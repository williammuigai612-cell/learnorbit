export const queryKeys = {
  org: {
    detail: (slug: string) => ['org', slug] as const,
    users: (orgId: number) => ['org', orgId, 'users'] as const,
    usage: (orgId: number) => ['org', orgId, 'usage'] as const,
    admins: (orgId: number) => ['org', orgId, 'admins'] as const,
    inviteCodes: (orgId: number) => ['org', orgId, 'inviteCodes'] as const,
    roles: (orgId: number) => ['org', orgId, 'roles'] as const,
    auditLogs: (orgId: number) => ['org', orgId, 'auditLogs'] as const,
    automations: (orgId: number) => ['org', orgId, 'automations'] as const,
    apiTokens: (orgId: number) => ['org', orgId, 'apiTokens'] as const,
    follow: (orgId: number) => ['org', orgId, 'follow'] as const,
  },
  courses: {
    list: (orgSlug: string) => ['courses', orgSlug] as const,
    detail: (uuid: string) => ['course', uuid] as const,
    meta: (uuid: string) => ['course', uuid, 'meta'] as const,
    byId: (id: number) => ['course', 'byId', id] as const,
    contributors: (uuid: string) => ['course', uuid, 'contributors'] as const,
    updates: (uuid: string) => ['course', uuid, 'updates'] as const,
    rights: (uuid: string) => ['course', uuid, 'rights'] as const,
  },
  activity: {
    detail: (uuid: string) => ['activity', uuid] as const,
    byId: (id: number) => ['activity', 'byId', id] as const,
    editorBootstrap: (uuid: string) => ['activity', uuid, 'editor-bootstrap'] as const,
    versions: (uuid: string) => ['activity', uuid, 'versions'] as const,
    state: (uuid: string) => ['activity', uuid, 'state'] as const,
  },
  channelVideos: {
    detail: (orgId: number, channelVideoId: number | string) =>
      ['channelVideo', orgId, channelVideoId] as const,
    // Phase 2G-3: an active filters object is appended to the key so each
    // filter combination gets its own cache entry. Omitting `filters` (or
    // passing none) keeps the original unfiltered key, and callers that
    // invalidate with just `list(orgId)` still catch every filtered variant
    // too — invalidateQueries matches by key prefix.
    list: (
      orgId: number,
      filters?: { subject?: string; topic?: string; level?: string; content_format?: string }
    ) =>
      filters && Object.keys(filters).length > 0
        ? (['channelVideo', orgId, 'list', filters] as const)
        : (['channelVideo', orgId, 'list'] as const),
    // Phase 4B
    like: (orgId: number, channelVideoId: number | string) =>
      ['channelVideo', orgId, channelVideoId, 'like'] as const,
    // Phase 4D
    save: (orgId: number, channelVideoId: number | string) =>
      ['channelVideo', orgId, channelVideoId, 'save'] as const,
    // Phase 4C. The Phase 9B `limit` segment separates the small preview
    // fetched while the panel is closed (badge only) from the full fetch
    // once it opens. Mutations update both entries at once by prefix-matching
    // this base key with setQueriesData — see useChannelVideoEngagement.ts.
    comments: (orgId: number, channelVideoId: number | string) =>
      ['channelVideo', orgId, channelVideoId, 'comments'] as const,
    commentsPage: (orgId: number, channelVideoId: number | string, limit: number) =>
      ['channelVideo', orgId, channelVideoId, 'comments', limit] as const,
    // Phase 4E
    share: (orgId: number, channelVideoId: number | string) =>
      ['channelVideo', orgId, channelVideoId, 'share'] as const,
  },
  channelResources: {
    detail: (orgId: number, channelResourceId: number | string) =>
      ['channelResource', orgId, channelResourceId] as const,
    // Phase 5C: mirrors channelVideos.list — an active filters object is
    // appended to the key so each filter combination gets its own cache
    // entry, while invalidating with just `list(orgId)` still catches every
    // filtered variant too (invalidateQueries matches by key prefix).
    list: (
      orgId: number,
      filters?: {
        subject?: string
        topic?: string
        level?: string
        institution_context?: string
        resource_type?: string
        year?: string
      }
    ) =>
      filters && Object.keys(filters).length > 0
        ? (['channelResource', orgId, 'list', filters] as const)
        : (['channelResource', orgId, 'list'] as const),
  },
  channelVideoReports: {
    // Phase 8B admin moderation queue — status is appended to the key so
    // each filtered tab (Open/Resolved/Dismissed/All) gets its own cache
    // entry, same convention as channelVideos.list's filters object.
    list: (orgId: number, status?: string) =>
      status
        ? (['channelVideoReport', orgId, 'list', status] as const)
        : (['channelVideoReport', orgId, 'list'] as const),
  },
  questions: {
    detail: (orgId: number, questionId: number | string) => ['question', orgId, questionId] as const,
    // Phase 6E-1: mirrors channelResources.list — an active filters object is
    // appended to the key so each filter combination gets its own cache
    // entry, while invalidating with just `list(orgId)` still catches every
    // filtered variant too (invalidateQueries matches by key prefix).
    list: (
      orgId: number,
      filters?: {
        subject?: string
        topic?: string
        level?: string
        institution_context?: string
        published?: boolean
      }
    ) =>
      filters && Object.keys(filters).length > 0
        ? (['question', orgId, 'list', filters] as const)
        : (['question', orgId, 'list'] as const),
  },
  quizzes: {
    detail: (orgId: number, quizId: number | string) => ['quiz', orgId, quizId] as const,
    // Phase 6E-2: mirrors questions.list — an active filters object is
    // appended to the key so each filter combination gets its own cache
    // entry, while invalidating with just `list(orgId)` still catches every
    // filtered variant too (invalidateQueries matches by key prefix).
    list: (
      orgId: number,
      filters?: {
        subject?: string
        topic?: string
        level?: string
        institution_context?: string
        quiz_type?: string
      }
    ) =>
      filters && Object.keys(filters).length > 0
        ? (['quiz', orgId, 'list', filters] as const)
        : (['quiz', orgId, 'list'] as const),
    // The attached-questions list for one quiz (Phase 6E-2's builder view) —
    // scoped by quiz id, not by org, since a quiz id already uniquely
    // identifies it (mirrors quizQuestions.list's own route shape).
    questions: (orgId: number, quizId: number | string) =>
      ['quiz', orgId, quizId, 'questions'] as const,
  },
  quizAttempts: {
    // Phase 6E-3 — a single attempt, in progress or graded. Scoped by
    // quiz_id + attempt_id, mirroring the backend's own route nesting
    // (GET /orgs/{org_id}/quizzes/{quiz_id}/attempts/{attempt_id}).
    detail: (orgId: number, quizId: number | string, attemptId: number | string) =>
      ['quizAttempt', orgId, quizId, attemptId] as const,
    // Phase 6G (Results) — the acting user's own attempt history for one
    // quiz. Separate top-level key (not nested under `detail`'s prefix) so
    // invalidating the list never has to know about individual attempt ids.
    list: (orgId: number, quizId: number | string) =>
      ['quizAttempt', 'list', orgId, quizId] as const,
  },
  trail: {
    org: (orgId: number) => ['trail', 'org', orgId] as const,
  },
  quizProgress: {
    // Phase 6H (Basic progress tracking) — the acting user's own
    // attempted-quiz aggregates for one org. Mirrors quizAttempts.list's
    // own shape (a single-user, single-org read).
    org: (orgId: number) => ['quizProgress', orgId] as const,
  },
  shorts: {
    // Global, cross-org queue (Phase 3E) — one cache entry, no per-org/filter
    // variants, mirroring the unscoped GET /shorts endpoint (Phase 3C).
    queue: () => ['shorts', 'queue'] as const,
  },
  feed: {
    // Personalized, cross-org home feed (Phase 4G) — one cache entry per
    // viewer, keyed by user id since content depends on the caller's follows
    // (unlike shorts.queue, which is unconditionally global).
    home: (userId: number | undefined) => ['feed', 'home', userId] as const,
  },
  notifications: {
    // In-app notifications (Phase 4H) — global, cross-org, keyed by viewer
    // (same rationale as feed.home: content is personal to the caller).
    list: (userId: number | undefined) => ['notifications', 'list', userId] as const,
    unreadCount: (userId: number | undefined) => ['notifications', 'unreadCount', userId] as const,
  },
  publicUsers: {
    // Phase 9B — another user's public profile (UserReadPublic via GET
    // /users/id/{id}), resolved for display only (name/username/avatar).
    // Keyed by user id alone, not by viewer: the endpoint returns the same
    // public projection to every caller, so two rows showing the same person
    // share one cache entry and one request.
    byId: (userId: number | undefined) => ['publicUser', userId] as const,
  },
  parentLinks: {
    // Phase 7B-frontend — pending parent-link requests directed at the
    // caller as a child. Global, cross-org, keyed by viewer (same rationale
    // as notifications.list).
    pending: (userId: number | undefined) => ['parentLinks', 'pending', userId] as const,
    // Phase 7C — the caller's own APPROVED links, on either side.
    mine: (userId: number | undefined) => ['parentLinks', 'mine', userId] as const,
    // Phase 7C — a linked child's cross-org quiz progress.
    childProgress: (childUserId: number | undefined) =>
      ['parentLinks', 'childProgress', childUserId] as const,
  },
  folders: {
    list: (orgId: number) => ['folders', orgId] as const,
    detail: (uuid: string) => ['folder', uuid] as const,
  },
  media: {
    list: (orgId: number) => ['media', orgId] as const,
    detail: (uuid: string) => ['media', uuid] as const,
  },
  community: {
    list: (orgId: number, page?: number) => ['communities', orgId, page] as const,
    detail: (uuid: string) => ['community', uuid] as const,
    rights: (uuid: string) => ['community', uuid, 'rights'] as const,
    discussions: (uuid: string, sort: string, page: number) => ['community', uuid, 'discussions', sort, page] as const,
    byCourse: (courseUuid: string) => ['community', 'byCourse', courseUuid] as const,
  },
  discussion: {
    detail: (uuid: string) => ['discussion', uuid] as const,
    comments: (uuid: string, page: number) => ['discussion', uuid, 'comments', page] as const,
    reactions: (uuid: string) => ['discussion', uuid, 'reactions'] as const,
  },
  assignments: {
    list: (orgSlug: string) => ['assignments', orgSlug] as const,
    detail: (uuid: string) => ['assignment', uuid] as const,
    tasks: (uuid: string) => ['assignment', uuid, 'tasks'] as const,
    submission: (uuid: string) => ['assignment', uuid, 'submission', 'me'] as const,
    taskSubmission: (uuid: string) => ['assignment', uuid, 'task-submission', 'me'] as const,
    analytics: (uuid: string) => ['assignment', uuid, 'analytics'] as const,
    allSubmissions: (uuid: string) => ['assignment', uuid, 'submissions'] as const,
  },
  usergroups: {
    list: (orgId: number) => ['usergroups', orgId] as const,
    resources: (ugId: string, orgId: number) => ['usergroup', ugId, 'resources', orgId] as const,
    members: (ugId: string) => ['usergroup', ugId, 'members'] as const,
  },
  playgrounds: {
    list: (orgSlug: string | number) => ['playgrounds', orgSlug] as const,
    detail: (uuid: string) => ['playground', uuid] as const,
  },
  boards: {
    list: (orgSlug: string | number) => ['boards', orgSlug] as const,
    detail: (uuid: string) => ['board', uuid] as const,
    members: (uuid: string) => ['board', uuid, 'members'] as const,
  },
  podcasts: {
    list: (orgSlug: string) => ['podcasts', orgSlug] as const,
    detail: (uuid: string) => ['podcast', uuid] as const,
    meta: (uuid: string) => ['podcast', uuid, 'meta'] as const,
    episodes: (uuid: string) => ['podcast', uuid, 'episodes'] as const,
  },
  ai: {
    ragSessions: (orgSlug: string) => ['ai', 'rag', 'sessions', orgSlug] as const,
  },
  certifications: {
    detail: (uuid: string) => ['certification', uuid] as const,
    byCourse: (courseUuid: string) => ['certification', 'byCourse', courseUuid] as const,
  },
  analytics: {
    pipe: (orgId: number, pipeName: string, params: string) => ['analytics', orgId, 'pipe', pipeName, params] as const,
    detail: (orgId: number, queryName: string, params: string) => ['analytics', orgId, 'detail', queryName, params] as const,
    db: (orgId: number, queryName: string, params: string) => ['analytics', orgId, 'db', queryName, params] as const,
    planInfo: (orgId: number) => ['analytics', orgId, 'planInfo'] as const,
    status: () => ['analytics', 'status'] as const,
    coursePipe: (orgId: number, courseUuid: string, pipeName: string, params: string) => ['analytics', orgId, 'course', courseUuid, 'pipe', pipeName, params] as const,
    courseDetail: (orgId: number, courseUuid: string, queryName: string, params: string) => ['analytics', orgId, 'course', courseUuid, 'detail', queryName, params] as const,
  },
  audit: {
    user: (orgId: number, userId: number, days: number) => ['audit', orgId, 'user', userId, days] as const,
    summary: (orgId: number, userIds: string, days: number) => ['audit', orgId, 'summary', userIds, days] as const,
  },
  courseUsergroups: {
    resources: (courseUuid: string, orgId: number) => ['courseUsergroups', courseUuid, orgId] as const,
  },
  superadmin: {
    status: () => ['superadmin', 'status'] as const,
    orgs: () => ['superadmin', 'orgs'] as const,
    users: () => ['superadmin', 'users'] as const,
    analytics: () => ['superadmin', 'analytics'] as const,
    apiTokens: () => ['superadmin', 'apiTokens'] as const,
  },
  payments: {
    configs: (orgId: number) => ['payments', orgId, 'configs'] as const,
    offers: (orgId: number) => ['payments', orgId, 'offers'] as const,
    customers: (orgId: number) => ['payments', orgId, 'customers'] as const,
    groups: (orgId: number) => ['payments', orgId, 'groups'] as const,
  },
}
