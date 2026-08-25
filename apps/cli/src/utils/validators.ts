const RESERVED_TLDS = new Set([
  'local',
  'localhost',
  'test',
  'invalid',
  'example',
])

// RFC 2606 reserved second-level domains. The LearnHouse seeder rejects these,
// silently leaving the install with no admin user, so the CLI must too.
const RESERVED_DOMAINS = new Set([
  'example.com',
  'example.net',
  'example.org',
])

export function validateEmail(value: string): string | undefined {
  if (!value) return 'Email is required'
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(value)) return 'Please enter a valid email address'
  const domain = value.slice(value.lastIndexOf('@') + 1).toLowerCase()
  const tld = domain.includes('.') ? domain.slice(domain.lastIndexOf('.') + 1) : domain
  if (RESERVED_TLDS.has(tld)) {
    return `Reserved TLD ".${tld}" is not accepted. Use a real domain (e.g. admin@yourdomain.com).`
  }
  if (RESERVED_DOMAINS.has(domain)) {
    return `Reserved domain "${domain}" is not accepted — the seeder would create no admin. Use a real domain.`
  }
  return undefined
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Password is required'
  if (value.length < 8) return 'Password must be at least 8 characters'
  return undefined
}

export function validateDomain(value: string): string | undefined {
  if (!value) return 'Domain is required'
  // Allow localhost or valid domain names
  if (value === 'localhost') return undefined
  const re = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
  if (!re.test(value)) return 'Please enter a valid domain (e.g., learnhouse.example.com)'
  return undefined
}

export function validatePort(value: string): string | undefined {
  // Require pure digits — parseInt would otherwise accept "8080abc" as 8080.
  if (!/^\d+$/.test(value.trim())) return 'Port must be between 1 and 65535'
  const num = parseInt(value, 10)
  if (num < 1 || num > 65535) return 'Port must be between 1 and 65535'
  return undefined
}

export function validateSlug(value: string): string | undefined {
  if (!value) return 'Slug is required'
  const re = /^[a-z0-9]+(-[a-z0-9]+)*$/
  if (!re.test(value)) return 'Slug must be lowercase alphanumeric with hyphens only'
  return undefined
}

export function validateRequired(value: string): string | undefined {
  if (!value || value.trim() === '') return 'This field is required'
  return undefined
}

// Optional registry host (lowercase DNS labels, optional :port), then one or
// more lowercase path components. Deliberately strict: the value is written
// verbatim into docker-compose.yml, so anything carrying whitespace — a newline
// above all — could inject YAML of the caller's choosing.
const IMAGE_REPOSITORY_RE =
  /^(?:[a-z0-9]([a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(?::\d+)?\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/
// A Docker tag: word character first, then word characters, dots and hyphens.
// Everything a YAML or shell metacharacter could be — newline, space, `:`, `#`,
// `@`, `/`, `;`, `$`, backtick, quotes, braces, brackets — is outside this set,
// which is what makes a validated tag safe to write into docker-compose.yml.
const IMAGE_TAG_RE = /^\w[\w.-]{0,127}$/
// `lo-` scopes the *git release tag*; it must never survive into an image tag.
const RELEASE_TAG_PREFIX_RE = /^lo-/i

/**
 * Validate a container image reference — a repository (`ghcr.io/owner/name`),
 * optionally with a tag (`ghcr.io/owner/name:1.0.0`).
 *
 * Digests are rejected: `appImage` records the repository a deployment tracks,
 * and `update` retags it, which a pinned digest cannot express.
 */
export function validateImageReference(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Image reference is required'
  if (/\s/.test(value)) return 'Image reference must not contain whitespace'
  if (value.includes('@')) {
    return 'Digest references (name@sha256:…) are not supported — use a repository, optionally with a tag'
  }

  const lastSlash = value.lastIndexOf('/')
  const lastColon = value.lastIndexOf(':')
  const hasTag = lastColon > lastSlash
  const repository = hasTag ? value.slice(0, lastColon) : value
  const tag = hasTag ? value.slice(lastColon + 1) : undefined

  if (!IMAGE_REPOSITORY_RE.test(repository)) {
    return `Invalid image repository "${repository}" — expected a lowercase reference such as ghcr.io/owner/name`
  }
  if (tag !== undefined && !IMAGE_TAG_RE.test(tag)) {
    return `Invalid image tag "${tag}"`
  }
  return undefined
}

/**
 * Validate a container image tag — the part after the `:` in `repo:tag`.
 *
 * Applied to the version `update` is about to splice into `docker-compose.yml`.
 * Without it a value carrying a newline injects YAML of the caller's choosing
 * (an `entrypoint:` override, say) which Docker then executes on the next
 * `up`. The upstream path never had this hole because its registry lookup
 * rejects anything that is not a real tag; the custom-image path skips that
 * lookup by design, so the check has to live here.
 *
 * Rejects a residual `lo-` rather than stripping it again: repeated stripping
 * turns `lo-lo-1.0.0` into a tag that still starts with `lo-`, so the invariant
 * is enforced by validation, not by normalisation.
 */
export function validateImageTag(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Version is required'
  if (/\s/.test(value)) return 'Version must not contain whitespace or newlines'
  if (!IMAGE_TAG_RE.test(value)) {
    return `Invalid version "${value}" — expected a Docker image tag such as 1.0.0 ` +
      '(letters, digits, dots, hyphens and underscores only)'
  }
  if (RELEASE_TAG_PREFIX_RE.test(value)) {
    return `Version "${value}" still carries a release-tag prefix — pass the version ` +
      'on its own, e.g. 1.0.0 (git tags are lo-1.0.0; image tags are 1.0.0)'
  }
  return undefined
}
