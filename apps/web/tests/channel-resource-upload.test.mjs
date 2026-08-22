// Phase 5C: the creator upload flow orchestrates EXISTING, unmodified
// primitives only — course/chapter creation, the existing documentpdf
// Activity upload, and the Phase 5B ChannelResource API — mirroring
// channelVideoUpload.ts's Phase 2F orchestration exactly (see
// docs/ARCHITECTURE.md § "Academic Library (Phase 5A)").
//
// All of uploadChannelResource's collaborators are mocked so this test
// isolates exactly the orchestration: container course lookup/creation using
// its own marker (distinct from the video container), the documentpdf
// Activity upload, and that metadata (including the resource-only `year`
// field) reaches createChannelResource's payload, with publish firing when
// requested.

import { beforeEach, describe, expect, mock, test } from "bun:test";

const courseCalls = { getOrgCourses: [], createNewCourse: [], updateCourse: [] };
const chapterCalls = { create: [] };
const activityCalls = { create: [], update: [] };
const channelResourceCalls = { create: [], publish: [] };

mock.module("@services/courses/courses", () => ({
  createNewCourse: async (...args) => {
    courseCalls.createNewCourse.push(args);
    return { success: true, data: { id: 2, course_uuid: "course_resource_container" } };
  },
  getOrgCourses: async (...args) => {
    courseCalls.getOrgCourses.push(args);
    return [];
  },
  getCourseMetadata: async () => ({ chapters: [] }),
  updateCourse: async (...args) => {
    courseCalls.updateCourse.push(args);
    return { success: true };
  },
}));

mock.module("@services/courses/chapters", () => ({
  createChapter: async (...args) => {
    chapterCalls.create.push(args);
    return { id: 20 };
  },
}));

mock.module("@services/courses/activities", () => ({
  createFileActivity: async (...args) => {
    activityCalls.create.push(args);
    return { id: 55, activity_uuid: "activity_resource_test" };
  },
  updateActivity: async (...args) => {
    activityCalls.update.push(args);
    return {};
  },
}));

mock.module("@services/organizations/channelResources", () => ({
  createChannelResource: async (orgId, data, accessToken) => {
    channelResourceCalls.create.push({ orgId, data, accessToken });
    return { id: 77, published: false };
  },
  setChannelResourcePublished: async (orgId, channelResourceId, published, accessToken) => {
    channelResourceCalls.publish.push({ orgId, channelResourceId, published, accessToken });
  },
}));

const {
  uploadChannelResource,
  ensureChannelResourcesContainer,
  CHANNEL_RESOURCES_CONTAINER_MARKER,
} = await import("../services/organizations/channelResourceUpload.ts");

const baseInput = {
  orgId: 1,
  orgslug: "test-org",
  file: new File(["fake"], "paper.pdf", { type: "application/pdf" }),
  title: "2023 KCSE Mathematics Paper 1",
  visibility: "public",
  publish: false,
};

beforeEach(() => {
  courseCalls.getOrgCourses.length = 0;
  courseCalls.createNewCourse.length = 0;
  courseCalls.updateCourse.length = 0;
  chapterCalls.create.length = 0;
  activityCalls.create.length = 0;
  activityCalls.update.length = 0;
  channelResourceCalls.create.length = 0;
  channelResourceCalls.publish.length = 0;
});

describe("ensureChannelResourcesContainer", () => {
  test("creates a container course marked with the resource-only marker", async () => {
    await ensureChannelResourcesContainer(1, "test-org", "token");
    expect(courseCalls.createNewCourse).toHaveLength(1);
    expect(courseCalls.updateCourse).toHaveLength(1);
    const [, updatePayload] = courseCalls.updateCourse[0];
    expect(updatePayload.extra_metadata).toEqual({ [CHANNEL_RESOURCES_CONTAINER_MARKER]: true });
    expect(CHANNEL_RESOURCES_CONTAINER_MARKER).toBe("learnorbit_resource_container");
  });
});

describe("uploadChannelResource", () => {
  test("uploads the PDF via the existing documentpdf activity endpoint", async () => {
    await uploadChannelResource(baseInput, "token");
    expect(activityCalls.create).toHaveLength(1);
    const [file, type] = activityCalls.create[0];
    expect(type).toBe("documentpdf");
    expect(file.name).toBe("paper.pdf");
  });

  test("passes academic metadata including year to createChannelResource", async () => {
    await uploadChannelResource(
      { ...baseInput, subject: "Mathematics", level: "Form 4", year: "2023" },
      "token"
    );
    expect(channelResourceCalls.create).toHaveLength(1);
    const { data } = channelResourceCalls.create[0];
    expect(data.subject).toBe("Mathematics");
    expect(data.level).toBe("Form 4");
    expect(data.year).toBe("2023");
    expect(data.activity_id).toBe(55);
  });

  test("publish-now fires setChannelResourcePublished", async () => {
    const result = await uploadChannelResource({ ...baseInput, publish: true }, "token");
    expect(channelResourceCalls.publish).toHaveLength(1);
    expect(channelResourceCalls.publish[0].channelResourceId).toBe(77);
    expect(result.published).toBe(true);
  });

  test("draft upload does not publish", async () => {
    await uploadChannelResource(baseInput, "token");
    expect(channelResourceCalls.publish).toHaveLength(0);
  });
});
