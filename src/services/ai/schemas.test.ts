import { describe, expect, it } from 'vitest'
import { extractionSchema } from './schemas'

describe('AI extraction compatibility', () => {
  it('accepts component fields returned at the root', () => {
    const result = extractionSchema.parse({
      title: '整机方案',
      platform: 'JD',
      price: '¥12,999',
      CPU: 'Ryzen 7 9800X3D',
      GPU: { value: 'RTX 5070', confidence: 92 },
      内存: '32GB DDR5',
    })

    expect(result.platform).toBe('京东')
    expect(result.price).toBe(12_999)
    expect(result.fields.cpu).toEqual({ value: 'Ryzen 7 9800X3D', confidence: 0.7 })
    expect(result.fields.gpu).toEqual({ value: 'RTX 5070', confidence: 0.92 })
    expect(result.fields.ram.value).toBe('32GB DDR5')
  })

  it('accepts a components object with string values', () => {
    const result = extractionSchema.parse({
      productName: '候选配置',
      components: { cpu: '7800X3D', gpu: 'RTX 5060 Ti', powerSupply: '750W' },
      warnings: '电源具体型号待确认',
    })

    expect(result.title).toBe('候选配置')
    expect(result.fields.psu.value).toBe('750W')
    expect(result.risks).toEqual(['电源具体型号待确认'])
    expect(result.fields.case).toEqual({ value: '', confidence: 0 })
  })
})
