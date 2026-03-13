import type { BuildReport, FontSubsetResult } from '../types.js'
import { relative } from 'node:path'

// ─── Size formatting ──────────────────────────────────────────────────────────

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Display saved percentage; cap at 99.9% since 100% is not meaningful for subsetting.
 * @param p
 */
function formatSavedPercent(p: number): string {
  return `${Math.min(p, 99.9).toFixed(1)}%`
}

/**
 * Return a path relative to cwd; fall back to the absolute path if outside cwd.
 * @param absolutePath
 */
function getRelativePath(absolutePath: string): string {
  const rel = relative(process.cwd(), absolutePath)
  return rel.startsWith('..') ? absolutePath : rel
}

// ─── Report builder ───────────────────────────────────────────────────────────

export interface BuildReportOptions {
  results: FontSubsetResult[]
  presetCharCount: number
  scannedCharCount: number
  totalCharCount: number
  durationMs: number
  dryRun?: boolean
}

export function buildReport(opts: BuildReportOptions): BuildReport {
  const {
    results,
    presetCharCount,
    scannedCharCount,
    totalCharCount,
    durationMs,
    dryRun = false,
  } = opts
  const sorted = [...results].sort(
    (a: FontSubsetResult, b: FontSubsetResult) => b.savedBytes - a.savedBytes
  )

  const totalOriginalSize = results.reduce((s, r) => s + r.originalSize, 0)
  const totalSubsetSize = results.reduce((s, r) => s + r.subsetSize, 0)
  const totalSavedBytes = totalOriginalSize - totalSubsetSize
  const totalSavedPercent = totalOriginalSize > 0 ? (totalSavedBytes / totalOriginalSize) * 100 : 0

  return {
    timestamp: new Date().toISOString(),
    durationMs: Math.round(durationMs),
    dryRun,
    presetCharCount,
    scannedCharCount,
    totalCharCount,
    results: sorted,
    totalOriginalSize,
    totalSubsetSize,
    totalSavedBytes,
    totalSavedPercent,
  }
}

// ─── Pretty printer ───────────────────────────────────────────────────────────

export function printReport(report: BuildReport): void {
  const LINE = '─'.repeat(60)
  const b = (s: string) => `\x1B[1m${s}\x1B[0m`
  const green = (s: string) => `\x1B[32m${s}\x1B[0m`
  const dim = (s: string) => `\x1B[2m${s}\x1B[0m`
  const yellow = (s: string) => `\x1B[33m${s}\x1B[0m`

  const title = report.dryRun
    ? `${b('fontminify')} ${yellow('[dry-run]')} report`
    : `${b('fontminify')} report`

  process.stdout.write(`\n${title}\n${LINE}\n`)

  process.stdout.write(
    `${b('Chars')}  ` +
      `preset: ${report.presetCharCount.toLocaleString()}  ` +
      `scanned: ${report.scannedCharCount.toLocaleString()}  ` +
      `total: ${b(report.totalCharCount.toLocaleString())}\n\n`
  )

  // Group results by font name, preserving the descending-savings order within each font.
  const groupedByFont = new Map<string, FontSubsetResult[]>()
  for (const r of report.results) {
    const list = groupedByFont.get(r.fontName) ?? []
    list.push(r)
    groupedByFont.set(r.fontName, list)
  }

  for (const [fontName, items] of groupedByFont) {
    process.stdout.write(`${b(fontName)}\n`)

    for (const r of items) {
      const fmt = r.format.toUpperCase().padEnd(5)
      const originalSize = formatSize(r.originalSize)

      if (report.dryRun) {
        // In dry-run mode show original size so the user knows what would be processed.
        process.stdout.write(`  ${fmt} ${originalSize}  ${dim('(dry-run, no output)')}\n`)
        continue
      }

      const saved = green(`-${formatSize(r.savedBytes)} (${formatSavedPercent(r.savedPercent)})`)
      const relPath = dim(getRelativePath(r.outputPath))
      process.stdout.write(
        `  ${fmt} ${originalSize} → ${formatSize(r.subsetSize)}  ${saved}  ${relPath}\n`
      )
    }

    process.stdout.write('\n')
  }

  if (!report.dryRun) {
    const totalSaved = green(
      `-${formatSize(report.totalSavedBytes)} (${formatSavedPercent(report.totalSavedPercent)})`
    )
    process.stdout.write(
      `${LINE}\n` +
        `${b('Total')}  ` +
        `${formatSize(report.totalOriginalSize)} → ${formatSize(report.totalSubsetSize)}  ` +
        `${totalSaved}  ${dim(`Done in ${formatDuration(report.durationMs)}`)}\n\n`
    )
  } else {
    process.stdout.write(`${dim(`Done in ${formatDuration(report.durationMs)}`)}\n\n`)
  }
}

// ─── JSON printer ─────────────────────────────────────────────────────────────

export function printReportJson(report: BuildReport): void {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}
