import { describe, expect, it } from 'vitest'
import type { PCBuild } from '../../types/models'
import { buildSchemeNameMap, schemeNameAt } from './buildNames'

describe('scheme names', () => {
  it('continues with two letters after scheme Z', () => {
    expect(schemeNameAt(0)).toBe('方案A')
    expect(schemeNameAt(25)).toBe('方案Z')
    expect(schemeNameAt(26)).toBe('方案AA')
  })

  it('uses import time instead of the current filtered order', () => {
    const newer = { id: 'newer', createdAt: '2026-02-02T00:00:00.000Z' } as PCBuild
    const older = { id: 'older', createdAt: '2026-01-01T00:00:00.000Z' } as PCBuild

    expect(buildSchemeNameMap([newer, older])).toEqual({ older: '方案A', newer: '方案B' })
  })

  it('preserves names that were already assigned', () => {
    const older = { id: 'older', createdAt: '2026-01-01T00:00:00.000Z', schemeName: '方案D' } as PCBuild
    const newer = { id: 'newer', createdAt: '2026-02-02T00:00:00.000Z', schemeName: '方案E' } as PCBuild

    expect(buildSchemeNameMap([newer, older])).toEqual({ older: '方案D', newer: '方案E' })
  })
})
