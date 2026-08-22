import QuizViewClient from './quiz'

const QuizViewPage = async (params: any) => {
  const quizid = (await params.params).quizid
  const orgslug = (await params.params).orgslug

  return <QuizViewClient quizid={quizid} orgslug={orgslug} />
}

export default QuizViewPage
