import { describe, expect, it } from 'vitest'
import { parseBackupV1 } from './backup'

describe('backup validation', () => {
  it('accepts an empty v1 data bundle', () => {
    expect(parseBackupV1('{"version":1,"data":{}}').version).toBe(1)
  })

  it('returns a useful error for malformed or unsupported backups', () => {
    expect(() => parseBackupV1('not-json')).toThrow('不是有效的 JSON')
    expect(() => parseBackupV1('{"version":2,"data":{}}')).toThrow('版本不支持')
  })

  it('rejects non-image payloads in image fields', () => {
    const raw = JSON.stringify({ version: 1, data: { builds: [{ images: [{ original: 'https://example.com/a.png' }] }] } })
    expect(() => parseBackupV1(raw)).toThrow('字段不完整')
  })
})
