'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import {
  createQuestion,
  deleteQuestion,
  getQuestion,
  listQuestions,
  setQuestionPublished,
  updateQuestion,
  type QuestionCreateInput,
  type QuestionFilters,
  type QuestionUpdateInput,
} from '@services/organizations/questions'
import { normalizeQuestionFilters } from '@services/organizations/questionFilters'

// The question bank listing (Phase 6E-1). Unlike useChannelResources, this
// endpoint is admin-only end to end (see services/orgs/questions.py's module
// docstring) — anonymous/non-admin callers always 401/403, so the query is
// additionally gated on having an access token rather than firing and
// surfacing an error state on first paint.
export function useQuestions(orgId: number | undefined, filters?: QuestionFilters) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const normalizedFilters = normalizeQuestionFilters(filters)

  return useQuery({
    queryKey: queryKeys.questions.list(orgId!, normalizedFilters),
    queryFn: () => listQuestions(orgId!, normalizedFilters, accessToken),
    enabled: !!orgId && !!accessToken,
    staleTime: 30_000,
  })
}

export function useQuestion(orgId: number | undefined, questionId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.questions.detail(orgId!, questionId!),
    queryFn: () => getQuestion(orgId!, questionId!, accessToken),
    enabled: !!orgId && !!questionId && !!accessToken,
    staleTime: 30_000,
    retry: false,
  })
}

function useInvalidateQuestions(orgId: number | undefined) {
  const queryClient = useQueryClient()
  return (questionId?: number) => {
    if (!orgId) return
    queryClient.invalidateQueries({ queryKey: queryKeys.questions.list(orgId) })
    if (questionId != null) {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.detail(orgId, questionId) })
    }
  }
}

export function useCreateQuestion(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const invalidate = useInvalidateQuestions(orgId)

  return useMutation({
    mutationFn: (data: QuestionCreateInput) => createQuestion(orgId!, data, accessToken!),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateQuestion(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const invalidate = useInvalidateQuestions(orgId)

  return useMutation({
    mutationFn: ({ questionId, data }: { questionId: number; data: QuestionUpdateInput }) =>
      updateQuestion(orgId!, questionId, data, accessToken!),
    onSuccess: (_result, variables) => invalidate(variables.questionId),
  })
}

export function useSetQuestionPublished(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const invalidate = useInvalidateQuestions(orgId)

  return useMutation({
    mutationFn: ({ questionId, published }: { questionId: number; published: boolean }) =>
      setQuestionPublished(orgId!, questionId, published, accessToken!),
    onSuccess: (_result, variables) => invalidate(variables.questionId),
  })
}

export function useDeleteQuestion(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const invalidate = useInvalidateQuestions(orgId)

  return useMutation({
    mutationFn: (questionId: number) => deleteQuestion(orgId!, questionId, accessToken!),
    onSuccess: (_result, questionId) => invalidate(questionId),
  })
}
