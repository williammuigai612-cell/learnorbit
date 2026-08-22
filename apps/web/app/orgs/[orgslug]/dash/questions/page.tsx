import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { Metadata } from 'next'
import React from 'react'
import QuestionsHome from './client'

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
    title: 'Question bank — ' + org.name,
    robots: {
      index: false,
      follow: false,
    },
  }
}

async function QuestionsPage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <QuestionsHome orgslug={orgslug} />
}

export default QuestionsPage
