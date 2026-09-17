import { describe, expect, it } from 'vitest'
import { buildTags, calculateCompleteness, findLikelyDuplicate, normalizeCpu, normalizeGpu } from './hardware'
import { emptyComponents, type PCBuild } from '../../types/models'

describe('hardware normalization', () => {
  it('normalizes common CPU and GPU aliases without guessing missing specs', () => {
    expect(normalizeCpu('R7 7800X3D')).toBe('AMD Ryzen 7 7800X3D')
    expect(normalizeGpu('RTX5070')).toBe('NVIDIA GeForce RTX 5070')
    expect(normalizeGpu('RTX 5060 ti')).toBe('NVIDIA GeForce RTX 5060 Ti')
    expect(normalizeGpu('5070')).toBe('5070')
  })

  it('separates completeness from quality and tags unknown power supplies', () => {
    const components = emptyComponents()
    components.cpu.value = 'AMD Ryzen 7 9800X3D'
    components.gpu.value = 'NVIDIA GeForce RTX 5070'
    components.psu.value = '750W 型号未明确'
    expect(calculateCompleteness(components)).toBe(25)
    expect(buildTags(components, 13_999)).toContain('电源待确认')
  })

  it('detects a repeated product by exact URL', () => {
    const components = emptyComponents()
    const existing = { id: 'a', url: 'https://example.com/item/1', store: '店铺', title: '方案', components } as PCBuild
    expect(findLikelyDuplicate({ url: existing.url, store: '', title: '', components }, [existing])?.id).toBe('a')
  })
})
