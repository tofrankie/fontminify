import type { Command } from 'commander'
import type { FontFormat, FontminifyConfig } from '../types'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { loadConfigFile, resolveConfig, validateResolvedConfig } from '../config/resolve-config'
import { mergeAndSort, readPresetFiles, resolvePresetPaths } from '../core/character-list'
import { collectChars } from '../core/extract'
import { minifyAllFonts } from '../core/minify'
import { buildReport, printReport, printReportJson } from '../core/report'
import { ERROR_CODES, FontminifyError } from '../errors'
import { handleCliError } from '../utils/handle-error'

interface BuildOptions {
  config?: string
  preset?: string[]
  include?: string[]
  exclude?: string[]
  characterPattern?: string
  fontSrc?: string
  fontDest?: string
  formats?: string
  dryRun?: boolean
  charsOut?: string
  silent?: boolean
  json?: boolean
}

export function registerBuildCommand(program: Command): void {
  program
    .command('build', { isDefault: true })
    .description('Run full pipeline: collect chars → merge → subset fonts → report')
    .option('-c, --config <path>', 'Config file path (default: fontminify.config.js)')
    .option('--preset <path...>', 'Preset chars file path(s)')
    .option('--include <glob...>', 'Glob patterns for files to scan')
    .option('--exclude <glob...>', 'Glob patterns to exclude from scan')
    .option('--character-pattern <regex>', 'Unicode regex for character extraction (default: \\p{Script=Han})')
    .option('--font-src <dir>', 'Source font directory (reads all .ttf files)')
    .option('--font-dest <dir>', 'Output font directory')
    .option('--formats <list>', 'Output formats, comma-separated (ttf,woff,woff2)')
    .option('--dry-run', 'Scan and estimate only, do not produce font files')
    .option('--chars-out <path>', 'Write merged characters to file (for audit)')
    .option('--silent', 'Suppress all non-error output')
    .option('--json', 'Output report as JSON (to stdout)')
    .addHelpText(
      'after',
      `
Examples:
  $ fontminify build
  $ fontminify build --font-src fonts/ --font-dest dist/fonts/ --formats woff2,woff
  $ fontminify build --preset preset-chars.txt --include "src/**/*.{ts,tsx}"
  $ fontminify build --dry-run
  $ fontminify build --json > report.json`
    )
    .action(async (opts: BuildOptions) => {
      try {
        await runBuild(opts)
      } catch (err) {
        handleCliError(err, { json: opts.json })
      }
    })
}

async function runBuild(opts: BuildOptions): Promise<void> {
  const start = performance.now()

  const fileConfig = await loadConfigFile(opts.config)
  const cliConfig = buildCliConfig(opts)
  const config = resolveConfig(fileConfig, cliConfig)

  // Fast-fail on invalid config before starting any long-running operations.
  validateResolvedConfig(config)

  if (!opts.silent && !opts.json) {
    process.stderr.write('fontminify: collecting chars...\n')
  }

  // Expand preset paths (supports globs, e.g. "presets/*.txt").
  const presetPaths = await resolvePresetPaths(config.presetCharsFile)
  const presetChars = await readPresetFiles(presetPaths)
  const { chars: scannedChars, skippedFiles } = await collectChars(config.collect)

  if (skippedFiles.length > 0 && !opts.silent && !opts.json) {
    process.stderr.write(`fontminify: skipped ${skippedFiles.length} unreadable file(s) while scanning\n`)
  }

  const finalText = mergeAndSort(presetChars, scannedChars)

  if (finalText.length === 0) {
    throw new FontminifyError(
      ERROR_CODES.EMPTY_CHARACTER_LIST,
      'No characters to include (merged list is empty). ' + 'Add a --preset file or check --include patterns.'
    )
  }

  if (opts.charsOut) {
    const outPath = resolve(process.cwd(), opts.charsOut)
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, finalText, 'utf8')
    if (!opts.silent && !opts.json) {
      process.stderr.write(`fontminify: chars written to ${outPath}\n`)
    }
  }

  if (!opts.silent && !opts.json) {
    process.stderr.write(`fontminify: minifying fonts (${finalText.length} chars)...\n`)
  }

  const dryRun = opts.dryRun ?? false
  const results = await minifyAllFonts(config, finalText, dryRun)
  const durationMs = performance.now() - start

  const report = buildReport({
    results,
    presetCharCount: presetChars.size,
    scannedCharCount: scannedChars.size,
    totalCharCount: finalText.length,
    durationMs,
    dryRun,
  })

  const useJsonReport = opts.json ?? config.report.json
  if (useJsonReport) {
    printReportJson(report)
    return
  }

  if (!opts.silent) {
    printReport(report)
  }
}

function buildCliConfig(opts: BuildOptions): Partial<FontminifyConfig> {
  const override: Partial<FontminifyConfig> = {}

  if (opts.preset?.length) override.presetCharsFile = opts.preset

  // Only set the fields that were explicitly provided; unset fields fall through
  // to the config file or defaults in resolveConfig, preventing accidental overrides.
  if (opts.include?.length || opts.exclude?.length || opts.characterPattern) {
    override.collect = {
      ...(opts.include?.length ? { include: opts.include } : {}),
      ...(opts.exclude?.length ? { exclude: opts.exclude } : {}),
      ...(opts.characterPattern ? { characterPattern: opts.characterPattern } : {}),
    }
  }

  if (opts.fontSrc || opts.fontDest || opts.formats) {
    override.fonts = {
      ...(opts.fontSrc ? { src: opts.fontSrc } : {}),
      ...(opts.fontDest ? { dest: opts.fontDest } : {}),
      ...(opts.formats ? { formats: opts.formats.split(',').map(f => f.trim() as FontFormat) } : {}),
    }
  }

  if (opts.json) override.report = { json: true }

  return override
}
