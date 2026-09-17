import { describe, expect, it } from 'vitest'
import { dateLabel, daysUntil } from './format'

describe('countdown dates', () => {
  const now = new Date('2026-12-31T14:00:00+08:00')

  it('handles today and tomorrow', () => {
    expect(daysUntil('2026-12-31', now)).toBe(0)
    expect(daysUntil('2027-01-01', now)).toBe(1)
    expect(dateLabel(0)).toBe('就是今天')
  })

  it('handles past dates and year boundaries', () => {
    expect(daysUntil('2026-12-30', now)).toBe(-1)
    expect(daysUntil('2027-01-02', now)).toBe(2)
    expect(dateLabel(-3)).toBe('已过 3 天')
  })
})
