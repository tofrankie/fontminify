import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSubset, collectProjectChars, getResolvedConfig } from '../src/api.js'
import { FontminifyError } from '../src/errors.js'

const TMP = tmpdir()

describe('getResolvedConfig', () => {
  it('returns merged config with overrides when no config file', async () => {
    const config = await getResolvedConfig(undefined, {
      fonts: { src: 'my-fonts', dest: 'my-dist', formats: ['woff2'] },
    })
    expect(config.fonts.src).toBe('my-fonts')
    expect(config.fonts.dest).toBe('my-dist')
    expect(config.fonts.formats).toEqual(['woff2'])
  })

  it('returns defaults when called with no args', async () => {
    const config = await getResolvedConfig()
    expect(config.fonts.src).toBe('fonts')
    expect(config.fonts.formats).toEqual(['woff2', 'woff'])
    expect(config.collect.include.length).toBeGreaterThan(0)
  })
})

describe('collectProjectChars', () => {
  it('merges preset and scanned chars', async () => {
    const dir = join(TMP, `fontminify-api-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'a.ts'), 'const t = "中文";', 'utf8')

    const config = await getResolvedConfig(undefined, {
      collect: { include: [join(dir, '*.ts')] },
      fonts: { src: 'fonts', dest: 'dist', formats: ['woff2'] },
    })
    const { scannedChars, finalText } = await collectProjectChars(config)
    expect(scannedChars.size).toBe(2) // 中, 文
    expect(finalText.length).toBeGreaterThanOrEqual(2)
    expect([...finalText].sort().join('')).toMatch(/[\u4E2D\u6587]/)
  })
})

describe('buildSubset', () => {
  it('throws EMPTY_CHARACTER_LIST when no preset and no files match', async () => {
    const config = await getResolvedConfig(undefined, {
      presetCharsFile: [],
      collect: { include: [join(TMP, `empty-${Date.now()}`, '*.ts')] },
      fonts: { src: 'fonts', dest: 'dist', formats: ['woff2'] },
    })
    await expect(buildSubset(config)).rejects.toThrow(FontminifyError)
    await expect(buildSubset(config)).rejects.toMatchObject({
      code: 'EMPTY_CHARACTER_LIST',
      message: expect.stringMatching(/no characters|include/i),
    })
  })

  it('returns BuildReport when dryRun and one font in src', async () => {
    const dir = join(TMP, `fontminify-build-${Date.now()}`)
    const sourcesDir = join(dir, 'sources')
    const codeDir = join(dir, 'code')
    await mkdir(sourcesDir, { recursive: true })
    await mkdir(codeDir, { recursive: true })
    await writeFile(join(sourcesDir, 'F.ttf'), 'x', 'utf8')
    await writeFile(join(codeDir, 'a.ts'), 'const t = "中";', 'utf8')
    const config = await getResolvedConfig(undefined, {
      presetCharsFile: [],
      collect: { include: [join(dir, 'code', '*.ts')] },
      fonts: {
        src: sourcesDir,
        dest: join(dir, 'out'),
        formats: ['woff2'],
      },
    })
    const report = await buildSubset(config, { dryRun: true })
    expect(report).toHaveProperty('timestamp')
    expect(report.durationMs).toBeGreaterThanOrEqual(0)
    expect(report.dryRun).toBe(true)
    expect(report.totalCharCount).toBeGreaterThanOrEqual(1)
    expect(report.results.length).toBe(1)
    expect(report.results[0].fontName).toBe('F')
  })
})
