'use client'

import React, { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, Circle, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCreateQuestion, useUpdateQuestion } from '@/hooks/queries/useQuestion'
import type { Question, QuestionContents, QuestionType } from '@services/organizations/questions'
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

interface McOptionDraft {
  id: string
  text: string
}

interface FormState {
  question_type: QuestionType
  prompt: string
  explanation: string
  subject: string
  topic: string
  level: string
  institution_context: string
}

const EMPTY_FORM: FormState = {
  question_type: 'multiple_choice',
  prompt: '',
  explanation: '',
  subject: '',
  topic: '',
  level: '',
  institution_context: '',
}

function newOptionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function emptyMcOptions(): McOptionDraft[] {
  return [{ id: newOptionId(), text: '' }, { id: newOptionId(), text: '' }]
}

function formFor(question?: Question): FormState {
  if (!question) return { ...EMPTY_FORM }
  return {
    question_type: question.question_type as QuestionType,
    prompt: question.prompt || '',
    explanation: question.explanation || '',
    subject: question.subject || '',
    topic: question.topic || '',
    level: question.level || '',
    institution_context: question.institution_context || '',
  }
}

function mcOptionsFor(question?: Question): McOptionDraft[] {
  const options = question?.contents?.options
  if (question?.question_type === 'multiple_choice' && options && options.length > 0) {
    return options.map((o) => ({ id: o.id, text: o.text }))
  }
  return emptyMcOptions()
}

function correctOptionIdFor(question?: Question): string | null {
  const options = question?.contents?.options
  if (question?.question_type === 'multiple_choice' && options) {
    return options.find((o) => o.is_correct)?.id ?? null
  }
  return null
}

function acceptedAnswersFor(question?: Question): string[] {
  const accepted = question?.contents?.accepted_answers
  if (
    (question?.question_type === 'short_answer' || question?.question_type === 'number_answer') &&
    accepted &&
    accepted.length > 0
  ) {
    return accepted
  }
  return ['']
}

interface QuestionFormModalProps {
  orgId: number
  /** Defaults to 'create'. 'edit' reuses this same form to update an
   * existing bank Question instead of creating a new one. */
  mode?: 'create' | 'edit'
  /** Required when mode="edit" — the question being edited, used to prefill
   * the form and as the target of the update mutation. */
  question?: Question
}

