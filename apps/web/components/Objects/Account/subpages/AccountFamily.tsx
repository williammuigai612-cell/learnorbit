'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { BarChart3, Check, X, Users } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrgMembership } from '@components/Contexts/OrgContext'
import { updateProfile } from '@services/settings/profile'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { getUriWithOrg } from '@services/config/config'
import { getErrorMessage } from '@services/utils/ts/errorMessage'
import { validateChildUsername } from '@/lib/parentLinks/validation'
import { useResolvedUser } from '@/hooks/useResolvedUser'
import {
  useMyParentLinks,
  usePendingParentLinks,
  useRequestParentLink,
  useRespondToParentLink,
} from '@/hooks/queries/useParentLinks'
import type { ParentChildLink } from '@services/users/parentLinks'
import { Switch } from '@components/ui/switch'
import { Input } from '@components/ui/input'
import { Button } from '@components/ui/button'
import { Label } from '@components/ui/label'
import UserAvatar from '@components/Objects/UserAvatar'

function getAvatarUrl(user: any): string | undefined {
  if (!user?.avatar_image) return undefined
  if (user.avatar_image.startsWith('http://') || user.avatar_image.startsWith('https://')) {
    return user.avatar_image
  }
  return getUserAvatarMediaDirectory(user.user_uuid, user.avatar_image)
}

function PendingLinkRow({
  link,
  accessToken,
  onRespond,
  isResponding,
}: {
  link: ParentChildLink
  accessToken: string
  onRespond: (_linkUuid: string, _approve: boolean) => void
  isResponding: boolean
}) {
  const { t } = useTranslation()
  const requester = useResolvedUser(link.parent_user_id, accessToken)

  const displayName = requester
    ? `${requester.first_name} ${requester.last_name}`.trim() || requester.username
    : t('account.family.pending.loading', { defaultValue: 'Loading…' })

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <UserAvatar
          width={36}
          rounded="rounded-full"
          avatar_url={getAvatarUrl(requester)}
        />
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{displayName}</p>
          {requester?.username && (
            <p className="text-xs text-gray-500 truncate">@{requester.username}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isResponding}
          onClick={() => onRespond(link.link_uuid, false)}
        >
          <X size={14} className="me-1" />
          {t('account.family.pending.reject', { defaultValue: 'Decline' })}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isResponding}
          onClick={() => onRespond(link.link_uuid, true)}
          className="bg-black text-white hover:bg-black/90"
        >
          <Check size={14} className="me-1" />
          {t('account.family.pending.accept', { defaultValue: 'Accept' })}
        </Button>
      </div>
    </div>
  )
}

function LinkedFamilyRow({
  link,
  accessToken,
  currentUserId,
  orgslug,
}: {
  link: ParentChildLink
  accessToken: string
  currentUserId: number
  orgslug: string
}) {
  const { t } = useTranslation()
  const isParentSide = link.parent_user_id === currentUserId
  const otherUserId = isParentSide ? link.child_user_id : link.parent_user_id
  const otherUser = useResolvedUser(otherUserId, accessToken)

  const displayName = otherUser
    ? `${otherUser.first_name} ${otherUser.last_name}`.trim() || otherUser.username
    : t('account.family.pending.loading', { defaultValue: 'Loading…' })

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <UserAvatar width={36} rounded="rounded-full" avatar_url={getAvatarUrl(otherUser)} />
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{displayName}</p>
          <p className="text-xs text-gray-500 truncate">
            {isParentSide
              ? t('account.family.linked.role_child', { defaultValue: 'Your child' })
              : t('account.family.linked.role_parent', { defaultValue: 'Your parent' })}
          </p>
        </div>
      </div>
      {isParentSide && (
        <Button asChild size="sm" variant="outline" className="flex-shrink-0">
          <Link href={getUriWithOrg(orgslug, `/account/family/${otherUserId}`)}>
            <BarChart3 size={14} className="me-1" />
            {t('account.family.linked.view_activity', { defaultValue: 'View activity' })}
          </Link>
        </Button>
      )}
    </div>
  )
}

