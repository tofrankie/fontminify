import type { Command } from 'commander'
import type { FontminifyConfig } from '../types'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { loadConfigFile, resolveConfig } from '../config/resolve-config'
import { collectChars } from '../core/extract'
import { handleCliError } from '../utils/handle-error'

interface CollectOptions {
  config?: string
  include?: string[]
  exclude?: string[]
  characterPattern?: string
  out?: string
  json?: boolean
  silent?: boolean
}

export function registerCollectCommand(program: Command): void {
  program
    .command('collect')
    .description('Collect and print the characters to include from project files')
    .option('-c, --config <path>', 'Path to config file')
    .option('--include <glob...>', 'Glob patterns for files to scan')
    .option('--exclude <glob...>', 'Glob patterns to exclude')
    .option('--character-pattern <regex>', 'Unicode regex for character extraction')
    .option('--out <path>', 'Write collected chars to file instead of stdout')
    .option('--json', 'Output as JSON ({ chars, count })')
    .option('--silent', 'Suppress stderr progress messages')
    .addHelpText(
      'after',
      `
Examples:
  $ fontminify collect
  $ fontminify collect --include "src/**/*.tsx" --out chars.txt
  $ fontminify collect --json | jq .count`
    )
    .action(async (opts: CollectOptions) => {
      try {
        await runCollect(opts)
      } catch (err) {
        handleCliError(err, { json: opts.json })
      }
    })
}

async function runCollect(opts: CollectOptions): Promise<void> {
  const fileConfig = await loadConfigFile(opts.config)
  const cliConfig = buildCliConfig(opts)
  const config = resolveConfig(fileConfig, cliConfig)

  const { chars, fileCount, skippedFiles } = await collectChars(config.collect)
  if (!opts.silent) {
    process.stderr.write(`fontminify collect: scanning ${fileCount} file(s)...\n`)
    process.stderr.write(`fontminify collect: found ${chars.size} unique char(s)\n`)
    if (skippedFiles.length > 0) {
      process.stderr.write(
        `fontminify collect: skipped ${skippedFiles.length} unreadable file(s)\n`
      )
    }
  }

  const charArr: string[] = []
  for (const ch of chars) charArr.push(ch)
  charArr.sort()
  const sorted = charArr.join('')

  if (opts.out) {
    const outPath = resolve(process.cwd(), opts.out)
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, sorted, 'utf8')
    if (!opts.silent) {
      process.stderr.write(`fontminify collect: written to ${outPath}\n`)
    }
  } else {
    if (opts.json) {
      process.stdout.write(`${JSON.stringify({ chars: sorted, count: chars.size }, null, 2)}\n`)
    } else {
      const dim = process.stdout.isTTY ? (s: string) => `\x1B[2m${s}\x1B[0m` : (s: string) => s
      process.stdout.write(`${dim(sorted)}\n`)
    }
  }
}

function buildCliConfig(opts: CollectOptions): Partial<FontminifyConfig> {
  const override: Partial<FontminifyConfig> = {}
  if (opts.include?.length || opts.exclude?.length || opts.characterPattern) {
    override.collect = {
      ...(opts.include?.length ? { include: opts.include } : {}),
      ...(opts.exclude?.length ? { exclude: opts.exclude } : {}),
      ...(opts.characterPattern ? { characterPattern: opts.characterPattern } : {}),
    }
  }
  return override
}
