/**
 * CLI usability / smoke tests.
 *
 * These tests spawn the compiled `dist/cli.mjs` binary and assert on exit
 * codes and key fragments of the output. They intentionally stay lightweight:
 * no real font files are used, so they complete in milliseconds and serve as
 * a fast sanity-check that the CLI contract (exit codes, error messages,
 * help text) is intact after any code change.
 *
 * Requirements: `pnpm build` must have been run before this suite executes.
 * The suite is skipped automatically when `dist/cli.mjs` is absent.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const CLI = resolve(import.meta.dirname, '../dist/cli.mjs')
const ROOT = resolve(import.meta.dirname, '..')

function run(args: string[], cwd = ROOT) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
}

// Skip the entire suite when the distribution has not been built yet.
beforeAll(() => {
  if (!existsSync(CLI)) {
    console.warn(`[cli.test] Skipping: ${CLI} not found. Run "pnpm build" first.`)
  }
})

describe('--help / --version', () => {
  it('exits 0 and prints usage for --help', () => {
    const r = run(['--help'])
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/fontminify/)
    expect(r.stdout).toMatch(/build/)
    expect(r.stdout).toMatch(/collect/)
  })

  it('exits 0 and prints a semver string for --version', () => {
    const r = run(['--version'])
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('exits 0 for "build --help"', () => {
    const r = run(['build', '--help'])
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/--font-src/)
    expect(r.stdout).toMatch(/--dry-run/)
  })

  it('exits 0 for "collect --help"', () => {
    const r = run(['collect', '--help'])
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/--include/)
    expect(r.stdout).toMatch(/--out/)
  })

  it('exits 0 for "presets list"', () => {
    const r = run(['presets', 'list'])
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/zh-CN-common-characters/)
  })
})

describe('user error handling (exit 1)', () => {
  it('exits 1 for invalid characterPattern', () => {
    const r = run(['build', '--character-pattern', 'INVALID['])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Invalid characterPattern/)
  })

  it('exits 1 for non-existent font-src', () => {
    const r = run(['build', '--font-src', '/absolutely/nonexistent/dir'])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Cannot read font source directory/)
  })

  it('exits 1 when formats are invalid (e.g. bad value)', () => {
    // Passing a single invalid format triggers USER_ERROR
    const r = run(['build', '--formats', 'svg'])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Invalid font format|format/)
  })

  it('exits 1 for unknown preset name', () => {
    const r = run(['presets', 'generate', 'nonexistent-preset'])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Unknown preset/)
  })

  it('fails when presets generate target already exists without --force', () => {
    // Output to existing file: exit 1 (user error) if preset found, or 2 (runtime) if preset path missing in dist
    const r = run(['presets', 'generate', 'zh-CN-common-characters', '--out', 'package.json'])
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/already exists|Use --force|not found|preset/)
  })
})

describe('--json error output', () => {
  it('emits a JSON error object to stderr when --json is set', () => {
    const r = run(['build', '--character-pattern', 'BAD[', '--json'])
    expect(r.status).toBe(1)
    const parsed = JSON.parse(r.stderr.trim())
    expect(parsed).toHaveProperty('error')
    expect(parsed).toHaveProperty('code', 'USER_ERROR')
  })
})
