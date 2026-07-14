import { env } from 'cloudflare:workers'
import {
  getGlobalTrafficBreakdowns,
  getTrafficBreakdowns,
} from '#/lib/analytics/breakdowns'
import { DEFAULT_WORKSPACE_ID } from '#/lib/constants'
import type {
  AnalyticsDateRange,
  AnalyticsDelta,
  AnalyticsOverview,
  AnalyticsPerformanceTotals,
  AnalyticsSeriesPoint,
  CachedLink,
} from '#/lib/types'

const ANALYTICS_TIMEZONE = 'UTC' as const
const DEFAULT_RANGE_DAYS = 30
export const MAX_ANALYTICS_RANGE_DAYS = 366
const TOP_LINKS_LIMIT = 5

const BOT_PATTERNS = [
  'Googlebot',
  'Bingbot',
  'Twitterbot',
  'facebookexternalhit',
  'LinkedInBot',
  'Slackbot',
  'Discordbot',
  'TelegramBot',
  'WhatsApp',
  'crawler',
  'spider',
  'bot',
]

export function detectBot(userAgent: string) {
  return BOT_PATTERNS.some((pattern) =>
    userAgent.toLowerCase().includes(pattern.toLowerCase()),
  )
}

export function parseUtmParams(url: URL) {
  return {
    utm_source: url.searchParams.get('utm_source') ?? '',
    utm_medium: url.searchParams.get('utm_medium') ?? '',
    utm_campaign: url.searchParams.get('utm_campaign') ?? '',
    utm_content: url.searchParams.get('utm_content') ?? '',
    utm_term: url.searchParams.get('utm_term') ?? '',
  }
}

export function parseReferrer(request: Request) {
  const referrer = request.headers.get('referer') ?? ''
  if (!referrer) return { referrer: '', referrer_domain: '' }

  try {
    return { referrer, referrer_domain: new URL(referrer).hostname }
  } catch {
    return { referrer, referrer_domain: '' }
  }
}

export function parseUserAgent(userAgent: string) {
  const lower = userAgent.toLowerCase()
  const isIpad =
    lower.includes('ipad') ||
    (lower.includes('macintosh') && lower.includes('mobile'))
  const browser = lower.includes('firefox')
    ? 'Firefox'
    : lower.includes('edg/')
      ? 'Edge'
      : lower.includes('chrome')
        ? 'Chrome'
        : lower.includes('safari')
          ? 'Safari'
          : 'Other'
  const os = lower.includes('iphone') || isIpad
    ? 'iOS'
    : lower.includes('mac os') || lower.includes('macintosh')
      ? 'macOS'
      : lower.includes('windows')
      ? 'Windows'
      : lower.includes('android')
        ? 'Android'
        : 'Other'
  const device = !userAgent.trim()
    ? 'Unknown'
    : isIpad || lower.includes('tablet') || (lower.includes('android') && !lower.includes('mobile'))
      ? 'Tablet'
      : lower.includes('mobile') || lower.includes('iphone')
        ? 'Mobile'
        : 'Desktop'

  return { browser, os, device }
}

export async function trackClick(request: Request, link: CachedLink) {
  const url = new URL(request.url)
  const cf = request.cf ?? {}
  const userAgent = request.headers.get('user-agent') ?? ''
  const referrer = parseReferrer(request)
  const utm = parseUtmParams(url)
  const agent = parseUserAgent(userAgent)
  const isBot = detectBot(userAgent)
  const timestamp = Date.now()

  env.CLICK_ANALYTICS.writeDataPoint({
    indexes: [link.id],
    blobs: [
      link.id,
      link.workspace_id,
      link.domain,
      link.short_path_normalized,
      String(cf.country ?? ''),
      String(cf.colo ?? ''),
      String(cf.region ?? ''),
      String(cf.city ?? ''),
      referrer.referrer,
      referrer.referrer_domain,
      userAgent.slice(0, 300),
      agent.browser,
      agent.os,
      agent.device,
      request.headers.get('accept-language')?.slice(0, 80) ?? '',
      utm.utm_source,
      utm.utm_medium,
      utm.utm_campaign,
      utm.utm_content,
      utm.utm_term,
    ],
    doubles: [isBot ? 1 : 0, timestamp],
  })

  const day = new Date().toISOString().slice(0, 10)
  await env.LINKS_DB.prepare(
    `INSERT INTO daily_link_metrics (
      id, workspace_id, link_id, metric_date, clicks, bot_clicks, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(link_id, metric_date) DO UPDATE SET
      clicks = clicks + 1,
      bot_clicks = bot_clicks + excluded.bot_clicks,
      updated_at = excluded.updated_at`,
  )
    .bind(
      `met_${link.id}_${day}`,
      link.workspace_id,
      link.id,
      day,
      isBot ? 1 : 0,
      new Date().toISOString(),
      new Date().toISOString(),
    )
    .run()
}

