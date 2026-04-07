import type { BuildReport, FontminifyConfig, ResolvedFontminifyConfig } from './types'
import { performance } from 'node:perf_hooks'
import { loadConfigFile, resolveConfig, validateResolvedConfig } from './config/resolve-config'
import { mergeAndSort, readPresetFiles, resolvePresetPaths } from './core/character-list'
import { collectChars } from './core/extract'
import { minifyAllFonts } from './core/minify'
import { buildReport } from './core/report'
import { ERROR_CODES, FontminifyError } from './errors'

export type { BuildReport, FontminifyConfig, ResolvedFontminifyConfig }
export { defineConfig, validateResolvedConfig } from './config/resolve-config'
export { ERROR_CODES, FontminifyError } from './errors'
export type { CollectConfig, FontFormat, FontsConfig, FontSubsetResult, GlyphConfig, ReportConfig } from './types'

/**
 * Resolve config from file + optional overrides.
 * @param configPath
 * @param overrides
 */
export async function getResolvedConfig(
  configPath?: string,
  overrides?: Partial<FontminifyConfig>
): Promise<ResolvedFontminifyConfig> {
  const fileConfig = await loadConfigFile(configPath)
  return resolveConfig(fileConfig, overrides)
}

/**
 * Collect chars from project files based on resolved config.
 * @param config
 */
export async function collectProjectChars(
  config: ResolvedFontminifyConfig
): Promise<{ presetChars: Set<string>; scannedChars: Set<string>; finalText: string }> {
  const presetPaths = await resolvePresetPaths(config.presetCharsFile)
  const presetChars = await readPresetFiles(presetPaths)
  const { chars: scannedChars } = await collectChars(config.collect)
  const finalText = mergeAndSort(presetChars, scannedChars)
  return { presetChars, scannedChars, finalText }
}

/**
 * Run the full build pipeline: collect + subset + report.
 * @param config
 * @param options
 * @param options.dryRun
 */
export async function buildSubset(
  config: ResolvedFontminifyConfig,
  options: { dryRun?: boolean } = {}
): Promise<BuildReport> {
  validateResolvedConfig(config)
  const { presetChars, scannedChars, finalText } = await collectProjectChars(config)

  if (finalText.length === 0) {
    throw new FontminifyError(
      ERROR_CODES.EMPTY_CHARACTER_LIST,
      'No characters to include. Add a preset file or check collect.include patterns.'
    )
  }

  const start = performance.now()
  const dryRun = options.dryRun ?? false
  const results = await minifyAllFonts(config, finalText, dryRun)
  const durationMs = performance.now() - start

  return buildReport({
    results,
    presetCharCount: presetChars.size,
    scannedCharCount: scannedChars.size,
    totalCharCount: finalText.length,
    durationMs,
    dryRun,
  })
}
