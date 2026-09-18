import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultBuilds, defaultSettings } from '../../data/seed'
import { OpenAICompatibleProvider } from './client'

afterEach(() => vi.unstubAllGlobals())

function response(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('AI comparison fallback', () => {
  it('returns the complete local report when the model response has no usable structure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response('[]')))
    const provider = new OpenAICompatibleProvider({ ...defaultSettings, apiKey: 'test-key' })

    const report = await provider.compareBuilds(defaultBuilds)

    expect(report.source).toBe('local')
    expect(Object.keys(report.risks)).toEqual(defaultBuilds.map((build) => build.title))
    expect(report.priceNotes.length).toBeGreaterThan(0)
  })

  it('merges partial model content into the complete local report', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(JSON.stringify({ differences: ['AI 补充差异'] }))))
    const provider = new OpenAICompatibleProvider({ ...defaultSettings, apiKey: 'test-key' })

    const report = await provider.compareBuilds(defaultBuilds)

    expect(report.source).toBe('hybrid')
    expect(report.coreDifferences).toContain('AI 补充差异')
    expect(Object.keys(report.risks)).toEqual(defaultBuilds.map((build) => build.title))
  })
})