export async function getAnalyticsOverview() {
  return getAnalyticsOverviewForRange(defaultRange())
}

export async function getAnalyticsOverviewForRange(
  range: DateRange,
): Promise<AnalyticsOverview> {
  validateDateRange(range)
  const previousRange = previousDateRange(range)
  const currentSeriesQuery = env.LINKS_DB.prepare(
    `SELECT
       metric_date,
       SUM(MAX(clicks - bot_clicks, 0)) AS human_clicks,
       SUM(MAX(bot_clicks, 0)) AS bot_clicks
     FROM daily_link_metrics
     WHERE workspace_id = ? AND metric_date BETWEEN ? AND ?
     GROUP BY metric_date
     ORDER BY metric_date ASC`,
  )
    .bind(DEFAULT_WORKSPACE_ID, range.from, range.to)
    .all<OverviewSeriesRow>()

  const previousSeriesQuery = env.LINKS_DB.prepare(
    `SELECT
       metric_date,
       SUM(MAX(clicks - bot_clicks, 0)) AS human_clicks,
       SUM(MAX(bot_clicks, 0)) AS bot_clicks
     FROM daily_link_metrics
     WHERE workspace_id = ? AND metric_date BETWEEN ? AND ?
     GROUP BY metric_date
     ORDER BY metric_date ASC`,
  )
    .bind(DEFAULT_WORKSPACE_ID, previousRange.from, previousRange.to)
    .all<OverviewSeriesRow>()

  const currentTotalsQuery = env.LINKS_DB.prepare(
    `SELECT
       COALESCE(SUM(MAX(clicks - bot_clicks, 0)), 0) AS human_clicks,
       COALESCE(SUM(MAX(bot_clicks, 0)), 0) AS bot_clicks,
       COUNT(DISTINCT CASE
         WHEN MAX(clicks - bot_clicks, 0) > 0 THEN link_id
       END) AS links_with_activity
     FROM daily_link_metrics
     WHERE workspace_id = ? AND metric_date BETWEEN ? AND ?`,
  )
    .bind(DEFAULT_WORKSPACE_ID, range.from, range.to)
    .first<OverviewTotalsRow>()

  const previousTotalsQuery = env.LINKS_DB.prepare(
    `SELECT
       COALESCE(SUM(MAX(clicks - bot_clicks, 0)), 0) AS human_clicks,
       COALESCE(SUM(MAX(bot_clicks, 0)), 0) AS bot_clicks,
       COUNT(DISTINCT CASE
         WHEN MAX(clicks - bot_clicks, 0) > 0 THEN link_id
       END) AS links_with_activity
     FROM daily_link_metrics
     WHERE workspace_id = ? AND metric_date BETWEEN ? AND ?`,
  )
    .bind(DEFAULT_WORKSPACE_ID, previousRange.from, previousRange.to)
    .first<OverviewTotalsRow>()

  const activeLinksQuery = env.LINKS_DB.prepare(
    `SELECT COUNT(*) AS active_links FROM links
     WHERE workspace_id = ? AND status = 'active' AND deleted_at IS NULL`,
  )
    .bind(DEFAULT_WORKSPACE_ID)
    .first<{ active_links: number }>()

  const topLinksQuery = env.LINKS_DB.prepare(
    `WITH current_metrics AS (
       SELECT
         link_id,
         SUM(MAX(clicks - bot_clicks, 0)) AS current_human_clicks
       FROM daily_link_metrics
       WHERE workspace_id = ? AND metric_date BETWEEN ? AND ?
       GROUP BY link_id
     ), previous_metrics AS (
       SELECT
         link_id,
         SUM(MAX(clicks - bot_clicks, 0)) AS previous_human_clicks
       FROM daily_link_metrics
       WHERE workspace_id = ? AND metric_date BETWEEN ? AND ?
       GROUP BY link_id
     )
     SELECT
       links.id,
       links.title,
       links.short_path,
       current_metrics.current_human_clicks,
       COALESCE(previous_metrics.previous_human_clicks, 0) AS previous_human_clicks
     FROM current_metrics
     INNER JOIN links ON links.id = current_metrics.link_id
     LEFT JOIN previous_metrics ON previous_metrics.link_id = current_metrics.link_id
     WHERE links.workspace_id = ?
       AND links.deleted_at IS NULL
       AND current_metrics.current_human_clicks > 0
     ORDER BY
       current_metrics.current_human_clicks DESC,
       LOWER(links.title) ASC,
       links.id ASC
     LIMIT ${TOP_LINKS_LIMIT}`,
  )
    .bind(
      DEFAULT_WORKSPACE_ID,
      range.from,
      range.to,
      DEFAULT_WORKSPACE_ID,
      previousRange.from,
      previousRange.to,
      DEFAULT_WORKSPACE_ID,
    )
    .all<TopLinkRow>()

  const [
    { results: currentSeriesRows },
    { results: previousSeriesRows },
    currentTotalsRow,
    previousTotalsRow,
    activeLinks,
    { results: topLinkRows },
    breakdowns,
  ] = await Promise.all([
    currentSeriesQuery,
    previousSeriesQuery,
    currentTotalsQuery,
    previousTotalsQuery,
    activeLinksQuery,
    topLinksQuery,
    getGlobalTrafficBreakdowns(range),
  ])

  const rangeDays = rangeDurationInDays(range)
  const previousRangeDays = rangeDurationInDays(previousRange)
  const totals = toPerformanceTotals(currentTotalsRow, rangeDays)
  const previousTotals = toPerformanceTotals(previousTotalsRow, previousRangeDays)
  const series = normalizeOverviewSeries(currentSeriesRows, range)
  const previousSeries = normalizeOverviewSeries(previousSeriesRows, previousRange)

  return {
    timezone: ANALYTICS_TIMEZONE,
    range,
    previousRange,
    totals,
    previousTotals,
    activeLinksNow: toNonNegativeCount(activeLinks?.active_links),
    series,
    previousSeries,
    breakdowns,
    comparison: {
      humanClicks: compareMetric(totals.humanClicks, previousTotals.humanClicks),
      botClicks: compareMetric(totals.botClicks, previousTotals.botClicks),
      linksWithActivity: compareMetric(
        totals.linksWithActivity,
        previousTotals.linksWithActivity,
      ),
      averageDailyHumanClicks: compareMetric(
        totals.averageDailyHumanClicks,
        previousTotals.averageDailyHumanClicks,
      ),
    },
    topLinks: topLinkRows.map((row) => {
      const humanClicks = toNonNegativeCount(row.current_human_clicks)
      const previousHumanClicks = toNonNegativeCount(row.previous_human_clicks)
      return {
        id: row.id,
        title: row.title,
        shortPath: row.short_path,
        humanClicks,
        sharePercent: totals.humanClicks > 0
          ? (humanClicks / totals.humanClicks) * 100
          : 0,
        delta: compareMetric(humanClicks, previousHumanClicks),
      }
    }),
  }
}

