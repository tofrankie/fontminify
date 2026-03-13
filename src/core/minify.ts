import type { FontFormat, FontSubsetResult, ResolvedFontminifyConfig } from '../types.js'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { basename, extname, join, normalize, resolve } from 'node:path'
import Fontmin from 'fontmin'
import { createRuntimeError, createUserError } from '../errors.js'

/**
 * Discover all .ttf files in a directory (non-recursive).
 * @param srcDir
 */
export async function discoverFonts(srcDir: string): Promise<string[]> {
  let entries: string[]
  try {
    entries = await readdir(srcDir)
  } catch {
    throw createUserError(
      `Cannot read font source directory "${srcDir}". Set --font-src to a directory containing TTF files.`
    )
  }

  const ttfFiles = entries.filter(e => e.toLowerCase().endsWith('.ttf')).map(e => join(srcDir, e))

  if (ttfFiles.length === 0) {
    throw createUserError(
      `No .ttf files found in "${srcDir}". Set --font-src to a directory containing TTF files.`
    )
  }

  return ttfFiles
}

const TRAILING_SLASH_RE = /[\\/]+$/

function normalizeComparableDirPath(input: string): string {
  const normalized = normalize(resolve(process.cwd(), input)).replace(TRAILING_SLASH_RE, '')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function resolveOutputPath(destDir: string, filename: string): string {
  return join(normalize(resolve(process.cwd(), destDir)), filename)
}

/**
 * Guard against overwriting source fonts (fontmin writes intermediate TTFs into dest).
 * @param srcDir
 * @param destDir
 */
export function checkOverwriteConflict(srcDir: string, destDir: string): void {
  const normalSrc = normalizeComparableDirPath(srcDir)
  const normalDest = normalizeComparableDirPath(destDir)
  if (normalSrc === normalDest) {
    throw createUserError(
      `Font source and destination directories are the same ("${srcDir}"). ` +
        'This would overwrite your source fonts. Set --font-dest to a different directory.'
    )
  }
}

function buildFontmin(opts: Omit<MinifyOneFontOptions, 'dryRun'>): Fontmin {
  const { srcPath, destDir, text, formats, hinting } = opts
  const fm = new Fontmin().src(srcPath).use(Fontmin.glyph({ text, hinting }))

  for (const fmt of formats) {
    if (fmt === 'woff') fm.use(Fontmin.ttf2woff({ deflate: true }))
    else if (fmt === 'woff2') fm.use(Fontmin.ttf2woff2())
  }

  return fm.dest(destDir)
}

interface MinifyOneFontOptions {
  srcPath: string
  destDir: string
  text: string
  formats: FontFormat[]
  hinting: boolean
  dryRun?: boolean
}

export async function minifyOneFont(opts: MinifyOneFontOptions): Promise<FontSubsetResult[]> {
  const { srcPath, destDir, text, formats, hinting, dryRun = false } = opts

  const originalStat = await stat(srcPath).catch(() => {
    throw createUserError(`Font file not found: "${srcPath}"`)
  })
  const originalSize = originalStat.size
  const fontName = basename(srcPath, extname(srcPath))

  if (dryRun) {
    return formats.map(fmt => ({
      fontName,
      format: fmt,
      originalSize,
      subsetSize: 0,
      savedBytes: 0,
      savedPercent: 0,
      outputPath: resolveOutputPath(destDir, `${fontName}.${fmt}`),
    }))
  }

  // Ensure the destination directory exists before fontmin tries to write into it.
  await mkdir(destDir, { recursive: true })

  const fm = buildFontmin({ srcPath, destDir, text, formats, hinting })

  interface FontminFile {
    path?: string
    contents?: { length: number }
  }

  const files = await new Promise<FontminFile[]>((resolve, reject) => {
    fm.run((err, f) => (err ? reject(err) : resolve(f as FontminFile[])))
  }).catch((err: unknown) => {
    throw createRuntimeError(
      `Failed to minify "${basename(srcPath)}": ${err instanceof Error ? err.message : String(err)}`
    )
  })

  // Fontmin always writes a subsetted TTF as an intermediate step even when TTF is not
  // in the requested formats. Clean it up to avoid leaving unexpected files behind.
  if (!formats.includes('ttf')) {
    const intermediateTtf = join(destDir, basename(srcPath))
    await rm(intermediateTtf, { force: true })
  }

  const results: FontSubsetResult[] = []

  for (const file of files) {
    const ext = (file.path?.split('.').pop() ?? 'ttf').toLowerCase() as FontFormat
    // Only report formats that were explicitly requested.
    if (!formats.includes(ext)) continue

    const subsetSize = file.contents?.length ?? 0
    const savedBytes = originalSize - subsetSize
    const savedPercent = originalSize > 0 ? (savedBytes / originalSize) * 100 : 0

    results.push({
      fontName,
      format: ext,
      originalSize,
      subsetSize,
      savedBytes,
      savedPercent,
      outputPath: file.path ?? resolveOutputPath(destDir, `${fontName}.${ext}`),
    })
  }

  return results
}

export async function minifyAllFonts(
  config: ResolvedFontminifyConfig,
  text: string,
  dryRun = false
): Promise<FontSubsetResult[]> {
  checkOverwriteConflict(config.fonts.src, config.fonts.dest)

  const fontPaths = await discoverFonts(config.fonts.src)
  const allResults: FontSubsetResult[] = []

  for (const srcPath of fontPaths) {
    const results = await minifyOneFont({
      srcPath,
      destDir: config.fonts.dest,
      text,
      formats: config.fonts.formats,
      hinting: config.glyph.hinting,
      dryRun,
    })
    allResults.push(...results)
  }

  return allResults
}
