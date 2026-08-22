import ResourceViewClient from './resource'

const ResourceViewPage = async (params: any) => {
  const channelresourceid = (await params.params).channelresourceid
  const orgslug = (await params.params).orgslug

  return <ResourceViewClient channelresourceid={channelresourceid} orgslug={orgslug} />
}

export default ResourceViewPage
