'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import {
  getQuizAttempt,
  listQuizAttempts,
  startQuizAttempt,
  submitQuizAttempt,
  type QuizAnswerSubmitInput,
} from '@services/organizations/quizAttempts'

export function useQuizAttempt(
  orgId: number | undefined,
  quizId: number | undefined,
  attemptId: number | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.quizAttempts.detail(orgId!, quizId!, attemptId!),
    queryFn: () => getQuizAttempt(orgId!, quizId!, attemptId!, accessToken),
    enabled: !!orgId && !!quizId && !!attemptId && !!accessToken,
    // An in-progress attempt's questions can't change once started, and a
    // graded attempt never changes again — no reason to refetch on window
    // focus/mount like the list/detail queries elsewhere.
    staleTime: Infinity,
    retry: false,
  })
}

export function useStartQuizAttempt(orgId: number | undefined, quizId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => startQuizAttempt(orgId!, quizId!, accessToken!),
    onSuccess: (attempt) => {
      queryClient.setQueryData(queryKeys.quizAttempts.detail(orgId!, quizId!, attempt.id), attempt)
    },
  })
}

/** The acting user's own attempt history for a quiz (Results, Phase 6G). */
export function useQuizAttempts(orgId: number | undefined, quizId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.quizAttempts.list(orgId!, quizId!),
    queryFn: () => listQuizAttempts(orgId!, quizId!, accessToken!),
    enabled: !!orgId && !!quizId && !!accessToken,
  })
}

export function useSubmitQuizAttempt(
  orgId: number | undefined,
  quizId: number | undefined,
  attemptId: number | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (answers: QuizAnswerSubmitInput[]) =>
      submitQuizAttempt(orgId!, quizId!, attemptId!, answers, accessToken!),
    onSuccess: (attempt) => {
      queryClient.setQueryData(queryKeys.quizAttempts.detail(orgId!, quizId!, attemptId!), attempt)
    },
  })
}
