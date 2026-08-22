import QuizAttemptClient from './attempt'

const QuizAttemptPage = async (params: any) => {
  const quizid = (await params.params).quizid
  const attemptid = (await params.params).attemptid
  const orgslug = (await params.params).orgslug

  return <QuizAttemptClient quizid={quizid} attemptid={attemptid} orgslug={orgslug} />
}

export default QuizAttemptPage
