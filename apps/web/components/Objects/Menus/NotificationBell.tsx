'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Bell } from '@phosphor-icons/react'
import { getUriWithOrg } from '@services/config/config'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import UserAvatar from '@components/Objects/UserAvatar'
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/queries/useNotifications'
import type { Notification } from '@services/organizations/notifications'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@components/ui/tooltip'
import { cn } from '@/lib/utils'

dayjs.extend(relativeTime)

function getAvatarUrl(actor: Notification['actor']): string | undefined {
  if (!actor?.avatar_image) return undefined
  if (actor.avatar_image.startsWith('http://') || actor.avatar_image.startsWith('https://')) {
    return actor.avatar_image
  }
  return getUserAvatarMediaDirectory(actor.user_uuid, actor.avatar_image)
}

// Basic in-app notification bell (Phase 4H / roadmap "Basic notifications").
// A simple indicator + dropdown list per docs/UI_UX_IMPLEMENTATION_PLAN.md
// UI-7 ("a simple list/indicator, not a full real-time system") — mirrors
// OrgMenu.tsx's existing CopilotMenuButton dropdown-trigger pattern rather
// than introducing a new nav surface. Comment notifications only for now
// (notification_type is a plain string, extensible to LIKE later without a
// frontend contract change).
export function NotificationBell({ orgslug, iconBtnClass }: { orgslug: string; iconBtnClass?: string }) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const { data: unread } = useUnreadNotificationCount()
  // Phase 9B: the list is fetched only once the dropdown opens. The badge
  // below reads the separate unread-count query, so the closed bell costs
  // one cheap COUNT rather than 50 hydrated rows on every page.
  const { data: notifications, isLoading } = useNotifications(isOpen)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const unreadCount = unread?.count ?? 0
  const label = t('notifications.label', { defaultValue: 'Notifications' })
  // Phase 9C: `aria-label` overrides the button's contents, so the unread
  // badge rendered inside it never reached the accessibility tree — the bell
  // announced plain "Notifications" whether there were 0 or 9+.
  const triggerLabel =
    unreadCount > 0
      ? t('notifications.labelWithCount', {
          defaultValue: '{{label}}, {{count}} unread',
          label,
          count: unreadCount,
        })
      : label

  return (
    <DropdownMenu onOpenChange={setIsOpen}>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className={cn('relative p-2 rounded-lg transition-colors', iconBtnClass ?? 'hover:bg-muted')}
                aria-label={triggerLabel}
              >
                <Bell size={20} weight={unreadCount > 0 || isOpen ? 'fill' : 'regular'} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 end-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-destructive text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-background"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Bell size={16} weight="fill" aria-hidden="true" />
          <span>{label}</span>
        </DropdownMenuLabel>
        {/* Phase 9C: "Mark all read" was a plain <button> nested in the menu
            label. Radix's roving tabindex only reaches [role="menuitem"], and
            Tab inside the content closes the menu — so the control was
            mouse-only (WCAG 2.1.1). As a real menu item it joins the arrow-key
            order; preventDefault on select keeps the menu open so the list
            visibly updates in place. */}
        {unreadCount > 0 && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              markAllRead.mutate()
            }}
            className="cursor-pointer text-xs font-normal text-primary"
          >
            {t('notifications.mark_all_read', { defaultValue: 'Mark all read' })}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            {t('notifications.loading', { defaultValue: 'Loading…' })}
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <DropdownMenuItem key={n.notification_uuid} asChild className="cursor-pointer">
                <Link
                  href={getUriWithOrg(orgslug, `/videos/${n.channelvideo_id}`)}
                  onClick={() => {
                    if (!n.is_read) markRead.mutate(n.notification_uuid)
                  }}
                  className={cn('flex items-start gap-2 py-2', !n.is_read && 'bg-primary/5')}
                >
                  <UserAvatar
                    width={28}
                    rounded="rounded-full"
                    username={n.actor?.username}
                    avatar_url={getAvatarUrl(n.actor)}
                  />
                  <span className="flex flex-1 flex-col min-w-0">
                    <span className="text-sm text-foreground">
                      <strong className="font-semibold">
                        {n.actor?.first_name || n.actor?.username || t('notifications.someone', { defaultValue: 'Someone' })}
                      </strong>{' '}
                      {t('notifications.commented_on_your_video', {
                        defaultValue: 'commented on your video',
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">{dayjs(n.creation_date).fromNow()}</span>
                  </span>
                  {/* Phase 9C: the dot was the only unread signal — shape and
                      colour with no text equivalent (§22 / WCAG 1.3.1). */}
                  {!n.is_read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  )}
                  {!n.is_read && (
                    <span className="sr-only">
                      {t('notifications.unread', { defaultValue: 'Unread' })}
                    </span>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            {t('notifications.empty', { defaultValue: 'No notifications yet' })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationBell
