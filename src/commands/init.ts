import type { Command } from 'commander'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createUserError } from '../errors.js'
import { handleCliError } from '../utils/handle-error.js'

const TEMPLATE = `import { defineConfig } from '@tofrankie/fontminify'

export default defineConfig({
  // Path(s) to preset character file(s). String or array.
  // presetCharsFile: 'preset-chars.txt',

  collect: {
    // Glob patterns for source files to scan.
    include: ['src/**/*.{json,js,jsx,ts,tsx,vue}'],
    // Glob patterns to exclude.
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Unicode regex to extract chars (default: Chinese).
    // characterPattern: '\\\\p{Script=Han}',
  },

  fonts: {
    // Source directory for .ttf files (non-recursive).
    src: 'fonts',
    // Output directory for subset fonts.
    dest: 'dist/fonts',
    // Output formats.
    formats: ['woff2', 'woff'],
  },

  glyph: {
    // Keep TTF hinting (fpgm, prep, cvt). Default: false.
    hinting: false,
  },
})
`

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Generate default fontminify.config.js in the current directory')
    .option('-f, --force', 'Overwrite existing config file')
    .addHelpText(
      'after',
      `
Examples:
  $ fontminify init
  $ fontminify init --force`
    )
    .action(async (opts: { force?: boolean }) => {
      try {
        const outPath = resolve(process.cwd(), 'fontminify.config.js')
        if (existsSync(outPath) && !opts.force) {
          throw createUserError('fontminify.config.js already exists. Use --force to overwrite.')
        }
        await writeFile(outPath, TEMPLATE, 'utf8')
        process.stdout.write('Created fontminify.config.js\n')
      } catch (err) {
        handleCliError(err)
      }
    })
}
