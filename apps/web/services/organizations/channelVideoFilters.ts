/*
 Pure helpers for Phase 2G-3 channel video filtering. Kept dependency-free
 (no fetch, no getAPIUrl) so they're directly unit-testable — see
 tests/channel-video-filters.test.mjs.
*/

export interface ChannelVideoFilters {
  subject?: string
  topic?: string
  level?: string
}

const FILTER_KEYS: (keyof ChannelVideoFilters)[] = ['subject', 'topic', 'level']

/** Drops empty/whitespace-only values so `{ subject: '' }` behaves like "no
 * filter" — keeps query keys and query params from treating "" as real. */
export function normalizeChannelVideoFilters(
  filters: ChannelVideoFilters | undefined
): ChannelVideoFilters | undefined {
  if (!filters) return undefined
  const normalized: ChannelVideoFilters = {}
  for (const key of FILTER_KEYS) {
    const value = filters[key]
    if (value && value.trim()) normalized[key] = value
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined
}

/** Builds the `?subject=...&topic=...` suffix the backend's existing
 * GET /orgs/{org_id}/videos query params expect. Empty string when there are
 * no active filters. */
export function buildChannelVideoQueryParams(filters: ChannelVideoFilters | undefined): string {
  const normalized = normalizeChannelVideoFilters(filters)
  if (!normalized) return ''
  const params = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = normalized[key]
    if (value) params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export interface ChannelVideoFilterOptions {
  subjects: string[]
  topics: string[]
  levels: string[]
}

/** Distinct, alphabetically-sorted values pulled from a channel's full
 * (unfiltered) video list — used to populate the filter dropdowns so options
 * never disappear out from under a selection already made. */
export function getChannelVideoFilterOptions(
  videos: Array<{ subject?: string | null; topic?: string | null; level?: string | null }> | undefined
): ChannelVideoFilterOptions {
  const subjects = new Set<string>()
  const topics = new Set<string>()
  const levels = new Set<string>()
  for (const video of videos || []) {
    if (video?.subject) subjects.add(video.subject)
    if (video?.topic) topics.add(video.topic)
    if (video?.level) levels.add(video.level)
  }
  const sort = (values: Set<string>) => Array.from(values).sort((a, b) => a.localeCompare(b))
  return { subjects: sort(subjects), topics: sort(topics), levels: sort(levels) }
}
