import VideoWatchClient from './video'

const VideoWatchPage = async (params: any) => {
  const channelvideoid = (await params.params).channelvideoid
  const orgslug = (await params.params).orgslug

  return <VideoWatchClient channelvideoid={channelvideoid} orgslug={orgslug} />
}

export default VideoWatchPage
