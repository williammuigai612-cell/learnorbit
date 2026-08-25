// Utilities for reading and mutating docker-compose.yml content.
// Extracted so tests import the real regex rather than inlining a copy.

/**
 * The image repository upstream LearnHouse deployments run. It stays the
 * default for every entry point here, so an installation whose config carries
 * no `appImage` behaves exactly as it always has.
 */
export const DEFAULT_APP_IMAGE_REPOSITORY = 'ghcr.io/learnhouse/app'

/**
 * Raised when the compose file carries no image for the repository the caller
 * expected.
 *
 * This case used to be indistinguishable from success: `String.replace` with
 * no match returns the input unchanged, so `update` wrote the file back
 * byte-identical, carried on pulling and restarting, and still reported
 * "updated to vX". For a deployment pinned to its own image that silence is
 * the dangerous outcome — it is the difference between "your update did
 * nothing" and "your update did what you asked".
 */
export class ComposeImageMismatchError extends Error {
  readonly expectedRepository: string
  readonly foundImages: string[]
  /** The digest-pinned reference that blocked the match, when that was the cause. */
  readonly digestImage?: string

  constructor(expectedRepository: string, foundImages: string[], digestImage?: string) {
    super(
      digestImage
        ? `docker-compose.yml pins "${expectedRepository}" by digest (${digestImage}). ` +
            'Retagging would drop that digest, so this is refused — a digest is a ' +
            'supply-chain control, not a tag. Repin the service to a plain tag first.'
        : `docker-compose.yml has no image entry for repository "${expectedRepository}"` +
            (foundImages.length
              ? ` (found: ${foundImages.join(', ')})`
              : ' (the file declares no image: entries)'),
    )
    this.name = 'ComposeImageMismatchError'
    this.expectedRepository = expectedRepository
    this.foundImages = foundImages
    this.digestImage = digestImage
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// A real Compose image entry: start of line, indentation only, then the `image:`
// key. Anchoring here is what stops `# image: …` in a comment, or an `image:`
// inside some other value, from being treated as the service's image — an
// unanchored pattern let a commented-out line both satisfy the repository guard
// and absorb the retag, leaving the live service on a different repository while
// the update reported success.
//
// `[^\S\n]` is "horizontal whitespace": it must not cross a line boundary the way
// `\s` would.
const IMAGE_KEY = String.raw`^[^\S\n]*image:[^\S\n]*`
// Optional trailing spaces and an optional trailing `# comment`.
const LINE_TAIL = String.raw`[^\S\n]*(?:#[^\n]*)?$`
// A tag runs to whitespace, and stops at `#` (trailing comment) and `@` (digest).
const TAG = String.raw`[^\s#@]+`

function taggedImagePattern(repository: string): RegExp {
  return new RegExp(`${IMAGE_KEY}(${escapeRegExp(repository)}:${TAG})${LINE_TAIL}`, 'm')
}

// `repo@sha256:…` or `repo:tag@sha256:…`. Matched separately so a digest pin is
// reported as such and refused, never silently rewritten into a plain tag.
function digestImagePattern(repository: string): RegExp {
  return new RegExp(
    `${IMAGE_KEY}(${escapeRegExp(repository)}(?::${TAG})?@[^\\s#]+)${LINE_TAIL}`,
    'm',
  )
}

/** Every `image:` value in the compose file, in file order. Diagnostics only. */
export function listComposeImages(compose: string): string[] {
  return [...compose.matchAll(/^[^\S\n]*image:[^\S\n]*(\S+)/gm)].map((m) => m[1])
}

/**
 * The `repository:tag` the compose file pins for `repository`, or null when it
 * pins none. Callers decide whether null is fatal — `update` fails closed for a
 * configured custom image and preserves the historical behaviour otherwise.
 *
 * Only genuine `image:` entries count; see {@link IMAGE_KEY}.
 */
export function findComposeImageForRepository(
  compose: string,
  repository: string,
): string | null {
  const match = compose.match(taggedImagePattern(repository))
  return match ? match[1] : null
}

/**
 * The digest-pinned reference the compose file carries for `repository`, or null.
 * Used to tell "this repository is absent" apart from "this repository is pinned
 * by digest, which we refuse to rewrite".
 */
export function findComposeDigestImageForRepository(
  compose: string,
  repository: string,
): string | null {
  const match = compose.match(digestImagePattern(repository))
  return match ? match[1] : null
}

/**
 * Split `repo[:tag]` into its parts.
 *
 * A colon only introduces a tag when it comes after the last `/` — otherwise it
 * is a registry port (`localhost:5000/app`).
 */
export function splitImageReference(ref: string): { repository: string; tag?: string } {
  const lastSlash = ref.lastIndexOf('/')
  const lastColon = ref.lastIndexOf(':')
  if (lastColon > lastSlash) {
    return { repository: ref.slice(0, lastColon), tag: ref.slice(lastColon + 1) }
  }
  return { repository: ref }
}

/**
 * Repoint the compose file's app image at `newImage`.
 *
 * `expectedRepository` is the repository the file is required to already pin;
 * it defaults to the upstream one so existing callers and installations are
 * unaffected. A missing match throws {@link ComposeImageMismatchError} rather
 * than returning the input unchanged — "no replacement occurred" is a failure,
 * never a success.
 */
export function replaceComposeImageTag(
  compose: string,
  newImage: string,
  expectedRepository: string = DEFAULT_APP_IMAGE_REPOSITORY,
): string {
  const pattern = taggedImagePattern(expectedRepository)
  const match = compose.match(pattern)
  if (!match) {
    throw new ComposeImageMismatchError(
      expectedRepository,
      listComposeImages(compose),
      findComposeDigestImageForRepository(compose, expectedRepository) ?? undefined,
    )
  }
  // Swap only the reference itself, so the line's indentation and any trailing
  // comment survive untouched.
  const previousImage = match[1]
  return compose.replace(pattern, (line) => line.replace(previousImage, newImage))
}
