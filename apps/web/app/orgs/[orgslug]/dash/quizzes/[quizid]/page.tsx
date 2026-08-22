import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { Metadata } from 'next'
import React from 'react'
import QuizBuilder from './client'

type MetadataProps = {
  params: Promise<{ orgslug: string; quizid: string }>
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 120,
    tags: ['organizations'],
  })

  return {
    title: 'Edit quiz — ' + org.name,
    robots: {
      index: false,
      follow: false,
    },
  }
}

async function QuizBuilderPage(props: { params: Promise<{ orgslug: string; quizid: string }> }) {
  const { orgslug, quizid } = await props.params
  return <QuizBuilder orgslug={orgslug} quizId={Number(quizid)} />
}

export default QuizBuilderPage
