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
  const { data: notifications, isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const unreadCount = unread?.count ?? 0
  const label = t('notifications.label', { defaultValue: 'Notifications' })

  return (
    <DropdownMenu onOpenChange={setIsOpen}>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className={cn('relative p-2 rounded-lg transition-colors', iconBtnClass ?? 'hover:bg-muted')}
                aria-label={label}
              >
                <Bell size={20} weight={unreadCount > 0 || isOpen ? 'fill' : 'regular'} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 end-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-destructive text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-background">
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
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Bell size={16} weight="fill" />
            <span>{label}</span>
          </span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs font-normal text-primary hover:underline"
            >
              {t('notifications.mark_all_read', { defaultValue: 'Mark all read' })}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="px-2 py-4 text-center text-xs text-neutral-400">
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
                    <span className="text-xs text-neutral-400">{dayjs(n.creation_date).fromNow()}</span>
                  </span>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <div className="px-2 py-4 text-center text-xs text-neutral-400">
            {t('notifications.empty', { defaultValue: 'No notifications yet' })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationBell
