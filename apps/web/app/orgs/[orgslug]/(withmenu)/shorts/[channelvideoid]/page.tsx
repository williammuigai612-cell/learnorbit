import ShortViewerClient from './short'

const ShortViewerPage = async (params: any) => {
  const channelvideoid = (await params.params).channelvideoid
  const orgslug = (await params.params).orgslug

  return <ShortViewerClient channelvideoid={channelvideoid} orgslug={orgslug} />
}

export default ShortViewerPage
