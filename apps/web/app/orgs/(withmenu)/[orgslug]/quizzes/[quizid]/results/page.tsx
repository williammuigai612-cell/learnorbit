import QuizResultsClient from './results'

const QuizResultsPage = async (params: any) => {
  const quizid = (await params.params).quizid
  const orgslug = (await params.params).orgslug

  return <QuizResultsClient quizid={quizid} orgslug={orgslug} />
}

export default QuizResultsPage
