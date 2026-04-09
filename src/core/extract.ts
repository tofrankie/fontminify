import type { CollectConfig } from '../types'
import { createReadStream } from 'node:fs'
import * as readline from 'node:readline'
import { glob } from 'tinyglobby'
import { createUserError } from '../errors'

const DEFAULT_CHARACTER_PATTERN = '\\p{Script=Han}'

/**
 * Glob project files based on include/exclude patterns.
 * @param config
 */
export async function globFiles(config: CollectConfig): Promise<string[]> {
  const { include, exclude = [] } = config
  if (include.length === 0) return []

  const files = await glob(include, {
    cwd: process.cwd(),
    ignore: exclude,
    absolute: true,
    onlyFiles: true,
  })

  return files
}

/**
 * Stream-read a file line by line and extract matching chars.
 * @param filePath
 * @param regex
 */
async function extractCharsFromFile(filePath: string, regex: RegExp): Promise<Set<string>> {
  const chars = new Set<string>()

  const stream = createReadStream(filePath, { encoding: 'utf8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  for await (const line of rl) {
    const matches = line.match(regex)
    if (matches) {
      for (const ch of matches) chars.add(ch)
    }
  }

  return chars
}

export interface CollectCharsResult {
  chars: Set<string>
  fileCount: number
  skippedFiles: string[]
}

/**
 * Collect all matching characters from project files.
 * @param config
 */
export async function collectChars(config: CollectConfig): Promise<CollectCharsResult> {
  const pattern = config.characterPattern ?? DEFAULT_CHARACTER_PATTERN
  let regex: RegExp
  try {
    regex = new RegExp(pattern, 'gu')
  } catch {
    throw createUserError(
      `Invalid characterPattern "${pattern}". ` +
        'Provide a valid JS Unicode regex string without /…/ delimiters, ' +
        'e.g. "\\\\p{Script=Han}" or "\\\\p{Script=Han}|[a-zA-Z0-9]".'
    )
  }

  const files = await globFiles(config)
  const allChars = new Set<string>()
  const skippedFiles: string[] = []

  for (const file of files) {
    try {
      const chars = await extractCharsFromFile(file, regex)
      for (const ch of chars) allChars.add(ch)
    } catch {
      skippedFiles.push(file)
    }
  }

  return { chars: allChars, fileCount: files.length, skippedFiles }
}