export async function getLinkAnalytics(linkId: string, range = defaultRange()) {
  validateDateRange(range)
  const previousRange = previousDateRange(range)
  const { results } = await env.LINKS_DB.prepare(
    `SELECT metric_date, clicks, bot_clicks
     FROM daily_link_metrics
     WHERE workspace_id = ?
       AND link_id = ?
       AND metric_date BETWEEN ? AND ?
     ORDER BY metric_date ASC
     LIMIT 366`,
  )
    .bind(DEFAULT_WORKSPACE_ID, linkId, range.from, range.to)
    .all<AnalyticsPoint>()

  const { results: previousResults } = await env.LINKS_DB.prepare(
    `SELECT metric_date, clicks, bot_clicks
     FROM daily_link_metrics
     WHERE workspace_id = ?
       AND link_id = ?
       AND metric_date BETWEEN ? AND ?
     ORDER BY metric_date ASC
     LIMIT 366`,
  )
    .bind(DEFAULT_WORKSPACE_ID, linkId, previousRange.from, previousRange.to)
    .all<AnalyticsPoint>()

  const series = normalizeSeries(results, range)
  const previousSeries = normalizeSeries(previousResults, previousRange)
  const breakdowns = await getTrafficBreakdowns(linkId, range)

  return {
    series,
    previousSeries,
    comparison: compareSeries(series, previousSeries),
    breakdowns,
    range,
    previousRange,
  }
}

