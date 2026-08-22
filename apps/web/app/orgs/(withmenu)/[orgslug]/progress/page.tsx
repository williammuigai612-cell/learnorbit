import ProgressClient from './progress'

const ProgressPage = async (params: any) => {
  const orgslug = (await params.params).orgslug

  return <ProgressClient orgslug={orgslug} />
}

export default ProgressPage
