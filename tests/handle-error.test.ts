import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeError, createUserError, FontminifyError } from '../src/errors'
import { handleCliError } from '../src/utils/handle-error'

describe('handleCliError', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    exitSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('exits with 1 for USER_ERROR', () => {
    handleCliError(createUserError('bad input'))
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(stderrSpy).toHaveBeenCalled()
    const out = stderrSpy.mock.calls.flat().join('') as string
    expect(out).toMatch(/Error:|bad input/)
  })

  it('exits with 2 for RUNTIME_ERROR', () => {
    handleCliError(createRuntimeError('io failed'))
    expect(exitSpy).toHaveBeenCalledWith(2)
    const out = stderrSpy.mock.calls.flat().join('') as string
    expect(out).toMatch(/Internal error:|io failed/)
  })

  it('exits with 2 for generic Error', () => {
    handleCliError(new Error('unknown'))
    expect(exitSpy).toHaveBeenCalledWith(2)
  })

  it('exits with 1 for EMPTY_CHARACTER_LIST', () => {
    const err = new FontminifyError('EMPTY_CHARACTER_LIST', 'No characters to include.')
    handleCliError(err)
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('with opts.json writes JSON to stderr and exits 1 for USER_ERROR', () => {
    handleCliError(createUserError('invalid'), { json: true })
    expect(exitSpy).toHaveBeenCalledWith(1)
    const out = (stderrSpy.mock.calls.flat().join('') as string).trim()
    const parsed = JSON.parse(out)
    expect(parsed).toMatchObject({ error: 'invalid', code: 'USER_ERROR' })
  })

  it('with opts.json writes JSON to stderr and exits 2 for RUNTIME_ERROR', () => {
    handleCliError(createRuntimeError('crash'), { json: true })
    expect(exitSpy).toHaveBeenCalledWith(2)
    const out = (stderrSpy.mock.calls.flat().join('') as string).trim()
    const parsed = JSON.parse(out)
    expect(parsed.error).toBe('crash')
    expect(parsed.code).toBe('RUNTIME_ERROR')
  })
})
