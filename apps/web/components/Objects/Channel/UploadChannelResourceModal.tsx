'use client'

import React, { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, FileText, Pencil, Upload } from 'lucide-react'
import { constructAcceptValue } from '@/lib/constants'
import { getUriWithOrg } from '@services/config/config'
import { useUploadChannelResource } from '@/hooks/queries/useChannelResourceUpload'
import { useUpdateChannelResource } from '@/hooks/queries/useChannelResource'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { Textarea } from '@components/ui/textarea'
import { Label } from '@components/ui/label'
import { Switch } from '@components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select'

const SUPPORTED_RESOURCE_FILES = constructAcceptValue(['pdf'])

type Phase = 'idle' | 'uploading' | 'submitting' | 'success' | 'error'

interface FormState {
  title: string
  description: string
  subject: string
  topic: string
  level: string
  institution_context: string
  resource_type: string
  year: string
  visibility: 'public' | 'unlisted'
  publish: boolean
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  subject: '',
  topic: '',
  level: '',
  institution_context: '',
  resource_type: '',
  year: '',
  visibility: 'public',
  publish: false,
}

/** Metadata editable via PUT .../resources/{id} — a subset of what's
 * collected on upload (no file, visibility, or publish state). */
export interface ChannelResourceEditData {
  id: number
  title: string
  description?: string | null
  subject?: string | null
  topic?: string | null
  level?: string | null
  institution_context?: string | null
  resource_type?: string | null
  year?: string | null
}

function formFor(mode: 'upload' | 'edit', channelResource?: ChannelResourceEditData): FormState {
  if (mode === 'edit' && channelResource) {
    return {
      ...EMPTY_FORM,
      title: channelResource.title || '',
      description: channelResource.description || '',
      subject: channelResource.subject || '',
      topic: channelResource.topic || '',
      level: channelResource.level || '',
      institution_context: channelResource.institution_context || '',
      resource_type: channelResource.resource_type || '',
      year: channelResource.year || '',
    }
  }
  return { ...EMPTY_FORM }
}

interface UploadChannelResourceModalProps {
  orgId: number
  orgslug: string
  /** Defaults to 'upload'. 'edit' reuses this same form for an owner/admin to
   * update an existing ChannelResource's metadata instead of creating a new
   * one. */
  mode?: 'upload' | 'edit'
  /** Required when mode="edit" — the resource being edited, used to prefill
   * the form and as the target of the update mutation. */
  channelResource?: ChannelResourceEditData
}

