'use client'

import React, { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Pencil, Plus } from 'lucide-react'
import { useCreateQuiz, useUpdateQuiz } from '@/hooks/queries/useQuiz'
import type { Quiz, QuizType } from '@services/organizations/quizzes'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { Textarea } from '@components/ui/textarea'
import { Label } from '@components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select'

type Phase = 'idle' | 'submitting' | 'error'

interface FormState {
  title: string
  description: string
  quiz_type: QuizType
  time_limit_minutes: string
  pass_threshold_percentage: string
  visibility: 'public' | 'unlisted'
  subject: string
  topic: string
  level: string
  institution_context: string
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  quiz_type: 'standard',
  time_limit_minutes: '',
  pass_threshold_percentage: '',
  visibility: 'public',
  subject: '',
  topic: '',
  level: '',
  institution_context: '',
}

function formFor(quiz?: Quiz): FormState {
  if (!quiz) return { ...EMPTY_FORM }
  return {
    title: quiz.title || '',
    description: quiz.description || '',
    quiz_type: (quiz.quiz_type as QuizType) || 'standard',
    time_limit_minutes: quiz.time_limit_minutes != null ? String(quiz.time_limit_minutes) : '',
    pass_threshold_percentage:
      quiz.pass_threshold_percentage != null ? String(quiz.pass_threshold_percentage) : '',
    visibility: quiz.visibility || 'public',
    subject: quiz.subject || '',
    topic: quiz.topic || '',
    level: quiz.level || '',
    institution_context: quiz.institution_context || '',
  }
}

interface QuizFormModalProps {
  orgId: number
  /** Defaults to 'create'. 'edit' reuses this same form to update an
   * existing Quiz's metadata instead of creating a new one — never touches
   * attached questions (see the quiz builder for that). */
  mode?: 'create' | 'edit'
  /** Required when mode="edit" — the quiz being edited, used to prefill the
   * form and as the target of the update mutation. */
  quiz?: Quiz
}

