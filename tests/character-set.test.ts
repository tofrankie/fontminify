import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  mergeAndSort,
  readPresetFile,
  readPresetFiles,
  resolvePresetPaths,
  textToCharacterSet,
} from '../src/core/character-set.js'

describe('textToCharacterSet', () => {
  it('extracts unique chars', () => {
    const set = textToCharacterSet('hello')
    expect([...set].sort().join('')).toBe('ehlo')
  })

  it('deduplicates repeated chars', () => {
    expect(textToCharacterSet('aaa').size).toBe(1)
    expect(textToCharacterSet('aaa').has('a')).toBe(true)
  })

  it('excludes normal space but keeps other whitespace', () => {
    const set = textToCharacterSet('a b\tc\u3000d')
    expect(set.has(' ')).toBe(false)
    expect(set.has('\t')).toBe(true)
    expect(set.has('\u3000')).toBe(true)
    expect(set.has('a')).toBe(true)
  })

  it('handles CJK characters', () => {
    const set = textToCharacterSet('你好世界')
    expect(set.size).toBe(4)
    expect(set.has('你')).toBe(true)
    expect(set.has('界')).toBe(true)
  })

  it('ignores comment lines starting with #', () => {
    const set = textToCharacterSet('# comment line\n中文')
    expect(set.has('#')).toBe(false)
    expect(set.has('c')).toBe(false)
    expect(set.has('中')).toBe(true)
    expect(set.has('文')).toBe(true)
  })

  it('returns empty set for empty string', () => {
    expect(textToCharacterSet('').size).toBe(0)
  })

  it('returns empty set for normal-space-only string', () => {
    expect(textToCharacterSet('     ').size).toBe(0)
  })
})

describe('mergeAndSort', () => {
  it('merges two disjoint sets and sorts the result', () => {
    const a = new Set(['c', 'a'])
    const b = new Set(['b'])
    expect(mergeAndSort(a, b)).toBe('abc')
  })

  it('deduplicates chars that appear in both sets', () => {
    const a = new Set(['x', 'y'])
    const b = new Set(['y', 'z'])
    expect(mergeAndSort(a, b)).toBe('xyz')
  })

  it('returns empty string for two empty sets', () => {
    expect(mergeAndSort(new Set(), new Set())).toBe('')
  })

  it('handles one empty set', () => {
    expect(mergeAndSort(new Set(['b', 'a']), new Set())).toBe('ab')
    expect(mergeAndSort(new Set(), new Set(['b', 'a']))).toBe('ab')
  })
})

describe('readPresetFile', () => {
  it('reads chars from a plain-text file', async () => {
    const tmp = join(tmpdir(), `fontminify-test-${Date.now()}.txt`)
    await writeFile(tmp, '你好世界hello', 'utf8')
    const set = await readPresetFile(tmp)
    expect(set.has('你')).toBe(true)
    expect(set.has('h')).toBe(true)
    // 你好世界hello → unique: 你好世界 h e l o = 8 (second 'l' deduplicated)
    expect(set.size).toBe(8)
  })

  it('throws USER_ERROR for non-existent file', async () => {
    await expect(readPresetFile('/nonexistent/file.txt')).rejects.toMatchObject({
      code: 'USER_ERROR',
    })
  })
})

describe('readPresetFiles', () => {
  it('merges chars from multiple files', async () => {
    const dir = tmpdir()
    const a = join(dir, `fontminify-a-${Date.now()}.txt`)
    const b = join(dir, `fontminify-b-${Date.now()}.txt`)
    await writeFile(a, '你好', 'utf8')
    await writeFile(b, '世界', 'utf8')
    const set = await readPresetFiles([a, b])
    expect(set.has('你')).toBe(true)
    expect(set.has('界')).toBe(true)
    expect(set.size).toBe(4)
  })

  it('returns empty set for empty path list', async () => {
    const set = await readPresetFiles([])
    expect(set.size).toBe(0)
  })
})

describe('resolvePresetPaths', () => {
  it('returns empty array for empty patterns', async () => {
    const paths = await resolvePresetPaths([])
    expect(paths).toEqual([])
  })

  it('resolves literal path (no glob chars) to absolute path', async () => {
    const paths = await resolvePresetPaths(['package.json'])
    expect(paths).toHaveLength(1)
    expect(paths[0]).toMatch(/package\.json$/)
  })

  it('expands glob pattern to matched files', async () => {
    const dir = join(tmpdir(), `fontminify-resolve-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'a.txt'), 'a', 'utf8')
    await writeFile(join(dir, 'b.txt'), 'b', 'utf8')
    const paths = await resolvePresetPaths([join(dir, '*.txt')])
    expect(paths.length).toBe(2)
    expect(paths.some(p => p.endsWith('a.txt'))).toBe(true)
    expect(paths.some(p => p.endsWith('b.txt'))).toBe(true)
  })
})
