import { env } from 'cloudflare:workers'
import {
  getGlobalTrafficBreakdowns,
  getTrafficBreakdowns,
} from '#/lib/analytics/breakdowns'
import {
  getGlobalClickHeatmap,
  getLinkClickHeatmap,
  getLinkUtmPerformance,
} from '#/lib/analytics/insights'
import { DEFAULT_WORKSPACE_ID } from '#/lib/constants'
import type {
  AnalyticsDateRange,
  AnalyticsDelta,
  AnalyticsOverview,
  AnalyticsPerformanceItem,
  AnalyticsPerformanceTotals,
  AnalyticsSeriesPoint,
  CachedLink,
} from '#/lib/types'
import {
  FALLBACK_TIME_ZONE,
  aggregationMode,
  isValidTimeZone,
  localAccuracyStartsOn,
  localDayHour,
  localRangeToUtc,
} from '#/lib/time-zone'

const ANALYTICS_TIMEZONE = FALLBACK_TIME_ZONE
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

  const now = new Date(timestamp)
  const nowIso = now.toISOString()
  const day = nowIso.slice(0, 10)
  const hour = `${nowIso.slice(0, 13)}:00:00.000Z`
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
      nowIso,
      nowIso,
    )
    .run()

  await env.LINKS_DB.prepare(
    `INSERT INTO hourly_link_metrics (
      id, workspace_id, link_id, metric_hour, clicks, bot_clicks, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(link_id, metric_hour) DO UPDATE SET
      clicks = clicks + 1,
      bot_clicks = bot_clicks + excluded.bot_clicks,
      updated_at = excluded.updated_at`,
  )
    .bind(
      `hrm_${link.id}_${hour.slice(0, 13)}`,
      link.workspace_id,
      link.id,
      hour,
      isBot ? 1 : 0,
      nowIso,
      nowIso,
    )
    .run()
}

export async function getAnalyticsOverview() {
  return getAnalyticsOverviewForRange(defaultRange())
}

