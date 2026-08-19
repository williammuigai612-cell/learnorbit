import type React from 'react'
import { Metadata } from 'next'
import { OrgRootLayout } from '@components/Contexts/OrgRootLayout'
import { buildOrgFaviconMetadata } from '@lib/seo/orgFaviconMetadata'

// Dash-only now: the (withmenu) sub-tree moved to
// app/orgs/(withmenu)/[orgslug]/layout.tsx — see that file and
// docs/ARCHITECTURE.md § "Next.js dynamic-segment/route-group 404" for why.
// This still wraps app/orgs/[orgslug]/dash via the shared OrgRootLayout.

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

  return <OrgRootLayout orgslug={params.orgslug}>{props.children}</OrgRootLayout>
}
