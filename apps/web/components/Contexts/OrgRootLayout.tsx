import type React from 'react'
import { OrgProvider } from '@components/Contexts/OrgContext'
import OrgLanguageSync from '@components/Contexts/OrgLanguageSync'
import NextTopLoader from 'nextjs-toploader'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import '@styles/globals.css'
import Footer from '@components/Footer/Footer'
import CompleteSignupFields from '@components/Auth/CompleteSignupFields'

/**
 * The org-scoped root shell: `OrgProvider` + the chrome every org route
 * needs regardless of which sub-tree it lives in (top loader, toast host,
 * signup-completion gate, global footer). Extracted out of a single
 * `[orgslug]/layout.tsx` so it can be shared by two physical layout files —
 * `app/orgs/(withmenu)/[orgslug]/layout.tsx` and `app/orgs/[orgslug]/layout.tsx`
 * (dash) — without duplicating this JSX. See docs/ARCHITECTURE.md §
 * "Next.js dynamic-segment/route-group 404" for why the route tree is split
 * this way.
 */
export function OrgRootLayout({
  orgslug,
  children,
}: {
  orgslug: string
  children: React.ReactNode
}) {
  return (
    <div>
      <OrgProvider orgslug={orgslug}>
        <OrgLanguageSync />
        <NextTopLoader color="#2e2e2e" initialPosition={0.3} height={4} easing={'ease'} speed={500} showSpinner={false} />
        <Toast />
        <CompleteSignupFields />
        {children}
        <Footer />
      </OrgProvider>
    </div>
  )
}
