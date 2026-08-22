'use client'

import { useQuery } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import { getOrgQuizProgress } from '@services/organizations/quizProgress'

/** The acting user's own quiz progress in this org (Basic progress
 * tracking, Phase 6H) — owner-only, so this needs an access token to fire,
 * unlike useQuizzes' public-capable listing. */
export function useQuizProgress(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.quizProgress.org(orgId!),
    queryFn: () => getOrgQuizProgress(orgId!, accessToken!),
    enabled: !!orgId && !!accessToken,
  })
}