export default function UploadChannelResourceModal({
  orgId,
  orgslug,
  mode = 'upload',
  channelResource,
}: UploadChannelResourceModalProps) {
  const { t } = useTranslation()
  const formId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [form, setForm] = useState<FormState>(() => formFor(mode, channelResource))
  const [file, setFile] = useState<File | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; file?: string }>({})
  const [errorMessage, setErrorMessage] = useState('')
  const [createdResourceId, setCreatedResourceId] = useState<number | null>(null)

  const upload = useUploadChannelResource(orgId, orgslug)
  const update = useUpdateChannelResource(orgId)

  const resetForm = () => {
    setPhase('idle')
    setForm(formFor(mode, channelResource))
    setFile(null)
    setFieldErrors({})
    setErrorMessage('')
    setCreatedResourceId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleOpenChange = (next: boolean) => {
    // Don't let a click-outside/Esc discard an in-flight upload/save.
    if (!next && (phase === 'uploading' || phase === 'submitting')) return
    setOpen(next)
    if (!next) resetForm()
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: { title?: string; file?: string } = {}
    if (!form.title.trim()) {
      errors.title = t('resource.upload.errors.title', { defaultValue: 'Title is required.' })
    }
    if (mode === 'upload' && !file) {
      errors.file = t('resource.upload.errors.file', { defaultValue: 'Select a PDF file to upload.' })
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setErrorMessage('')

    if (mode === 'edit') {
      setPhase('submitting')
      try {
        await update.mutateAsync({
          channelResourceId: channelResource!.id,
          data: {
            // Sent as-is (not `|| undefined`) so clearing a field in the form
            // actually clears it server-side — same `exclude_unset` partial-
            // update semantics as the video edit form.
            title: form.title.trim(),
            description: form.description.trim(),
            subject: form.subject.trim(),
            topic: form.topic.trim(),
            level: form.level.trim(),
            institution_context: form.institution_context.trim(),
            resource_type: form.resource_type.trim(),
            year: form.year.trim(),
          },
        })
        setOpen(false)
        resetForm()
      } catch (err: any) {
        setErrorMessage(
          err?.message || t('resource.edit.errors.generic', { defaultValue: 'The update failed. Please try again.' })
        )
        setPhase('error')
      }
      return
    }

    setPhase('uploading')

    try {
      const result = await upload.mutateAsync({
        file: file as File,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        subject: form.subject.trim() || undefined,
        topic: form.topic.trim() || undefined,
        level: form.level.trim() || undefined,
        institution_context: form.institution_context.trim() || undefined,
        resource_type: form.resource_type.trim() || undefined,
        year: form.year.trim() || undefined,
        visibility: form.visibility,
        publish: form.publish,
      })
      setCreatedResourceId(result.id)
      setPhase('success')
    } catch (err: any) {
      setErrorMessage(err?.message || t('resource.upload.errors.generic', { defaultValue: 'The upload failed. Please try again.' }))
      setPhase('error')
    }
  }

  const isBusy = phase === 'uploading' || phase === 'submitting'
  const viewHref = createdResourceId != null ? getUriWithOrg(orgslug, `/resources/${createdResourceId}`) : ''

  return (
    <Modal
      isDialogOpen={open}
      onOpenChange={handleOpenChange}
      dialogTitle={
        mode === 'edit'
          ? t('resource.edit.title', { defaultValue: 'Edit resource details' })
          : t('resource.upload.title', { defaultValue: 'Upload a resource' })
      }
      dialogDescription={
        mode === 'edit'
          ? t('resource.edit.subtitle', { defaultValue: 'Update this resource’s academic metadata.' })
          : t('resource.upload.subtitle', { defaultValue: 'Publish a PDF resource to this channel.' })
      }
      minWidth="md"
      dialogTrigger={
        mode === 'edit' ? (
          <button
            type="button"
            aria-label={t('resource.edit.trigger', { defaultValue: 'Edit resource details' })}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        ) : (
          <Button type="button" size="sm" className="gap-1.5">
            <Upload size={16} aria-hidden="true" />
            {t('resource.upload.trigger', { defaultValue: 'Upload resource' })}
          </Button>
        )
      }
      dialogContent={
        phase === 'success' ? (
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="text-success" size={28} aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {form.publish
                  ? t('resource.upload.success.published', { defaultValue: 'Resource published' })
                  : t('resource.upload.success.draft', { defaultValue: 'Resource saved as a draft' })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {form.publish
                  ? t('resource.upload.success.publishedDescription', {
                      defaultValue: 'It now appears in your channel’s resource listing.',
                    })
                  : t('resource.upload.success.draftDescription', {
                      defaultValue: 'Only you and other channel admins can see it until you publish it.',
                    })}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" onClick={() => { resetForm() }}>
                {t('resource.upload.uploadAnother', { defaultValue: 'Upload another' })}
              </Button>
              <Button asChild>
                <Link href={viewHref}>{t('resource.upload.viewResource', { defaultValue: 'View resource' })}</Link>
              </Button>
            </div>
          </div>
        ) : (
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

            {mode === 'upload' && (
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-file`}>
                  {t('resource.upload.file', { defaultValue: 'PDF file' })}
                </Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-11 h-11 rounded-md bg-muted shrink-0">
                    <FileText className="text-muted-foreground" size={18} aria-hidden="true" />
                  </div>
                  <Input
                    id={`${formId}-file`}
                    ref={fileInputRef}
                    type="file"
                    accept={SUPPORTED_RESOURCE_FILES}
                    disabled={isBusy}
                    aria-invalid={!!fieldErrors.file}
                    aria-describedby={fieldErrors.file ? `${formId}-file-error` : undefined}
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null)
                      setFieldErrors((prev) => ({ ...prev, file: undefined }))
                    }}
                    className="h-11"
                  />
                </div>
                {fieldErrors.file && (
                  <p id={`${formId}-file-error`} className="text-xs text-destructive">
                    {fieldErrors.file}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-title`}>
                {t('resource.upload.titleLabel', { defaultValue: 'Title' })}
              </Label>
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
                placeholder={t('resource.upload.titlePlaceholder', { defaultValue: 'e.g. 2023 KCSE Mathematics Paper 1' })}
              />
              {fieldErrors.title && (
                <p id={`${formId}-title-error`} className="text-xs text-destructive">
                  {fieldErrors.title}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-description`}>
                {t('resource.upload.description', { defaultValue: 'Description' })}
              </Label>
              <Textarea
                id={`${formId}-description`}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                disabled={isBusy}
                rows={3}
                placeholder={t('resource.upload.descriptionPlaceholder', {
                  defaultValue: 'What does this resource cover?',
                })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-subject`}>
                  {t('resource.subject', { defaultValue: 'Subject' })}
                </Label>
                <Input
                  id={`${formId}-subject`}
                  value={form.subject}
                  onChange={(e) => setField('subject', e.target.value)}
                  disabled={isBusy}
                  placeholder={t('resource.upload.subjectPlaceholder', { defaultValue: 'e.g. Mathematics' })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-topic`}>
                  {t('resource.topic', { defaultValue: 'Topic' })}
                </Label>
                <Input
                  id={`${formId}-topic`}
                  value={form.topic}
                  onChange={(e) => setField('topic', e.target.value)}
                  disabled={isBusy}
                  placeholder={t('resource.upload.topicPlaceholder', { defaultValue: 'e.g. Linear Equations' })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-level`}>
                  {t('resource.level', { defaultValue: 'Level' })}
                </Label>
                <Input
                  id={`${formId}-level`}
                  value={form.level}
                  onChange={(e) => setField('level', e.target.value)}
                  disabled={isBusy}
                  placeholder={t('resource.upload.levelPlaceholder', { defaultValue: 'e.g. Form 4' })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-institution`}>
                  {t('resource.institution', { defaultValue: 'Institution / curriculum' })}
                </Label>
                <Input
                  id={`${formId}-institution`}
                  value={form.institution_context}
                  onChange={(e) => setField('institution_context', e.target.value)}
                  disabled={isBusy}
                  placeholder={t('resource.upload.institutionPlaceholder', { defaultValue: 'e.g. KCSE' })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-resource-type`}>
                  {t('resource.resourceType', { defaultValue: 'Resource type' })}
                </Label>
                <Input
                  id={`${formId}-resource-type`}
                  value={form.resource_type}
                  onChange={(e) => setField('resource_type', e.target.value)}
                  disabled={isBusy}
                  placeholder={t('resource.upload.resourceTypePlaceholder', { defaultValue: 'e.g. Past paper, Notes' })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-year`}>
                  {t('resource.year', { defaultValue: 'Year' })}
                </Label>
                <Input
                  id={`${formId}-year`}
                  value={form.year}
                  onChange={(e) => setField('year', e.target.value)}
                  disabled={isBusy}
                  placeholder={t('resource.upload.yearPlaceholder', { defaultValue: 'e.g. 2023' })}
                />
              </div>
            </div>

            {mode === 'upload' && (
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-visibility`}>
                  {t('resource.upload.visibility', { defaultValue: 'Visibility' })}
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
                      {t('resource.upload.visibilityPublic', { defaultValue: 'Public — shown in this channel’s resource listing' })}
                    </SelectItem>
                    <SelectItem value="unlisted">
                      {t('resource.upload.visibilityUnlisted', { defaultValue: 'Unlisted — only visible to channel admins' })}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === 'upload' && (
              <label
                htmlFor={`${formId}-publish`}
                className="flex items-center justify-between gap-3 rounded-md border border-input px-3 py-3 min-h-11 cursor-pointer"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {t('resource.upload.publishNow', { defaultValue: 'Publish now' })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {form.publish
                      ? t('resource.upload.publishNowOn', { defaultValue: 'Goes live as soon as the upload finishes.' })
                      : t('resource.upload.publishNowOff', { defaultValue: 'Saved as a draft — publish later from the channel.' })}
                  </span>
                </span>
                <Switch
                  id={`${formId}-publish`}
                  checked={form.publish}
                  onCheckedChange={(checked) => setField('publish', checked)}
                  disabled={isBusy}
                />
              </label>
            )}

            {mode === 'upload' && isBusy && (
              <div className="space-y-1.5" aria-live="polite">
                <div className="text-xs text-muted-foreground">
                  {t('resource.upload.uploading', { defaultValue: 'Uploading…' })}
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-full bg-primary animate-pulse" />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="submit" disabled={isBusy} className="min-w-32">
                {mode === 'edit'
                  ? isBusy
                    ? t('resource.edit.submitting', { defaultValue: 'Saving…' })
                    : phase === 'error'
                      ? t('resource.edit.retry', { defaultValue: 'Try again' })
                      : t('resource.edit.submit', { defaultValue: 'Save changes' })
                  : isBusy
                    ? t('resource.upload.submitting', { defaultValue: 'Uploading…' })
                    : phase === 'error'
                      ? t('resource.upload.retry', { defaultValue: 'Try again' })
                      : t('resource.upload.submit', { defaultValue: 'Upload' })}
              </Button>
            </div>
          </form>
        )
      }
    />
  )
}
