import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import { registerBuildCommand } from './commands/build'
import { registerCollectCommand } from './commands/collect'
import { registerInitCommand } from './commands/init'
import { registerPresetsCommand } from './commands/presets'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
  version: string
}

main()

function main() {
  // Suppress DEP0180 emitted by fontmin's dependency chain on Node 22+.
  //
  // Root cause:  clone-stats@1.0.0 calls `new fs.Stats(...)` (deprecated in Node 22)
  //              inside vinyl's File.clone(), which is triggered by fontmin's ttf2woff2
  //              plugin every time it processes a file.
  // Dependency:  fontmin → vinyl@2 → clone-stats@1 → new fs.Stats()
  // Reference:   https://nodejs.org/api/deprecations.html#DEP0180
  //
  // Without suppression, every `fontminify build` run prints:
  //   (node:XXXX) [DEP0180] DeprecationWarning: fs.Stats constructor is deprecated.
  //   (Use `node --trace-deprecation ...` to show where the warning was created)
  //
  // We cannot fix this upstream without forking fontmin. The warning is suppressed
  // here (CLI entry only) so it does not pollute user output or CI logs.
  suppressDeprecation('DEP0180')

  const program = new Command()

  program
    .name('fontminify')
    .description('Subset and minify fonts')
    .version(pkg.version, '-v, --version')
    .addHelpText(
      'after',
      `
  Examples:
    $ fontminify                          Run full build with config file
    $ fontminify build --dry-run          Preview without producing files
    $ fontminify collect                  Output scanned chars to stdout
    $ fontminify init                     Generate default config file
    $ fontminify presets list             List built-in presets
    $ fontminify presets generate         Write a preset to a file`
    )

  registerBuildCommand(program)
  registerCollectCommand(program)
  registerInitCommand(program)
  registerPresetsCommand(program)

  program.parseAsync(process.argv).catch(err => {
    process.stderr.write(
      `\x1B[31mError:\x1B[0m ${err instanceof Error ? err.message : String(err)}\n`
    )
    process.exit(2)
  })
}

/**
 * Suppress a specific Node.js deprecation warning emitted by third-party dependencies.
 *
 * Node.js calls process.emitWarning in three shapes:
 *   (a) emitWarning(error)                  — code lives on the Error object
 *   (b) emitWarning(message, type, code)    — code is the 3rd string argument
 *   (c) emitWarning(message, { code, ... }) — code lives on the 2nd arg object
 *
 * We use Object.defineProperty so the assignment bypasses TypeScript's strict
 * overload checking on process.emitWarning.
 * @param targetCode
 */
function suppressDeprecation(targetCode: string): void {
  const orig = process.emitWarning.bind(process)

  function filtered(warning: string | Error, ...args: unknown[]): void {
    let code: string | undefined
    if (typeof warning === 'object' && warning !== null) {
      code = (warning as { code?: string }).code
    } else if (typeof args[0] === 'object' && args[0] !== null) {
      code = (args[0] as { code?: string }).code
    } else {
      code = args[1] as string | undefined
    }
    if (code === targetCode) return
    orig(
      warning as string,
      ...(args as Parameters<typeof orig> extends [unknown, ...infer R] ? R : never[])
    )
  }

  Object.defineProperty(process, 'emitWarning', {
    value: filtered,
    writable: true,
    configurable: true,
  })
}
