// Client-side pre-check for the parent-link request form. Catches the
// obvious empty/self-link cases before a round trip; the backend
// (request_parent_link) remains the source of truth for both (400 on
// self-link by id, not username) and for unknown usernames.
export function validateChildUsername(
  value: string,
  ownUsername?: string
): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return 'Enter a username'
  }
  if (ownUsername && trimmed.toLowerCase() === ownUsername.toLowerCase()) {
    return "You can't link your own account"
  }
  return null
}
