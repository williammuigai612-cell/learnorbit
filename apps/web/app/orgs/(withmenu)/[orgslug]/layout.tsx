import type React from 'react'
import { Metadata } from 'next'
import { OrgRootLayout } from '@components/Contexts/OrgRootLayout'
import { OrgMenuChrome } from '@components/Objects/Menus/OrgMenuChrome'
import { buildOrgFaviconMetadata } from '@lib/seo/orgFaviconMetadata'

// This route group sits BEFORE the [orgslug] dynamic segment deliberately —
// [orgslug]/(withmenu)/page.tsx used to 404 under Next.js 16.2.9 (every route
// shaped [dynamicSegment]/(routeGroup)/page.tsx did). See
// docs/ARCHITECTURE.md § "Next.js dynamic-segment/route-group 404" for the
// investigation. Composes the same OrgProvider shell app/orgs/[orgslug]/layout.tsx
// (dash) uses, plus this tree's menu/sidebar/banner chrome (OrgMenuChrome).

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgslug: string }>
}): Promise<Metadata> {
  const { orgslug } = await params
  return buildOrgFaviconMetadata(orgslug)
}

export default async function RootLayout(props: {
  children: React.ReactNode
  params: Promise<{ orgslug: string }>
}) {
  const params = await props.params

  return (
    <OrgRootLayout orgslug={params.orgslug}>
      <OrgMenuChrome orgslug={params.orgslug}>{props.children}</OrgMenuChrome>
    </OrgRootLayout>
  )
}
