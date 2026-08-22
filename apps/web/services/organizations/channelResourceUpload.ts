import {
  createNewCourse,
  getOrgCourses,
  getCourseMetadata,
  updateCourse,
} from '@services/courses/courses'
import { createChapter } from '@services/courses/chapters'
import { createFileActivity, updateActivity } from '@services/courses/activities'
import { createChannelResource, setChannelResourcePublished } from '@services/organizations/channelResources'

/*
 Creator upload flow (Phase 5C) — orchestrates EXISTING, unmodified LearnHouse
 primitives only: course/chapter creation, the existing documentpdf Activity
 upload endpoint, and the Phase 5B ChannelResource API. No new
 storage/upload/validation code — mirrors channelVideoUpload.ts's Phase 2F
 orchestration exactly.

 Per docs/ARCHITECTURE.md § "Academic Library (Phase 5A)": resources get their
 OWN lazily-created hidden container course ("Channel Resources"), separate
 from the "Channel Videos" container, so PDFs aren't mislabeled as videos in
 an admin's course list. Same public+published container shape as the video
 container so `check_resource_access` allows anonymous viewing once the
 creator publishes their resource.
*/

export const CHANNEL_RESOURCES_CONTAINER_MARKER = 'learnorbit_resource_container'
const CONTAINER_MARKER = CHANNEL_RESOURCES_CONTAINER_MARKER
const CONTAINER_COURSE_NAME = 'Channel Resources'
const CONTAINER_CHAPTER_NAME = 'Resources'

interface ContainerRef {
  course_id: number
  chapter_id: number
}

/**
 * Finds this channel's hidden resource-container course (by the
 * extra_metadata marker) or creates one — public + published so its
 * resources are viewable, unlisted from a curriculum standpoint (see module
 * docstring). Returns the id of a chapter inside it, creating one if the
 * course is brand new.
 *
 * Known limitation: same as ensureChannelVideosContainer — two admins
 * uploading for the very first time simultaneously could each create a
 * container course (no locking). Acceptable for V1.
 */
export async function ensureChannelResourcesContainer(
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
        description: 'Resources published to this channel.',
        visibility: true,
        learnings: '',
        tags: '',
      },
      null,
      access_token
    )
    if (!created?.success || !created?.data?.course_uuid) {
      throw new Error(created?.data?.detail || 'Could not set up this channel for resource uploads.')
    }
    course_id = created.data.id
    course_uuid = created.data.course_uuid
    const published = await updateCourse(
      course_uuid,
      { published: true, extra_metadata: { [CONTAINER_MARKER]: true } },
      access_token
    )
    if (!published?.success) {
      throw new Error('Could not set up this channel for resource uploads.')
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

export interface UploadChannelResourceInput {
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
  year?: string
  visibility: 'public' | 'unlisted'
  publish: boolean
}

/** Full creator upload flow: container course/chapter → documentpdf Activity
 * upload (existing endpoint) → ChannelResource post → optional publish. */
export async function uploadChannelResource(
  input: UploadChannelResourceInput,
  access_token: string
) {
  const { chapter_id } = await ensureChannelResourcesContainer(input.orgId, input.orgslug, access_token)

  const activity = await createFileActivity(
    input.file,
    'documentpdf',
    { name: input.title },
    chapter_id,
    access_token
  )

  // Same rationale as uploadChannelVideo: the underlying Activity's own
  // `published` flag carries no meaning of its own outside this
  // ChannelResource — the ChannelResource's own `published`/`visibility`
  // fields are the single source of truth for who can see it, and if this
  // stayed false the uploading admin couldn't even preview their own draft.
  await updateActivity({ published: true }, activity.activity_uuid, access_token)

  const channelResource = await createChannelResource(
    input.orgId,
    {
      activity_id: activity.id,
      title: input.title,
      description: input.description || undefined,
      visibility: input.visibility,
      subject: input.subject || undefined,
      topic: input.topic || undefined,
      level: input.level || undefined,
      institution_context: input.institution_context || undefined,
      resource_type: input.resource_type || undefined,
      year: input.year || undefined,
    },
    access_token
  )

  if (input.publish) {
    await setChannelResourcePublished(input.orgId, channelResource.id, true, access_token)
    channelResource.published = true
  }

  return channelResource
}
