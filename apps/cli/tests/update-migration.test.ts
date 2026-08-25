import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Isolated file: control migrateContentVolume's return status so updateCommand's
// content-migration switch executes the "migrated" and "no_compose" arms (the
// real helper needs a live daemon to ever report 'migrated').
vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process')
  return { ...actual, execSync: vi.fn(() => Buffer.from('')) }
})
const promptStub = vi.hoisted(() => ({
  log: { error: () => {}, info: () => {}, success: () => {}, warn: () => {}, warning: () => {}, message: () => {}, step: () => {} },
  intro: () => {}, outro: () => {}, cancel: () => {}, note: () => {},
  spinner: () => ({ start: () => {}, stop: () => {}, message: () => {} }),
  isCancel: () => false,
  confirm: async () => true,
}))
vi.mock('@clack/prompts', () => promptStub)
const migMock = vi.hoisted(() => ({ status: 'migrated' as string, copiedBytes: 8192 }))
vi.mock('../src/services/content-volume-migration.js', () => ({
  migrateContentVolume: () => ({ status: migMock.status, copiedBytes: migMock.copiedBytes }),
  patchComposeAddContentVolume: (c: string) => c,
}))
// updateCommand waits for the app to come back up. Nothing is listening in a
// unit test, so the real helper polls until HEALTH_CHECK_TIMEOUT_MS (180s)
// elapses — three minutes per test that reaches it. Same stub the other
// command suites use (see setup-ci-port.test.ts).
vi.mock('../src/services/health.js', () => ({
  waitForHealth: async () => true,
  waitForOrgSeed: async () => true,
  waitForEeReady: async () => 'ee',
}))

import { updateCommand } from '../src/commands/update.js'

