import type { FontSubsetResult } from '../src/types.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildReport, formatSize, printReport, printReportJson } from '../src/core/report.js'

// ─── formatSize ───────────────────────────────────────────────────────────────

describe('formatSize', () => {
  it('displays bytes as B when under 1 KB', () => {
    expect(formatSize(0)).toBe('0B')
    expect(formatSize(512)).toBe('512B')
    expect(formatSize(1023)).toBe('1023B')
  })

  it('displays KB with two decimal places between 1 KB and 1 MB', () => {
    expect(formatSize(1024)).toBe('1.00KB')
    expect(formatSize(2048)).toBe('2.00KB')
    expect(formatSize(1536)).toBe('1.50KB')
  })

  it('displays MB with two decimal places at or above 1 MB', () => {
    expect(formatSize(1024 * 1024)).toBe('1.00MB')
    expect(formatSize(1024 * 1024 * 2.5)).toBe('2.50MB')
  })
})

// ─── buildReport ─────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<FontSubsetResult> = {}): FontSubsetResult {
  return {
    fontName: 'NotoSans',
    format: 'woff2',
    originalSize: 10_000,
    subsetSize: 500,
    savedBytes: 9_500,
    savedPercent: 95,
    outputPath: '/dist/fonts/NotoSans.woff2',
    ...overrides,
  }
}

describe('buildReport', () => {
  it('computes correct totals from results', () => {
    const report = buildReport({
      results: [makeResult()],
      presetCharCount: 100,
      scannedCharCount: 14,
      totalCharCount: 110,
      durationMs: 1234,
    })

    expect(report.totalOriginalSize).toBe(10_000)
    expect(report.totalSubsetSize).toBe(500)
    expect(report.totalSavedBytes).toBe(9_500)
    expect(report.totalSavedPercent).toBeCloseTo(95, 1)
  })

  it('copies char count fields from options', () => {
    const report = buildReport({
      results: [],
      presetCharCount: 200,
      scannedCharCount: 30,
      totalCharCount: 220,
      durationMs: 0,
    })

    expect(report.presetCharCount).toBe(200)
    expect(report.scannedCharCount).toBe(30)
    expect(report.totalCharCount).toBe(220)
  })

  it('rounds durationMs to the nearest integer', () => {
    const report = buildReport({
      results: [],
      presetCharCount: 0,
      scannedCharCount: 0,
      totalCharCount: 0,
      durationMs: 123.7,
    })

    expect(report.durationMs).toBe(124)
  })

  it('sets dryRun to false by default', () => {
    const report = buildReport({
      results: [],
      presetCharCount: 0,
      scannedCharCount: 0,
      totalCharCount: 0,
      durationMs: 0,
    })

    expect(report.dryRun).toBe(false)
  })

  it('respects explicit dryRun: true', () => {
    const report = buildReport({
      results: [],
      presetCharCount: 0,
      scannedCharCount: 0,
      totalCharCount: 0,
      durationMs: 0,
      dryRun: true,
    })

    expect(report.dryRun).toBe(true)
  })

  it('includes a valid ISO 8601 timestamp', () => {
    const report = buildReport({
      results: [],
      presetCharCount: 0,
      scannedCharCount: 0,
      totalCharCount: 0,
      durationMs: 0,
    })

    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('sorts results by savedBytes descending', () => {
    const small = makeResult({ format: 'woff', savedBytes: 100 })
    const large = makeResult({ format: 'woff2', savedBytes: 9_500 })

    const report = buildReport({
      results: [small, large],
      presetCharCount: 0,
      scannedCharCount: 0,
      totalCharCount: 0,
      durationMs: 0,
    })

    expect(report.results[0].savedBytes).toBe(9_500)
    expect(report.results[1].savedBytes).toBe(100)
  })

  it('returns zero percent savings when originalSize is 0', () => {
    const report = buildReport({
      results: [makeResult({ originalSize: 0, subsetSize: 0, savedBytes: 0 })],
      presetCharCount: 0,
      scannedCharCount: 0,
      totalCharCount: 0,
      durationMs: 0,
    })

    expect(report.totalSavedPercent).toBe(0)
  })
})

// ─── printReport / printReportJson ───────────────────────────────────────────

describe('printReport', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
  })

  it('writes human-readable report with Chars and Total', () => {
    const report = buildReport({
      results: [makeResult()],
      presetCharCount: 10,
      scannedCharCount: 5,
      totalCharCount: 12,
      durationMs: 100,
    })
    printReport(report)
    const out = stdoutSpy.mock.calls.flat().join('') as string
    expect(out).toMatch(/fontminify.*report/)
    expect(out).toMatch(/Chars/)
    expect(out).toMatch(/preset: 10/)
    expect(out).toMatch(/Total/)
  })

  it('writes dry-run label when report.dryRun is true', () => {
    const report = buildReport({
      results: [],
      presetCharCount: 0,
      scannedCharCount: 0,
      totalCharCount: 0,
      durationMs: 0,
      dryRun: true,
    })
    printReport(report)
    const out = stdoutSpy.mock.calls.flat().join('') as string
    expect(out).toMatch(/dry-run/)
  })

  it('writes dry-run row with original size when results exist', () => {
    const report = buildReport({
      results: [makeResult()],
      presetCharCount: 0,
      scannedCharCount: 0,
      totalCharCount: 1,
      durationMs: 0,
      dryRun: true,
    })
    printReport(report)
    const out = stdoutSpy.mock.calls.flat().join('') as string
    expect(out).toMatch(/dry-run, no output/)
    expect(out).toMatch(/9\.77KB|10000/)
  })

  it('formats duration in seconds when durationMs >= 1000', () => {
    const report = buildReport({
      results: [],
      presetCharCount: 0,
      scannedCharCount: 0,
      totalCharCount: 0,
      durationMs: 2500,
      dryRun: true,
    })
    printReport(report)
    const out = stdoutSpy.mock.calls.flat().join('') as string
    expect(out).toMatch(/2\.5s/)
  })
})

describe('printReportJson', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
  })

  it('writes valid JSON report', () => {
    const report = buildReport({
      results: [makeResult()],
      presetCharCount: 0,
      scannedCharCount: 0,
      totalCharCount: 1,
      durationMs: 0,
    })
    printReportJson(report)
    const out = stdoutSpy.mock.calls.flat().join('') as string
    const parsed = JSON.parse(out.trim())
    expect(parsed).toHaveProperty('timestamp')
    expect(parsed).toHaveProperty('durationMs')
    expect(parsed).toHaveProperty('results')
    expect(parsed.results).toHaveLength(1)
  })
})
