import { describe, expect, it } from 'vitest'
import {
  aggregationMode,
  formatTimeZoneLabel,
  isValidTimeZone,
  localDayHour,
  localRangeToUtc,
} from './time-zone'

describe('time-zone helpers', () => {
  it('validates IANA zones and rejects arbitrary input', () => {
    expect(isValidTimeZone('America/Lima')).toBe(true)
    expect(isValidTimeZone('Europe/Madrid')).toBe(true)
    expect(isValidTimeZone("America/Lima'; DROP TABLE links;--")).toBe(false)
  })

  it('converts Lima calendar-day boundaries to UTC', () => {
    const bounds = localRangeToUtc(
      { from: '2026-07-14', to: '2026-07-14' },
      'America/Lima',
    )
    expect(bounds.from.toISOString()).toBe('2026-07-14T05:00:00.000Z')
    expect(bounds.toExclusive.toISOString()).toBe('2026-07-15T05:00:00.000Z')
  })

  it('honors daylight-saving changes in New York', () => {
    const bounds = localRangeToUtc(
      { from: '2026-03-08', to: '2026-03-08' },
      'America/New_York',
    )
    expect(bounds.from.toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(bounds.toExclusive.toISOString()).toBe('2026-03-09T04:00:00.000Z')
  })

  it('moves UTC instants into their local day and hour', () => {
    expect(localDayHour('2026-07-14T02:00:00.000Z', 'America/Lima')).toEqual({
      date: '2026-07-13',
      day: 1,
      hour: 21,
    })
  })

  it('describes transition modes and readable offsets', () => {
    expect(
      aggregationMode(
        { from: '2026-07-01', to: '2026-07-14' },
        '2026-07-10',
      ),
    ).toBe('mixed')
    expect(formatTimeZoneLabel('America/Lima', new Date('2026-07-14T12:00:00Z')))
      .toContain('UTC-05:00')
  })
})