export async function exportMetricsCsv(range: DateRange, linkId?: string | null) {
  validateDateRange(range)
  const where = [
    'daily_link_metrics.workspace_id = ?',
    'daily_link_metrics.metric_date BETWEEN ? AND ?',
  ]
  const binds: unknown[] = [DEFAULT_WORKSPACE_ID, range.from, range.to]

  if (linkId) {
    where.push('daily_link_metrics.link_id = ?')
    binds.push(linkId)
  }

  const { results } = await env.LINKS_DB.prepare(
    `SELECT
      daily_link_metrics.metric_date,
      links.id AS link_id,
      links.title,
      links.short_path,
      domains.domain,
      daily_link_metrics.clicks,
      MAX(daily_link_metrics.clicks - daily_link_metrics.bot_clicks, 0) AS human_clicks,
      daily_link_metrics.bot_clicks,
      daily_link_metrics.unique_visitors
     FROM daily_link_metrics
     JOIN links ON links.id = daily_link_metrics.link_id
     JOIN domains ON domains.id = links.domain_id
     WHERE ${where.join(' AND ')}
     ORDER BY daily_link_metrics.metric_date ASC, links.title ASC`,
  )
    .bind(...binds)
    .all<{
      metric_date: string
      link_id: string
      title: string
      short_path: string
      domain: string
      clicks: number
      human_clicks: number
      bot_clicks: number
      unique_visitors: number
    }>()

  return toCsv([
    [
      'date',
      'link_id',
      'title',
      'short_url',
      'clicks',
      'human_clicks',
      'bot_clicks',
      'unique_visitors',
    ],
    ...results.map((row) => [
      row.metric_date,
      row.link_id,
      row.title,
      `https://${row.domain}/${row.short_path}`,
      String(row.clicks),
      String(toNonNegativeCount(row.human_clicks)),
      String(row.bot_clicks),
      String(row.unique_visitors),
    ]),
  ])
}

export type DateRange = AnalyticsDateRange

export type AnalyticsPoint = {
  metric_date: string
  clicks: number
  bot_clicks?: number
}

export type AnalyticsComparison = {
  currentClicks: number
  previousClicks: number
  delta: number
  deltaPercent: number
  trend: 'up' | 'down' | 'flat'
}

type OverviewSeriesRow = {
  metric_date: string
  human_clicks: number
  bot_clicks: number
}

type OverviewTotalsRow = {
  human_clicks: number
  bot_clicks: number
  links_with_activity: number
}

type TopLinkRow = {
  id: string
  title: string
  short_path: string
  current_human_clicks: number
  previous_human_clicks: number
}

export type DateRangeValidationField = 'from' | 'to' | 'range'

export class DateRangeValidationError extends Error {
  readonly code = 'invalid_date_range' as const

  constructor(
    message: string,
    readonly field: DateRangeValidationField,
  ) {
    super(message)
    this.name = 'DateRangeValidationError'
  }
}

export function isDateRangeValidationError(
  error: unknown,
): error is DateRangeValidationError {
  return error instanceof DateRangeValidationError
}

export function parseDateRange(url: URL): DateRange {
  const rawFrom = url.searchParams.get('from')
  const rawTo = url.searchParams.get('to')

  if (rawFrom === null && rawTo === null) return defaultRange()
  if (rawFrom === null) {
    throw new DateRangeValidationError('La fecha inicial es obligatoria.', 'from')
  }
  if (rawTo === null) {
    throw new DateRangeValidationError('La fecha final es obligatoria.', 'to')
  }
  if (!validDate(rawFrom)) {
    throw new DateRangeValidationError('La fecha inicial no es válida.', 'from')
  }
  if (!validDate(rawTo)) {
    throw new DateRangeValidationError('La fecha final no es válida.', 'to')
  }

  return validateDateRange({ from: rawFrom, to: rawTo })
}

export function validateDateRange(range: DateRange): DateRange {
  if (!validDate(range.from)) {
    throw new DateRangeValidationError('La fecha inicial no es válida.', 'from')
  }
  if (!validDate(range.to)) {
    throw new DateRangeValidationError('La fecha final no es válida.', 'to')
  }
  if (range.from > range.to) {
    throw new DateRangeValidationError(
      'La fecha inicial no puede ser posterior a la fecha final.',
      'range',
    )
  }

  const today = toDateString(new Date())
  if (range.from > today || range.to > today) {
    throw new DateRangeValidationError(
      'El rango no puede incluir fechas futuras.',
      'range',
    )
  }

  if (rangeDurationInDays(range) > MAX_ANALYTICS_RANGE_DAYS) {
    throw new DateRangeValidationError(
      `El rango no puede superar ${MAX_ANALYTICS_RANGE_DAYS} días.`,
      'range',
    )
  }

  return range
}

