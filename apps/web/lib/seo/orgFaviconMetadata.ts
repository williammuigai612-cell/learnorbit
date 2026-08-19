import { Metadata } from 'next'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getOrgFaviconMediaDirectory } from '@services/media/media'

/**
 * Shared `generateMetadata` body for both org-scoped root layouts
 * (`app/orgs/(withmenu)/[orgslug]/layout.tsx` and `app/orgs/[orgslug]/layout.tsx`
 * for dash) — kept in one place so the org-scoped route tree can be split
 * across two physical layout files (see docs/ARCHITECTURE.md § "Next.js
 * dynamic-segment/route-group 404" for why) without duplicating this lookup.
 */
export async function buildOrgFaviconMetadata(orgslug: string): Promise<Metadata> {
  try {
    const org = await getOrganizationContextInfo(orgslug, {
      revalidate: 86400,
      tags: ['organizations'],
    })
    const faviconImage = org?.config?.config?.customization?.general?.favicon_image || org?.config?.config?.general?.favicon_image
    if (faviconImage) {
      return {
        icons: { icon: getOrgFaviconMediaDirectory(org.org_uuid, faviconImage) },
      }
    }
  } catch {
    // A favicon lookup failure must not break the page's metadata.
  }
  return {}
}
