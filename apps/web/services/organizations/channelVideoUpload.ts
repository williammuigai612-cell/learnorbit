import {
  createNewCourse,
  getOrgCourses,
  getCourseMetadata,
  updateCourse,
} from '@services/courses/courses'
import { createChapter } from '@services/courses/chapters'
import { createVideoActivityWithProgress, updateActivity } from '@services/courses/activities'
import { createChannelVideo, setChannelVideoPublished } from '@services/organizations/channelVideos'

/*
 Creator upload flow (Phase 2F) — orchestrates EXISTING, unmodified LearnHouse
 primitives only: course creation, chapter creation, the existing
 XHR-with-progress hosted-video-activity upload, and the Phase 2C ChannelVideo
 API. No new storage, upload, or processing code.

 Per docs/ARCHITECTURE.md § "Videos (Phase 2A)": "a video is always a lesson
 inside a structured course today" — there is no course-less Activity in
 LearnHouse (Activity.course_id is required). A LearnOrbit channel video isn't
 conceptually a course, so rather than surface course/chapter picking to the
 creator (out of scope for the channel-video product concept per docs/PRD.md),
 each channel gets a single, lazily-created, hidden container course
 ("Channel Videos") that every one of its channel-video Activities lives in.
 It's marked via `extra_metadata.learnorbit_channel_container` (a plain JSONB
 field the Course model already has — no schema change) and kept
 public+published so `check_resource_access` (the same RBAC an anonymous
 course viewer goes through) allows anonymous playback once the creator
 publishes their video, exactly like Phase 2D's watch page already assumes.
*/

export const CHANNEL_VIDEOS_CONTAINER_MARKER = 'learnorbit_channel_container'
const CONTAINER_MARKER = CHANNEL_VIDEOS_CONTAINER_MARKER
const CONTAINER_COURSE_NAME = 'Channel Videos'
const CONTAINER_CHAPTER_NAME = 'Videos'

interface ContainerRef {
  course_id: number
  chapter_id: number
}

/**
 * Finds this channel's hidden video-container course (by the extra_metadata
 * marker) or creates one — public + published so its videos are watchable,
 * unlisted from a curriculum standpoint (see module docstring). Returns the
 * id of a chapter inside it, creating one if the course is brand new.
 *
 * Known limitation: two admins uploading for the very first time
 * simultaneously could each create a container course (no locking) — the
 * next upload would then just pick whichever one the list endpoint returns
 * first. Acceptable for V1; not a correctness issue, just a minor tidiness
 * one.
 */
export async function ensureChannelVideosContainer(
  orgId: number,
  orgslug: string,
  access_token: string
): Promise<ContainerRef> {
  const courses = await getOrgCourses(orgslug, {}, access_token, true)
  const existing = (Array.isArray(courses) ? courses : []).find(
    (c: any) => c?.extra_metadata?.[CONTAINER_MARKER] === true
  )

  let course_id: number
  let course_uuid: string

  if (existing) {
    course_id = existing.id
    course_uuid = existing.course_uuid
  } else {
    const created = await createNewCourse(
      String(orgId),
      {
        name: CONTAINER_COURSE_NAME,
        description: 'Videos published to this channel.',
        visibility: true,
        learnings: '',
        tags: '',
      },
      null,
      access_token
    )
    if (!created?.success || !created?.data?.course_uuid) {
      throw new Error(created?.data?.detail || 'Could not set up this channel for video uploads.')
    }
    course_id = created.data.id
    course_uuid = created.data.course_uuid
    const published = await updateCourse(
      course_uuid,
      { published: true, extra_metadata: { [CONTAINER_MARKER]: true } },
      access_token
    )
    if (!published?.success) {
      throw new Error('Could not set up this channel for video uploads.')
    }
  }

  const meta = await getCourseMetadata(
    course_uuid.replace('course_', ''),
    {},
    access_token,
    { slim: false }
  )
  const chapter = meta?.chapters?.[0]
  if (chapter?.id) {
    return { course_id, chapter_id: chapter.id }
  }

  const newChapter = await createChapter(
    { name: CONTAINER_CHAPTER_NAME, org_id: orgId, course_id },
    access_token
  )
  return { course_id, chapter_id: newChapter.id }
}

export interface UploadChannelVideoInput {
  orgId: number
  orgslug: string
  file: File
  title: string
  description?: string
  subject?: string
  topic?: string
  level?: string
  institution_context?: string
  resource_type?: string
  visibility: 'public' | 'unlisted'
  publish: boolean
  /** Phase 3F: 'short' creates a Short via the same upload pipeline. Omitted
   * defaults to 'long' — see ChannelVideoCreateInput. */
  content_format?: 'long' | 'short'
}

/** Full creator upload flow: container course/chapter → video Activity upload
 * (existing XHR-with-progress path) → ChannelVideo post → optional publish. */
export async function uploadChannelVideo(
  input: UploadChannelVideoInput,
  access_token: string,
  onProgress?: (_percent: number) => void
) {
  const { chapter_id } = await ensureChannelVideosContainer(input.orgId, input.orgslug, access_token)

  const activity = await createVideoActivityWithProgress(
    input.file,
    {
      name: input.title,
      details: { startTime: 0, endTime: null, autoplay: false, muted: false },
    },
    chapter_id,
    access_token,
    onProgress || (() => {})
  )

  // The underlying Activity's own `published` flag is set unconditionally —
  // it's never reused outside this ChannelVideo, so it carries no meaning of
  // its own here. The ChannelVideo's `published`/`visibility` fields (below)
  // are the actual, single source of truth for who can see this video: the
  // Phase 2C API already gates GET-by-id on them (public+published for
  // anyone, everything for this channel's owner/admins), and Phase 2D's
  // watch page separately refuses to render an unpublished Activity — if
  // this stayed false for a draft, even the uploading admin couldn't preview
  // their own draft.
  await updateActivity({ published: true }, activity.activity_uuid, access_token)

  const channelVideo = await createChannelVideo(
    input.orgId,
    {
      activity_id: activity.id,
      title: input.title,
      description: input.description || undefined,
      visibility: input.visibility,
      content_format: input.content_format || 'long',
      subject: input.subject || undefined,
      topic: input.topic || undefined,
      level: input.level || undefined,
      institution_context: input.institution_context || undefined,
      resource_type: input.resource_type || undefined,
    },
    access_token
  )

  if (input.publish) {
    await setChannelVideoPublished(input.orgId, channelVideo.id, true, access_token)
    channelVideo.published = true
  }

  return channelVideo
}
