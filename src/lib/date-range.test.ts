import { describe, expect, it } from 'vitest'
import {
  dateRangeDays,
  defaultDateRange,
  describeDateRange,
  previousDateRange,
  validateDateRange,
} from './date-range'

const now = new Date('2026-07-13T23:45:00.000Z')

describe('date range utilities', () => {
  it('builds inclusive UTC presets without an off-by-one error', () => {
    const range = defaultDateRange(30, now)

    expect(range).toEqual({ from: '2026-06-14', to: '2026-07-13' })
    expect(dateRangeDays(range)).toBe(30)
  })

  it('derives an immediately preceding range with equal duration', () => {
    expect(previousDateRange({ from: '2026-07-07', to: '2026-07-13' })).toEqual(
      {
        from: '2026-06-30',
        to: '2026-07-06',
      },
    )
  })

  it.each([
    [{ from: '', to: '2026-07-13' }, 'empty'],
    [{ from: '2026-02-30', to: '2026-07-13' }, 'invalid'],
    [{ from: '2026-07-13', to: '2026-07-12' }, 'inverted'],
    [{ from: '2026-07-01', to: '2026-07-14' }, 'future'],
    [{ from: '2025-07-12', to: '2026-07-13' }, 'too_long'],
  ] as const)('rejects %j as %s', (range, code) => {
    expect(validateDateRange(range, { now })).toMatchObject({
      valid: false,
      code,
    })
  })

  it('accepts the maximum 366-day inclusive range', () => {
    expect(
      validateDateRange(
        { from: '2025-07-13', to: '2026-07-13' },
        { maxDays: 366, now },
      ),
    ).toEqual({ valid: true, days: 366 })
  })

  it('formats the effective, previous and timezone descriptions', () => {
    const description = describeDateRange(
      { from: '2026-07-07', to: '2026-07-13' },
      { locale: 'es-PE' },
    )

    expect(description.rangeLabel).toContain('2026')
    expect(description.previousRangeLabel).toContain('2026')
    expect(description.previousRange).toEqual({
      from: '2026-06-30',
      to: '2026-07-06',
    })
    expect(description.timeZone).toBe('UTC')
  })
})
