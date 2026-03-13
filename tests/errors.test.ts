import { describe, expect, it } from 'vitest'
import { createRuntimeError, createUserError, FontminifyError, isNodeError } from '../src/errors.js'

describe('FontminifyError', () => {
  it('is an instance of Error', () => {
    const err = new FontminifyError('USER_ERROR', 'bad input')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(FontminifyError)
  })

  it('stores code and message', () => {
    const err = new FontminifyError('RUNTIME_ERROR', 'io failed')
    expect(err.code).toBe('RUNTIME_ERROR')
    expect(err.message).toBe('io failed')
    expect(err.name).toBe('FontminifyError')
  })
})

describe('createUserError', () => {
  it('creates a FontminifyError with USER_ERROR code', () => {
    const err = createUserError('missing file')
    expect(err).toBeInstanceOf(FontminifyError)
    expect(err.code).toBe('USER_ERROR')
    expect(err.message).toBe('missing file')
  })
})

describe('createRuntimeError', () => {
  it('creates a FontminifyError with RUNTIME_ERROR code', () => {
    const err = createRuntimeError('subsetting failed')
    expect(err).toBeInstanceOf(FontminifyError)
    expect(err.code).toBe('RUNTIME_ERROR')
    expect(err.message).toBe('subsetting failed')
  })
})

describe('isNodeError', () => {
  it('returns true for an Error with a code property', () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    expect(isNodeError(err)).toBe(true)
  })

  it('returns false for a plain Error without code', () => {
    expect(isNodeError(new Error('plain'))).toBe(false)
  })

  it('returns false for non-Error values', () => {
    expect(isNodeError('string')).toBe(false)
    expect(isNodeError(null)).toBe(false)
    expect(isNodeError(42)).toBe(false)
  })
})
