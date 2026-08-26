import pc from 'picocolors'
import { VERSION, APP_IMAGE, DEV_IMAGE } from '../constants.js'

const NPM_REGISTRY_URL = 'https://registry.npmjs.org/learnhouse'

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
  }
  return 0
}

/**
 * Check npm for the latest version and warn if outdated.
 * Non-blocking — silently fails on network errors.
 */
export async function checkForUpdates(): Promise<void> {
  try {
    const resp = await fetch(NPM_REGISTRY_URL, {
      signal: AbortSignal.timeout(3000),
      headers: { Accept: 'application/json' },
    })
    if (!resp.ok) return
    const data = await resp.json() as { 'dist-tags'?: { latest?: string } }
    const latest = data['dist-tags']?.latest
    if (!latest) return

    if (compareVersions(latest, VERSION) > 0) {
      console.log()
      console.log(pc.yellow(`  Update available: ${VERSION} → ${pc.bold(latest)}`))
      console.log(pc.dim(`  Run: npx learnhouse@latest`))
      console.log()
    }
  } catch {
    // Network error — skip silently
  }
}

/**
 * Resolve the Docker image this installation should run.
 *
 * - channel 'dev'    → the dev image
 * - channel 'stable' → the pinned LearnOrbit release (`APP_IMAGE`)
 *
 * Deliberately offline and deterministic. `release.yaml` publishes exactly one
 * immutable tag per `lo-X.Y.Z` git tag and no `:latest`
 * (docs/DEPLOYMENT_PLAN.md §12.4), so there is nothing to discover: the version
 * this CLI ships with *is* the answer. The lookup this replaces read
 * upstream's release feed (`learnhouse/learnhouse`), which let upstream's
 * numbering decide what a LearnOrbit deployment ran, and fell back to
 * `:latest` — a tag this project never publishes, so the fallback could only
 * ever pin an image that cannot be pulled.
 *
 * `isLatest` is kept in the shape callers destructure; it can no longer be
 * true on either channel.
 */
export async function resolveAppImage(
  channel: 'stable' | 'dev' = 'stable',
): Promise<{ image: string; isLatest: boolean }> {
  return { image: channel === 'dev' ? DEV_IMAGE : APP_IMAGE, isLatest: false }
}
