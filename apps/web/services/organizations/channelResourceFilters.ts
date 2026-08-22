/*
 Pure helpers for Phase 5C channel resource filtering. Kept dependency-free
 (no fetch, no getAPIUrl) so they're directly unit-testable — see
 tests/channel-resource-filters.test.mjs. Mirrors channelVideoFilters.ts's
 shape exactly, extended with the two Academic Library-only fields
 (institution_context, resource_type) plus year (see
 docs/ARCHITECTURE.md § "Academic Library (Phase 5A)").
*/

export interface ChannelResourceFilters {
  subject?: string
  topic?: string
  level?: string
  institution_context?: string
  resource_type?: string
  year?: string
}

const FILTER_KEYS: (keyof ChannelResourceFilters)[] = [
  'subject',
  'topic',
  'level',
  'institution_context',
  'resource_type',
  'year',
]

/** Drops empty/whitespace-only values so `{ subject: '' }` behaves like "no
 * filter" — keeps query keys and query params from treating "" as real. */
export function normalizeChannelResourceFilters(
  filters: ChannelResourceFilters | undefined
): ChannelResourceFilters | undefined {
  if (!filters) return undefined
  const normalized: ChannelResourceFilters = {}
  for (const key of FILTER_KEYS) {
    const value = filters[key]
    if (value && value.trim()) (normalized as Record<string, string>)[key] = value
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined
}

/** Builds the `?subject=...&level=...` suffix the backend's existing
 * GET /orgs/{org_id}/resources query params expect. Empty string when there
 * are no active filters. */
export function buildChannelResourceQueryParams(filters: ChannelResourceFilters | undefined): string {
  const normalized = normalizeChannelResourceFilters(filters)
  if (!normalized) return ''
  const params = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = normalized[key]
    if (value) params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export interface ChannelResourceFilterOptions {
  subjects: string[]
  levels: string[]
  institutions: string[]
  resourceTypes: string[]
}

/** Distinct, alphabetically-sorted values pulled from a channel's full
 * (unfiltered) resource list — used to populate the filter dropdowns so
 * options never disappear out from under a selection already made. Limited
 * to subject/level/institution/type per docs/DESIGN_SYSTEM.md §18's "Resource
 * filters" spec (topic and year are supported server-side but not surfaced
 * as filter dropdowns). */
export function getChannelResourceFilterOptions(
  resources:
    | Array<{
        subject?: string | null
        level?: string | null
        institution_context?: string | null
        resource_type?: string | null
      }>
    | undefined
): ChannelResourceFilterOptions {
  const subjects = new Set<string>()
  const levels = new Set<string>()
  const institutions = new Set<string>()
  const resourceTypes = new Set<string>()
  for (const resource of resources || []) {
    if (resource?.subject) subjects.add(resource.subject)
    if (resource?.level) levels.add(resource.level)
    if (resource?.institution_context) institutions.add(resource.institution_context)
    if (resource?.resource_type) resourceTypes.add(resource.resource_type)
  }
  const sort = (values: Set<string>) => Array.from(values).sort((a, b) => a.localeCompare(b))
  return {
    subjects: sort(subjects),
    levels: sort(levels),
    institutions: sort(institutions),
    resourceTypes: sort(resourceTypes),
  }
}
