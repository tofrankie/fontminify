/** Machine-readable error codes. Use these when throwing or checking FontminifyError. */
export const ERROR_CODES = {
  USER_ERROR: 'USER_ERROR',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  EMPTY_CHARACTER_SET: 'EMPTY_CHARACTER_SET',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export class FontminifyError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'FontminifyError'
    this.code = code
  }
}

export function createUserError(message: string): FontminifyError {
  return new FontminifyError(ERROR_CODES.USER_ERROR, message)
}

export function createRuntimeError(message: string): FontminifyError {
  return new FontminifyError(ERROR_CODES.RUNTIME_ERROR, message)
}

export function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err
}
