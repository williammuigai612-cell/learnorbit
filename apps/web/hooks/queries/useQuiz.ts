'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import {
  attachQuestionToQuiz,
  createQuiz,
  deleteQuiz,
  detachQuestionFromQuiz,
  getQuiz,
  listQuizQuestions,
  listQuizzes,
  reorderQuizQuestions,
  setQuizPublished,
  updateQuiz,
  type QuizCreateInput,
  type QuizFilters,
  type QuizUpdateInput,
} from '@services/organizations/quizzes'
import { normalizeQuizFilters } from '@services/organizations/quizFilters'

// The quiz metadata listing (Phase 6E-2). Unlike useQuestions, list/get are
// public-capable (published+public for anon/non-admin viewers, everything
// for this channel's admins — enforced server-side), so this only needs
// `orgId`, not an access token, to fire — same pattern as
// useChannelResources.
export function useQuizzes(orgId: number | undefined, filters?: QuizFilters) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const normalizedFilters = normalizeQuizFilters(filters)

  return useQuery({
    queryKey: queryKeys.quizzes.list(orgId!, normalizedFilters),
    queryFn: () => listQuizzes(orgId!, normalizedFilters, accessToken),
    enabled: !!orgId,
    staleTime: 30_000,
  })
}

export function useQuiz(orgId: number | undefined, quizId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.quizzes.detail(orgId!, quizId!),
    queryFn: () => getQuiz(orgId!, quizId!, accessToken),
    enabled: !!orgId && !!quizId,
    staleTime: 30_000,
    retry: false,
  })
}

function useInvalidateQuizzes(orgId: number | undefined) {
  const queryClient = useQueryClient()
  return (quizId?: number) => {
    if (!orgId) return
    queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.list(orgId) })
    if (quizId != null) {
      queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.detail(orgId, quizId) })
    }
  }
}

export function useCreateQuiz(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const invalidate = useInvalidateQuizzes(orgId)

  return useMutation({
    mutationFn: (data: QuizCreateInput) => createQuiz(orgId!, data, accessToken!),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateQuiz(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const invalidate = useInvalidateQuizzes(orgId)

  return useMutation({
    mutationFn: ({ quizId, data }: { quizId: number; data: QuizUpdateInput }) =>
      updateQuiz(orgId!, quizId, data, accessToken!),
    onSuccess: (_result, variables) => invalidate(variables.quizId),
  })
}

export function useSetQuizPublished(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const invalidate = useInvalidateQuizzes(orgId)

  return useMutation({
    mutationFn: ({ quizId, published }: { quizId: number; published: boolean }) =>
      setQuizPublished(orgId!, quizId, published, accessToken!),
    onSuccess: (_result, variables) => invalidate(variables.quizId),
  })
}

export function useDeleteQuiz(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const invalidate = useInvalidateQuizzes(orgId)

  return useMutation({
    mutationFn: (quizId: number) => deleteQuiz(orgId!, quizId, accessToken!),
    onSuccess: (_result, quizId) => invalidate(quizId),
  })
}

// --- Attached-questions (the quiz builder view) -----------------------

export function useQuizQuestions(orgId: number | undefined, quizId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.quizzes.questions(orgId!, quizId!),
    queryFn: () => listQuizQuestions(orgId!, quizId!, accessToken),
    enabled: !!orgId && !!quizId && !!accessToken,
    staleTime: 10_000,
  })
}

function useInvalidateQuizQuestions(orgId: number | undefined, quizId: number | undefined) {
  const queryClient = useQueryClient()
  const invalidateQuizzes = useInvalidateQuizzes(orgId)
  return () => {
    if (!orgId || !quizId) return
    queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.questions(orgId, quizId) })
    // Attaching/detaching changes question_count on the parent Quiz too.
    invalidateQuizzes(quizId)
  }
}

export function useAttachQuestionToQuiz(orgId: number | undefined, quizId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const invalidate = useInvalidateQuizQuestions(orgId, quizId)

  return useMutation({
    mutationFn: (questionId: number) => attachQuestionToQuiz(orgId!, quizId!, questionId, accessToken!),
    onSuccess: () => invalidate(),
  })
}

export function useReorderQuizQuestions(orgId: number | undefined, quizId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const invalidate = useInvalidateQuizQuestions(orgId, quizId)

  return useMutation({
    mutationFn: (questionIds: number[]) => reorderQuizQuestions(orgId!, quizId!, questionIds, accessToken!),
    onSuccess: () => invalidate(),
  })
}

export function useDetachQuestionFromQuiz(orgId: number | undefined, quizId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const invalidate = useInvalidateQuizQuestions(orgId, quizId)

  return useMutation({
    mutationFn: (questionId: number) => detachQuestionFromQuiz(orgId!, quizId!, questionId, accessToken!),
    onSuccess: () => invalidate(),
  })
}