describe('update — content-migration status arms', () => {
  let home: string
  let installDir: string
  let origHome: string | undefined

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-updm-'))
    installDir = path.join(home, '.learnhouse', 'test')
    fs.mkdirSync(installDir, { recursive: true })
    fs.writeFileSync(path.join(installDir, 'learnhouse.config.json'), JSON.stringify({
      version: '1.4.0', deploymentId: 'dep1', createdAt: '2026-01-01T00:00:00Z',
      installDir, domain: 'localhost', httpPort: 8080,
      useHttps: false, autoSsl: false, useExternalDb: false, orgSlug: 'default',
    }))
    fs.writeFileSync(path.join(installDir, '.env'), 'LEARNHOUSE_DOMAIN=localhost\n')
    fs.writeFileSync(path.join(installDir, 'docker-compose.yml'),
      'name: learnhouse-dep1\nservices:\n  learnhouse-app:\n    image: ghcr.io/learnhouse/app:1.4.0\n')
    origHome = process.env.HOME
    process.env.HOME = home
    vi.spyOn(process, 'exit').mockImplementation(((c?: number) => { throw new Error(`exit ${c}`) }) as never)
  })
  afterEach(() => {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome
    fs.rmSync(home, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('reports the migrated byte count when content moves into the volume', async () => {
    migMock.status = 'migrated'
    await expect(updateCommand({ backup: false, migrate: false })).resolves.toBeUndefined()
  })

  it('notes a skipped migration when there is no docker-compose.yml', async () => {
    migMock.status = 'no_compose'
    await expect(updateCommand({ backup: false, migrate: false })).resolves.toBeUndefined()
  })
})

// ─── update with a deployment-pinned image ──────────────────
//
// The failure this guards against: `update` derived its target from a constant
// compiled into the CLI, so on a deployment running its own image it either
// rewrote the compose to the upstream image, or silently matched nothing and
// still reported success. Both must now be impossible.

describe('update — appImage (deployment-pinned image)', () => {
  const LO = 'ghcr.io/williammuigai612-cell/learnorbit'
  let home: string
  let installDir: string
  let origHome: string | undefined

  const write = (cfgExtra: Record<string, unknown>, composeImage: string) => {
    fs.writeFileSync(path.join(installDir, 'learnhouse.config.json'), JSON.stringify({
      version: '1.4.0', deploymentId: 'dep1', createdAt: '2026-01-01T00:00:00Z',
      installDir, domain: 'localhost', httpPort: 8080,
      useHttps: false, autoSsl: false, useExternalDb: false, orgSlug: 'default',
      ...cfgExtra,
    }))
    fs.writeFileSync(path.join(installDir, 'docker-compose.yml'),
      `name: learnhouse-dep1\nservices:\n  learnhouse-app:\n    image: ${composeImage}\n  db:\n    image: pgvector/pgvector:pg16\n`)
  }
  const compose = () => fs.readFileSync(path.join(installDir, 'docker-compose.yml'), 'utf-8')

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-updimg-'))
    installDir = path.join(home, '.learnhouse', 'test')
    fs.mkdirSync(installDir, { recursive: true })
    fs.writeFileSync(path.join(installDir, '.env'), 'LEARNHOUSE_DOMAIN=localhost\n')
    origHome = process.env.HOME
    process.env.HOME = home
    migMock.status = 'already_mounted'
    vi.spyOn(process, 'exit').mockImplementation(((c?: number) => { throw new Error(`exit ${c}`) }) as never)
  })
  afterEach(() => {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome
    fs.rmSync(home, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('retags the configured repository and never substitutes the upstream image', async () => {
    write({ appImage: LO }, `${LO}:1.0.0`)
    await updateCommand({ version: '1.0.1', backup: false, migrate: false })
    expect(compose()).toContain(`image: ${LO}:1.0.1`)
    expect(compose()).not.toContain('ghcr.io/learnhouse/app')
    expect(compose()).toContain('image: pgvector/pgvector:pg16')
  })

  it('strips a pasted lo- release prefix instead of producing learnorbit:lo-1.0.1', async () => {
    write({ appImage: LO }, `${LO}:1.0.0`)
    await updateCommand({ version: 'lo-1.0.1', backup: false, migrate: false })
    expect(compose()).toContain(`image: ${LO}:1.0.1`)
    expect(compose()).not.toContain('lo-1.0.1')
  })

  it('fails closed when the compose runs a different repository', async () => {
    write({ appImage: LO }, 'ghcr.io/learnhouse/app:1.4.0')
    await expect(
      updateCommand({ version: '1.0.1', backup: false, migrate: false }),
    ).rejects.toThrow(/exit 1/)
  })

  it('leaves the compose byte-identical on a mismatch', async () => {
    write({ appImage: LO }, 'ghcr.io/learnhouse/app:1.4.0')
    const before = compose()
    await expect(
      updateCommand({ version: '1.0.1', backup: false, migrate: false }),
    ).rejects.toThrow(/exit 1/)
    expect(compose()).toBe(before)
  })

  it('does not pull, restart or migrate on a mismatch', async () => {
    const { execSync } = await import('node:child_process')
    write({ appImage: LO }, 'ghcr.io/learnhouse/app:1.4.0')
    vi.mocked(execSync).mockClear()
    await expect(
      updateCommand({ version: '1.0.1', backup: false, migrate: false }),
    ).rejects.toThrow(/exit 1/)
    const ran = vi.mocked(execSync).mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
    expect(ran).not.toMatch(/docker compose pull/)
    expect(ran).not.toMatch(/docker compose (up|down)/)
    expect(ran).not.toMatch(/alembic/)
  })

  it('a config without appImage keeps the upstream repository', async () => {
    write({}, 'ghcr.io/learnhouse/app:1.4.0')
    await updateCommand({ backup: false, migrate: false })
    expect(compose()).toContain('image: ghcr.io/learnhouse/app:')
    expect(compose()).not.toContain(LO)
  })
})

// ─── Security regressions for the deployment-aware image ────────
//
// Every case below reproduces a finding from the security review at the level
// of the real `updateCommand`, so it proves the whole path — not just the
// helper — fails closed.

describe('update — security regressions (appImage)', () => {
  const LO = 'ghcr.io/williammuigai612-cell/learnorbit'
  const DIGEST = `sha256:${'a'.repeat(64)}`
  let home: string
  let installDir: string
  let origHome: string | undefined

  const write = (cfgExtra: Record<string, unknown>, composeBody: string) => {
    fs.writeFileSync(path.join(installDir, 'learnhouse.config.json'), JSON.stringify({
      version: '1.4.0', deploymentId: 'dep1', createdAt: '2026-01-01T00:00:00Z',
      installDir, domain: 'localhost', httpPort: 8080,
      useHttps: false, autoSsl: false, useExternalDb: false, orgSlug: 'default',
      ...cfgExtra,
    }))
    fs.writeFileSync(path.join(installDir, 'docker-compose.yml'), composeBody)
  }
  const compose = () => fs.readFileSync(path.join(installDir, 'docker-compose.yml'), 'utf-8')
  const ranCommands = async () => {
    const { execSync } = await import('node:child_process')
    return vi.mocked(execSync).mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
  }

  beforeEach(async () => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-updsec-'))
    installDir = path.join(home, '.learnhouse', 'test')
    fs.mkdirSync(installDir, { recursive: true })
    fs.writeFileSync(path.join(installDir, '.env'), 'LEARNHOUSE_DOMAIN=localhost\n')
    origHome = process.env.HOME
    process.env.HOME = home
    migMock.status = 'already_mounted'
    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockClear()
    vi.spyOn(process, 'exit').mockImplementation(((c?: number) => { throw new Error(`exit ${c}`) }) as never)
  })
  afterEach(() => {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome
    fs.rmSync(home, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  // HIGH-1 — the exact bypass the review demonstrated.
  describe('a commented-out image cannot satisfy the repository guard', () => {
    const commented =
      `name: learnhouse-dep1\nservices:\n  learnhouse-app:\n` +
      `    # image: ${LO}:1.0.0\n` +
      `    image: ghcr.io/learnhouse/app:1.4.0\n`

    it('fails with a non-zero result', async () => {
      write({ appImage: LO }, commented)
      await expect(
        updateCommand({ version: '1.0.1', backup: false, migrate: false }),
      ).rejects.toThrow(/exit 1/)
    })

    it('leaves docker-compose.yml byte-identical', async () => {
      write({ appImage: LO }, commented)
      const before = compose()
      await expect(
        updateCommand({ version: '1.0.1', backup: false, migrate: false }),
      ).rejects.toThrow(/exit 1/)
      expect(compose()).toBe(before)
      expect(compose()).toContain('image: ghcr.io/learnhouse/app:1.4.0')
    })

    it('does not pull, restart or migrate', async () => {
      write({ appImage: LO }, commented)
      await expect(
        updateCommand({ version: '1.0.1', backup: false, migrate: false }),
      ).rejects.toThrow(/exit 1/)
      const ran = await ranCommands()
      expect(ran).not.toMatch(/docker compose pull/)
      expect(ran).not.toMatch(/docker compose (up|down)/)
      expect(ran).not.toMatch(/alembic/)
    })
  })

  // HIGH-2 — a crafted --to must never reach the compose file.
  describe('custom version validation', () => {
    const good = `name: learnhouse-dep1\nservices:\n  learnhouse-app:\n    image: ${LO}:1.0.0\n`

    it('rejects a YAML-injection version before touching the compose file', async () => {
      write({ appImage: LO }, good)
      const before = compose()
      await expect(
        updateCommand({
          version: '1.0.0\n    entrypoint: ["sh","-c","id > /tmp/pwn"]',
          backup: false, migrate: false,
        }),
      ).rejects.toThrow(/exit 1/)
      expect(compose()).toBe(before)
      expect(compose()).not.toContain('entrypoint')
      const ran = await ranCommands()
      expect(ran).not.toMatch(/docker compose (pull|up|down)/)
      expect(ran).not.toMatch(/alembic/)
    })

    it.each([
      ['1.0.0;id'], ['1.0.0$(id)'], ['1.0.0 extra'], ['a/b'], ['a@b'], ['a:b'],
    ])('rejects %s', async (bad) => {
      write({ appImage: LO }, good)
      const before = compose()
      await expect(
        updateCommand({ version: bad, backup: false, migrate: false }),
      ).rejects.toThrow(/exit 1/)
      expect(compose()).toBe(before)
    })
  })

  // LOW-6 — normalise the supported forms, reject the rest.
  describe('release-tag prefix handling', () => {
    const good = `name: learnhouse-dep1\nservices:\n  learnhouse-app:\n    image: ${LO}:1.0.0\n`

    it.each([
      ['1.0.0', '1.0.0'],
      ['lo-2.0.0', '2.0.0'],
      ['v2.10.3', '2.10.3'],
      ['lo-v3.1.4', '3.1.4'],
    ])('%s normalises to :%s', async (input, expected) => {
      write({ appImage: LO }, good)
      await updateCommand({ version: input, backup: false, migrate: false })
      expect(compose()).toContain(`image: ${LO}:${expected}`)
      expect(compose()).not.toMatch(/image:.*:lo-/i)
    })

    it.each([['lo-lo-1.0.0'], ['vlo-1.0.0'], ['LO-1.0.0']])('rejects %s', async (bad) => {
      write({ appImage: LO }, good)
      const before = compose()
      await expect(
        updateCommand({ version: bad, backup: false, migrate: false }),
      ).rejects.toThrow(/exit 1/)
      expect(compose()).toBe(before)
      expect(compose()).not.toMatch(/:lo-/i)
    })
  })

  // MEDIUM-4 — a digest pin is refused, never rewritten away.
  it('refuses to retag a digest-pinned service', async () => {
    const pinned = `name: learnhouse-dep1\nservices:\n  learnhouse-app:\n    image: ${LO}:1.0.0@${DIGEST}\n`
    write({ appImage: LO }, pinned)
    const before = compose()
    await expect(
      updateCommand({ version: '1.0.1', backup: false, migrate: false }),
    ).rejects.toThrow(/exit 1/)
    expect(compose()).toBe(before)
    expect(compose()).toContain(DIGEST)
  })

  // Requirement 11 / review item: no registry request on the custom path.
  it('makes no registry request on the custom-image path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    write({ appImage: LO }, `name: x\nservices:\n  learnhouse-app:\n    image: ${LO}:1.0.0\n`)
    await updateCommand({ version: '1.0.1', backup: false, migrate: false })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(compose()).toContain(`image: ${LO}:1.0.1`)
  })

  // The previously-untested upstream warn arm.
  it('warns but proceeds when an upstream install pins no upstream image', async () => {
    write({}, 'name: learnhouse-dep1\nservices:\n  learnhouse-app:\n    image: someone/else:1.0.0\n')
    const before = compose()
    await updateCommand({ backup: false, migrate: false })
    expect(compose()).toBe(before)
  })
})

// ─── update --to <tag that does not exist> ──────────────────────
//
// The production bug: on a deployment-pinned image the compose file was
// rewritten to the requested tag *before* anything checked that the tag could
// be pulled. `docker compose pull` then failed, the command exited 1 — and the
// installation was left permanently pinned to an image that does not exist, so
// the next `up` had nothing to start. Failing must leave the install exactly
// as it was.

describe('update — an unresolvable custom image leaves the install untouched', () => {
  const LO = 'ghcr.io/williammuigai612-cell/learnorbit'
  const BAD = '0.0.0-nonexistent'
  let home: string
  let installDir: string
  let origHome: string | undefined

  const write = (cfgExtra: Record<string, unknown>, composeImage: string) => {
    fs.writeFileSync(path.join(installDir, 'learnhouse.config.json'), JSON.stringify({
      version: '1.4.0', deploymentId: 'dep1', createdAt: '2026-01-01T00:00:00Z',
      installDir, domain: 'localhost', httpPort: 8080,
      useHttps: false, autoSsl: false, useExternalDb: false, orgSlug: 'default',
      ...cfgExtra,
    }))
    fs.writeFileSync(path.join(installDir, 'docker-compose.yml'),
      `name: learnhouse-dep1\nservices:\n  learnhouse-app:\n    image: ${composeImage}\n  db:\n    image: pgvector/pgvector:pg16\n`)
  }
  const compose = () => fs.readFileSync(path.join(installDir, 'docker-compose.yml'), 'utf-8')
  const ranCommands = async () => {
    const { execSync } = await import('node:child_process')
    return vi.mocked(execSync).mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
  }
  // A registry that does not have `tag`. Both ways of asking for it fail — the
  // direct `docker pull repo:tag`, and the `docker compose pull` that resolves
  // whatever docker-compose.yml currently pins. The second arm is what makes
  // this a regression test rather than a test of the new code path: on the old
  // ordering the compose file was already rewritten by the time compose pull
  // ran, so the failure arrived too late to be undone. Everything else docker
  // is asked to do still succeeds, isolating "this image cannot be resolved"
  // from "docker is broken".
  const registryRejects = async (tag: string) => {
    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockImplementation(((cmd: string) => {
      const c = String(cmd)
      const unknown = () => {
        throw new Error(`manifest unknown: manifest tagged "${tag}" not found`)
      }
      if (c.startsWith('docker pull ') && c.includes(tag)) unknown()
      if (c.includes('docker compose pull') && compose().includes(tag)) unknown()
      return Buffer.from('')
    }) as never)
  }
  const dockerAlwaysSucceeds = async () => {
    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockReset()
    vi.mocked(execSync).mockImplementation((() => Buffer.from('')) as never)
  }

  beforeEach(async () => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-updpull-'))
    installDir = path.join(home, '.learnhouse', 'test')
    fs.mkdirSync(installDir, { recursive: true })
    fs.writeFileSync(path.join(installDir, '.env'), 'LEARNHOUSE_DOMAIN=localhost\n')
    origHome = process.env.HOME
    process.env.HOME = home
    migMock.status = 'already_mounted'
    await dockerAlwaysSucceeds()
    vi.spyOn(process, 'exit').mockImplementation(((c?: number) => { throw new Error(`exit ${c}`) }) as never)
  })
  afterEach(async () => {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome
    fs.rmSync(home, { recursive: true, force: true })
    // Hand the shared module mock back in its default (always-succeeds) state.
    await dockerAlwaysSucceeds()
    vi.restoreAllMocks()
  })

  it('fails when the requested version does not exist', async () => {
    write({ appImage: LO }, `${LO}:1.0.1`)
    await registryRejects(BAD)
    await expect(
      updateCommand({ version: BAD, backup: false, migrate: false }),
    ).rejects.toThrow(/exit 1/)
  })

  it('leaves docker-compose.yml byte-identical after that failure', async () => {
    write({ appImage: LO }, `${LO}:1.0.1`)
    const before = compose()
    await registryRejects(BAD)
    await expect(
      updateCommand({ version: BAD, backup: false, migrate: false }),
    ).rejects.toThrow(/exit 1/)
    expect(compose()).toBe(before)
    expect(compose()).toContain(`image: ${LO}:1.0.1`)
    expect(compose()).not.toContain(BAD)
  })

  it('does not restart or migrate after that failure', async () => {
    write({ appImage: LO }, `${LO}:1.0.1`)
    await registryRejects(BAD)
    await expect(
      updateCommand({ version: BAD, backup: false, migrate: false }),
    ).rejects.toThrow(/exit 1/)
    const ran = await ranCommands()
    expect(ran).toContain(`docker pull ${LO}:${BAD}`)
    expect(ran).not.toMatch(/docker compose pull/)
    expect(ran).not.toMatch(/docker compose (up|down)/)
    expect(ran).not.toMatch(/alembic/)
  })

  it('still updates when the image resolves', async () => {
    write({ appImage: LO }, `${LO}:1.0.1`)
    await updateCommand({ version: '1.0.2', backup: false, migrate: false })
    expect(compose()).toContain(`image: ${LO}:1.0.2`)
    expect(compose()).toContain('image: pgvector/pgvector:pg16')
    const ran = await ranCommands()
    expect(ran).toContain(`docker pull ${LO}:1.0.2`)
    expect(ran).toContain('docker compose up -d')
  })
})
