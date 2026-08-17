'use client'

import React, { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, Clapperboard, Pencil, Upload, Video as VideoIcon } from 'lucide-react'
import { constructAcceptValue } from '@/lib/constants'
import { getUriWithOrg } from '@services/config/config'
import { useUploadChannelVideo } from '@/hooks/queries/useChannelVideoUpload'
import { useUpdateChannelVideo } from '@/hooks/queries/useChannelVideo'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { Textarea } from '@components/ui/textarea'
import { Label } from '@components/ui/label'
import { Switch } from '@components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select'

const SUPPORTED_VIDEO_FILES = constructAcceptValue(['mp4', 'webm'])

type Phase = 'idle' | 'uploading' | 'processing' | 'submitting' | 'success' | 'error'

interface FormState {
  title: string
  description: string
  subject: string
  topic: string
  level: string
  institution_context: string
  resource_type: string
  visibility: 'public' | 'unlisted'
  publish: boolean
  /** Phase 3F: which existing ChannelVideo.content_format this upload
   * creates. Upload-only — edit mode never changes an existing video's
   * format. */
  content_format: 'long' | 'short'
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  subject: '',
  topic: '',
  level: '',
  institution_context: '',
  resource_type: '',
  visibility: 'public',
  publish: false,
  content_format: 'long',
}

/** Metadata editable via 2G-1's PUT .../videos/{id} — a subset of what's
 * collected on upload (no file, visibility, or publish state). */
export interface ChannelVideoEditData {
  id: number
  title: string
  description?: string | null
  subject?: string | null
  topic?: string | null
  level?: string | null
  institution_context?: string | null
  resource_type?: string | null
}

function formFor(
  mode: 'upload' | 'edit',
  channelVideo?: ChannelVideoEditData,
  defaultContentFormat?: FormState['content_format']
): FormState {
  if (mode === 'edit' && channelVideo) {
    return {
      ...EMPTY_FORM,
      title: channelVideo.title || '',
      description: channelVideo.description || '',
      subject: channelVideo.subject || '',
      topic: channelVideo.topic || '',
      level: channelVideo.level || '',
      institution_context: channelVideo.institution_context || '',
      resource_type: channelVideo.resource_type || '',
    }
  }
  return { ...EMPTY_FORM, content_format: defaultContentFormat ?? EMPTY_FORM.content_format }
}

interface UploadChannelVideoModalProps {
  orgId: number
  orgslug: string
  /** Defaults to 'upload' (the original Phase 2F flow). 'edit' (Phase 2G-2)
   * reuses this same form for an owner/admin to update an existing
   * ChannelVideo's metadata instead of creating a new one. */
  mode?: 'upload' | 'edit'
  /** Required when mode="edit" — the video being edited, used to prefill the
   * form and as the target of the update mutation. */
  channelVideo?: ChannelVideoEditData
  /** Upload-only (Phase 3G): preselects the Format toggle so a trigger
   * opened from the Shorts section starts on "Short" instead of the default
   * "Video" — the toggle remains editable, this only sets the initial value. */
  defaultContentFormat?: 'long' | 'short'
}

