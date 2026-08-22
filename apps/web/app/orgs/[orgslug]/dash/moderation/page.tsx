import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { Metadata } from 'next'
import React from 'react'
import ModerationHome from './client'

type MetadataProps = {
  params: Promise<{ orgslug: string }>
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 120,
    tags: ['organizations'],
  })

  return {
    title: 'Moderation — ' + org.name,
    robots: {
      index: false,
      follow: false,
    },
  }
}

async function ModerationPage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <ModerationHome orgslug={orgslug} />
}

export default ModerationPage
