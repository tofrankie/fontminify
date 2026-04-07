import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { glob } from 'tinyglobby'
import { createUserError } from '../errors'

const GLOB_META_RE = /[*?{}[\]!]/
const LINE_BREAK_RE = /\r?\n/u

/**
 * Expand an array of paths/globs into concrete file paths.
 * Plain paths that exist are kept as-is; glob patterns are expanded via tinyglobby.
 * @param patterns
 */
export async function resolvePresetPaths(patterns: string[]): Promise<string[]> {
  if (patterns.length === 0) return []

  const resolved: string[] = []
  const globPatterns: string[] = []

  for (const p of patterns) {
    // Treat a pattern as a literal path if it contains no glob metacharacters.
    if (!GLOB_META_RE.test(p)) {
      resolved.push(resolve(process.cwd(), p))
    } else {
      globPatterns.push(p)
    }
  }

  if (globPatterns.length > 0) {
    const matched = await glob(globPatterns, { absolute: true, onlyFiles: true })
    resolved.push(...matched)
  }

  return resolved
}

/**
 * Read chars from a preset file (plain text, one-or-more chars per line or all in one).
 * Returns a Set of individual characters (after deduplication).
 * @param filePath
 */
export async function readPresetFile(filePath: string): Promise<Set<string>> {
  let content: string
  try {
    content = await readFile(filePath, 'utf8')
  } catch {
    throw createUserError(`Cannot read preset chars file "${filePath}". Make sure the file exists and is readable.`)
  }

  return textToCharacterList(content)
}

/**
 * Read chars from multiple preset files and merge them.
 * @param filePaths
 */
export async function readPresetFiles(filePaths: string[]): Promise<Set<string>> {
  const merged = new Set<string>()
  for (const fp of filePaths) {
    const chars = await readPresetFile(fp)
    for (const ch of chars) merged.add(ch)
  }
  return merged
}

/**
 * Convert arbitrary text to a deduplicated set of characters.
 * @param text
 */
export function textToCharacterList(text: string): Set<string> {
  const chars = new Set<string>()
  const lines = text.split(LINE_BREAK_RE)
  for (const line of lines) {
    const trimmed = line.trim()
    // Allow metadata/comment headers in preset files without polluting the character list.
    if (trimmed.startsWith('# ')) continue
    for (const ch of line) {
      if (ch === ' ') continue
      if (ch.trim() === '') {
        chars.add(ch)
        continue
      }
      chars.add(ch)
    }
  }
  return chars
}

/**
 * Merge two sets of characters and return a sorted, deduplicated string.
 * @param a
 * @param b
 */
export function mergeAndSort(a: Set<string>, b: Set<string>): string {
  const merged = new Set([...a, ...b])
  const chars: string[] = []
  for (const ch of merged) chars.push(ch)
  chars.sort()
  return chars.join('')
}
