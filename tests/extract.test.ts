import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectChars, globFiles } from '../src/core/extract'

const TMP = tmpdir()

describe('globFiles', () => {
  it('returns empty array when include is empty', async () => {
    const files = await globFiles({ include: [], exclude: [] })
    expect(files).toEqual([])
  })

  it('returns matching files for a pattern', async () => {
    const dir = join(TMP, `fontminify-glob-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'a.ts'), 'x', 'utf8')
    await writeFile(join(dir, 'b.ts'), 'y', 'utf8')

    const files = await globFiles({
      include: [join(dir, '*.ts')],
      exclude: [],
    })
    expect(files.length).toBe(2)
    expect(files.some(p => p.endsWith('a.ts'))).toBe(true)
    expect(files.some(p => p.endsWith('b.ts'))).toBe(true)
  })
})

describe('collectChars', () => {
  it('throws USER_ERROR for invalid characterPattern', async () => {
    await expect(
      collectChars({ include: ['**/*.ts'], characterPattern: '[' })
    ).rejects.toMatchObject({ code: 'USER_ERROR' })
    await expect(collectChars({ include: ['**/*.ts'], characterPattern: '[' })).rejects.toThrow(
      /Invalid characterPattern/
    )
  })

  it('returns empty set when no files match include', async () => {
    const { chars, skippedFiles } = await collectChars({
      include: [join(TMP, `nonexistent-${Date.now()}`, '*.ts')],
    })
    expect(chars.size).toBe(0)
    expect(skippedFiles).toEqual([])
  })

  it('extracts chars from matched files using default Han pattern', async () => {
    const dir = join(TMP, `fontminify-collect-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    const filePath = join(dir, 'sample.ts')
    await writeFile(filePath, 'const x = "你好世界";\n', 'utf8')

    const { chars, skippedFiles } = await collectChars({
      include: [join(dir, '*.ts')],
    })
    expect(chars.has('你')).toBe(true)
    expect(chars.has('好')).toBe(true)
    expect(chars.has('世')).toBe(true)
    expect(chars.has('界')).toBe(true)
    expect(chars.size).toBe(4)
    expect(skippedFiles).toEqual([])
  })

  it('uses custom characterPattern when provided', async () => {
    const dir = join(TMP, `fontminify-collect2-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'a.js'), 'abc 123 xyz', 'utf8')

    const { chars, skippedFiles } = await collectChars({
      include: [join(dir, '*.js')],
      characterPattern: '[a-z]',
    })
    expect(chars.has('a')).toBe(true)
    expect(chars.has('b')).toBe(true)
    expect(chars.has('x')).toBe(true)
    expect(chars.has('1')).toBe(false)
    expect(chars.size).toBeGreaterThanOrEqual(3)
    expect(skippedFiles).toEqual([])
  })
})
