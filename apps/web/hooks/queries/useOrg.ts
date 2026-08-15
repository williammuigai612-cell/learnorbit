'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import { getAPIUrl } from '@services/config/config'
import { apiFetch } from '@services/utils/ts/requests'
import {
  followOrganization,
  getOrganizationContextInfo,
  unfollowOrganization,
} from '@services/organizations/orgs'

export function useOrg(orgSlug: string) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.org.detail(orgSlug),
    queryFn: () => getOrganizationContextInfo(orgSlug, {}, accessToken),
    enabled: !!orgSlug,
    staleTime: 5 * 60_000,
  })
}

export interface OrgFollowStatus {
  is_following: boolean
  follower_count: number
}

// Anonymous visitors can see the follower count; is_following is only ever
// true for the authenticated caller, so the query stays enabled without a
// token and simply omits the Authorization header.
export function useOrgFollowStatus(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery<OrgFollowStatus>({
    queryKey: queryKeys.org.follow(orgId!),
    queryFn: () => apiFetch(`${getAPIUrl()}orgs/${orgId}/follow`, accessToken),
    enabled: !!orgId,
    staleTime: 30_000,
  })
}

export function useFollowOrg(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => followOrganization(orgId, accessToken!),
    onSuccess: (data: OrgFollowStatus) => {
      queryClient.setQueryData(queryKeys.org.follow(orgId!), data)
    },
  })
}

export function useUnfollowOrg(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => unfollowOrganization(orgId, accessToken!),
    onSuccess: (data: OrgFollowStatus) => {
      queryClient.setQueryData(queryKeys.org.follow(orgId!), data)
    },
  })
}
