/**
 * In-process command tests: build a Commander program, register commands,
 * then parseAsync(argv) so that runBuild / runCollect / init / presets actions run.
 * Run in a temp dir so loadConfigFile() finds no config and CLI args fully define behavior.
 */

import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Command } from 'commander'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerBuildCommand } from '../src/commands/build'
import { registerCollectCommand } from '../src/commands/collect'
import { registerInitCommand } from '../src/commands/init'
import { registerPresetsCommand } from '../src/commands/presets'

const TMP = tmpdir()
const PKG = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

function createProgram(): Command {
  const program = new Command()
  program.name('fontminify').version(PKG.version)
  registerBuildCommand(program)
  registerCollectCommand(program)
  registerInitCommand(program)
  registerPresetsCommand(program)
  return program
}

describe('commands (in-process)', () => {
  let program: Command
  let cwd: string
  let tmpDir: string

  beforeEach(async () => {
    program = createProgram()
    cwd = process.cwd()
    tmpDir = join(TMP, `fontminify-cmd-${Date.now()}`)
    await mkdir(tmpDir, { recursive: true })
  })

  afterEach(() => {
    process.chdir(cwd)
  })

  describe('build', () => {
    it('runs full pipeline with --dry-run in temp dir', async () => {
      await mkdir(join(tmpDir, 'sources'), { recursive: true })
      await mkdir(join(tmpDir, 'code'), { recursive: true })
      await writeFile(join(tmpDir, 'sources', 'F.ttf'), 'x', 'utf8')
      await writeFile(join(tmpDir, 'code', 'a.ts'), 'const t = "中";', 'utf8')

      process.chdir(tmpDir)
      await program.parseAsync([
        'node',
        'fontminify',
        'build',
        '--font-src',
        'sources',
        '--font-dest',
        'out',
        '--formats',
        'woff2',
        '--include',
        'code/*.ts',
        '--dry-run',
        '--silent',
      ])

      // No throw = runBuild completed
    })

    it('writes chars-out when --chars-out given', async () => {
      await mkdir(join(tmpDir, 'sources'), { recursive: true })
      await mkdir(join(tmpDir, 'code'), { recursive: true })
      await writeFile(join(tmpDir, 'sources', 'F.ttf'), 'x', 'utf8')
      await writeFile(join(tmpDir, 'code', 'a.ts'), 'const t = "中";', 'utf8')

      process.chdir(tmpDir)
      await program.parseAsync([
        'node',
        'fontminify',
        'build',
        '--font-src',
        'sources',
        '--font-dest',
        'out',
        '--formats',
        'woff2',
        '--include',
        'code/*.ts',
        '--dry-run',
        '--silent',
        '--chars-out',
        'merged.txt',
      ])

      const content = await readFile(join(tmpDir, 'merged.txt'), 'utf8')
      expect(content).toMatch(/\u4E2D/)
    })

    it('still prints JSON report when --json and --silent are both set', async () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      await mkdir(join(tmpDir, 'sources'), { recursive: true })
      await mkdir(join(tmpDir, 'code'), { recursive: true })
      await writeFile(join(tmpDir, 'sources', 'F.ttf'), 'x', 'utf8')
      await writeFile(join(tmpDir, 'code', 'a.ts'), 'const t = "中";', 'utf8')

      process.chdir(tmpDir)
      await program.parseAsync([
        'node',
        'fontminify',
        'build',
        '--font-src',
        'sources',
        '--font-dest',
        'out',
        '--formats',
        'woff2',
        '--include',
        'code/*.ts',
        '--dry-run',
        '--json',
        '--silent',
      ])

      const out = (stdoutSpy.mock.calls.flat().join('') as string).trim()
      const parsed = JSON.parse(out)
      expect(parsed).toHaveProperty('dryRun', true)
      expect(parsed).toHaveProperty('results')
      stdoutSpy.mockRestore()
    })
  })

  describe('collect', () => {
    it('writes collected chars to --out file', async () => {
      await mkdir(join(tmpDir, 'code'), { recursive: true })
      await writeFile(join(tmpDir, 'code', 'a.ts'), 'const t = "中文";', 'utf8')

      process.chdir(tmpDir)
      await program.parseAsync([
        'node',
        'fontminify',
        'collect',
        '--include',
        'code/*.ts',
        '--out',
        'chars.txt',
        '--silent',
      ])

      const content = await readFile(join(tmpDir, 'chars.txt'), 'utf8')
      expect(content).toMatch(/[\u4E2D\u6587]/)
    })

    it('writes stderr "written to" when --out without --silent', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
      await mkdir(join(tmpDir, 'code'), { recursive: true })
      await writeFile(join(tmpDir, 'code', 'a.ts'), 'x', 'utf8')

      process.chdir(tmpDir)
      await program.parseAsync([
        'node',
        'fontminify',
        'collect',
        '--include',
        'code/*.ts',
        '--out',
        'out.txt',
      ])

      const stderrOut = stderrSpy.mock.calls.flat().join('')
      expect(stderrOut).toMatch(/written to/)
      stderrSpy.mockRestore()
    })

    it('prints plain chars to stdout when no --out and no --json', async () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      await mkdir(join(tmpDir, 'code'), { recursive: true })
      await writeFile(join(tmpDir, 'code', 'b.ts'), 'const c = "字";', 'utf8')

      process.chdir(tmpDir)
      await program.parseAsync(['node', 'fontminify', 'collect', '--include', 'code/*.ts'])

      const stdoutOut = stdoutSpy.mock.calls.flat().join('')
      expect(stdoutOut).toContain('字')
      stdoutSpy.mockRestore()
    })

    it('outputs JSON when --json and no --out', async () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      await mkdir(join(tmpDir, 'code'), { recursive: true })
      await writeFile(join(tmpDir, 'code', 'x.ts'), 'a', 'utf8')

      process.chdir(tmpDir)
      await program.parseAsync([
        'node',
        'fontminify',
        'collect',
        '--include',
        'code/*.ts',
        '--json',
        '--silent',
      ])

      const out = (stdoutSpy.mock.calls.flat().join('') as string).trim()
      const parsed = JSON.parse(out)
      expect(parsed).toHaveProperty('chars')
      expect(parsed).toHaveProperty('count')
      stdoutSpy.mockRestore()
    })

    it('reports skipped files on stderr when some files are unreadable', async () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
      await mkdir(join(tmpDir, 'code'), { recursive: true })
      await writeFile(join(tmpDir, 'code', 'a.ts'), 'x', 'utf8')
      const unreadable = join(tmpDir, 'code', 'b.ts')
      await writeFile(unreadable, 'y', 'utf8')
      try {
        chmodSync(unreadable, 0o000)
      } catch {
        // Skip on platforms where chmod fails (e.g. Windows)
        stderrSpy.mockRestore()
        return
      }

      process.chdir(tmpDir)
      await program.parseAsync(['node', 'fontminify', 'collect', '--include', 'code/*.ts'])

      const stderrOut = stderrSpy.mock.calls.flat().join('')
      expect(stderrOut).toMatch(/skipped.*unreadable/)
      stderrSpy.mockRestore()
      chmodSync(unreadable, 0o644)
    })

    it('calls handleCliError when collect throws (e.g. invalid characterPattern)', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
      await mkdir(join(tmpDir, 'code'), { recursive: true })
      await writeFile(join(tmpDir, 'code', 'a.ts'), 'x', 'utf8')

      process.chdir(tmpDir)
      await program
        .parseAsync([
          'node',
          'fontminify',
          'collect',
          '--include',
          'code/*.ts',
          '--character-pattern',
          '[',
        ])
        .catch(() => {})

      expect(exitSpy).toHaveBeenCalledWith(1)
      const stderrOut = stderrSpy.mock.calls.flat().join('')
      expect(stderrOut).toMatch(/Invalid characterPattern|Error/)
      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    })
  })

  describe('init', () => {
    it('creates fontminify.config.js with --force', async () => {
      process.chdir(tmpDir)
      await program.parseAsync(['node', 'fontminify', 'init', '--force'])

      const content = await readFile(join(tmpDir, 'fontminify.config.js'), 'utf8')
      expect(content).toMatch(/defineConfig/)
      expect(content).toMatch(/include.*ts,tsx/)
    })

    it('refuses to overwrite without --force', async () => {
      await writeFile(join(tmpDir, 'fontminify.config.js'), 'existing', 'utf8')
      process.chdir(tmpDir)

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

      await program.parseAsync(['node', 'fontminify', 'init'])

      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(stderrSpy).toHaveBeenCalled()
      const msg = stderrSpy.mock.calls.flat().join('') as string
      expect(msg).toMatch(/already exists|--force/)

      exitSpy.mockRestore()
      stderrSpy.mockRestore()
    })
  })

  describe('presets', () => {
    it('list prints preset names', async () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      await program.parseAsync(['node', 'fontminify', 'presets', 'list'])
      const out = stdoutSpy.mock.calls.flat().join('') as string
      expect(out).toMatch(/zh-CN-common-characters/)
      stdoutSpy.mockRestore()
    })

    it('generate writes preset file to --out', async () => {
      const cliPath = resolve(import.meta.dirname, '../dist/cli.mjs')
      if (!existsSync(cliPath)) {
        console.warn(
          '[commands.test] Skipping presets generate: dist/cli.mjs not found. Run "pnpm build" first.'
        )
        return
      }
      const outPath = join(tmpDir, 'preset.txt')
      await mkdir(tmpDir, { recursive: true })
      const r = spawnSync(
        process.execPath,
        [cliPath, 'presets', 'generate', 'zh-CN-common-characters', '--out', outPath],
        {
          cwd: resolve(import.meta.dirname, '..'),
          encoding: 'utf8',
          env: { ...process.env, NO_COLOR: '1' },
        }
      )
      expect(r.status).toBe(0)
      const content = await readFile(outPath, 'utf8')
      expect(content.length).toBeGreaterThan(0)
    })
  })
})
