import type { Command } from 'commander'
import { existsSync, statSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { input, select } from '@inquirer/prompts'
import { createRuntimeError, createUserError } from '../errors'
import { handleCliError } from '../utils/handle-error'

/** Preset files (from src/templates/presets) are copied to dist/presets at build time. */
const __dirname = dirname(fileURLToPath(import.meta.url))
const PRESETS_DIR = join(__dirname, 'presets')

/**
 * Resolve user output path (absolute or relative to cwd).
 * If path is an existing directory or a non-existent path with no file extension, treat as directory and return <path>/<name>.txt.
 * Otherwise treat as file path and return as-is (parent dirs will be created when writing).
 * @param input
 * @param presetName
 */
export function resolveOutputPath(input: string, presetName: string): string {
  const resolved = resolve(process.cwd(), input)
  if (existsSync(resolved)) {
    if (statSync(resolved).isDirectory()) {
      return join(resolved, `${presetName}.txt`)
    }
    return resolved
  }
  const hasExtension = extname(input) !== ''
  const trailingSlash = input.endsWith('/') || input.endsWith('\\')
  if (!hasExtension || trailingSlash) {
    return join(resolved, `${presetName}.txt`)
  }
  return resolved
}

const PRESET_META: Record<string, { description: string; descriptionCN: string }> = {
  'zh-CN-common-characters': {
    description: 'Modern Chinese common characters (2,500 chars)',
    descriptionCN: '现代汉语常用字（共 2500 字）',
  },
  'zh-CN-secondary-characters': {
    description: 'Modern Chinese secondary common characters (1,000 chars)',
    descriptionCN: '现代汉语次常用字（共 1000 字）',
  },
  'zh-CN-common-and-secondary-characters': {
    description: 'Modern Chinese common + secondary characters (3,500 chars)',
    descriptionCN: '现代汉语常用字 + 次常用字（共 3500 字）',
  },
  'zh-CN-punctuation-characters': {
    description: 'Modern Chinese punctuation symbols',
    descriptionCN: '现代汉语标点符号',
  },
  'zh-HK-common-characters': {
    description: 'Hong Kong common characters (4,762 chars)',
    descriptionCN: '香港常用字（共 4762 字）',
  },
  'zh-TW-common-characters': {
    description: 'Taiwan common characters (4,808 chars)',
    descriptionCN: '台湾常用字（共 4808 字）',
  },
  'ascii-characters': {
    description: 'ASCII characters',
    descriptionCN: 'ASCII 常用字符',
  },
}

export function registerPresetsCommand(program: Command): void {
  const cmd = program.command('presets').description('Manage built-in preset character lists')

  cmd
    .command('list')
    .description('List all built-in presets')
    .action(() => {
      process.stdout.write('Built-in presets:\n\n')
      for (const [name, meta] of Object.entries(PRESET_META)) {
        process.stdout.write(`  ${name.padEnd(32)} ${meta.description}\n`)
      }
      process.stdout.write('\nUsage: fontminify presets generate [name] [--out <path>]\n')
    })

  cmd
    .command('generate [name]')
    .description('Write a preset to a file (interactive when name omitted)')
    .option('--out <path>', 'Output path (default: <name>.txt)')
    .option('-f, --force', 'Overwrite existing file')
    .addHelpText(
      'after',
      `
Examples:
  $ fontminify presets generate                    Interactive: select preset and output path
  $ fontminify presets generate zh-CN-common-and-secondary-characters
  $ fontminify presets generate zh-CN-common-and-secondary-characters --out preset-chars.txt`
    )
    .action(async (name: string | undefined, opts: { out?: string; force?: boolean }) => {
      try {
        const isTTY = process.stdin.isTTY === true

        if (!name) {
          if (!isTTY) {
            throw createUserError(
              'Preset name is required when not running interactively. Run "fontminify presets list" to see available presets.'
            )
          }
          name = await select({
            message: 'Select a preset',
            choices: Object.entries(PRESET_META).map(([value, meta]) => ({
              name: `${meta.description} / ${meta.descriptionCN}`,
              value,
            })),
          })
        }

        if (!PRESET_META[name]) {
          throw createUserError(`Unknown preset "${name}". Run "fontminify presets list" to see available presets.`)
        }

        let outPath: string
        if (opts.out) {
          outPath = resolveOutputPath(opts.out, name)
        } else if (isTTY) {
          const outInput = await input({
            message: 'Output path (file or directory; absolute or relative to cwd)',
            default: `${name}.txt`,
          })
          outPath = resolveOutputPath(outInput || `${name}.txt`, name)
        } else {
          outPath = resolveOutputPath(`${name}.txt`, name)
        }

        const srcPath = join(PRESETS_DIR, `${name}.txt`)
        if (!existsSync(srcPath)) {
          throw createRuntimeError(
            `Built-in preset file not found at "${srcPath}". Your installation may be incomplete.`
          )
        }

        if (existsSync(outPath) && !opts.force) {
          const stat = statSync(outPath)
          if (stat.isFile()) {
            throw createUserError(`File "${outPath}" already exists. Use --force to overwrite.`)
          }
        }

        const content = await readFile(srcPath, 'utf8')
        await mkdir(dirname(outPath), { recursive: true })
        await writeFile(outPath, content, 'utf8')
        process.stdout.write(`Generated "${outPath}" (${PRESET_META[name]?.description})\n`)
      } catch (err) {
        handleCliError(err)
      }
    })
}
