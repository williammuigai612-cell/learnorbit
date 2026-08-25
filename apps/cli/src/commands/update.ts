import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { findInstallDir, readConfig } from '../services/config-store.js'
import { dockerComposeDown, dockerComposeUp, dockerComposePull, dockerPullImage } from '../services/docker.js'
import { migrateContentVolume } from '../services/content-volume-migration.js'
import { waitForHealth } from '../services/health.js'
import { validateImageReference, validateImageTag } from '../utils/validators.js'
import {
  ComposeImageMismatchError,
  DEFAULT_APP_IMAGE_REPOSITORY,
  findComposeDigestImageForRepository,
  findComposeImageForRepository,
  listComposeImages,
  replaceComposeImageTag,
} from '../services/compose-utils.js'
import {
  updateEnterprise,
  backupDatabase,
  ensureAlembicBaseline,
  runAlembicUpgrade,
  type EditionLayout,
} from './update-ee.js'

// Community (monolith) layout: one app container, alembic under /app/api, in-container db.
const COMMUNITY_LAYOUT: EditionLayout = { appService: 'learnhouse-app', alembicCwd: '/app/api', dbService: 'db' }

const GHCR_BASE = 'ghcr.io/williammuigai612-cell/learnorbit'

async function resolveTag(version: string): Promise<boolean> {
  try {
    const tokenResp = await fetch(
      'https://ghcr.io/token?scope=repository:williammuigai612-cell/learnorbit:pull',
      { signal: AbortSignal.timeout(5000) },
    )
    if (!tokenResp.ok) return false
    const { token } = (await tokenResp.json()) as { token: string }

    const manifestResp = await fetch(
      `https://ghcr.io/v2/williammuigai612-cell/learnorbit/manifests/${version}`,
      {
        signal: AbortSignal.timeout(5000),
        headers: {
          Accept:
            'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json',
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return manifestResp.ok
  } catch {
    return false
  }
}

export async function updateCommand(options: { version?: string; migrate?: boolean; backup?: boolean }) {
  const dir = findInstallDir()
  const config = readConfig(dir)
  if (!config) {
    p.log.error('No LearnHouse installation found. Run `npx learnhouse setup` first.')
    process.exit(1)
    return
  }

  // Enterprise installs use a different upgrade path: license re-auth, EE images,
  // a pre-upgrade DB backup, and Alembic migrations against the (possibly external) DB.
  if (config.edition === 'enterprise') {
    p.intro(pc.cyan('Upgrading LearnHouse Enterprise'))
    await updateEnterprise(config, {
      version: options.version,
      migrate: options.migrate,
      backup: options.backup,
      interactive: !!process.stdout.isTTY,
    })
    return
  }

  // The repository this deployment tracks. `appImage` makes it a property of
  // the installation; without it, the historical upstream default stands.
  const imageRepository = config.appImage || DEFAULT_APP_IMAGE_REPOSITORY
  const hasCustomImage = !!config.appImage

  // Normalise the two prefix forms we actually support — `lo-1.0.0` (a git
  // release tag) and `v1.0.0` — each exactly once. Anything left over is
  // rejected by validateImageTag below rather than stripped again: repeated
  // stripping would quietly turn `lo-lo-1.0.0` into a tag that still begins
  // with `lo-`. Upstream keeps its own normalisation untouched.
  const versionInput = hasCustomImage
    ? options.version?.replace(/^lo-/, '')
    : options.version
  const targetVersion = versionInput?.replace(/^v/, '')

  const composePath = join(config.installDir, 'docker-compose.yml')

  // Everything below runs before the backup, and therefore before the compose
  // file is written, before any pull or restart, and before migrations.
  if (hasCustomImage && targetVersion !== undefined) {
    // The custom path deliberately makes no registry request, so the registry
    // lookup that incidentally rejected junk versions upstream is not there to
    // catch this. Without the check, a version carrying a newline is spliced
    // straight into docker-compose.yml as extra YAML.
    const versionErr = validateImageTag(targetVersion)
    if (versionErr) {
      p.log.error(`Refusing to update — ${versionErr}`)
      process.exit(1)
      return
    }
  }

  // FAIL CLOSED, before anything is backed up, pulled or restarted: a
  // deployment pinned to its own image must already be running that image. If
  // it is not, the old code silently left the compose file untouched and still
  // reported success — the one outcome that must never happen, because the next
  // step would otherwise be to point this install at a different repository.
  if (hasCustomImage) {
    const currentCompose = readFileSync(composePath, 'utf-8')
    const pinned = findComposeImageForRepository(currentCompose, imageRepository)
    if (!pinned) {
      const digest = findComposeDigestImageForRepository(currentCompose, imageRepository)
      p.log.error(
        digest
          ? `Digest-pinned image — refusing to update.\n` +
              `  docker-compose.yml pins: ${digest}\n` +
              `Retagging would silently drop that digest, which is a supply-chain control. ` +
              `Nothing was changed: no pull, no restart, no migration. Repin the service to a ` +
              `plain tag (${imageRepository}:<version>) if you want the CLI to manage it.`
          : `Image mismatch — refusing to update.\n` +
              `  configured (learnhouse.config.json appImage): ${imageRepository}\n` +
              `  docker-compose.yml images:                    ${listComposeImages(currentCompose).join(', ') || '(none)'}\n` +
              `Nothing was changed: no pull, no restart, no migration. Point docker-compose.yml ` +
              `at ${imageRepository} or correct appImage, then re-run.`,
      )
      process.exit(1)
      return
    }
  }

  if (targetVersion) {
    p.intro(pc.cyan(`Updating LearnHouse to v${targetVersion}`))
  } else {
    p.intro(pc.cyan('Updating LearnHouse to latest'))
  }

  const ui = {
    log: (m: string) => p.log.info(m),
    ok: (m: string) => p.log.success(m),
    warn: (m: string) => p.log.warn(m),
  }
  const s = p.spinner()

  // Resolve a deployment-pinned target BEFORE anything is written. The compose
  // rewrite further down is permanent, so a tag that does not exist has to fail
  // while docker-compose.yml still pins the image this install is running —
  // otherwise `update --to <bad-tag>` exits 1 and leaves the deployment
  // pointing at an image that cannot be pulled, which the next `up` cannot
  // start. The upstream path already had this ordering (its registry lookup
  // runs before the rewrite); the custom path deliberately makes no registry
  // request, so the pull itself does the resolving. It is the same fetch
  // `docker compose pull` performs later, just done while it is still undoable.
  let customTargetImage: string | undefined
  if (hasCustomImage) {
    customTargetImage = `${imageRepository}:${targetVersion || 'latest'}`
    if (!targetVersion) {
      p.log.warn(
        `No --to version given, so this targets ${imageRepository}:latest. ` +
          'Deployments that publish only immutable version tags should pass --to <version>.',
      )
    }
    // `targetVersion` is already validated above; the repository half comes from
    // learnhouse.config.json, which `setup` validated but a hand edit could not.
    // Vet the whole reference before it reaches a shell.
    const refErr = validateImageReference(customTargetImage)
    if (refErr) {
      p.log.error(`Refusing to update — ${refErr}`)
      process.exit(1)
      return
    }
    s.start(`Resolving ${customTargetImage}`)
    try {
      dockerPullImage(customTargetImage, config.installDir)
      s.stop(`Pulled ${customTargetImage}`)
    } catch {
      s.stop('Image could not be pulled')
      p.log.error(
        `Could not pull ${customTargetImage} — refusing to update.\n` +
          `Nothing was changed: docker-compose.yml still pins the image this ` +
          `deployment is running, and there was no backup, restart or migration. ` +
          `Check the tag exists in ${imageRepository} (and that you are logged in ` +
          `to its registry), then re-run.`,
      )
      process.exit(1)
      return
    }
  }

  try {
    // 1) Back up the database first (safety net for migrations) — works for the
    //    in-container db AND an external one via the .env string.
    if (options.backup !== false) {
      s.start('Backing up the database')
      try {
        const b = backupDatabase(config, COMMUNITY_LAYOUT, ui)
        s.stop('Database backed up')
        ui.ok(`Backup: ${b}`)
      } catch (err) {
        s.stop('Backup failed')
        p.log.error(`Database backup failed: ${(err as Error)?.message ?? err}. Aborting — nothing changed.`)
        process.exit(1)
      }
    } else {
      p.log.warn('Skipping database backup (--no-backup). Not recommended for production.')
    }
    // 2) Stamp an Alembic baseline if the DB was created via create_all and never stamped.
    ensureAlembicBaseline(config.installDir, COMMUNITY_LAYOUT, ui)

    // Resolve the target image tag
    let targetImage: string
    if (customTargetImage) {
      // Deliberately no registry probe: resolveTag() only knows how to ask
      // about ghcr.io/williammuigai612-cell/learnorbit, and asking it about a custom repository
      // would either 404 a valid version or, worse, hand back the upstream
      // image. The repository never changes here — only the tag does. The tag
      // was already resolved (and pulled) by the pre-flight above.
      targetImage = customTargetImage
    } else if (targetVersion) {
      s.start(`Checking if v${targetVersion} exists`)
      const exists = await resolveTag(targetVersion)
      if (!exists) {
        // Also try with 'v' prefix
        const existsWithV = await resolveTag(`v${targetVersion}`)
        if (!existsWithV) {
          s.stop('Version not found')
          p.log.error(
            `Version ${targetVersion} not found on ghcr.io/williammuigai612-cell/learnorbit`,
          )
          process.exit(1)
        }
        targetImage = `${GHCR_BASE}:v${targetVersion}`
      } else {
        targetImage = `${GHCR_BASE}:${targetVersion}`
      }
      s.stop(`Found v${targetVersion}`)
    } else {
      targetImage = `${GHCR_BASE}:latest`
    }

    // Update the image in docker-compose.yml
    const composeContent = readFileSync(composePath, 'utf-8')
    let nextCompose: string
    try {
      nextCompose = replaceComposeImageTag(composeContent, targetImage, imageRepository)
    } catch (err) {
      if (!(err instanceof ComposeImageMismatchError)) throw err
      // The custom path already failed closed above, so reaching here means an
      // upstream install whose compose does not pin the upstream image. That
      // used to pass silently; keep the same control flow so existing
      // installations are unaffected, but stop being silent about it.
      p.log.warn(
        `docker-compose.yml pins no ${imageRepository} image, so its tag was left as-is ` +
          `(found: ${err.foundImages.join(', ') || 'none'}).`,
      )
      nextCompose = composeContent
    }
    writeFileSync(composePath, nextCompose)

    // Preserve any uploaded media before the container is recreated.
    s.start('Checking content storage')
    try {
      const migration = migrateContentVolume(config.installDir, config.deploymentId)
      switch (migration.status) {
        case 'migrated':
          s.stop(
            `Migrated uploaded content into persistent volume (${formatBytes(migration.copiedBytes ?? 0)})`,
          )
          break
        case 'patched_no_data':
          s.stop('Added persistent content volume to docker-compose.yml')
          break
        case 'already_mounted':
          s.stop('Content storage already persistent')
          break
        case 'skipped_s3':
          s.stop('Content served from S3 — no local volume needed')
          break
        case 'no_compose':
          s.stop('Skipped content migration (no docker-compose.yml found)')
          break
      }
    } catch (err) {
      s.stop('Content migration failed')
      const msg = err instanceof Error ? err.message : String(err)
      p.log.warn(`Could not migrate uploaded content: ${msg}`)
    }

    s.start('Pulling new image (this may take a minute)')
    dockerComposePull(config.installDir)
    s.stop('Image pulled')

    s.start('Restarting services')
    dockerComposeDown(config.installDir)
    dockerComposeUp(config.installDir, true)
    s.stop('Services restarted')

    // 4) Wait for the app, then run migrations via the shared helper.
    s.start('Waiting for LearnHouse to be ready')
    await waitForHealth(`http://localhost:${config.httpPort}`)
    s.stop('LearnHouse is up')

    if (options.migrate !== false) {
      p.log.step('Running database migrations')
      if (!runAlembicUpgrade(config.installDir, COMMUNITY_LAYOUT, ui)) {
        p.log.warn('Your DB backup is in ./backups/ — restore it and re-pin the previous image to roll back.')
        process.exit(1)
      }
    } else {
      p.log.info('Skipped migrations (--no-migrate). Run later:')
      p.log.info('  docker compose exec learnhouse-app sh -c "cd /app/api && uv run alembic upgrade head"')
    }

    if (targetVersion) {
      p.log.success(`LearnHouse has been updated to v${targetVersion}!`)
    } else {
      p.log.success('LearnHouse has been updated to the latest version!')
    }
  } catch {
    s.stop('Update failed')
    p.log.error('Failed to update. Check Docker output above.')
    process.exit(1)
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

