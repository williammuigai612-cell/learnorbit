'use client'
import { useEffect, useState } from 'react'
import { getUser } from '@services/users/users'

// Resolves another user's public profile (UserReadPublic via GET
// /users/id/{id}) for display purposes — name/username/avatar. Shared by
// AccountFamily's row components and the child-activity view (Phase 7C).
export function useResolvedUser(userId: number | undefined, accessToken: string) {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getUser(String(userId), accessToken)
      .then((data) => {
        if (!cancelled) setUser(data)
      })
      .catch(() => {
        /* caller renders a fallback label when this stays null */
      })
    return () => {
      cancelled = true
    }
  }, [userId, accessToken])

  return user
}
