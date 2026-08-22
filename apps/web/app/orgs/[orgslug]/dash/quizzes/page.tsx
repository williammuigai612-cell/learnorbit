import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { Metadata } from 'next'
import React from 'react'
import QuizzesHome from './client'

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
    title: 'Quizzes — ' + org.name,
    robots: {
      index: false,
      follow: false,
    },
  }
}

async function QuizzesPage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <QuizzesHome orgslug={orgslug} />
}

export default QuizzesPage
