import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

/*
 Fetcher for the Phase 8C organization verification toggle. Wraps
 PATCH /orgs/{org_id}/verification — superadmin-only end to end (see
 services/orgs/verification.py's set_org_verification) — with
 `errorHandling` so a 401/403/404 surfaces as a thrown, status-tagged
 error rather than a swallowed body. Mirrors channelVideoReports.ts's
 fetcher shape.
*/

export async function setOrgVerification(
  org_id: number,
  is_verified: boolean,
  access_token: string
): Promise<any> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/verification`,
    RequestBodyWithAuthHeader('PATCH', { is_verified }, null, access_token)
  )
  return errorHandling(result)
}
