import 'server-only'
import {
  getLEARNHOUSE_DOMAIN_VAL,
  getLEARNHOUSE_HTTP_PROTOCOL_VAL,
} from '@services/config/config'

/**
 * The deployment's own origin, for SERVER-side requests to the API.
 *
 * Server actions and route handlers build their own fetches, so no browser sets
 * an `Origin` on them. The API's CSRF middleware refuses state-changing requests
 * that carry neither `Origin` nor `Referer`, so these calls need the configured
 * origin supplied explicitly.
 *
 * Derived from the existing NEXT_PUBLIC_LEARNHOUSE_HTTPS / _DOMAIN config — no
 * new environment variable, and no hardcoded domain.
 */
export function getServerOrigin(): string {
  const protocol = getLEARNHOUSE_HTTP_PROTOCOL_VAL()
  const domain = getLEARNHOUSE_DOMAIN_VAL()
  return `${protocol}${domain}`.replace(/\/+$/, '')
}

/**
 * Add this deployment's `Origin` to a request built on the server.
 *
 * Deliberately a wrapper rather than a change to `RequestBodyWithAuthHeader`:
 * that helper is shared with browser code, where `Origin` is a forbidden header
 * name that fetch silently drops — setting it there would be dead code that
 * reads as protection. `import 'server-only'` makes using this from a client
 * bundle a build error.
 */
export function withServerOrigin(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers as HeadersInit | undefined)
  headers.set('Origin', getServerOrigin())
  return { ...init, headers }
}
