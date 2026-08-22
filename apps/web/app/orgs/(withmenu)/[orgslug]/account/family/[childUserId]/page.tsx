import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import AccountFamilyChildActivity from '@components/Objects/Account/subpages/AccountFamilyChildActivity'

type ChildActivityPageProps = {
  params: Promise<{ orgslug: string; childUserId: string }>
}

const ChildActivityPage = async (props: ChildActivityPageProps) => {
  const params = await props.params
  const session = await getServerSession()

  // Browser-relative redirects only: the org slug is NEVER a URL path
  // segment (the proxy adds the /orgs/{slug} prefix) — same convention as
  // account/[subpage]/page.tsx.
  if (!session) {
    redirect(`/login?redirect=/account/family/${params.childUserId}`)
  }

  const childUserId = Number(params.childUserId)
  if (!Number.isInteger(childUserId) || childUserId <= 0) {
    redirect('/account/family')
  }

  return <AccountFamilyChildActivity childUserId={childUserId} />
}

export default ChildActivityPage