export default function QuestionFormModal({ orgId, mode = 'create', question }: QuestionFormModalProps) {
  const { t } = useTranslation()
  const formId = useId()

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [form, setForm] = useState<FormState>(() => formFor(question))
  const [mcOptions, setMcOptions] = useState<McOptionDraft[]>(() => mcOptionsFor(question))
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(() => correctOptionIdFor(question))
  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>(() => acceptedAnswersFor(question))
  const [fieldErrors, setFieldErrors] = useState<{ prompt?: string; options?: string; accepted?: string }>({})
  const [errorMessage, setErrorMessage] = useState('')

  const create = useCreateQuestion(orgId)
  const update = useUpdateQuestion(orgId)

  const resetForm = () => {
    setPhase('idle')
    setForm(formFor(question))
    setMcOptions(mcOptionsFor(question))
    setCorrectOptionId(correctOptionIdFor(question))
    setAcceptedAnswers(acceptedAnswersFor(question))
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

  const handleQuestionTypeChange = (value: QuestionType) => {
    setField('question_type', value)
    setFieldErrors((prev) => ({ ...prev, options: undefined, accepted: undefined }))
  }

  const addMcOption = () => setMcOptions((opts) => [...opts, { id: newOptionId(), text: '' }])
  const removeMcOption = (id: string) => {
    setMcOptions((opts) => opts.filter((o) => o.id !== id))
    if (correctOptionId === id) setCorrectOptionId(null)
  }
  const updateMcOptionText = (id: string, text: string) => {
    setMcOptions((opts) => opts.map((o) => (o.id === id ? { ...o, text } : o)))
  }

  const addAcceptedAnswer = () => setAcceptedAnswers((a) => [...a, ''])
  const removeAcceptedAnswer = (index: number) =>
    setAcceptedAnswers((a) => a.filter((_, i) => i !== index))
  const updateAcceptedAnswer = (index: number, value: string) =>
    setAcceptedAnswers((a) => a.map((v, i) => (i === index ? value : v)))

  const buildContents = (): QuestionContents | null => {
    if (form.question_type === 'multiple_choice') {
      const validOptions = mcOptions.filter((o) => o.text.trim())
      if (validOptions.length < 2) {
        setFieldErrors((prev) => ({
          ...prev,
          options: t('question.form.errors.minOptions', { defaultValue: 'Add at least 2 options.' }),
        }))
        return null
      }
      if (!correctOptionId || !validOptions.some((o) => o.id === correctOptionId)) {
        setFieldErrors((prev) => ({
          ...prev,
          options: t('question.form.errors.needCorrect', {
            defaultValue: 'Mark exactly one option as correct.',
          }),
        }))
        return null
      }
      return {
        options: validOptions.map((o) => ({
          id: o.id,
          text: o.text.trim(),
          is_correct: o.id === correctOptionId,
        })),
      }
    }

    // short_answer / number_answer
    const validAnswers = acceptedAnswers.map((a) => a.trim()).filter(Boolean)
    if (validAnswers.length === 0) {
      setFieldErrors((prev) => ({
        ...prev,
        accepted: t('question.form.errors.minAccepted', { defaultValue: 'Add at least one accepted answer.' }),
      }))
      return null
    }
    if (form.question_type === 'number_answer') {
      const invalid = validAnswers.find((a) => Number.isNaN(Number(a)))
      if (invalid !== undefined) {
        setFieldErrors((prev) => ({
          ...prev,
          accepted: t('question.form.errors.numericAccepted', {
            defaultValue: 'Accepted answers must be numbers.',
          }),
        }))
        return null
      }
    }
    return { accepted_answers: validAnswers }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: { prompt?: string } = {}
    if (!form.prompt.trim()) {
      errors.prompt = t('question.form.errors.prompt', { defaultValue: 'Prompt is required.' })
    }
    setFieldErrors(errors)

    const contents = buildContents()
    if (Object.keys(errors).length > 0 || !contents) return

    setErrorMessage('')
    setPhase('submitting')

    const payload = {
      question_type: form.question_type,
      prompt: form.prompt.trim(),
      contents,
      explanation: form.explanation.trim() || undefined,
      subject: form.subject.trim() || undefined,
      topic: form.topic.trim() || undefined,
      level: form.level.trim() || undefined,
      institution_context: form.institution_context.trim() || undefined,
    }

    try {
      if (mode === 'edit') {
        await update.mutateAsync({ questionId: question!.id, data: payload })
      } else {
        await create.mutateAsync(payload)
      }
      setOpen(false)
      resetForm()
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          t('question.form.errors.generic', { defaultValue: 'Something went wrong. Please try again.' })
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
          ? t('question.form.editTitle', { defaultValue: 'Edit question' })
          : t('question.form.createTitle', { defaultValue: 'New question' })
      }
      dialogDescription={
        mode === 'edit'
          ? t('question.form.editSubtitle', { defaultValue: 'Update this bank item.' })
          : t('question.form.createSubtitle', { defaultValue: 'Add a question to this channel’s bank.' })
      }
      minWidth="md"
      dialogTrigger={
        mode === 'edit' ? (
          <button
            type="button"
            aria-label={t('question.form.editTrigger', { defaultValue: 'Edit question' })}
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        ) : (
          <Button type="button" size="sm" className="gap-1.5">
            <Plus size={16} aria-hidden="true" />
            {t('question.form.createTrigger', { defaultValue: 'New question' })}
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
            <Label htmlFor={`${formId}-type`}>
              {t('question.form.type', { defaultValue: 'Question type' })}
            </Label>
            <Select
              value={form.question_type}
              onValueChange={(v) => handleQuestionTypeChange(v as QuestionType)}
              disabled={isBusy}
            >
              <SelectTrigger id={`${formId}-type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multiple_choice">
                  {t('question.form.typeMultipleChoice', { defaultValue: 'Multiple choice' })}
                </SelectItem>
                <SelectItem value="short_answer">
                  {t('question.form.typeShortAnswer', { defaultValue: 'Short answer' })}
                </SelectItem>
                <SelectItem value="number_answer">
                  {t('question.form.typeNumberAnswer', { defaultValue: 'Number answer' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-prompt`}>
              {t('question.form.prompt', { defaultValue: 'Prompt' })}
            </Label>
            <Textarea
              id={`${formId}-prompt`}
              value={form.prompt}
              onChange={(e) => {
                setField('prompt', e.target.value)
                setFieldErrors((prev) => ({ ...prev, prompt: undefined }))
              }}
              disabled={isBusy}
              rows={3}
              required
              aria-invalid={!!fieldErrors.prompt}
              aria-describedby={fieldErrors.prompt ? `${formId}-prompt-error` : undefined}
              placeholder={t('question.form.promptPlaceholder', {
                defaultValue: 'e.g. What is the value of x in 2x + 4 = 10?',
              })}
            />
            {fieldErrors.prompt && (
              <p id={`${formId}-prompt-error`} className="text-xs text-destructive">
                {fieldErrors.prompt}
              </p>
            )}
          </div>

          {form.question_type === 'multiple_choice' ? (
            <div className="space-y-2">
              <Label>{t('question.form.options', { defaultValue: 'Options' })}</Label>
              <p className="text-xs text-muted-foreground">
                {t('question.form.optionsHelp', { defaultValue: 'Click the circle to mark the correct answer.' })}
              </p>
              <div className="space-y-2">
                {mcOptions.map((option, i) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-label={t('question.form.markCorrect', { defaultValue: 'Mark as correct answer' })}
                      aria-pressed={correctOptionId === option.id}
                      onClick={() => {
                        setCorrectOptionId(option.id)
                        setFieldErrors((prev) => ({ ...prev, options: undefined }))
                      }}
                      className="shrink-0 text-muted-foreground hover:text-success transition-colors"
                    >
                      {correctOptionId === option.id ? (
                        <CheckCircle2 className="text-success" size={20} aria-hidden="true" />
                      ) : (
                        <Circle size={20} aria-hidden="true" />
                      )}
                    </button>
                    <Input
                      value={option.text}
                      onChange={(e) => {
                        updateMcOptionText(option.id, e.target.value)
                        setFieldErrors((prev) => ({ ...prev, options: undefined }))
                      }}
                      disabled={isBusy}
                      placeholder={t('question.form.optionPlaceholder', { defaultValue: `Option ${i + 1}` })}
                    />
                    {mcOptions.length > 2 && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => removeMcOption(option.id)}
                        aria-label={t('question.form.removeOption', { defaultValue: 'Remove option' })}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={addMcOption}>
                <Plus size={14} aria-hidden="true" />
                {t('question.form.addOption', { defaultValue: 'Add option' })}
              </Button>
              {fieldErrors.options && <p className="text-xs text-destructive">{fieldErrors.options}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t('question.form.acceptedAnswers', { defaultValue: 'Accepted answers' })}</Label>
              <p className="text-xs text-muted-foreground">
                {form.question_type === 'number_answer'
                  ? t('question.form.acceptedAnswersHelpNumber', {
                      defaultValue: 'Any of these numeric values will be graded correct.',
                    })
                  : t('question.form.acceptedAnswersHelpText', {
                      defaultValue: 'Any of these values will be graded correct (case-insensitive).',
                    })}
              </p>
              <div className="space-y-2">
                {acceptedAnswers.map((answer, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type={form.question_type === 'number_answer' ? 'number' : 'text'}
                      value={answer}
                      onChange={(e) => {
                        updateAcceptedAnswer(i, e.target.value)
                        setFieldErrors((prev) => ({ ...prev, accepted: undefined }))
                      }}
                      disabled={isBusy}
                      placeholder={t('question.form.acceptedAnswerPlaceholder', { defaultValue: 'Accepted answer' })}
                    />
                    {acceptedAnswers.length > 1 && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => removeAcceptedAnswer(i)}
                        aria-label={t('question.form.removeAcceptedAnswer', { defaultValue: 'Remove answer' })}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={addAcceptedAnswer}>
                <Plus size={14} aria-hidden="true" />
                {t('question.form.addAcceptedAnswer', { defaultValue: 'Add accepted answer' })}
              </Button>
              {fieldErrors.accepted && <p className="text-xs text-destructive">{fieldErrors.accepted}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-explanation`}>
              {t('question.form.explanation', { defaultValue: 'Explanation (optional)' })}
            </Label>
            <Textarea
              id={`${formId}-explanation`}
              value={form.explanation}
              onChange={(e) => setField('explanation', e.target.value)}
              disabled={isBusy}
              rows={2}
              placeholder={t('question.form.explanationPlaceholder', {
                defaultValue: 'Shown to students only after they submit their attempt.',
              })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-subject`}>
                {t('question.form.subject', { defaultValue: 'Subject' })}
              </Label>
              <Input
                id={`${formId}-subject`}
                value={form.subject}
                onChange={(e) => setField('subject', e.target.value)}
                disabled={isBusy}
                placeholder={t('question.form.subjectPlaceholder', { defaultValue: 'e.g. Mathematics' })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-topic`}>
                {t('question.form.topicLabel', { defaultValue: 'Topic' })}
              </Label>
              <Input
                id={`${formId}-topic`}
                value={form.topic}
                onChange={(e) => setField('topic', e.target.value)}
                disabled={isBusy}
                placeholder={t('question.form.topicPlaceholder', { defaultValue: 'e.g. Linear Equations' })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-level`}>
                {t('question.form.level', { defaultValue: 'Level' })}
              </Label>
              <Input
                id={`${formId}-level`}
                value={form.level}
                onChange={(e) => setField('level', e.target.value)}
                disabled={isBusy}
                placeholder={t('question.form.levelPlaceholder', { defaultValue: 'e.g. Form 4' })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-institution`}>
                {t('question.form.institution', { defaultValue: 'Institution / curriculum' })}
              </Label>
              <Input
                id={`${formId}-institution`}
                value={form.institution_context}
                onChange={(e) => setField('institution_context', e.target.value)}
                disabled={isBusy}
                placeholder={t('question.form.institutionPlaceholder', { defaultValue: 'e.g. KCSE' })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="submit" disabled={isBusy} className="min-w-32">
              {mode === 'edit'
                ? isBusy
                  ? t('question.form.saving', { defaultValue: 'Saving…' })
                  : phase === 'error'
                    ? t('question.form.retry', { defaultValue: 'Try again' })
                    : t('question.form.save', { defaultValue: 'Save changes' })
                : isBusy
                  ? t('question.form.creating', { defaultValue: 'Creating…' })
                  : phase === 'error'
                    ? t('question.form.retry', { defaultValue: 'Try again' })
                    : t('question.form.create', { defaultValue: 'Create question' })}
            </Button>
          </div>
        </form>
      }
    />
  )
}