export async function getAnalyticsOverviewForRange(
  range: DateRange,
  timeZone = ANALYTICS_TIMEZONE,
): Promise<AnalyticsOverview> {
  validateDateRange(range, timeZone)
  if (!isValidTimeZone(timeZone)) {
    throw new DateRangeValidationError('La zona horaria no es válida.', 'timeZone')
  }
  if (timeZone !== ANALYTICS_TIMEZONE) {
    return getLocalizedAnalyticsOverview(range, timeZone)
  }
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

  const campaignPerformanceQuery = queryCategoryPerformance(
    'campaigns',
    range,
    previousRange,
  )
  const tagPerformanceQuery = queryCategoryPerformance('tags', range, previousRange)

  const [
    { results: currentSeriesRows },
    { results: previousSeriesRows },
    currentTotalsRow,
    previousTotalsRow,
    activeLinks,
    { results: topLinkRows },
    breakdowns,
    heatmap,
    campaignPerformanceRows,
    tagPerformanceRows,
  ] = await Promise.all([
    currentSeriesQuery,
    previousSeriesQuery,
    currentTotalsQuery,
    previousTotalsQuery,
    activeLinksQuery,
    topLinksQuery,
    getGlobalTrafficBreakdowns(range),
    getGlobalClickHeatmap(range),
    campaignPerformanceQuery,
    tagPerformanceQuery,
  ])

  const rangeDays = rangeDurationInDays(range)
  const previousRangeDays = rangeDurationInDays(previousRange)
  const totals = toPerformanceTotals(currentTotalsRow, rangeDays)
  const previousTotals = toPerformanceTotals(previousTotalsRow, previousRangeDays)
  const series = normalizeOverviewSeries(currentSeriesRows, range)
  const previousSeries = normalizeOverviewSeries(previousSeriesRows, previousRange)

  return {
    timezone: ANALYTICS_TIMEZONE,
    aggregationMode: 'local',
    localAccuracyStartsOn: range.from,
    range,
    previousRange,
    totals,
    previousTotals,
    activeLinksNow: toNonNegativeCount(activeLinks?.active_links),
    series,
    previousSeries,
    breakdowns,
    heatmap,
    categoryPerformance: {
      campaigns: toCategoryPerformance(campaignPerformanceRows),
      tags: toCategoryPerformance(tagPerformanceRows),
    },
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

export async function getLinkAnalytics(
  linkId: string,
  range = defaultRange(),
  timeZone = ANALYTICS_TIMEZONE,
) {
  validateDateRange(range, timeZone)
  if (!isValidTimeZone(timeZone)) {
    throw new DateRangeValidationError('La zona horaria no es válida.', 'timeZone')
  }
  if (timeZone !== ANALYTICS_TIMEZONE) {
    return getLocalizedLinkAnalytics(linkId, range, timeZone)
  }
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

  const series = normalizeLinkSeries(results, range)
  const previousSeries = normalizeLinkSeries(previousResults, previousRange)
  const [breakdowns, heatmap, utm] = await Promise.all([
    getTrafficBreakdowns(linkId, range),
    getLinkClickHeatmap(linkId, range),
    getLinkUtmPerformance(linkId, range, previousRange),
  ])
  const humanClicks = sumHumanClicks(series)
  const botClicks = series.reduce(
    (total, point) => total + toNonNegativeCount(point.bot_clicks),
    0,
  )
  const recordedClicks = humanClicks + botClicks

  return {
    series,
    previousSeries,
    comparison: compareSeries(series, previousSeries),
    breakdowns,
    heatmap,
    utm,
    totals: {
      humanClicks,
      botClicks,
      averageDailyHumanClicks: humanClicks / rangeDurationInDays(range),
      botSharePercent: recordedClicks > 0 ? (botClicks / recordedClicks) * 100 : 0,
    },
    range,
    previousRange,
    scope: 'human' as const,
    timezone: ANALYTICS_TIMEZONE,
    aggregationMode: 'local' as const,
    localAccuracyStartsOn: range.from,
  }
}

async function getLocalizedAnalyticsOverview(
  range: DateRange,
  timeZone: string,
): Promise<AnalyticsOverview> {
  const previousRange = previousDateRange(range)
  const coverageStartsAt = await getHourlyCoverageStart()
  const [
    series,
    previousSeries,
    currentLinks,
    previousLinks,
    activeLinks,
    linkRows,
    campaigns,
    tags,
    breakdowns,
    heatmap,
  ] = await Promise.all([
    queryLocalizedSeries(range, timeZone, coverageStartsAt),
    queryLocalizedSeries(previousRange, timeZone, coverageStartsAt),
    queryLocalizedLinkTotals(range, timeZone, coverageStartsAt),
    queryLocalizedLinkTotals(previousRange, timeZone, coverageStartsAt),
    env.LINKS_DB.prepare(
      `SELECT COUNT(*) AS active_links FROM links
       WHERE workspace_id = ? AND status = 'active' AND deleted_at IS NULL`,
    )
      .bind(DEFAULT_WORKSPACE_ID)
      .first<{ active_links: number }>(),
    env.LINKS_DB.prepare(
      `SELECT id, title, short_path FROM links
       WHERE workspace_id = ? AND deleted_at IS NULL`,
    )
      .bind(DEFAULT_WORKSPACE_ID)
      .all<{ id: string; title: string; short_path: string }>(),
    queryLocalizedCategoryPerformance(
      'campaigns',
      range,
      previousRange,
      timeZone,
      coverageStartsAt,
    ),
    queryLocalizedCategoryPerformance(
      'tags',
      range,
      previousRange,
      timeZone,
      coverageStartsAt,
    ),
    getGlobalTrafficBreakdowns(range, timeZone),
    getGlobalClickHeatmap(range, timeZone),
  ])

  const totals = totalsFromSeries(series, currentLinks, range)
  const previousTotals = totalsFromSeries(previousSeries, previousLinks, previousRange)
  const localFrom = localAccuracyStartsOn(coverageStartsAt, timeZone)
  const combinedRange = { from: previousRange.from, to: range.to }
  const topLinks = linkRows.results
    .map((link) => {
      const humanClicks = currentLinks.get(link.id) ?? 0
      const previousHumanClicks = previousLinks.get(link.id) ?? 0
      return {
        id: link.id,
        title: link.title,
        shortPath: link.short_path,
        humanClicks,
        sharePercent: totals.humanClicks > 0
          ? (humanClicks / totals.humanClicks) * 100
          : 0,
        delta: compareMetric(humanClicks, previousHumanClicks),
      }
    })
    .filter((link) => link.humanClicks > 0)
    .sort((left, right) =>
      right.humanClicks - left.humanClicks || left.title.localeCompare(right.title),
    )
    .slice(0, TOP_LINKS_LIMIT)

  return {
    timezone: timeZone,
    aggregationMode: aggregationMode(combinedRange, localFrom),
    localAccuracyStartsOn: localFrom,
    range,
    previousRange,
    totals,
    previousTotals,
    activeLinksNow: toNonNegativeCount(activeLinks?.active_links),
    series,
    previousSeries,
    breakdowns,
    heatmap,
    categoryPerformance: { campaigns, tags },
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
    topLinks,
  }
}

async function getLocalizedLinkAnalytics(
  linkId: string,
  range: DateRange,
  timeZone: string,
) {
  const previousRange = previousDateRange(range)
  const coverageStartsAt = await getHourlyCoverageStart()
  const [current, previous, breakdowns, heatmap, utm] = await Promise.all([
    queryLocalizedSeries(range, timeZone, coverageStartsAt, linkId),
    queryLocalizedSeries(previousRange, timeZone, coverageStartsAt, linkId),
    getTrafficBreakdowns(linkId, range, timeZone),
    getLinkClickHeatmap(linkId, range, timeZone),
    getLinkUtmPerformance(linkId, range, previousRange, timeZone),
  ])
  const series = current.map(toLinkPoint)
  const previousSeries = previous.map(toLinkPoint)
  const humanClicks = sumHumanClicks(series)
  const botClicks = series.reduce(
    (total, point) => total + toNonNegativeCount(point.bot_clicks),
    0,
  )
  const localFrom = localAccuracyStartsOn(coverageStartsAt, timeZone)
  return {
    series,
    previousSeries,
    comparison: compareSeries(series, previousSeries),
    breakdowns,
    heatmap,
    utm,
    totals: {
      humanClicks,
      botClicks,
      averageDailyHumanClicks: humanClicks / rangeDurationInDays(range),
      botSharePercent: humanClicks + botClicks > 0
        ? (botClicks / (humanClicks + botClicks)) * 100
        : 0,
    },
    range,
    previousRange,
    scope: 'human' as const,
    timezone: timeZone,
    aggregationMode: aggregationMode(
      { from: previousRange.from, to: range.to },
      localFrom,
    ),
    localAccuracyStartsOn: localFrom,
  }
}

async function getHourlyCoverageStart() {
  const row = await env.LINKS_DB.prepare(
    `SELECT starts_at FROM analytics_hourly_coverage WHERE workspace_id = ?`,
  )
    .bind(DEFAULT_WORKSPACE_ID)
    .first<{ starts_at: string }>()
  return row?.starts_at ?? '9999-12-31T00:00:00.000Z'
}

async function queryLocalizedSeries(
  range: DateRange,
  timeZone: string,
  coverageStartsAt: string,
  linkId?: string,
) {
  const values = new Map<string, { human_clicks: number; bot_clicks: number }>()
  const cutoffDate = coverageStartsAt.slice(0, 10)
  const legacyTo = range.to < cutoffDate ? range.to : addDays(parseDateString(cutoffDate), -1)
    .toISOString()
    .slice(0, 10)
  if (range.from <= legacyTo) {
    const linkFilter = linkId ? 'AND link_id = ?' : ''
    const binds: unknown[] = [DEFAULT_WORKSPACE_ID]
    if (linkId) binds.push(linkId)
    binds.push(range.from, legacyTo)
    const { results } = await env.LINKS_DB.prepare(
      `SELECT metric_date,
         SUM(MAX(clicks - bot_clicks, 0)) AS human_clicks,
         SUM(MAX(bot_clicks, 0)) AS bot_clicks
       FROM daily_link_metrics
       WHERE workspace_id = ? ${linkFilter}
         AND metric_date BETWEEN ? AND ?
       GROUP BY metric_date`,
    )
      .bind(...binds)
      .all<OverviewSeriesRow>()
    for (const row of results) {
      values.set(row.metric_date, {
        human_clicks: toNonNegativeCount(row.human_clicks),
        bot_clicks: toNonNegativeCount(row.bot_clicks),
      })
    }
  }

  const bounds = localRangeToUtc(range, timeZone)
  const hourlyFrom = bounds.from.toISOString() > coverageStartsAt
    ? bounds.from.toISOString()
    : coverageStartsAt
  const hourlyTo = bounds.toExclusive.toISOString()
  if (hourlyFrom < hourlyTo) {
    const linkFilter = linkId ? 'AND link_id = ?' : ''
    const binds: unknown[] = [DEFAULT_WORKSPACE_ID]
    if (linkId) binds.push(linkId)
    binds.push(hourlyFrom, hourlyTo)
    const { results } = await env.LINKS_DB.prepare(
      `SELECT metric_hour,
         SUM(MAX(clicks - bot_clicks, 0)) AS human_clicks,
         SUM(MAX(bot_clicks, 0)) AS bot_clicks
       FROM hourly_link_metrics
       WHERE workspace_id = ? ${linkFilter}
         AND metric_hour >= ? AND metric_hour < ?
       GROUP BY metric_hour`,
    )
      .bind(...binds)
      .all<{ metric_hour: string; human_clicks: number; bot_clicks: number }>()
    for (const row of results) {
      const localDate = localDayHour(row.metric_hour, timeZone).date
      if (localDate < range.from || localDate > range.to) continue
      const current = values.get(localDate) ?? { human_clicks: 0, bot_clicks: 0 }
      current.human_clicks += toNonNegativeCount(row.human_clicks)
      current.bot_clicks += toNonNegativeCount(row.bot_clicks)
      values.set(localDate, current)
    }
  }

  return eachDate(range).map((metric_date) => ({
    metric_date,
    human_clicks: values.get(metric_date)?.human_clicks ?? 0,
    bot_clicks: values.get(metric_date)?.bot_clicks ?? 0,
  }))
}

async function queryLocalizedLinkTotals(
  range: DateRange,
  timeZone: string,
  coverageStartsAt: string,
) {
  const totals = new Map<string, number>()
  const cutoffDate = coverageStartsAt.slice(0, 10)
  const legacyTo = range.to < cutoffDate ? range.to : addDays(parseDateString(cutoffDate), -1)
    .toISOString()
    .slice(0, 10)
  if (range.from <= legacyTo) {
    const { results } = await env.LINKS_DB.prepare(
      `SELECT link_id, SUM(MAX(clicks - bot_clicks, 0)) AS human_clicks
       FROM daily_link_metrics
       WHERE workspace_id = ? AND metric_date BETWEEN ? AND ?
       GROUP BY link_id`,
    )
      .bind(DEFAULT_WORKSPACE_ID, range.from, legacyTo)
      .all<{ link_id: string; human_clicks: number }>()
    for (const row of results) totals.set(row.link_id, toNonNegativeCount(row.human_clicks))
  }
  const bounds = localRangeToUtc(range, timeZone)
  const from = bounds.from.toISOString() > coverageStartsAt
    ? bounds.from.toISOString()
    : coverageStartsAt
  const to = bounds.toExclusive.toISOString()
  if (from < to) {
    const { results } = await env.LINKS_DB.prepare(
      `SELECT link_id, SUM(MAX(clicks - bot_clicks, 0)) AS human_clicks
       FROM hourly_link_metrics
       WHERE workspace_id = ? AND metric_hour >= ? AND metric_hour < ?
       GROUP BY link_id`,
    )
      .bind(DEFAULT_WORKSPACE_ID, from, to)
      .all<{ link_id: string; human_clicks: number }>()
    for (const row of results) {
      totals.set(row.link_id, (totals.get(row.link_id) ?? 0) + toNonNegativeCount(row.human_clicks))
    }
  }
  return totals
}

async function queryLocalizedCategoryPerformance(
  kind: 'campaigns' | 'tags',
  range: DateRange,
  previousRange: DateRange,
  timeZone: string,
  coverageStartsAt: string,
) {
  const [current, previous] = await Promise.all([
    queryLocalizedCategoryTotals(kind, range, timeZone, coverageStartsAt),
    queryLocalizedCategoryTotals(kind, previousRange, timeZone, coverageStartsAt),
  ])
  const ids = new Set([...current.keys(), ...previous.keys()])
  return [...ids]
    .map((id) => {
      const currentValue = current.get(id)
      const previousValue = previous.get(id)
      const currentClicks = currentValue?.clicks ?? 0
      const previousClicks = previousValue?.clicks ?? 0
      return {
        id,
        label: currentValue?.label ?? previousValue?.label ?? id,
        currentClicks,
        previousClicks,
        delta: compareMetric(currentClicks, previousClicks),
      }
    })
    .sort((left, right) =>
      right.currentClicks - left.currentClicks || left.label.localeCompare(right.label),
    )
    .slice(0, TOP_LINKS_LIMIT)
}

async function queryLocalizedCategoryTotals(
  kind: 'campaigns' | 'tags',
  range: DateRange,
  timeZone: string,
  coverageStartsAt: string,
) {
  const categoryTable = kind === 'campaigns' ? 'campaigns' : 'tags'
  const assignmentTable = kind === 'campaigns' ? 'campaign_links' : 'link_tags'
  const categoryId = kind === 'campaigns' ? 'campaign_id' : 'tag_id'
  const activeCategory = kind === 'campaigns' ? 'AND categories.archived_at IS NULL' : ''
  const totals = new Map<string, { label: string; clicks: number }>()
  const cutoffDate = coverageStartsAt.slice(0, 10)
  const legacyTo = range.to < cutoffDate ? range.to : addDays(parseDateString(cutoffDate), -1)
    .toISOString()
    .slice(0, 10)
  if (range.from <= legacyTo) {
    const { results } = await env.LINKS_DB.prepare(
      `SELECT categories.id, categories.name AS label,
         SUM(MAX(metrics.clicks - metrics.bot_clicks, 0)) AS clicks
       FROM ${categoryTable} AS categories
       JOIN ${assignmentTable} AS assignments ON assignments.${categoryId} = categories.id
       JOIN links ON links.id = assignments.link_id
       JOIN daily_link_metrics AS metrics ON metrics.link_id = links.id
       WHERE categories.workspace_id = ? ${activeCategory}
         AND links.deleted_at IS NULL
         AND metrics.metric_date BETWEEN ? AND ?
       GROUP BY categories.id, categories.name`,
    )
      .bind(DEFAULT_WORKSPACE_ID, range.from, legacyTo)
      .all<{ id: string; label: string; clicks: number }>()
    for (const row of results) totals.set(row.id, { label: row.label, clicks: toNonNegativeCount(row.clicks) })
  }
  const bounds = localRangeToUtc(range, timeZone)
  const from = bounds.from.toISOString() > coverageStartsAt
    ? bounds.from.toISOString()
    : coverageStartsAt
  const to = bounds.toExclusive.toISOString()
  if (from < to) {
    const { results } = await env.LINKS_DB.prepare(
      `SELECT categories.id, categories.name AS label,
         SUM(MAX(metrics.clicks - metrics.bot_clicks, 0)) AS clicks
       FROM ${categoryTable} AS categories
       JOIN ${assignmentTable} AS assignments ON assignments.${categoryId} = categories.id
       JOIN links ON links.id = assignments.link_id
       JOIN hourly_link_metrics AS metrics ON metrics.link_id = links.id
       WHERE categories.workspace_id = ? ${activeCategory}
         AND links.deleted_at IS NULL
         AND metrics.metric_hour >= ? AND metrics.metric_hour < ?
       GROUP BY categories.id, categories.name`,
    )
      .bind(DEFAULT_WORKSPACE_ID, from, to)
      .all<{ id: string; label: string; clicks: number }>()
    for (const row of results) {
      const current = totals.get(row.id)
      totals.set(row.id, {
        label: row.label,
        clicks: (current?.clicks ?? 0) + toNonNegativeCount(row.clicks),
      })
    }
  }
  return totals
}

function totalsFromSeries(
  series: AnalyticsSeriesPoint[],
  linkTotals: Map<string, number>,
  range: DateRange,
) {
  const humanClicks = series.reduce((total, point) => total + point.human_clicks, 0)
  const botClicks = series.reduce((total, point) => total + point.bot_clicks, 0)
  return {
    humanClicks,
    botClicks,
    linksWithActivity: [...linkTotals.values()].filter((clicks) => clicks > 0).length,
    averageDailyHumanClicks: humanClicks / rangeDurationInDays(range),
  }
}

function toLinkPoint(point: AnalyticsSeriesPoint) {
  const recordedClicks = point.human_clicks + point.bot_clicks
  return {
    metric_date: point.metric_date,
    clicks: point.human_clicks,
    human_clicks: point.human_clicks,
    bot_clicks: point.bot_clicks,
    recorded_clicks: recordedClicks,
  }
}

export async function exportMetricsCsv(
  range: DateRange,
  linkId?: string | null,
  timeZone = ANALYTICS_TIMEZONE,
) {
  validateDateRange(range, timeZone)
  if (!isValidTimeZone(timeZone)) {
    throw new DateRangeValidationError('La zona horaria no es válida.', 'timeZone')
  }
  if (timeZone !== ANALYTICS_TIMEZONE) {
    return exportLocalizedMetricsCsv(range, linkId, timeZone)
  }
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

async function exportLocalizedMetricsCsv(
  range: DateRange,
  linkId: string | null | undefined,
  timeZone: string,
) {
  const coverageStartsAt = await getHourlyCoverageStart()
  const rows = new Map<string, {
    botClicks: number
    clicks: number
    date: string
    domain: string
    humanClicks: number
    linkId: string
    shortPath: string
    title: string
    uniqueVisitors: number
  }>()
  const cutoffDate = coverageStartsAt.slice(0, 10)
  const legacyTo = range.to < cutoffDate ? range.to : addDays(parseDateString(cutoffDate), -1)
    .toISOString()
    .slice(0, 10)
  if (range.from <= legacyTo) {
    const filter = linkId ? 'AND metrics.link_id = ?' : ''
    const binds: unknown[] = [DEFAULT_WORKSPACE_ID, range.from, legacyTo]
    if (linkId) binds.push(linkId)
    const { results } = await env.LINKS_DB.prepare(
      `SELECT metrics.metric_date, metrics.link_id, links.title, links.short_path,
         domains.domain, metrics.clicks,
         MAX(metrics.clicks - metrics.bot_clicks, 0) AS human_clicks,
         metrics.bot_clicks, metrics.unique_visitors
       FROM daily_link_metrics AS metrics
       JOIN links ON links.id = metrics.link_id
       JOIN domains ON domains.id = links.domain_id
       WHERE metrics.workspace_id = ?
         AND metrics.metric_date BETWEEN ? AND ? ${filter}
       ORDER BY metrics.metric_date ASC, links.title ASC`,
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
    for (const row of results) {
      rows.set(`${row.metric_date}:${row.link_id}`, {
        botClicks: toNonNegativeCount(row.bot_clicks),
        clicks: toNonNegativeCount(row.clicks),
        date: row.metric_date,
        domain: row.domain,
        humanClicks: toNonNegativeCount(row.human_clicks),
        linkId: row.link_id,
        shortPath: row.short_path,
        title: row.title,
        uniqueVisitors: toNonNegativeCount(row.unique_visitors),
      })
    }
  }
  const bounds = localRangeToUtc(range, timeZone)
  const from = bounds.from.toISOString() > coverageStartsAt
    ? bounds.from.toISOString()
    : coverageStartsAt
  const to = bounds.toExclusive.toISOString()
  if (from < to) {
    const filter = linkId ? 'AND metrics.link_id = ?' : ''
    const binds: unknown[] = [DEFAULT_WORKSPACE_ID, from, to]
    if (linkId) binds.push(linkId)
    const { results } = await env.LINKS_DB.prepare(
      `SELECT metrics.metric_hour, metrics.link_id, links.title, links.short_path,
         domains.domain, metrics.clicks,
         MAX(metrics.clicks - metrics.bot_clicks, 0) AS human_clicks,
         metrics.bot_clicks
       FROM hourly_link_metrics AS metrics
       JOIN links ON links.id = metrics.link_id
       JOIN domains ON domains.id = links.domain_id
       WHERE metrics.workspace_id = ?
         AND metrics.metric_hour >= ? AND metrics.metric_hour < ? ${filter}
       ORDER BY metrics.metric_hour ASC, links.title ASC`,
    )
      .bind(...binds)
      .all<{
        metric_hour: string
        link_id: string
        title: string
        short_path: string
        domain: string
        clicks: number
        human_clicks: number
        bot_clicks: number
      }>()
    for (const row of results) {
      const date = localDayHour(row.metric_hour, timeZone).date
      if (date < range.from || date > range.to) continue
      const key = `${date}:${row.link_id}`
      const current = rows.get(key) ?? {
        botClicks: 0,
        clicks: 0,
        date,
        domain: row.domain,
        humanClicks: 0,
        linkId: row.link_id,
        shortPath: row.short_path,
        title: row.title,
        uniqueVisitors: 0,
      }
      current.clicks += toNonNegativeCount(row.clicks)
      current.humanClicks += toNonNegativeCount(row.human_clicks)
      current.botClicks += toNonNegativeCount(row.bot_clicks)
      rows.set(key, current)
    }
  }
  const localFrom = localAccuracyStartsOn(coverageStartsAt, timeZone)
  const mode = aggregationMode(range, localFrom)
  return toCsv([
    [
      'date',
      'time_zone',
      'aggregation_mode',
      'link_id',
      'title',
      'short_url',
      'clicks',
      'human_clicks',
      'bot_clicks',
      'unique_visitors',
    ],
    ...[...rows.values()]
      .sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title))
      .map((row) => [
        row.date,
        timeZone,
        mode,
        row.linkId,
        row.title,
        `https://${row.domain}/${row.shortPath}`,
        String(row.clicks),
        String(row.humanClicks),
        String(row.botClicks),
        String(row.uniqueVisitors),
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
  deltaPercent: number | null
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

type CategoryPerformanceRow = {
  id: string
  label: string
  current_clicks: number
  previous_clicks: number
}

export type DateRangeValidationField = 'from' | 'to' | 'range' | 'timeZone'

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
  const timeZone = parseTimeZone(url)

  if (rawFrom === null && rawTo === null) return defaultRange(timeZone)
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

  return validateDateRange({ from: rawFrom, to: rawTo }, timeZone)
}

export function parseTimeZone(url: URL) {
  const value = url.searchParams.get('timeZone') ?? ANALYTICS_TIMEZONE
  if (!isValidTimeZone(value)) {
    throw new DateRangeValidationError('La zona horaria no es válida.', 'timeZone')
  }
  return value
}

export function validateDateRange(
  range: DateRange,
  timeZone = ANALYTICS_TIMEZONE,
): DateRange {
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

  const today = localDayHour(new Date(), timeZone).date
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

function defaultRange(timeZone = ANALYTICS_TIMEZONE): DateRange {
  const to = localDayHour(new Date(), timeZone).date
  const from = addDays(parseDateString(to), -(DEFAULT_RANGE_DAYS - 1))
  return { from: toDateString(from), to }
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

async function queryCategoryPerformance(
  kind: 'campaigns' | 'tags',
  range: DateRange,
  previousRange: DateRange,
) {
  const categoryTable = kind === 'campaigns' ? 'campaigns' : 'tags'
  const assignmentTable = kind === 'campaigns' ? 'campaign_links' : 'link_tags'
  const categoryId = kind === 'campaigns' ? 'campaign_id' : 'tag_id'
  const activeCategory = kind === 'campaigns' ? 'AND categories.archived_at IS NULL' : ''
  const { results } = await env.LINKS_DB.prepare(
    `SELECT
       categories.id,
       categories.name AS label,
       COALESCE(SUM(CASE
         WHEN metrics.metric_date BETWEEN ? AND ?
         THEN MAX(metrics.clicks - metrics.bot_clicks, 0)
         ELSE 0
       END), 0) AS current_clicks,
       COALESCE(SUM(CASE
         WHEN metrics.metric_date BETWEEN ? AND ?
         THEN MAX(metrics.clicks - metrics.bot_clicks, 0)
         ELSE 0
       END), 0) AS previous_clicks
     FROM ${categoryTable} AS categories
     JOIN ${assignmentTable} AS assignments
       ON assignments.${categoryId} = categories.id
     JOIN links ON links.id = assignments.link_id
     JOIN daily_link_metrics AS metrics ON metrics.link_id = links.id
     WHERE categories.workspace_id = ?
       ${activeCategory}
       AND links.workspace_id = ?
       AND links.deleted_at IS NULL
       AND metrics.metric_date BETWEEN ? AND ?
     GROUP BY categories.id, categories.name
     HAVING current_clicks > 0 OR previous_clicks > 0
     ORDER BY current_clicks DESC, previous_clicks DESC, LOWER(categories.name) ASC
     LIMIT ${TOP_LINKS_LIMIT}`,
  )
    .bind(
      range.from,
      range.to,
      previousRange.from,
      previousRange.to,
      DEFAULT_WORKSPACE_ID,
      DEFAULT_WORKSPACE_ID,
      previousRange.from,
      range.to,
    )
    .all<CategoryPerformanceRow>()
  return results
}

function toCategoryPerformance(
  rows: CategoryPerformanceRow[],
): AnalyticsPerformanceItem[] {
  return rows.map((row) => {
    const currentClicks = toNonNegativeCount(row.current_clicks)
    const previousClicks = toNonNegativeCount(row.previous_clicks)
    return {
      id: row.id,
      label: row.label,
      currentClicks,
      previousClicks,
      delta: compareMetric(currentClicks, previousClicks),
    }
  })
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

function compareSeries(
  series: AnalyticsPoint[],
  previousSeries: AnalyticsPoint[],
): AnalyticsComparison {
  const currentClicks = sumHumanClicks(series)
  const previousClicks = sumHumanClicks(previousSeries)
  const delta = currentClicks - previousClicks
  const deltaPercent = previousClicks === 0 ? null : (delta / previousClicks) * 100
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'

  return { currentClicks, previousClicks, delta, deltaPercent, trend }
}

function normalizeLinkSeries(points: AnalyticsPoint[], range: DateRange) {
  const byDate = new Map(points.map((point) => [point.metric_date, point]))
  return eachDate(range).map((metric_date) => {
    const point = byDate.get(metric_date)
    const recordedClicks = toNonNegativeCount(point?.clicks)
    const botClicks = toNonNegativeCount(point?.bot_clicks)
    const humanClicks = Math.max(recordedClicks - botClicks, 0)
    return {
      metric_date,
      clicks: humanClicks,
      human_clicks: humanClicks,
      bot_clicks: botClicks,
      recorded_clicks: recordedClicks,
    }
  })
}

function sumHumanClicks(points: Array<AnalyticsPoint & { human_clicks?: number }>) {
  return points.reduce(
    (total, point) => total + toNonNegativeCount(point.human_clicks ?? point.clicks),
    0,
  )
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
