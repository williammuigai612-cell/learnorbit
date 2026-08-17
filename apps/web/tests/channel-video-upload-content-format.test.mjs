// Phase 3F: the creator upload flow must be able to create a Short by
// passing content_format="short" through to the existing ChannelVideo create
// call — no new upload/storage system, just this one extra field flowing
// through the existing Phase 2F orchestration in channelVideoUpload.ts.
//
// All of uploadChannelVideo's collaborators (container course lookup, video
// Activity upload, ChannelVideo create/publish) are mocked so this test
// isolates exactly one thing: does content_format reach createChannelVideo's
// payload, and does publish still fire when requested.

import { beforeEach, describe, expect, mock, test } from "bun:test";

const courseCalls = { getOrgCourses: [] };
const activityCalls = { create: [], update: [] };
const channelVideoCalls = { create: [], publish: [] };

mock.module("@services/courses/courses", () => ({
  createNewCourse: async () => ({
    success: true,
    data: { id: 1, course_uuid: "course_container" },
  }),
  getOrgCourses: async (...args) => {
    courseCalls.getOrgCourses.push(args);
    return [
      { id: 1, course_uuid: "course_container", extra_metadata: { learnorbit_channel_container: true } },
    ];
  },
  getCourseMetadata: async () => ({ chapters: [{ id: 10 }] }),
  updateCourse: async () => ({ success: true }),
}));

mock.module("@services/courses/chapters", () => ({
  createChapter: async () => ({ id: 10 }),
}));

mock.module("@services/courses/activities", () => ({
  createVideoActivityWithProgress: async (...args) => {
    activityCalls.create.push(args);
    return { id: 42, activity_uuid: "activity_test" };
  },
  updateActivity: async (...args) => {
    activityCalls.update.push(args);
    return {};
  },
}));

mock.module("@services/organizations/channelVideos", () => ({
  createChannelVideo: async (orgId, data, accessToken) => {
    channelVideoCalls.create.push({ orgId, data, accessToken });
    return { id: 99, published: false, content_format: data.content_format || "long" };
  },
  setChannelVideoPublished: async (orgId, channelVideoId, published, accessToken) => {
    channelVideoCalls.publish.push({ orgId, channelVideoId, published, accessToken });
  },
}));

const { uploadChannelVideo } = await import("../services/organizations/channelVideoUpload.ts");

const baseInput = {
  orgId: 1,
  orgslug: "test-org",
  file: new File(["fake"], "video.mp4", { type: "video/mp4" }),
  title: "A test video",
  visibility: "public",
  publish: false,
};

beforeEach(() => {
  courseCalls.getOrgCourses.length = 0;
  activityCalls.create.length = 0;
  activityCalls.update.length = 0;
  channelVideoCalls.create.length = 0;
  channelVideoCalls.publish.length = 0;
});

describe("uploadChannelVideo content_format", () => {
  test("content_format: 'short' is sent to createChannelVideo", async () => {
    await uploadChannelVideo({ ...baseInput, content_format: "short" }, "token");
    expect(channelVideoCalls.create).toHaveLength(1);
    expect(channelVideoCalls.create[0].data.content_format).toBe("short");
  });

  test("omitting content_format defaults to 'long'", async () => {
    await uploadChannelVideo({ ...baseInput }, "token");
    expect(channelVideoCalls.create).toHaveLength(1);
    expect(channelVideoCalls.create[0].data.content_format).toBe("long");
  });

  test("explicit content_format: 'long' stays 'long'", async () => {
    await uploadChannelVideo({ ...baseInput, content_format: "long" }, "token");
    expect(channelVideoCalls.create[0].data.content_format).toBe("long");
  });

  test("publish-now still fires for a Short upload", async () => {
    const result = await uploadChannelVideo(
      { ...baseInput, content_format: "short", publish: true },
      "token"
    );
    expect(channelVideoCalls.publish).toHaveLength(1);
    expect(channelVideoCalls.publish[0].channelVideoId).toBe(99);
    expect(result.published).toBe(true);
  });
});
