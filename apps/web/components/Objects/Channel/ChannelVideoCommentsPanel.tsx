'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { AlertCircle, Loader2, MessageCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  useChannelVideoComments,
  useCreateChannelVideoComment,
  useUpdateChannelVideoComment,
  useDeleteChannelVideoComment,
} from '@/hooks/queries/useChannelVideoEngagement'
import {
  CHANNEL_VIDEO_COMMENTS_PREVIEW_LIMIT,
  type ChannelVideoComment,
} from '@services/organizations/channelVideos'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { Button } from '@components/ui/button'
import { Textarea } from '@components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'
import UserAvatar from '@components/Objects/UserAvatar'

dayjs.extend(relativeTime)

// Server-side hard cap is MAX_COMMENT_LENGTH in
// services/orgs/channel_video_comments.py — kept in sync manually since it's
// a single literal, not worth a shared-config round trip for.
const MAX_COMMENT_LENGTH = 2000

interface ChannelVideoCommentsPanelProps {
  orgId: number | undefined
  channelVideoId: number | string | undefined
  /** Custom Dialog trigger visual (Phase 4F, Shorts rail) — defaults to the
   * standard ghost Button used on the long-form watch page when omitted. */
  /** `commentCountLabel` is the display string — it may read "20+" while the
   * panel is closed, since only a preview is fetched then (Phase 9B).
   * `commentCount` stays the raw fetched length for any caller that needs a
   * number rather than a label. */
  trigger?: (_props: {
    commentCount: number | undefined
    commentCountLabel: string | undefined
    isLoading: boolean
  }) => React.ReactNode
}

function getAvatarUrl(author: ChannelVideoComment['author']): string | null {
  if (!author?.avatar_image) return null
  if (author.avatar_image.startsWith('http://') || author.avatar_image.startsWith('https://')) {
    return author.avatar_image
  }
  return getUserAvatarMediaDirectory(author.user_uuid, author.avatar_image)
}