export default function QuizFormModal({ orgId, mode = 'create', quiz }: QuizFormModalProps) {
  const { t } = useTranslation()
  const formId = useId()

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [form, setForm] = useState<FormState>(() => formFor(quiz))
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; time_limit_minutes?: string }>({})
  const [errorMessage, setErrorMessage] = useState('')

  const create = useCreateQuiz(orgId)
  const update = useUpdateQuiz(orgId)

  const resetForm = () => {
    setPhase('idle')
    setForm(formFor(quiz))
    setFieldErrors({})
    setErrorMessage('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && phase === 'submitting') return
    setOpen(next)
    if (!next) resetForm()
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: { title?: string; time_limit_minutes?: string } = {}
    if (!form.title.trim()) {
      errors.title = t('quiz.form.errors.title', { defaultValue: 'Title is required.' })
    }
    let timeLimitMinutes: number | undefined
    if (form.time_limit_minutes.trim()) {
      timeLimitMinutes = Number(form.time_limit_minutes)
      if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes <= 0) {
        errors.time_limit_minutes = t('quiz.form.errors.timeLimit', {
          defaultValue: 'Time limit must be a positive number of minutes.',
        })
      }
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setErrorMessage('')
    setPhase('submitting')

    const passThreshold = form.pass_threshold_percentage.trim()
      ? Number(form.pass_threshold_percentage)
      : undefined

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      quiz_type: form.quiz_type,
      time_limit_minutes: timeLimitMinutes,
      pass_threshold_percentage: passThreshold,
      visibility: form.visibility,
      subject: form.subject.trim() || undefined,
      topic: form.topic.trim() || undefined,
      level: form.level.trim() || undefined,
      institution_context: form.institution_context.trim() || undefined,
    }

    try {
      if (mode === 'edit') {
        await update.mutateAsync({ quizId: quiz!.id, data: payload })
      } else {
        await create.mutateAsync(payload)
      }
      setOpen(false)
      resetForm()
    } catch (err: any) {
      setErrorMessage(
        err?.message || t('quiz.form.errors.generic', { defaultValue: 'Something went wrong. Please try again.' })
      )
      setPhase('error')
    }
  }

  const isBusy = phase === 'submitting'

  return (
    <Modal
      isDialogOpen={open}
      onOpenChange={handleOpenChange}
      dialogTitle={
        mode === 'edit'
          ? t('quiz.form.editTitle', { defaultValue: 'Edit quiz' })
          : t('quiz.form.createTitle', { defaultValue: 'New quiz' })
      }
      dialogDescription={
        mode === 'edit'
          ? t('quiz.form.editSubtitle', { defaultValue: 'Update this quiz’s details.' })
          : t('quiz.form.createSubtitle', {
              defaultValue: 'Starts unpublished with no questions attached — add questions after creating it.',
            })
      }
      minWidth="md"
      dialogTrigger={
        mode === 'edit' ? (
          <button
            type="button"
            aria-label={t('quiz.form.editTrigger', { defaultValue: 'Edit quiz' })}
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        ) : (
          <Button type="button" size="sm" className="gap-1.5">
            <Plus size={16} aria-hidden="true" />
            {t('quiz.form.createTrigger', { defaultValue: 'New quiz' })}
          </Button>
        )
      }
      dialogContent={
        <form id={formId} onSubmit={handleSubmit} className="space-y-5" noValidate>
          {phase === 'error' && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-title`}>{t('quiz.form.title', { defaultValue: 'Title' })}</Label>
            <Input
              id={`${formId}-title`}
              value={form.title}
              onChange={(e) => {
                setField('title', e.target.value)
                setFieldErrors((prev) => ({ ...prev, title: undefined }))
              }}
              disabled={isBusy}
              required
              aria-invalid={!!fieldErrors.title}
              aria-describedby={fieldErrors.title ? `${formId}-title-error` : undefined}
              placeholder={t('quiz.form.titlePlaceholder', { defaultValue: 'e.g. Form 2 Algebra Quiz' })}
            />
            {fieldErrors.title && (
              <p id={`${formId}-title-error`} className="text-xs text-destructive">
                {fieldErrors.title}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-description`}>
              {t('quiz.form.description', { defaultValue: 'Description' })}
            </Label>
            <Textarea
              id={`${formId}-description`}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              disabled={isBusy}
              rows={2}
              placeholder={t('quiz.form.descriptionPlaceholder', { defaultValue: 'What does this quiz cover?' })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-type`}>{t('quiz.form.type', { defaultValue: 'Quiz type' })}</Label>
              <Select
                value={form.quiz_type}
                onValueChange={(v) => setField('quiz_type', v as QuizType)}
                disabled={isBusy}
              >
                <SelectTrigger id={`${formId}-type`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">{t('quiz.form.typeStandard', { defaultValue: 'Standard' })}</SelectItem>
                  <SelectItem value="exam_practice">
                    {t('quiz.form.typeExamPractice', { defaultValue: 'Exam practice (timed)' })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-visibility`}>
                {t('quiz.form.visibility', { defaultValue: 'Visibility' })}
              </Label>
              <Select
                value={form.visibility}
                onValueChange={(v) => setField('visibility', v as FormState['visibility'])}
                disabled={isBusy}
              >
                <SelectTrigger id={`${formId}-visibility`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    {t('quiz.form.visibilityPublic', { defaultValue: 'Public — shown in listings once published' })}
                  </SelectItem>
                  <SelectItem value="unlisted">
                    {t('quiz.form.visibilityUnlisted', { defaultValue: 'Unlisted — only reachable by direct link' })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.quiz_type === 'exam_practice' && (
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-time-limit`}>
                {t('quiz.form.timeLimit', { defaultValue: 'Time limit (minutes)' })}
              </Label>
              <Input
                id={`${formId}-time-limit`}
                type="number"
                min={1}
                value={form.time_limit_minutes}
                onChange={(e) => {
                  setField('time_limit_minutes', e.target.value)
                  setFieldErrors((prev) => ({ ...prev, time_limit_minutes: undefined }))
                }}
                disabled={isBusy}
                aria-invalid={!!fieldErrors.time_limit_minutes}
                aria-describedby={fieldErrors.time_limit_minutes ? `${formId}-time-limit-error` : undefined}
                placeholder={t('quiz.form.timeLimitPlaceholder', { defaultValue: 'e.g. 30' })}
              />
              {fieldErrors.time_limit_minutes && (
                <p id={`${formId}-time-limit-error`} className="text-xs text-destructive">
                  {fieldErrors.time_limit_minutes}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-pass-threshold`}>
              {t('quiz.form.passThreshold', { defaultValue: 'Pass threshold % (optional)' })}
            </Label>
            <Input
              id={`${formId}-pass-threshold`}
              type="number"
              min={0}
              max={100}
              value={form.pass_threshold_percentage}
              onChange={(e) => setField('pass_threshold_percentage', e.target.value)}
              disabled={isBusy}
              placeholder={t('quiz.form.passThresholdPlaceholder', { defaultValue: 'e.g. 70' })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-subject`}>{t('quiz.form.subject', { defaultValue: 'Subject' })}</Label>
              <Input
                id={`${formId}-subject`}
                value={form.subject}
                onChange={(e) => setField('subject', e.target.value)}
                disabled={isBusy}
                placeholder={t('quiz.form.subjectPlaceholder', { defaultValue: 'e.g. Mathematics' })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-topic`}>{t('quiz.form.topicLabel', { defaultValue: 'Topic' })}</Label>
              <Input
                id={`${formId}-topic`}
                value={form.topic}
                onChange={(e) => setField('topic', e.target.value)}
                disabled={isBusy}
                placeholder={t('quiz.form.topicPlaceholder', { defaultValue: 'e.g. Linear Equations' })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-level`}>{t('quiz.form.level', { defaultValue: 'Level' })}</Label>
              <Input
                id={`${formId}-level`}
                value={form.level}
                onChange={(e) => setField('level', e.target.value)}
                disabled={isBusy}
                placeholder={t('quiz.form.levelPlaceholder', { defaultValue: 'e.g. Form 4' })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-institution`}>
                {t('quiz.form.institution', { defaultValue: 'Institution / curriculum' })}
              </Label>
              <Input
                id={`${formId}-institution`}
                value={form.institution_context}
                onChange={(e) => setField('institution_context', e.target.value)}
                disabled={isBusy}
                placeholder={t('quiz.form.institutionPlaceholder', { defaultValue: 'e.g. KCSE' })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="submit" disabled={isBusy} className="min-w-32">
              {mode === 'edit'
                ? isBusy
                  ? t('quiz.form.saving', { defaultValue: 'Saving…' })
                  : phase === 'error'
                    ? t('quiz.form.retry', { defaultValue: 'Try again' })
                    : t('quiz.form.save', { defaultValue: 'Save changes' })
                : isBusy
                  ? t('quiz.form.creating', { defaultValue: 'Creating…' })
                  : phase === 'error'
                    ? t('quiz.form.retry', { defaultValue: 'Try again' })
                    : t('quiz.form.create', { defaultValue: 'Create quiz' })}
            </Button>
          </div>
        </form>
      }
    />
  )
}
