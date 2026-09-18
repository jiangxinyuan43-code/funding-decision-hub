import { describe, expect, it } from 'vitest'
import { normalizeHttpUrl } from './url'

describe('normalizeHttpUrl', () => {
  it('keeps valid web links and adds https when omitted', () => {
    expect(normalizeHttpUrl('https://item.example.com/a')).toBe('https://item.example.com/a')
    expect(normalizeHttpUrl('item.example.com/a')).toBe('https://item.example.com/a')
  })

  it('allows an empty optional link', () => {
    expect(normalizeHttpUrl('  ')).toBe('')
  })

  it('rejects executable and malformed protocols', () => {
    expect(() => normalizeHttpUrl('javascript:alert(1)')).toThrow('仅支持 HTTP 或 HTTPS')
    expect(() => normalizeHttpUrl('http://')).toThrow('格式不正确')
  })
})