function CommentComposer({
  onSubmit,
  isSubmitting,
  placeholder,
  submitLabel,
  initialValue = '',
  onCancel,
  autoFocus = false,
}: {
  onSubmit: (_content: string) => void
  isSubmitting: boolean
  placeholder: string
  submitLabel: string
  initialValue?: string
  onCancel?: () => void
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const fieldId = React.useId()
  const [value, setValue] = useState(initialValue)
  const remaining = MAX_COMMENT_LENGTH - value.length
  const overLimit = remaining < 0
  const canSubmit = value.trim().length > 0 && !overLimit && !isSubmitting

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit(value.trim())
    if (!onCancel) setValue('')
  }

  return (
    <div className="space-y-2">
      {/* Phase 9C: the composer was placeholder-only, which docs/DESIGN_SYSTEM.md
          §22 forbids outright — `placeholder` doubles as the accessible name
          here rather than adding a visible label the layout has no room for. */}
      <Textarea
        id={fieldId}
        aria-label={placeholder}
        aria-describedby={`${fieldId}-count`}
        aria-invalid={overLimit || undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={2}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
          if (e.key === 'Escape' && onCancel) onCancel()
        }}
      />
      <div className="flex items-center justify-between gap-2">
        {/* Over-limit pairs the color change with an icon + wording, so color
            isn't the only signal (§22 / WCAG 1.4.1). */}
        <span
          id={`${fieldId}-count`}
          className={`text-xs ${overLimit ? 'inline-flex items-center gap-1 font-semibold text-destructive' : 'text-muted-foreground'}`}
        >
          {overLimit ? (
            <>
              <AlertCircle size={12} aria-hidden="true" />
              {t('video.comments.overLimit', {
                defaultValue: '{{count}} over the limit',
                count: -remaining,
              })}
            </>
          ) : (
            <>
              <span aria-hidden="true">{remaining}</span>
              <span className="sr-only">
                {t('video.comments.charactersRemaining', {
                  defaultValue: '{{count}} characters remaining',
                  count: remaining,
                })}
              </span>
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button type="button" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function CommentRow({
  comment,
  currentUserId,
  orgId,
  channelVideoId,
}: {
  comment: ChannelVideoComment
  currentUserId: number | undefined
  orgId: number | undefined
  channelVideoId: number | string | undefined
}) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const updateComment = useUpdateChannelVideoComment(orgId, channelVideoId)
  const deleteComment = useDeleteChannelVideoComment(orgId, channelVideoId)

  const isAuthor = !!currentUserId && currentUserId === comment.author?.id
  const authorName = comment.author
    ? `${comment.author.first_name} ${comment.author.last_name}`.trim() || comment.author.username
    : t('common.unknown', { defaultValue: 'Unknown' })
  const timeAgo = dayjs(comment.creation_date).fromNow()

  const handleUpdate = (content: string) => {
    updateComment.mutate(
      { commentUuid: comment.comment_uuid, content },
      {
        onSuccess: () => setIsEditing(false),
        onError: (err: any) => {
          toast.error(err?.detail || err?.message || t('video.comments.failedToUpdate', { defaultValue: 'Failed to update comment' }))
        },
      }
    )
  }

  const handleDelete = () => {
    deleteComment.mutate(comment.comment_uuid, {
      onError: (err: any) => {
        toast.error(err?.detail || err?.message || t('video.comments.failedToDelete', { defaultValue: 'Failed to delete comment' }))
      },
    })
  }

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-b-0">
      <UserAvatar
        width={32}
        rounded="rounded-full"
        avatar_url={getAvatarUrl(comment.author) || undefined}
        predefined_avatar={comment.author?.avatar_image ? undefined : 'empty'}
        userId={comment.author?.id?.toString()}
        shadow="shadow-none"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-foreground">{authorName}</span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>

        {isEditing ? (
          <CommentComposer
            initialValue={comment.content}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
            isSubmitting={updateComment.isPending}
            placeholder={t('video.comments.writeComment', { defaultValue: 'Write a comment…' })}
            submitLabel={t('video.comments.save', { defaultValue: 'Save' })}
            autoFocus
          />
        ) : (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap" dir="auto">
            {comment.content}
          </p>
        )}
      </div>

      {isAuthor && !isEditing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('video.comments.actions', { defaultValue: 'Comment actions' })}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
            >
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Pencil className="me-2 h-4 w-4" />
              {t('video.comments.edit', { defaultValue: 'Edit' })}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="me-2 h-4 w-4" />
              {t('video.comments.delete', { defaultValue: 'Delete' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export function ChannelVideoCommentsPanel({ orgId, channelVideoId, trigger }: ChannelVideoCommentsPanelProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'
  const currentUserId = session?.data?.user?.id
  const [open, setOpen] = useState(false)

  // Phase 9B: while closed, only a small preview is fetched — enough for the
  // trigger's count badge. Opening the panel switches to the full fetch.
  const { data: comments, isLoading } = useChannelVideoComments(orgId, channelVideoId, open)
  const createComment = useCreateChannelVideoComment(orgId, channelVideoId)

  const handleCreate = (content: string) => {
    createComment.mutate(content, {
      onError: (err: any) => {
        toast.error(err?.detail || err?.message || t('video.comments.failedToPost', { defaultValue: 'Failed to post comment' }))
      },
    })
  }

  const commentCount = comments?.length
  // The closed panel fetches only a preview, so a saturated preview means
  // "at least this many", not "exactly this many" — label it honestly rather
  // than reporting the preview size as the true count (Phase 9B).
  const commentCountLabel =
    commentCount === undefined
      ? undefined
      : !open && commentCount >= CHANNEL_VIDEO_COMMENTS_PREVIEW_LIMIT
        ? `${CHANNEL_VIDEO_COMMENTS_PREVIEW_LIMIT}+`
        : String(commentCount)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger({ commentCount, commentCountLabel, isLoading })
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('video.comments.open', { defaultValue: 'View comments' })}
            className="gap-1.5 px-3"
          >
            <MessageCircle size={16} aria-hidden="true" className="text-muted-foreground" />
            {commentCountLabel !== undefined && (
              <span className="text-muted-foreground">{commentCountLabel}</span>
            )}
          </Button>
        )}
      </DialogTrigger>
      {/* Phase 9D (M6): the primitive is `w-full max-w-lg` with no inset, so at
          360px the dialog ran edge to edge; and `85vh` ignores the on-screen
          keyboard, which put the composer and Post button underneath it.
          Sized here rather than in components/ui/dialog.tsx — that primitive is
          inherited and shared with the whole LearnHouse tree. */}
      <DialogContent className="w-[95vw] sm:w-full max-h-[85dvh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle>{t('video.comments.title', { defaultValue: 'Comments' })}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-[120px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : !comments || comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('video.comments.empty', { defaultValue: 'No comments yet' })}
            </p>
          ) : (
            comments.map((comment) => (
              <CommentRow
                key={comment.comment_uuid}
                comment={comment}
                currentUserId={currentUserId}
                orgId={orgId}
                channelVideoId={channelVideoId}
              />
            ))
          )}
        </div>

        <div className="pt-3 mt-2 border-t border-border">
          {isAuthenticated ? (
            <CommentComposer
              onSubmit={handleCreate}
              isSubmitting={createComment.isPending}
              placeholder={t('video.comments.writeComment', { defaultValue: 'Write a comment…' })}
              submitLabel={t('video.comments.post', { defaultValue: 'Post' })}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('video.comments.signInToComment', { defaultValue: 'Sign in to comment.' })}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ChannelVideoCommentsPanel