function defaultRange(): DateRange {
  const to = new Date()
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - (DEFAULT_RANGE_DAYS - 1))
  return { from: toDateString(from), to: toDateString(to) }
}

function previousDateRange(range: DateRange): DateRange {
  const from = parseDateString(range.from)
  const to = parseDateString(range.to)
  const days = Math.max(1, differenceInDays(from, to) + 1)
  const previousTo = addDays(from, -1)
  const previousFrom = addDays(previousTo, -(days - 1))
  return { from: toDateString(previousFrom), to: toDateString(previousTo) }
}

function normalizeOverviewSeries(
  points: OverviewSeriesRow[],
  range: DateRange,
): AnalyticsSeriesPoint[] {
  const byDate = new Map(points.map((point) => [point.metric_date, point]))
  return eachDate(range).map((metric_date) => {
    const point = byDate.get(metric_date)
    return {
      metric_date,
      human_clicks: toNonNegativeCount(point?.human_clicks),
      bot_clicks: toNonNegativeCount(point?.bot_clicks),
    }
  })
}

function toPerformanceTotals(
  row: OverviewTotalsRow | null,
  rangeDays: number,
): AnalyticsPerformanceTotals {
  const humanClicks = toNonNegativeCount(row?.human_clicks)
  return {
    humanClicks,
    botClicks: toNonNegativeCount(row?.bot_clicks),
    linksWithActivity: toNonNegativeCount(row?.links_with_activity),
    averageDailyHumanClicks: rangeDays > 0 ? humanClicks / rangeDays : 0,
  }
}

export function compareMetric(current: number, previous: number): AnalyticsDelta {
  const safeCurrent = toNonNegativeNumber(current)
  const safePrevious = toNonNegativeNumber(previous)
  const absolute = safeCurrent - safePrevious

  if (safePrevious === 0) {
    if (safeCurrent > 0) {
      return { status: 'new', absolute, percent: null, trend: 'up' }
    }
    return { status: 'no-baseline', absolute: 0, percent: null, trend: 'flat' }
  }

  return {
    status: 'comparable',
    absolute,
    percent: (absolute / safePrevious) * 100,
    trend: absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'flat',
  }
}

function normalizeSeries(points: AnalyticsPoint[], range: DateRange) {
  const byDate = new Map(points.map((point) => [point.metric_date, point]))
  return eachDate(range).map((metric_date) => {
    const point = byDate.get(metric_date)
    return {
      metric_date,
      clicks: Number(point?.clicks ?? 0),
      bot_clicks: Number(point?.bot_clicks ?? 0),
    }
  })
}

function compareSeries(
  series: AnalyticsPoint[],
  previousSeries: AnalyticsPoint[],
): AnalyticsComparison {
  const currentClicks = sumClicks(series)
  const previousClicks = sumClicks(previousSeries)
  const delta = currentClicks - previousClicks
  const deltaPercent =
    previousClicks === 0 ? (currentClicks > 0 ? 100 : 0) : (delta / previousClicks) * 100
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'

  return { currentClicks, previousClicks, delta, deltaPercent, trend }
}

function sumClicks(points: AnalyticsPoint[]) {
  return points.reduce((total, point) => total + Number(point.clicks ?? 0), 0)
}

function eachDate(range: DateRange) {
  const dates: string[] = []
  const current = parseDateString(range.from)
  const end = parseDateString(range.to)

  while (current <= end) {
    dates.push(toDateString(current))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}

function parseDateString(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function differenceInDays(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function validDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) || toDateString(parsed) !== value ? null : value
}

function rangeDurationInDays(range: DateRange) {
  return differenceInDays(parseDateString(range.from), parseDateString(range.to)) + 1
}

function toNonNegativeCount(value: unknown) {
  return Math.round(toNonNegativeNumber(value))
}

function toNonNegativeNumber(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.max(0, number) : 0
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          if (!/[",\n]/.test(value)) return value
          return `"${value.replace(/"/g, '""')}"`
        })
        .join(','),
    )
    .join('\n')
}
