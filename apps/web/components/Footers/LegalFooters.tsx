'use client'
// Shared legal/footer bits, ported from the platform's look.
//
// AuthFooter   — the "By continuing, you agree to … Terms of Service and
//                Privacy Policy." line shown under the auth forms.
// CopyrightFooter — the "© {year} LearnOrbit" line for app surfaces
//                (the apex /home hub, the onboarding page, …).
//
// This app does not host its own legal pages. Links resolve via
// getPlatformUrl() and are rendered ONLY when that resolves to something —
// there is deliberately no hardcoded fallback, so an unconfigured deployment
// omits the links entirely rather than pointing users at a third party's
// terms and misrepresenting who operates the service.
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getPlatformUrl } from '@services/config/config'

// Resolved per render rather than at module scope: runtime config is not
// guaranteed to be populated at import time, and link visibility now depends
// on the resolved value being accurate.
function getLegalUrls() {
  return {
    terms: getPlatformUrl('/terms'),
    privacy: getPlatformUrl('/privacy'),
  }
}

export function AuthFooter({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const { terms, privacy } = getLegalUrls()

  // With no legal documents configured the consent sentence has nothing to
  // point at, so the whole line is omitted rather than left dangling.
  if (!terms || !privacy) return null

  return (
    <div className={`pb-8 pt-6 text-center px-6 ${className}`}>
      <p className="text-[13px] text-black/30 font-medium">
        {t('auth.terms_text', { defaultValue: 'By continuing, you agree to the' })}{' '}
        <Link
          href={terms}
          target="_blank"
          rel="noopener noreferrer"
          className="text-black/50 hover:text-black/70 transition-colors"
        >
          {t('auth.terms_of_service', { defaultValue: 'Terms of Service' })}
        </Link>{' '}
        {t('auth.and', { defaultValue: 'and' })}{' '}
        <Link
          href={privacy}
          target="_blank"
          rel="noopener noreferrer"
          className="text-black/50 hover:text-black/70 transition-colors"
        >
          {t('auth.privacy_policy', { defaultValue: 'Privacy Policy' })}
        </Link>
        .
      </p>
    </div>
  )
}

export function CopyrightFooter({
  year,
  className = '',
  tone = 'light',
}: {
  year: number
  className?: string
  // `light` → dark text on light bg; `dark` → light text on dark bg.
  tone?: 'light' | 'dark'
}) {
  const { t } = useTranslation()
  const base = tone === 'dark' ? 'text-white/40' : 'text-black/35'
  const link = tone === 'dark' ? 'text-white/60 hover:text-white/80' : 'text-black/55 hover:text-black/75'
  const { terms, privacy } = getLegalUrls()
  return (
    <footer className={`w-full py-6 px-6 ${className}`}>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium">
        <p className={base}>
          {t('common.copyright', { defaultValue: '© {{year}} LearnOrbit', year })}
        </p>
        {terms && privacy && (
          <nav className="flex items-center gap-x-5">
            <Link
              href={terms}
              target="_blank"
              rel="noopener noreferrer"
              className={`${link} transition-colors`}
            >
              {t('auth.terms_of_service', { defaultValue: 'Terms of Service' })}
            </Link>
            <Link
              href={privacy}
              target="_blank"
              rel="noopener noreferrer"
              className={`${link} transition-colors`}
            >
              {t('auth.privacy_policy', { defaultValue: 'Privacy Policy' })}
            </Link>
          </nav>
        )}
      </div>
    </footer>
  )
}
