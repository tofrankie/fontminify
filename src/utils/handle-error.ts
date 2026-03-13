import { ERROR_CODES, FontminifyError } from '../errors.js'

interface HandleErrorOptions {
  /** When true, output the error as a JSON object to stderr instead of plain text. */
  json?: boolean
}

/**
 * Unified CLI error handler used by all commands.
 *
 * Exit codes:
 *   1 — USER_ERROR / EMPTY_CHARACTER_LIST (bad arguments, invalid config, or no characters to include)
 *   2 — RUNTIME_ERROR or unknown (subsetting failure, I/O error, unexpected exception)
 * @param err
 * @param opts
 */
export function handleCliError(err: unknown, opts: HandleErrorOptions = {}): never {
  const isFontminifyErr = err instanceof FontminifyError
  const isUserErr =
    isFontminifyErr &&
    (err.code === ERROR_CODES.USER_ERROR || err.code === ERROR_CODES.EMPTY_CHARACTER_LIST)
  const exitCode = isUserErr ? 1 : 2
  const msg = err instanceof Error ? err.message : String(err)

  if (opts.json) {
    const payload: Record<string, string> = { error: msg }
    if (isFontminifyErr) payload.code = err.code
    process.stderr.write(`${JSON.stringify(payload)}\n`)
  } else {
    const label = isUserErr ? '\x1B[31mError:\x1B[0m' : '\x1B[31mInternal error:\x1B[0m'
    process.stderr.write(`${label} ${msg}\n`)

    // For unexpected errors, suggest using --trace for Node internals.
    if (!isFontminifyErr && err instanceof Error && err.stack) {
      process.stderr.write(
        '\x1B[2m(run with NODE_OPTIONS=--stack-trace-limit=25 for full stack)\x1B[0m\n'
      )
    }
  }

  process.exit(exitCode)
}
