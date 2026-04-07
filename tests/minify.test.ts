import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkOverwriteConflict, discoverFonts, minifyAllFonts, minifyOneFont } from '../src/core/minify'
import { FontminifyError } from '../src/errors'

const TMP = tmpdir()

vi.mock('fontmin', () => {
  class MockFontmin {
    private _destDir: string | undefined

    src(): this {
      return this
    }

    use(): this {
      return this
    }

    static glyph(): unknown {
      return {}
    }

    static ttf2woff(): unknown {
      return {}
    }

    static ttf2woff2(): unknown {
      return {}
    }

    dest(destDir: string): this {
      this._destDir = destDir
      return this
    }

    // Simulate fontmin.run(callback) with two output files: one woff2 and one ttf.
    run(cb: (err: Error | null, files: { path: string; contents: { length: number } }[]) => void) {
      const base = this._destDir ?? TMP
      // lengths are arbitrary but non-zero so savedBytes > 0 for realistic stats
      const files = [
        { path: join(base, 'Mock.woff2'), contents: { length: 1234 } },
        { path: join(base, 'Mock.ttf'), contents: { length: 2048 } },
      ]
      cb(null, files)
    }
  }

  return { default: MockFontmin }
})

describe('discoverFonts', () => {
  it('throws USER_ERROR when directory does not exist', async () => {
    const path = join(TMP, `nonexistent-${Date.now()}`)
    await expect(discoverFonts(path)).rejects.toThrow(FontminifyError)
    await expect(discoverFonts(path)).rejects.toMatchObject({
      code: 'USER_ERROR',
      message: expect.stringMatching(/Cannot read font source directory|ENOENT/),
    })
  })

  it('throws USER_ERROR when directory has no .ttf files', async () => {
    const dir = join(TMP, `fontminify-no-ttf-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'readme.txt'), 'x', 'utf8')

    await expect(discoverFonts(dir)).rejects.toThrow(FontminifyError)
    await expect(discoverFonts(dir)).rejects.toMatchObject({
      code: 'USER_ERROR',
      message: expect.stringMatching(/No .ttf files found/),
    })
  })

  it('returns absolute paths to .ttf files in directory', async () => {
    const dir = join(TMP, `fontminify-ttf-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'Font.ttf'), 'fake-ttf', 'utf8')
    await writeFile(join(dir, 'Other.TTF'), 'fake', 'utf8')
    await writeFile(join(dir, 'skip.woff2'), 'x', 'utf8')

    const paths = await discoverFonts(dir)
    expect(paths.length).toBe(2)
    expect(paths.every(p => p.toLowerCase().endsWith('.ttf'))).toBe(true)
    expect(paths.some(p => p.includes('Font.ttf'))).toBe(true)
    expect(paths.some(p => p.includes('Other.TTF'))).toBe(true)
  })
})

describe('checkOverwriteConflict', () => {
  let cwd: string

  beforeEach(() => {
    cwd = process.cwd()
  })

  afterEach(() => {
    process.chdir(cwd)
  })

  it('throws when src and dest are the same and formats include ttf', () => {
    expect(() => checkOverwriteConflict('/fonts', '/fonts')).toThrow(FontminifyError)
    expect(() => checkOverwriteConflict('/fonts', '/fonts')).toThrow(/same.*ttf|overwrite/)
  })

  it('throws when src and dest normalize to same path (trailing slash)', () => {
    expect(() => checkOverwriteConflict('/fonts/', '/fonts')).toThrow(FontminifyError)
  })

  it('does not throw when src and dest differ', () => {
    expect(() => checkOverwriteConflict('/fonts', '/dist/fonts')).not.toThrow()
  })

  it('throws when src and dest are the same even if formats do not include ttf', () => {
    expect(() => checkOverwriteConflict('/fonts', '/fonts')).toThrow(FontminifyError)
  })

  it('throws when dest uses relative alias of src directory', async () => {
    const dir = join(TMP, `fontminify-path-${Date.now()}`)
    await mkdir(join(dir, 'fonts'), { recursive: true })
    process.chdir(dir)
    expect(() => checkOverwriteConflict('fonts', './fonts')).toThrow(FontminifyError)
  })
})

describe('minifyOneFont', () => {
  it('returns mock results without writing when dryRun is true', async () => {
    const dir = join(TMP, `fontminify-dry-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    const ttfPath = join(dir, 'Fake.ttf')
    await writeFile(ttfPath, 'x', 'utf8')
    const destDir = join(dir, 'out')

    const results = await minifyOneFont({
      srcPath: ttfPath,
      destDir,
      text: 'ab',
      formats: ['woff2', 'woff'],
      hinting: false,
      dryRun: true,
    })

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      fontName: 'Fake',
      format: 'woff2',
      originalSize: 1,
      subsetSize: 0,
      savedBytes: 0,
      savedPercent: 0,
    })
    expect(results[0].outputPath).toMatch(/Fake\.woff2$/)
  })

  it('uses fontmin pipeline when dryRun is false and filters formats', async () => {
    const dir = join(TMP, `fontminify-real-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    const ttfPath = join(dir, 'Real.ttf')
    await writeFile(ttfPath, 'xx', 'utf8') // original size: 2 bytes
    const destDir = join(dir, 'out')

    const results = await minifyOneFont({
      srcPath: ttfPath,
      destDir,
      text: 'ab',
      formats: ['woff2'], // request only woff2; mock also produces a ttf which should be filtered out
      hinting: false,
      dryRun: false,
    })

    expect(results).toHaveLength(1)
    const r = results[0]
    expect(r.format).toBe('woff2')
    expect(r.subsetSize).toBe(1234)
    // originalSize is the real TTF size (2 bytes in this test), so savedBytes can be negative
    expect(typeof r.savedBytes).toBe('number')
    // Output path comes from the mocked fontmin implementation
    expect(r.outputPath).toMatch(/Mock\.woff2$/)
  })
})

describe('minifyAllFonts', () => {
  it('returns combined results for one font when dryRun is true', async () => {
    const dir = join(TMP, `fontminify-all-dry-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'A.ttf'), 'x', 'utf8')
    const destDir = join(dir, 'dist')

    const results = await minifyAllFonts(
      {
        presetCharsFile: [],
        collect: { include: [], exclude: [], characterPattern: '' },
        fonts: { src: dir, dest: destDir, formats: ['woff2'] },
        glyph: { hinting: false },
        report: { json: false },
      },
      'x',
      true
    )

    expect(results).toHaveLength(1)
    expect(results[0].fontName).toBe('A')
    expect(results[0].format).toBe('woff2')
  })

  it('uses fontmin pipeline when dryRun is false', async () => {
    const dir = join(TMP, `fontminify-all-real-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'B.ttf'), 'yy', 'utf8')
    const destDir = join(dir, 'dist')

    const results = await minifyAllFonts(
      {
        presetCharsFile: [],
        collect: { include: [], exclude: [], characterPattern: '' },
        fonts: { src: dir, dest: destDir, formats: ['woff2'] },
        glyph: { hinting: false },
        report: { json: false },
      },
      'x',
      false
    )

    expect(results).toHaveLength(1)
    expect(results[0].fontName).toBe('B')
    expect(results[0].format).toBe('woff2')
    expect(results[0].subsetSize).toBe(1234)
  })
})
