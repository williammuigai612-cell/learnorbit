import ShortsIndexClient from './shorts-index'

const ShortsIndexPage = async (params: any) => {
  const orgslug = (await params.params).orgslug

  return <ShortsIndexClient orgslug={orgslug} />
}

export default ShortsIndexPage
