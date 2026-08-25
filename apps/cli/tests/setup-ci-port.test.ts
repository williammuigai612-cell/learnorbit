import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Isolated file: mock the network probes so the CI setup's automatic
// port-fallback branches (canonical 80 busy → pick another / give up) run
// deterministically, independent of the test machine's actual free ports.
vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process')
  return { ...actual, execSync: vi.fn(() => Buffer.from('')) }
})
const net = vi.hoisted(() => ({ available: 80 as number | null, portFree: true }))
vi.mock('../src/utils/network.js', () => ({
  findAvailablePort: async () => net.available,
  checkPort: async () => net.portFree,
  getPublicIp: async () => null,
}))
const promptStub = vi.hoisted(() => ({
  log: { error: () => {}, info: () => {}, success: () => {}, warn: () => {}, warning: () => {}, message: () => {}, step: () => {} },
  intro: () => {}, outro: () => {}, cancel: () => {}, note: () => {},
  spinner: () => ({ start: () => {}, stop: () => {}, message: () => {} }),
  isCancel: () => false,
}))
vi.mock('@clack/prompts', () => promptStub)
vi.mock('../src/services/health.js', () => ({
  waitForHealth: async () => true, waitForOrgSeed: async () => true, waitForEeReady: async () => 'ee',
}))

import { setupCommand } from '../src/commands/setup.js'

describe('setup --ci automatic port fallback', () => {
  let home: string
  let origHome: string | undefined
  const base = { ci: true as const, domain: 'localhost', adminEmail: 'admin@school.dev', adminPassword: 'password123', start: false }

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-ciport-'))
    origHome = process.env.HOME
    process.env.HOME = home
    net.available = 80; net.portFree = true
    vi.spyOn(process, 'exit').mockImplementation(((c?: number) => { throw new Error(`exit ${c}`) }) as never)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome
    fs.rmSync(home, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('falls back to an available port when 80 is taken', async () => {
    net.available = 8080 // canonical 80 busy → use 8080 (227-230)
    await setupCommand({ ...base, name: 'fb' })
    const cfg = JSON.parse(fs.readFileSync(path.join(home, '.learnhouse', 'fb', 'learnhouse.config.json'), 'utf-8'))
    expect(cfg.httpPort).toBe(8080)
  })

  it('exits when no common port is available', async () => {
    net.available = null // findAvailablePort gives up → exit (231-233)
    await expect(setupCommand({ ...base, name: 'none' })).rejects.toThrow(/exit 1/)
  })

  it('exits when an explicitly-requested port is already in use', async () => {
    net.portFree = false // checkPort(explicit port) → busy → exit (235-237)
    await expect(setupCommand({ ...base, name: 'busy', port: 9090 })).rejects.toThrow(/exit 1/)
  })

  it('accepts an explicitly-requested port that is free', async () => {
    net.portFree = true
    await setupCommand({ ...base, name: 'okport', port: 9091 })
    const cfg = JSON.parse(fs.readFileSync(path.join(home, '.learnhouse', 'okport', 'learnhouse.config.json'), 'utf-8'))
    expect(cfg.httpPort).toBe(9091)
  })
})

// ─── setup --image: the deployment chooses its own container image ───
//
// Without --image the upstream resolution path must be untouched. With it, the
// repository is persisted as `appImage` and the generated compose runs it — the
// official LearnHouse image must not appear anywhere.

describe('setup --ci --image', () => {
  let home: string
  let origHome: string | undefined
  const LO = 'ghcr.io/williammuigai612-cell/learnorbit'
  const base = { ci: true as const, domain: 'localhost', adminEmail: 'admin@school.dev', adminPassword: 'password123', start: false }

  const read = (name: string, file: string) =>
    fs.readFileSync(path.join(home, '.learnhouse', name, file), 'utf-8')

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-ciimg-'))
    origHome = process.env.HOME
    process.env.HOME = home
    net.available = 80; net.portFree = true
    vi.spyOn(process, 'exit').mockImplementation(((c?: number) => { throw new Error(`exit ${c}`) }) as never)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome
    fs.rmSync(home, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('without --image, keeps the default LearnOrbit image and writes no appImage', async () => {
    await setupCommand({ ...base, name: 'plain' })
    const cfg = JSON.parse(read('plain', 'learnhouse.config.json'))
    expect('appImage' in cfg).toBe(false)
    expect(read('plain', 'docker-compose.yml')).toContain('ghcr.io/williammuigai612-cell/learnorbit')
  })

  it('persists the repository half of --image as appImage', async () => {
    await setupCommand({ ...base, name: 'lo', image: `${LO}:1.0.0` })
    const cfg = JSON.parse(read('lo', 'learnhouse.config.json'))
    expect(cfg.appImage).toBe(LO)
  })

  it('generates a compose that runs the configured image, never the upstream one', async () => {
    await setupCommand({ ...base, name: 'lo2', image: `${LO}:1.0.0` })
    const compose = read('lo2', 'docker-compose.yml')
    expect(compose).toContain(`image: ${LO}:1.0.0`)
    expect(compose).not.toContain('ghcr.io/learnhouse/app')
  })

  it('falls back to :latest when --image carries no tag', async () => {
    await setupCommand({ ...base, name: 'lo3', image: LO })
    expect(read('lo3', 'docker-compose.yml')).toContain(`image: ${LO}:latest`)
    expect(JSON.parse(read('lo3', 'learnhouse.config.json')).appImage).toBe(LO)
  })

  it('rejects a malformed --image before writing anything', async () => {
    await expect(
      setupCommand({ ...base, name: 'bad', image: 'ghcr.io/a/b\n    command: id' }),
    ).rejects.toThrow(/exit 1/)
    expect(fs.existsSync(path.join(home, '.learnhouse', 'bad', 'docker-compose.yml'))).toBe(false)
  })
})

// ─── LOW-5: --image must never be silently discarded on the EE path ───

describe('setup --image with the Enterprise edition', () => {
  let home: string
  let origHome: string | undefined
  const LO = 'ghcr.io/williammuigai612-cell/learnorbit'

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-ciee-'))
    origHome = process.env.HOME
    process.env.HOME = home
    net.available = 80; net.portFree = true
    vi.spyOn(process, 'exit').mockImplementation(((c?: number) => { throw new Error(`exit ${c}`) }) as never)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome
    fs.rmSync(home, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('refuses --image together with --edition enterprise instead of ignoring it', async () => {
    await expect(
      setupCommand({
        ci: true, domain: 'localhost', adminEmail: 'admin@school.dev',
        adminPassword: 'password123', start: false,
        name: 'ee', edition: 'enterprise', image: LO,
      }),
    ).rejects.toThrow(/exit 1/)
    const errors = vi.mocked(console.error).mock.calls.map((c: unknown[]) => String(c[0])).join('\n')
    expect(errors).toMatch(/--image is not supported with .*enterprise/i)
    expect(fs.existsSync(path.join(home, '.learnhouse', 'ee', 'learnhouse.config.json'))).toBe(false)
  })
})