export default function AccountFamily() {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const { orgslug } = useOrgMembership()
  // The session's own user object (UserRead, via GET /users/session) already
  // carries username/email/is_parent — unlike getUser()'s `/users/id/{id}`,
  // which returns UserReadPublic and deliberately excludes email (that's the
  // "look up another user" endpoint, used below for pending-request rows).
  const currentUser = session?.data?.user
  const [isTogglingParent, setIsTogglingParent] = useState(false)
  const [childUsername, setChildUsername] = useState('')
  const [childUsernameError, setChildUsernameError] = useState<string | null>(null)

  const pendingLinksQuery = usePendingParentLinks()
  const myLinksQuery = useMyParentLinks()
  const requestParentLinkMutation = useRequestParentLink()
  const respondToParentLinkMutation = useRespondToParentLink()

  const handleParentToggle = async (checked: boolean) => {
    if (!currentUser || isTogglingParent) return
    setIsTogglingParent(true)
    try {
      await updateProfile(
        { username: currentUser.username, email: currentUser.email, is_parent: checked },
        currentUser.id,
        access_token
      )
      await session.update(true)
      toast.success(
        checked
          ? t('account.family.parent_enabled', { defaultValue: 'Parent account enabled' })
          : t('account.family.parent_disabled', { defaultValue: 'Parent account disabled' })
      )
    } catch (e: any) {
      toast.error(
        getErrorMessage(
          e?.detail,
          t('account.family.parent_toggle_error', {
            defaultValue: 'Could not update this setting. Please try again.',
          })
        )
      )
    } finally {
      setIsTogglingParent(false)
    }
  }

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const error = validateChildUsername(childUsername, currentUser?.username)
    if (error) {
      setChildUsernameError(error)
      return
    }
    setChildUsernameError(null)
    try {
      await requestParentLinkMutation.mutateAsync(childUsername.trim())
      toast.success(
        t('account.family.request_sent', {
          defaultValue: 'Request sent to @{{username}}',
          username: childUsername.trim(),
        })
      )
      setChildUsername('')
    } catch (e: any) {
      toast.error(
        getErrorMessage(
          e?.detail,
          t('account.family.request_error', {
            defaultValue: 'Could not send that request. Please try again.',
          })
        )
      )
    }
  }

  const handleRespond = async (linkUuid: string, approve: boolean) => {
    try {
      await respondToParentLinkMutation.mutateAsync({ linkUuid, approve })
      toast.success(
        approve
          ? t('account.family.link_accepted', { defaultValue: 'Link accepted' })
          : t('account.family.link_declined', { defaultValue: 'Link declined' })
      )
    } catch (e: any) {
      toast.error(
        getErrorMessage(
          e?.detail,
          t('account.family.respond_error', {
            defaultValue: 'Could not update that request. Please try again.',
          })
        )
      )
    }
  }

  const pendingLinks = pendingLinksQuery.data ?? []
  const myLinks = myLinksQuery.data ?? []

  return (
    <div className="bg-white rounded-xl nice-shadow">
      <div className="flex flex-col bg-gray-50 -space-y-1 px-5 py-3 mx-3 my-3 rounded-md">
        <h1 className="font-bold text-xl text-gray-800 flex items-center gap-2">
          <Users size={18} />
          {t('account.family.title', { defaultValue: 'Family' })}
        </h1>
        <h2 className="text-gray-500 text-md">
          {t('account.family.subtitle', {
            defaultValue: 'Link a parent or guardian account to yours',
          })}
        </h2>
      </div>

      <div className="mx-5 my-5 space-y-6">
        {/* Parent toggle */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-gray-50/60">
          <div className="min-w-0">
            <Label htmlFor="is_parent_toggle">
              {t('account.family.parent_toggle_label', {
                defaultValue: "I'm a parent or guardian",
              })}
            </Label>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('account.family.parent_toggle_description', {
                defaultValue: 'Enable this to request a link to a child account.',
              })}
            </p>
          </div>
          <Switch
            id="is_parent_toggle"
            checked={!!currentUser?.is_parent}
            disabled={!currentUser || isTogglingParent}
            onCheckedChange={handleParentToggle}
          />
        </div>

        {/* Request a link (parents only) */}
        {currentUser?.is_parent && (
          <form onSubmit={handleRequestSubmit} className="space-y-2">
            <Label htmlFor="child_username">
              {t('account.family.request_label', { defaultValue: "Request a link to a child's account" })}
            </Label>
            <div className="flex gap-2">
              <Input
                id="child_username"
                value={childUsername}
                onChange={(e) => {
                  setChildUsername(e.target.value)
                  if (childUsernameError) setChildUsernameError(null)
                }}
                placeholder={t('account.family.request_placeholder', {
                  defaultValue: "Child's username",
                })}
              />
              <Button type="submit" disabled={requestParentLinkMutation.isPending}>
                {requestParentLinkMutation.isPending
                  ? t('account.family.request_sending', { defaultValue: 'Sending…' })
                  : t('account.family.request_submit', { defaultValue: 'Send request' })}
              </Button>
            </div>
            {childUsernameError && (
              <p className="text-red-500 text-sm">{childUsernameError}</p>
            )}
          </form>
        )}

        {/* Pending requests (anyone can be a child) */}
        {pendingLinks.length > 0 && (
          <div>
            <Label>
              {t('account.family.pending.title', { defaultValue: 'Pending requests' })}
            </Label>
            <div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100 px-4">
              {pendingLinks.map((link) => (
                <PendingLinkRow
                  key={link.link_uuid}
                  link={link}
                  accessToken={access_token}
                  onRespond={handleRespond}
                  isResponding={respondToParentLinkMutation.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {/* Linked family — every APPROVED link, either side (Phase 7C) */}
        {myLinks.length > 0 && currentUser?.id && (
          <div>
            <Label>
              {t('account.family.linked.title', { defaultValue: 'Linked family' })}
            </Label>
            <div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100 px-4">
              {myLinks.map((link) => (
                <LinkedFamilyRow
                  key={link.link_uuid}
                  link={link}
                  accessToken={access_token}
                  currentUserId={currentUser.id}
                  orgslug={orgslug}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
