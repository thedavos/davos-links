import type { DateRange } from '#/lib/date-range'

export const FALLBACK_TIME_ZONE = 'UTC'

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 100) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0)
    return true
  } catch {
    return false
  }
}

export function detectBrowserTimeZone() {
  if (typeof Intl === 'undefined') return FALLBACK_TIME_ZONE
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
  return isValidTimeZone(detected) ? detected : FALLBACK_TIME_ZONE
}

export function supportedTimeZones() {
  const values = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [
        'America/Bogota',
        'America/Lima',
        'America/Los_Angeles',
        'America/Mexico_City',
        'America/New_York',
        'America/Santiago',
        'America/Sao_Paulo',
        'Europe/London',
        'Europe/Madrid',
        'UTC',
      ]
  return values.includes('UTC') ? values : ['UTC', ...values]
}

export function formatTimeZoneLabel(timeZone: string, at = new Date()) {
  const zone = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE
  const rawOffset = new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    timeZone: zone,
    timeZoneName: 'longOffset',
  })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const offset = rawOffset === 'GMT' || rawOffset === 'UTC'
    ? 'UTC+00:00'
    : rawOffset.replace('GMT', 'UTC')
  return `${zone} (${offset})`
}

export function formatInstant(
  value: string | number | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
    timeZone: isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE,
  }).format(date)
}

export function formatCalendarDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
    timeZone: 'UTC',
  }).format(date)
}

export function calendarDateInTimeZone(date: Date, timeZone: string) {
  return localParts(date, timeZone).date
}

export function localDateTimeToUtc(
  date: string,
  timeZone: string,
  hour = 0,
  minute = 0,
) {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day || !isValidTimeZone(timeZone)) {
    throw new RangeError('Fecha o zona horaria no válida.')
  }
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let guess = target
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const parts = localParts(new Date(guess), timeZone)
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    )
    const next = guess + (target - represented)
    if (next === guess) break
    guess = next
  }
  return new Date(guess)
}

export function localRangeToUtc(range: DateRange, timeZone: string) {
  const nextDay = addCalendarDays(range.to, 1)
  return {
    from: localDateTimeToUtc(range.from, timeZone),
    toExclusive: localDateTimeToUtc(nextDay, timeZone),
  }
}

export function localDayHour(value: string | number | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value)
  const parts = localParts(date, timeZone)
  const weekday = new Date(`${parts.date}T12:00:00.000Z`).getUTCDay()
  return {
    date: parts.date,
    day: (weekday === 0 ? 7 : weekday) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    hour: parts.hour,
  }
}

export function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid ISO date: ${value}`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function localAccuracyStartsOn(cutoff: string, timeZone: string) {
  return addCalendarDays(localDayHour(cutoff, timeZone).date, 1)
}

export function aggregationMode(
  range: DateRange,
  localFrom: string,
): 'local' | 'mixed' | 'legacy-utc' {
  if (range.to < localFrom) return 'legacy-utc'
  if (range.from >= localFrom) return 'local'
  return 'mixed'
}

function localParts(date: Date, timeZone: string) {
  const zone = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE
  let formatter = partsFormatterCache.get(zone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      timeZone: zone,
      year: 'numeric',
    })
    partsFormatterCache.set(zone, formatter)
  }
  const values = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  )
  const year = Number(values.year)
  const month = Number(values.month)
  const day = Number(values.day)
  const hour = Number(values.hour)
  const minute = Number(values.minute)
  return {
    date: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    day,
    hour,
    minute,
    month,
    year,
  }
}
