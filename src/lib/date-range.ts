export type DateRange = {
  from: string
  to: string
}

export type DateRangeValidation =
  | { valid: true; days: number }
  | {
      valid: false
      code: 'empty' | 'invalid' | 'inverted' | 'future' | 'too_long'
      message: string
    }

export const ANALYTICS_TIME_ZONE = 'UTC'
export const MAX_ANALYTICS_RANGE_DAYS = 366

const DAY_IN_MS = 86_400_000
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function defaultDateRange(
  days = 30,
  now = new Date(),
  timeZone = ANALYTICS_TIME_ZONE,
): DateRange {
  const safeDays = Math.max(1, Math.floor(days))
  const to = parseIsoDate(dateInTimeZone(now, timeZone))
  const from = addUtcDays(to, -(safeDays - 1))

  return { from: toIsoDate(from), to: toIsoDate(to) }
}

export function validateDateRange(
  range: DateRange,
  options: { maxDays?: number; now?: Date; timeZone?: string } = {},
): DateRangeValidation {
  if (!range.from || !range.to) {
    return {
      valid: false,
      code: 'empty',
      message: 'Completa las fechas Desde y Hasta.',
    }
  }

  const from = safeParseIsoDate(range.from)
  const to = safeParseIsoDate(range.to)
  if (!from || !to) {
    return {
      valid: false,
      code: 'invalid',
      message: 'Introduce fechas válidas.',
    }
  }

  if (from > to) {
    return {
      valid: false,
      code: 'inverted',
      message: 'La fecha Desde no puede ser posterior a Hasta.',
    }
  }

  const today = parseIsoDate(
    dateInTimeZone(
      options.now ?? new Date(),
      options.timeZone ?? ANALYTICS_TIME_ZONE,
    ),
  )
  if (from > today || to > today) {
    return {
      valid: false,
      code: 'future',
      message: 'El periodo no puede incluir fechas futuras.',
    }
  }

  const days = dateRangeDays(range)
  const maxDays = options.maxDays ?? MAX_ANALYTICS_RANGE_DAYS
  if (days > maxDays) {
    return {
      valid: false,
      code: 'too_long',
      message: `El periodo no puede superar ${maxDays} días.`,
    }
  }

  return { valid: true, days }
}

export function dateRangeDays(range: DateRange) {
  const from = parseIsoDate(range.from)
  const to = parseIsoDate(range.to)
  return Math.round((to.getTime() - from.getTime()) / DAY_IN_MS) + 1
}

export function previousDateRange(range: DateRange): DateRange {
  const days = dateRangeDays(range)
  const previousTo = addUtcDays(parseIsoDate(range.from), -1)
  const previousFrom = addUtcDays(previousTo, -(days - 1))

  return { from: toIsoDate(previousFrom), to: toIsoDate(previousTo) }
}

export function formatDateRange(
  range: DateRange,
  options: { locale?: string; timeZone?: string } = {},
) {
  const formatter = new Intl.DateTimeFormat(options.locale ?? 'es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: ANALYTICS_TIME_ZONE,
  })

  return `${formatter.format(parseCalendarDate(range.from))} – ${formatter.format(parseCalendarDate(range.to))}`
}

export function describeDateRange(
  range: DateRange,
  options: { locale?: string; timeZone?: string } = {},
) {
  const timeZone = options.timeZone ?? ANALYTICS_TIME_ZONE
  const previousRange = previousDateRange(range)

  return {
    range,
    previousRange,
    rangeLabel: formatDateRange(range, { ...options, timeZone }),
    previousRangeLabel: formatDateRange(previousRange, {
      ...options,
      timeZone,
    }),
    timeZone,
  }
}

export function isSameDateRange(left: DateRange, right: DateRange) {
  return left.from === right.from && left.to === right.to
}

export function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function safeParseIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) || toIsoDate(parsed) !== value
    ? null
    : parsed
}

function parseIsoDate(value: string) {
  const parsed = safeParseIsoDate(value)
  if (!parsed) throw new RangeError(`Invalid ISO date: ${value}`)
  return parsed
}

function parseCalendarDate(value: string) {
  const parsed = safeParseIsoDate(value)
  if (!parsed) throw new RangeError(`Invalid ISO date: ${value}`)
  parsed.setUTCHours(12)
  return parsed
}

function dateInTimeZone(date: Date, timeZone: string) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        month: '2-digit',
        timeZone,
        year: 'numeric',
      })
        .formatToParts(date)
        .map((part) => [part.type, part.value]),
    )
    return `${parts.year}-${parts.month}-${parts.day}`
  } catch {
    return toIsoDate(date)
  }
}

function addUtcDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}
