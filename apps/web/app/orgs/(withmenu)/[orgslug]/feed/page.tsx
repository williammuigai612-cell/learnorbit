import HomeFeedClient from './feed-client'

const HomeFeedPage = async (params: any) => {
  const orgslug = (await params.params).orgslug

  return <HomeFeedClient orgslug={orgslug} />
}

export default HomeFeedPage
