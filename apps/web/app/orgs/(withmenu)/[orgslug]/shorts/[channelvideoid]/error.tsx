'use client' // Error components must be Client Components

import BoundaryError from '@components/Objects/StyledElements/Error/BoundaryError'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <BoundaryError error={error} reset={reset} />
}
