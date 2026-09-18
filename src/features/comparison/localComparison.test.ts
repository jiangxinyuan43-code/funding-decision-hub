import { describe, expect, it } from 'vitest'
import { defaultBuilds } from '../../data/seed'
import type { ComparisonAnalysis, PCBuild } from '../../types/models'
import { compareBuildsLocally, mergeComparisonWithAI } from './localComparison'

function buildsWithMissingField(): PCBuild[] {
  return defaultBuilds.map((build) => ({
    ...build,
    components: Object.fromEntries(Object.entries(build.components).map(([key, field]) => [key, { ...field }])) as PCBuild['components'],
    analysis: build.analysis ? { ...build.analysis } : undefined,
  }))
}

describe('complete local comparison report', () => {
  it('keeps every build in the report when fields are missing', () => {
    const builds = buildsWithMissingField()
    builds[0].components.psu = { value: '', confidence: 0, source: 'ai', confirmed: false }

    const report = compareBuildsLocally(builds)

    expect(Object.keys(report.risks)).toEqual(builds.map((build) => build.title))
    expect(report.risks[builds[0].title]).toContain('电源未明确')
    expect(report.unknowns).toContain(`${builds[0].title}：电源未明确`)
    expect(report.coreDifferences.some((item) => item.startsWith('电源：'))).toBe(true)
    expect(report.priceNotes).toHaveLength(3)
  })

  it('merges useful AI notes without dropping deterministic facts', () => {
    const baseline = compareBuildsLocally(buildsWithMissingField())
    const generated: ComparisonAnalysis = {
      coreDifferences: ['AI 补充差异'],
      risks: { [defaultBuilds[0].title]: ['AI 补充风险'] },
      priceNotes: [],
      usageNotes: ['AI 补充场景'],
      unknowns: [],
    }

    const report = mergeComparisonWithAI(baseline, generated)

    expect(report.source).toBe('hybrid')
    expect(report.coreDifferences).toContain('AI 补充差异')
    expect(report.coreDifferences.length).toBeGreaterThan(baseline.coreDifferences.length)
    expect(report.risks[defaultBuilds[0].title]).toContain('AI 补充风险')
    expect(report.priceNotes).toEqual(baseline.priceNotes)
  })
})
