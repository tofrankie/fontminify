import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Command } from 'commander'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerPresetsCommand, resolveOutputPath } from '../src/commands/presets'

// Mock path.join so PRESETS_DIR in presets.ts points to a fixture (for generate tests).
// Must run before presets module uses join(__dirname, 'presets').
vi.mock('node:path', async importOriginal => {
  const actual = (await importOriginal()) as typeof import('node:path')
  const os = await import('node:os')
  const fs = await import('node:fs')
  const fixtureDir = actual.join(os.tmpdir(), `fontminify-presets-fixture-${Date.now()}`, 'presets')
  fs.mkdirSync(fixtureDir, { recursive: true })
  fs.writeFileSync(actual.join(fixtureDir, 'zh-CN-common-characters.txt'), 'test content', 'utf8')
  return {
    ...actual,
    join: (...args: string[]) => (args[1] === 'presets' ? fixtureDir : actual.join(...args)),
  }
})

describe('resolveOutputPath', () => {
  let cwd: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    cwd = join(tmpdir(), `fontminify-resolveOutputPath-${Date.now()}`)
    mkdirSync(cwd, { recursive: true })
    process.chdir(cwd)
  })

  afterEach(() => {
    process.chdir(originalCwd)
  })

  it('returns dir/presetName.txt when input is an existing directory', () => {
    const outDir = join(cwd, 'out')
    mkdirSync(outDir, { recursive: true })
    const result = resolveOutputPath('out', 'zh-CN-common')
    expect(result).toBe(join(resolve(process.cwd(), 'out'), 'zh-CN-common.txt'))
  })

  it('returns resolved path as-is when input is an existing file', () => {
    const filePath = join(cwd, 'existing.txt')
    writeFileSync(filePath, '')
    const result = resolveOutputPath('existing.txt', 'any-preset')
    expect(result).toBe(resolve(process.cwd(), 'existing.txt'))
  })

  it('returns dir/presetName.txt when input is non-existent and has no extension', () => {
    const result = resolveOutputPath('output', 'my-preset')
    expect(result).toBe(join(resolve(process.cwd(), 'output'), 'my-preset.txt'))
  })

  it('returns dir/presetName.txt when input has trailing slash', () => {
    const result = resolveOutputPath('output/', 'my-preset')
    expect(result).toBe(join(resolve(process.cwd(), 'output'), 'my-preset.txt'))
  })

  it('returns resolved path as-is when input is non-existent with extension', () => {
    const result = resolveOutputPath('output/chars.txt', 'my-preset')
    expect(result).toBe(resolve(process.cwd(), 'output/chars.txt'))
  })
})

describe('presets generate (in-process)', () => {
  let cwd: string
  let program: Command
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    cwd = join(tmpdir(), `fontminify-presets-cwd-${Date.now()}`)
    mkdirSync(cwd, { recursive: true })
    process.chdir(cwd)
    program = new Command()
    program.name('fontminify')
    registerPresetsCommand(program)
  })

  afterEach(() => {
    process.chdir(originalCwd)
  })

  it('writes preset to --out when preset dir is mocked', async () => {
    const outPath = join(cwd, 'preset-out.txt')
    await program.parseAsync(['node', 'fontminify', 'presets', 'generate', 'zh-CN-common-characters', '--out', outPath])
    expect(existsSync(outPath)).toBe(true)
    const content = await readFile(outPath, 'utf8')
    expect(content).toBe('test content')
  })
})
