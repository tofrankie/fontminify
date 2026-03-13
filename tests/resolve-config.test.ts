import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  defineConfig,
  loadConfigFile,
  resolveConfig,
  validateResolvedConfig,
} from '../src/config/resolve-config'
import { FontminifyError } from '../src/errors'

// ─── resolveConfig ────────────────────────────────────────────────────────────

describe('resolveConfig', () => {
  it('applies built-in defaults when called with empty objects', () => {
    const config = resolveConfig({}, {})

    expect(config.fonts.src).toBe('fonts')
    expect(config.fonts.dest).toBe('dist/fonts')
    expect(config.fonts.formats).toEqual(['woff2', 'woff'])
    expect(config.collect.include.length).toBeGreaterThan(0)
    expect(config.glyph.hinting).toBe(false)
    expect(config.report.json).toBe(false)
  })

  it('uses file config values over defaults', () => {
    const config = resolveConfig(
      { fonts: { src: 'my-fonts', dest: 'my-dist', formats: ['woff'] } },
      {}
    )

    expect(config.fonts.src).toBe('my-fonts')
    expect(config.fonts.dest).toBe('my-dist')
    expect(config.fonts.formats).toEqual(['woff'])
  })

  it('uses CLI overrides over file config', () => {
    const config = resolveConfig(
      { fonts: { src: 'file-src', dest: 'file-dest', formats: ['woff'] } },
      { fonts: { src: 'cli-src' } }
    )

    expect(config.fonts.src).toBe('cli-src')
    expect(config.fonts.dest).toBe('file-dest') // falls through to file config
  })

  it('normalizes a string presetCharsFile to an array', () => {
    const config = resolveConfig({ presetCharsFile: 'preset.txt' }, {})
    expect(config.presetCharsFile).toEqual(['preset.txt'])
  })

  it('keeps presetCharsFile as empty array when unset', () => {
    const config = resolveConfig({}, {})
    expect(config.presetCharsFile).toEqual([])
  })

  it('merges collect.characterPattern from CLI override', () => {
    const config = resolveConfig({}, { collect: { characterPattern: '\\p{Script=Latin}' } })
    expect(config.collect.characterPattern).toBe('\\p{Script=Latin}')
  })
})

// ─── validateResolvedConfig ───────────────────────────────────────────────────

describe('validateResolvedConfig', () => {
  const valid = resolveConfig({}, {})

  it('does not throw for a fully valid config', () => {
    expect(() => validateResolvedConfig(valid)).not.toThrow()
  })

  it('throws USER_ERROR when fonts.formats is empty', () => {
    const bad = { ...valid, fonts: { ...valid.fonts, formats: [] as never[] } }
    expect(() => validateResolvedConfig(bad)).toThrow(FontminifyError)
    expect(() => validateResolvedConfig(bad)).toThrowError(/fonts\.formats is empty/)
  })

  it('throws USER_ERROR for an unrecognised format value', () => {
    const bad = { ...valid, fonts: { ...valid.fonts, formats: ['svg' as never] } }
    expect(() => validateResolvedConfig(bad)).toThrow(FontminifyError)
    expect(() => validateResolvedConfig(bad)).toThrowError(/Invalid font format/)
  })

  it('throws USER_ERROR when collect.include is empty', () => {
    const bad = { ...valid, collect: { ...valid.collect, include: [] } }
    expect(() => validateResolvedConfig(bad)).toThrow(FontminifyError)
    expect(() => validateResolvedConfig(bad)).toThrowError(/collect\.include is empty/)
  })

  it('throws USER_ERROR when fonts.src is blank', () => {
    const bad = { ...valid, fonts: { ...valid.fonts, src: '   ' } }
    expect(() => validateResolvedConfig(bad)).toThrow(FontminifyError)
    expect(() => validateResolvedConfig(bad)).toThrowError(/fonts\.src is empty/)
  })

  it('throws USER_ERROR when fonts.dest is blank', () => {
    const bad = { ...valid, fonts: { ...valid.fonts, dest: '' } }
    expect(() => validateResolvedConfig(bad)).toThrow(FontminifyError)
    expect(() => validateResolvedConfig(bad)).toThrowError(/fonts\.dest is empty/)
  })

  it('throws USER_ERROR when fonts.src and fonts.dest are the same', () => {
    const bad = { ...valid, fonts: { ...valid.fonts, src: 'fonts', dest: 'fonts' } }
    expect(() => validateResolvedConfig(bad)).toThrow(FontminifyError)
    expect(() => validateResolvedConfig(bad)).toThrowError(
      /fonts\.src and fonts\.dest must be different/
    )
  })

  it('thrown error has code USER_ERROR', () => {
    const bad = { ...valid, fonts: { ...valid.fonts, formats: [] as never[] } }
    try {
      validateResolvedConfig(bad)
    } catch (err) {
      expect(err).toBeInstanceOf(FontminifyError)
      expect((err as FontminifyError).code).toBe('USER_ERROR')
    }
  })
})

describe('loadConfigFile', () => {
  it('throws when configPath is given but file does not exist', async () => {
    const path = join(tmpdir(), `nonexistent-${Date.now()}.js`)
    await expect(loadConfigFile(path)).rejects.toThrow(/Config file not found|not found/)
  })
})

describe('defineConfig', () => {
  it('returns the same config object', () => {
    const config = { fonts: { src: 'f', dest: 'd', formats: ['woff2'] as const } }
    expect(defineConfig(config)).toBe(config)
  })
})