export default function UploadChannelVideoModal({
  orgId,
  orgslug,
  mode = 'upload',
  channelVideo,
  defaultContentFormat,
}: UploadChannelVideoModalProps) {
  const { t } = useTranslation()
  const formId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [form, setForm] = useState<FormState>(() => formFor(mode, channelVideo, defaultContentFormat))
  const [file, setFile] = useState<File | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; file?: string }>({})
  const [errorMessage, setErrorMessage] = useState('')
  const [createdVideoId, setCreatedVideoId] = useState<number | null>(null)

  const upload = useUploadChannelVideo(orgId, orgslug)
  const update = useUpdateChannelVideo(orgId)

  const resetForm = () => {
    setPhase('idle')
    setProgress(0)
    setForm(formFor(mode, channelVideo, defaultContentFormat))
    setFile(null)
    setFieldErrors({})
    setErrorMessage('')
    setCreatedVideoId(null)
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
      errors.title = t('video.upload.errors.title', { defaultValue: 'Title is required.' })
    }
    if (mode === 'upload' && !file) {
      errors.file = t('video.upload.errors.file', { defaultValue: 'Select a video file to upload.' })
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setErrorMessage('')

    if (mode === 'edit') {
      setPhase('submitting')
      try {
        await update.mutateAsync({
          channelVideoId: channelVideo!.id,
          data: {
            // Sent as-is (not `|| undefined`) so clearing a field in the form
            // actually clears it server-side — see 2G-1's `exclude_unset`
            // partial-update semantics: an omitted key leaves the existing
            // value untouched, but an empty string is a real, applied value.
            title: form.title.trim(),
            description: form.description.trim(),
            subject: form.subject.trim(),
            topic: form.topic.trim(),
            level: form.level.trim(),
            institution_context: form.institution_context.trim(),
            resource_type: form.resource_type.trim(),
          },
        })
        // Listing + detail queries are already invalidated by the mutation's
        // onSuccess — closing here is enough to "show updated metadata
        // immediately without a manual reload".
        setOpen(false)
        resetForm()
      } catch (err: any) {
        setErrorMessage(
          err?.message || t('video.edit.errors.generic', { defaultValue: 'The update failed. Please try again.' })
        )
        setPhase('error')
      }
      return
    }

    setPhase('uploading')
    setProgress(0)

    try {
      const result = await upload.mutateAsync({
        input: {
          file: file as File,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          subject: form.subject.trim() || undefined,
          topic: form.topic.trim() || undefined,
          level: form.level.trim() || undefined,
          institution_context: form.institution_context.trim() || undefined,
          resource_type: form.resource_type.trim() || undefined,
          visibility: form.visibility,
          publish: form.publish,
          content_format: form.content_format,
        },
        onProgress: (percent) => {
          setProgress(percent)
          // The upload request body finishes at 100%, but the server still
          // has to save the Activity/ChannelVideo rows before responding —
          // a real (if brief) step, not a fabricated one.
          if (percent >= 100) setPhase('processing')
        },
      })
      setCreatedVideoId(result.id)
      setPhase('success')
    } catch (err: any) {
      setErrorMessage(err?.message || t('video.upload.errors.generic', { defaultValue: 'The upload failed. Please try again.' }))
      setPhase('error')
    }
  }

  const isBusy = phase === 'uploading' || phase === 'processing' || phase === 'submitting'
  const watchHref = createdVideoId != null ? getUriWithOrg(orgslug, `/videos/${createdVideoId}`) : ''

  return (
    <Modal
      isDialogOpen={open}
      onOpenChange={handleOpenChange}
      dialogTitle={
        mode === 'edit'
          ? t('video.edit.title', { defaultValue: 'Edit video details' })
          : t('video.upload.title', { defaultValue: 'Upload a video' })
      }
      dialogDescription={
        mode === 'edit'
          ? t('video.edit.subtitle', { defaultValue: 'Update this video’s academic metadata.' })
          : t('video.upload.subtitle', { defaultValue: 'Publish an educational video to this channel.' })
      }
      minWidth="md"
      dialogTrigger={
        mode === 'edit' ? (
          <button
            type="button"
            aria-label={t('video.edit.trigger', { defaultValue: 'Edit video details' })}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        ) : (
          <Button type="button" size="sm" className="gap-1.5">
            <Upload size={16} aria-hidden="true" />
            {t('video.upload.trigger', { defaultValue: 'Upload video' })}
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
                  ? t('video.upload.success.published', { defaultValue: 'Video published' })
                  : t('video.upload.success.draft', { defaultValue: 'Video saved as a draft' })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {form.publish
                  ? t('video.upload.success.publishedDescription', {
                      defaultValue: 'It now appears in your channel’s video listing.',
                    })
                  : t('video.upload.success.draftDescription', {
                      defaultValue: 'Only you and other channel admins can see it until you publish it.',
                    })}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" onClick={() => { resetForm() }}>
                {t('video.upload.uploadAnother', { defaultValue: 'Upload another' })}
              </Button>
              <Button asChild>
                <Link href={watchHref}>{t('video.upload.viewVideo', { defaultValue: 'View video' })}</Link>
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
                <Label htmlFor={`${formId}-format`}>
                  {t('video.upload.format', { defaultValue: 'Format' })}
                </Label>
                <ToggleGroup
                  id={`${formId}-format`}
                  type="single"
                  variant="outline"
                  value={form.content_format}
                  onValueChange={(v) => {
                    if (v) setField('content_format', v as FormState['content_format'])
                  }}
                  disabled={isBusy}
                  className="justify-start"
                >
                  <ToggleGroupItem value="long" aria-label={t('video.upload.formatLong', { defaultValue: 'Video' })} className="gap-1.5 px-3">
                    <VideoIcon size={14} aria-hidden="true" />
                    {t('video.upload.formatLong', { defaultValue: 'Video' })}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="short" aria-label={t('video.upload.formatShort', { defaultValue: 'Short' })} className="gap-1.5 px-3">
                    <Clapperboard size={14} aria-hidden="true" />
                    {t('video.upload.formatShort', { defaultValue: 'Short' })}
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="text-xs text-muted-foreground">
                  {form.content_format === 'short'
                    ? t('video.upload.formatShortHint', {
                        defaultValue: 'Shorts appear in the global Shorts feed as well as this channel.',
                      })
                    : t('video.upload.formatLongHint', {
                        defaultValue: 'Appears in this channel’s video listing.',
                      })}
                </p>
              </div>
            )}

            {mode === 'upload' && (
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-file`}>
                  {t('video.upload.file', { defaultValue: 'Video file' })}
                </Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-11 h-11 rounded-md bg-muted shrink-0">
                    <VideoIcon className="text-muted-foreground" size={18} aria-hidden="true" />
                  </div>
                  <Input
                    id={`${formId}-file`}
                    ref={fileInputRef}
                    type="file"
                    accept={SUPPORTED_VIDEO_FILES}
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
                {t('video.upload.titleLabel', { defaultValue: 'Title' })}
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
                placeholder={t('video.upload.titlePlaceholder', { defaultValue: 'e.g. Linear Equations Explained' })}
              />
              {fieldErrors.title && (
                <p id={`${formId}-title-error`} className="text-xs text-destructive">
                  {fieldErrors.title}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-description`}>
                {t('video.upload.description', { defaultValue: 'Description' })}
              </Label>
              <Textarea
                id={`${formId}-description`}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                disabled={isBusy}
                rows={3}
                placeholder={t('video.upload.descriptionPlaceholder', {
                  defaultValue: 'What does this video cover?',
                })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-subject`}>
                  {t('video.subject', { defaultValue: 'Subject' })}
                </Label>
                <Input
                  id={`${formId}-subject`}
                  value={form.subject}
                  onChange={(e) => setField('subject', e.target.value)}
                  disabled={isBusy}
                  placeholder={t('video.upload.subjectPlaceholder', { defaultValue: 'e.g. Mathematics' })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-topic`}>
                  {t('video.topic', { defaultValue: 'Topic' })}
                </Label>
                <Input
                  id={`${formId}-topic`}
                  value={form.topic}
                  onChange={(e) => setField('topic', e.target.value)}
                  disabled={isBusy}
                  placeholder={t('video.upload.topicPlaceholder', { defaultValue: 'e.g. Linear Equations' })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-level`}>
                  {t('video.level', { defaultValue: 'Level' })}
                </Label>
                <Input
                  id={`${formId}-level`}
                  value={form.level}
                  onChange={(e) => setField('level', e.target.value)}
                  disabled={isBusy}
                  placeholder={t('video.upload.levelPlaceholder', { defaultValue: 'e.g. Form 2' })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-institution`}>
                  {t('video.institution', { defaultValue: 'Institution / curriculum' })}
                </Label>
                <Input
                  id={`${formId}-institution`}
                  value={form.institution_context}
                  onChange={(e) => setField('institution_context', e.target.value)}
                  disabled={isBusy}
                  placeholder={t('video.upload.institutionPlaceholder', { defaultValue: 'e.g. KCSE' })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`${formId}-resource-type`}>
                  {t('video.resourceType', { defaultValue: 'Resource / exam type' })}
                </Label>
                <Input
                  id={`${formId}-resource-type`}
                  value={form.resource_type}
                  onChange={(e) => setField('resource_type', e.target.value)}
                  disabled={isBusy}
                  placeholder={t('video.upload.resourceTypePlaceholder', { defaultValue: 'e.g. Lesson, Past paper walkthrough' })}
                />
              </div>
            </div>

            {mode === 'upload' && (
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-visibility`}>
                  {t('video.upload.visibility', { defaultValue: 'Visibility' })}
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
                      {t('video.upload.visibilityPublic', { defaultValue: 'Public — shown in this channel’s video listing' })}
                    </SelectItem>
                    <SelectItem value="unlisted">
                      {t('video.upload.visibilityUnlisted', { defaultValue: 'Unlisted — only visible to channel admins' })}
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
                    {t('video.upload.publishNow', { defaultValue: 'Publish now' })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {form.publish
                      ? t('video.upload.publishNowOn', { defaultValue: 'Goes live as soon as the upload finishes.' })
                      : t('video.upload.publishNowOff', { defaultValue: 'Saved as a draft — publish later from the channel.' })}
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
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {phase === 'processing'
                      ? t('video.upload.processing', { defaultValue: 'Finishing up…' })
                      : t('video.upload.uploading', { defaultValue: 'Uploading…' })}
                  </span>
                  {phase === 'uploading' && <span>{Math.round(progress)}%</span>}
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full bg-primary transition-all ${phase === 'processing' ? 'animate-pulse w-full' : ''}`}
                    style={phase === 'uploading' ? { width: `${progress}%` } : undefined}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="submit" disabled={isBusy} className="min-w-32">
                {mode === 'edit'
                  ? isBusy
                    ? t('video.edit.submitting', { defaultValue: 'Saving…' })
                    : phase === 'error'
                      ? t('video.edit.retry', { defaultValue: 'Try again' })
                      : t('video.edit.submit', { defaultValue: 'Save changes' })
                  : isBusy
                    ? t('video.upload.submitting', { defaultValue: 'Uploading…' })
                    : phase === 'error'
                      ? t('video.upload.retry', { defaultValue: 'Try again' })
                      : t('video.upload.submit', { defaultValue: 'Upload' })}
              </Button>
            </div>
          </form>
        )
      }
    />
  )
}
