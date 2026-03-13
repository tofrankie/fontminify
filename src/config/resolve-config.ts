import type { FontFormat, FontminifyConfig, ResolvedFontminifyConfig } from '../types.js'
import { existsSync } from 'node:fs'
import { normalize, resolve } from 'node:path'
import { createRuntimeError, createUserError } from '../errors.js'

const VALID_FORMATS = new Set<FontFormat>(['ttf', 'woff', 'woff2'])

const CONFIG_FILENAMES = [
  'fontminify.config.js',
  'fontminify.config.mjs',
  'fontminify.config.cjs',
  'fontminify.config.ts',
]

const DEFAULTS: ResolvedFontminifyConfig = {
  presetCharsFile: [],
  collect: {
    include: ['src/**/*.{json,js,jsx,ts,tsx,vue}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    characterPattern: '\\p{Script=Han}',
  },
  fonts: {
    src: 'fonts',
    dest: 'dist/fonts',
    formats: ['woff2', 'woff'],
  },
  glyph: { hinting: false },
  report: { json: false },
}

const TRAILING_SLASH_RE = /[\\/]+$/

function normalizeComparableDirPath(input: string): string {
  const normalized = normalize(resolve(process.cwd(), input)).replace(TRAILING_SLASH_RE, '')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

export async function loadConfigFile(configPath?: string): Promise<FontminifyConfig> {
  const { createJiti } = await import('jiti')
  const jiti = createJiti(import.meta.url, { moduleCache: false })

  let resolvedPath: string | undefined

  if (configPath) {
    resolvedPath = resolve(process.cwd(), configPath)
    if (!existsSync(resolvedPath)) {
      throw new Error(`Config file not found: "${resolvedPath}". Check --config path.`)
    }
  } else {
    for (const name of CONFIG_FILENAMES) {
      const candidate = resolve(process.cwd(), name)
      if (existsSync(candidate)) {
        resolvedPath = candidate
        break
      }
    }
  }

  if (!resolvedPath) return {}

  let mod: unknown
  try {
    mod = await jiti.import(resolvedPath)
  } catch (err) {
    throw createRuntimeError(
      `Failed to load config file "${resolvedPath}": ` +
        `${err instanceof Error ? err.message : String(err)}`
    )
  }

  const config = (mod as { default?: FontminifyConfig }).default ?? (mod as FontminifyConfig)
  if (config === null || typeof config !== 'object') {
    throw createUserError(
      `Config file "${resolvedPath}" must export a plain object. ` +
        'Use defineConfig({ ... }) or export default { ... }.'
    )
  }
  return config
}

export function resolveConfig(
  fileConfig: FontminifyConfig,
  cliOverrides: Partial<FontminifyConfig> = {}
): ResolvedFontminifyConfig {
  const merged: ResolvedFontminifyConfig = {
    presetCharsFile: normalizeStringArray(
      cliOverrides.presetCharsFile ?? fileConfig.presetCharsFile ?? DEFAULTS.presetCharsFile
    ),
    collect: {
      include:
        cliOverrides.collect?.include ?? fileConfig.collect?.include ?? DEFAULTS.collect.include,
      exclude:
        cliOverrides.collect?.exclude ?? fileConfig.collect?.exclude ?? DEFAULTS.collect.exclude,
      characterPattern:
        cliOverrides.collect?.characterPattern ??
        fileConfig.collect?.characterPattern ??
        DEFAULTS.collect.characterPattern,
    },
    fonts: {
      src: cliOverrides.fonts?.src ?? fileConfig.fonts?.src ?? DEFAULTS.fonts.src,
      dest: cliOverrides.fonts?.dest ?? fileConfig.fonts?.dest ?? DEFAULTS.fonts.dest,
      formats: cliOverrides.fonts?.formats ?? fileConfig.fonts?.formats ?? DEFAULTS.fonts.formats,
    },
    glyph: {
      hinting: cliOverrides.glyph?.hinting ?? fileConfig.glyph?.hinting ?? DEFAULTS.glyph.hinting,
    },
    report: {
      json: cliOverrides.report?.json ?? fileConfig.report?.json ?? DEFAULTS.report.json,
    },
  }

  return merged
}

function normalizeStringArray(val: string | string[] | undefined): string[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

/**
 * Validate a resolved config and throw a descriptive `FontminifyError` on the first
 * problem found (fast-fail). Call this before the pipeline starts so users get clear
 * feedback before any long-running operations begin.
 * @param config
 */
export function validateResolvedConfig(config: ResolvedFontminifyConfig): void {
  // formats must be non-empty
  if (config.fonts.formats.length === 0) {
    throw createUserError(
      'fonts.formats is empty. Specify at least one output format: "ttf", "woff", or "woff2".'
    )
  }

  // formats must only contain valid values
  const invalid = config.fonts.formats.filter(f => !VALID_FORMATS.has(f))
  if (invalid.length > 0) {
    throw createUserError(
      `Invalid font format(s): ${invalid.map(f => `"${f}"`).join(', ')}. ` +
        'Allowed values are "ttf", "woff", and "woff2".'
    )
  }

  // collect.include must be non-empty
  if (config.collect.include.length === 0) {
    throw createUserError(
      'collect.include is empty. Provide at least one glob pattern to scan, ' +
        'e.g. --include "src/**/*.{ts,tsx}".'
    )
  }

  // fonts.src must be set
  if (!config.fonts.src.trim()) {
    throw createUserError(
      'fonts.src is empty. Set --font-src to the directory containing your .ttf source files.'
    )
  }

  // fonts.dest must be set
  if (!config.fonts.dest.trim()) {
    throw createUserError(
      'fonts.dest is empty. Set --font-dest to the output directory for subsetted fonts.'
    )
  }

  // fonts.src and fonts.dest must be different to avoid overwriting source fonts
  if (
    normalizeComparableDirPath(config.fonts.src) === normalizeComparableDirPath(config.fonts.dest)
  ) {
    throw createUserError(
      'fonts.src and fonts.dest must be different directories to avoid overwriting source fonts.'
    )
  }
}

export function defineConfig(config: FontminifyConfig): FontminifyConfig {
  return config
}
