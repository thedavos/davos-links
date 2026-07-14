import { env } from 'cloudflare:workers'
import { ANALYTICS_COLUMNS } from '#/lib/analytics/breakdowns'
import { DEFAULT_WORKSPACE_ID } from '#/lib/constants'
import type {
  AnalyticsDelta,
  AnalyticsHeatmap,
  AnalyticsHeatmapCell,
  AnalyticsInsightStatus,
  AnalyticsUtmItem,
  AnalyticsUtmPerformance,
} from '#/lib/types'
import {
  FALLBACK_TIME_ZONE,
  localDayHour,
  localRangeToUtc,
} from '#/lib/time-zone'

const ANALYTICS_DATASET = 'davos_links_clicks'
const ANALYTICS_TIMEOUT_MS = 8_000
const TOP_ITEMS = 5

type AnalyticsEnv = Env & {
  ANALYTICS_DATA_SOURCE?: string
  ANALYTICS_ENGINE_API_TOKEN?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  BETTER_AUTH_URL?: string
}

type DateRange = { from: string; to: string }
type InsightScope =
  | { kind: 'link'; linkId: string; workspaceId: string }
  | { kind: 'workspace'; workspaceId: string }
type AnalyticsRow = Record<string, unknown>
type UtmDimension = 'campaigns' | 'sources' | 'mediums'

const analyticsEnv = env as AnalyticsEnv

export function getGlobalClickHeatmap(
  range: DateRange,
  timeZone = FALLBACK_TIME_ZONE,
) {
  return getClickHeatmap(
    { kind: 'workspace', workspaceId: DEFAULT_WORKSPACE_ID },
    range,
    timeZone,
  )
}

export function getLinkClickHeatmap(
  linkId: string,
  range: DateRange,
  timeZone = FALLBACK_TIME_ZONE,
) {
  return getClickHeatmap(
    { kind: 'link', linkId, workspaceId: DEFAULT_WORKSPACE_ID },
    range,
    timeZone,
  )
}

export async function getLinkUtmPerformance(
  linkId: string,
  range: DateRange,
  previousRange: DateRange,
  timeZone = FALLBACK_TIME_ZONE,
): Promise<AnalyticsUtmPerformance> {
  const scope: InsightScope = {
    kind: 'link',
    linkId,
    workspaceId: DEFAULT_WORKSPACE_ID,
  }
  const source = analyticsSource()

  if (source === 'demo') {
    if (!isLocalDemoAllowed(analyticsEnv.BETTER_AUTH_URL)) {
      return unavailableUtm('demo', range, previousRange, 'not_configured', 'local_demo')
    }
    return getDemoUtmPerformance(scope, range, previousRange)
  }

  return getCloudflareUtmPerformance(scope, range, previousRange, timeZone)
}

async function getClickHeatmap(
  scope: InsightScope,
  range: DateRange,
  timeZone: string,
): Promise<AnalyticsHeatmap> {
  const source = analyticsSource()
  if (source === 'demo') {
    if (!isLocalDemoAllowed(analyticsEnv.BETTER_AUTH_URL)) {
      return unavailableHeatmap('demo', range, 'not_configured', 'local_demo')
    }
    return getDemoHeatmap(scope, range, timeZone)
  }
  return getCloudflareHeatmap(scope, range, timeZone)
}

async function getCloudflareHeatmap(
  scope: InsightScope,
  range: DateRange,
  timeZone: string,
): Promise<AnalyticsHeatmap> {
  const coverage = cloudflareCoverage(range)
  const credentials = analyticsCredentials()
  if (!credentials || !isValidScope(scope)) {
    return unavailableHeatmap(
      'analytics_engine',
      coverage,
      'not_configured',
      '3_months',
    )
  }
  if (coverage.from > coverage.to) {
    return readyHeatmap('analytics_engine', coverage, '3_months', [])
  }

  try {
    const zone = escapeSqlString(timeZone)
    const localTimestamp = `toDateTime(formatDateTime(timestamp, '%Y-%m-%d %H:%M:%S', '${zone}'))`
    const rows = await queryAnalyticsEngine(
      credentials,
      `SELECT
         toDayOfWeek(${localTimestamp}) AS day,
         toHour(${localTimestamp}) AS hour,
         SUM(_sample_interval) AS clicks
       FROM ${ANALYTICS_DATASET}
       WHERE ${analyticsWhere(scope, coverage, timeZone)}
       GROUP BY day, hour
       ORDER BY day ASC, hour ASC`,
    )
    return readyHeatmap('analytics_engine', coverage, '3_months', rows)
  } catch (error) {
    console.error('Analytics Engine heatmap query failed.', safeErrorMessage(error))
    return unavailableHeatmap(
      'analytics_engine',
      coverage,
      'upstream_error',
      '3_months',
    )
  }
}

async function getDemoHeatmap(
  scope: InsightScope,
  range: DateRange,
  timeZone: string,
): Promise<AnalyticsHeatmap> {
  const coverage = { ...range, truncated: false }
  if (!isValidScope(scope)) return readyHeatmap('demo', coverage, 'local_demo', [])
  const filters = demoFilters(scope, range)

  try {
    if (timeZone !== FALLBACK_TIME_ZONE) {
      const { results } = await analyticsEnv.LINKS_DB.prepare(
        `SELECT metric_date, hour_utc AS hour, human_clicks AS clicks
         FROM demo_click_slices
         WHERE ${filters.where}`,
      )
        .bind(...filters.binds)
        .all<AnalyticsRow>()
      const grouped = new Map<string, number>()
      for (const row of results) {
        const instant = `${String(row.metric_date)}T${String(row.hour).padStart(2, '0')}:00:00.000Z`
        const slot = localDayHour(instant, timeZone)
        const key = `${slot.day}:${slot.hour}`
        grouped.set(key, (grouped.get(key) ?? 0) + toCount(row.clicks))
      }
      return readyHeatmap(
        'demo',
        coverage,
        'local_demo',
        [...grouped].map(([slot, clicks]) => {
          const [day, hour] = slot.split(':').map(Number)
          return { day, hour, clicks }
        }),
      )
    }
    const { results } = await analyticsEnv.LINKS_DB.prepare(
      `SELECT
         CASE strftime('%w', metric_date)
           WHEN '0' THEN 7
           ELSE CAST(strftime('%w', metric_date) AS INTEGER)
         END AS day,
         hour_utc AS hour,
         SUM(human_clicks) AS clicks
       FROM demo_click_slices
       WHERE ${filters.where}
       GROUP BY day, hour_utc
       ORDER BY day ASC, hour_utc ASC`,
    )
      .bind(...filters.binds)
      .all<AnalyticsRow>()
    return readyHeatmap('demo', coverage, 'local_demo', results)
  } catch (error) {
    console.error('Local demo heatmap query failed.', safeErrorMessage(error))
    return unavailableHeatmap('demo', coverage, 'upstream_error', 'local_demo')
  }
}

async function getCloudflareUtmPerformance(
  scope: InsightScope,
  range: DateRange,
  previousRange: DateRange,
  timeZone: string,
): Promise<AnalyticsUtmPerformance> {
  const coverage = cloudflareCoverage(range)
  const previousCoverage = cloudflareCoverage(previousRange)
  const credentials = analyticsCredentials()
  if (!credentials || !isValidScope(scope)) {
    return unavailableUtm(
      'analytics_engine',
      coverage,
      previousCoverage,
      'not_configured',
      '3_months',
    )
  }
  if (coverage.from > coverage.to) {
    return readyUtm('analytics_engine', coverage, previousCoverage, '3_months', 0, {})
  }

  try {
    const comparisonFrom = previousCoverage.from <= previousCoverage.to
      ? previousCoverage.from
      : coverage.from
    const comparisonTo = coverage.to
    const scopeWhere = analyticsScopeWhere(scope)
    const totalWhere = analyticsWhere(scope, coverage, timeZone)
    const [totals, campaigns, sources, mediums] = await Promise.all([
      queryAnalyticsEngine(
        credentials,
        `SELECT SUM(_sample_interval) AS clicks
         FROM ${ANALYTICS_DATASET}
         WHERE ${totalWhere}`,
      ),
      queryCloudflareUtmDimension(
        credentials,
        ANALYTICS_COLUMNS.utmCampaign,
        scopeWhere,
        coverage,
        previousCoverage,
        comparisonFrom,
        comparisonTo,
        timeZone,
      ),
      queryCloudflareUtmDimension(
        credentials,
        ANALYTICS_COLUMNS.utmSource,
        scopeWhere,
        coverage,
        previousCoverage,
        comparisonFrom,
        comparisonTo,
        timeZone,
      ),
      queryCloudflareUtmDimension(
        credentials,
        ANALYTICS_COLUMNS.utmMedium,
        scopeWhere,
        coverage,
        previousCoverage,
        comparisonFrom,
        comparisonTo,
        timeZone,
      ),
    ])
    const totalClicks = toCount(totals[0]?.clicks)
    return readyUtm(
      'analytics_engine',
      coverage,
      previousCoverage,
      '3_months',
      totalClicks,
      { campaigns, sources, mediums },
    )
  } catch (error) {
    console.error('Analytics Engine UTM query failed.', safeErrorMessage(error))
    return unavailableUtm(
      'analytics_engine',
      coverage,
      previousCoverage,
      'upstream_error',
      '3_months',
    )
  }
}

function queryCloudflareUtmDimension(
  credentials: { accountId: string; token: string },
  column: string,
  scopeWhere: string,
  current: DateRange,
  previous: DateRange,
  comparisonFrom: string,
  comparisonTo: string,
  timeZone: string,
) {
  const currentBounds = localRangeToUtc(current, timeZone)
  const previousBounds = localRangeToUtc(previous, timeZone)
  const comparisonBounds = localRangeToUtc(
    { from: comparisonFrom, to: comparisonTo },
    timeZone,
  )
  const currentFrom = toSqlDateTime(currentBounds.from)
  const currentEnd = toSqlDateTime(currentBounds.toExclusive)
  const previousFrom = toSqlDateTime(previousBounds.from)
  const previousEnd = toSqlDateTime(previousBounds.toExclusive)
  const comparisonStart = toSqlDateTime(comparisonBounds.from)
  const comparisonEnd = toSqlDateTime(comparisonBounds.toExclusive)
  const previousExpression = previous.from <= previous.to
    ? `timestamp >= toDateTime('${previousFrom}', 'Etc/UTC') AND timestamp < toDateTime('${previousEnd}', 'Etc/UTC')`
    : '0 = 1'
  return queryAnalyticsEngine(
    credentials,
    `SELECT
       ${column} AS value,
       SUM(if(timestamp >= toDateTime('${currentFrom}', 'Etc/UTC') AND timestamp < toDateTime('${currentEnd}', 'Etc/UTC'), _sample_interval, 0)) AS current_clicks,
       SUM(if(${previousExpression}, _sample_interval, 0)) AS previous_clicks
     FROM ${ANALYTICS_DATASET}
     WHERE ${scopeWhere}
       AND ${column} != ''
       AND timestamp >= toDateTime('${comparisonStart}', 'Etc/UTC')
       AND timestamp < toDateTime('${comparisonEnd}', 'Etc/UTC')
     GROUP BY value
     HAVING current_clicks > 0 OR previous_clicks > 0
     ORDER BY current_clicks DESC, previous_clicks DESC, value ASC
     LIMIT ${TOP_ITEMS}`,
  )
}

async function getDemoUtmPerformance(
  scope: InsightScope,
  range: DateRange,
  previousRange: DateRange,
): Promise<AnalyticsUtmPerformance> {
  const coverage = { ...range, truncated: false }
  const previousCoverage = { ...previousRange, truncated: false }
  if (!isValidScope(scope)) {
    return readyUtm('demo', coverage, previousCoverage, 'local_demo', 0, {})
  }

  try {
    const scopeFilters = demoScopeFilters(scope)
    const [total, campaigns, sources, mediums] = await Promise.all([
      analyticsEnv.LINKS_DB.prepare(
        `SELECT COALESCE(SUM(human_clicks), 0) AS clicks
         FROM demo_click_slices
         WHERE ${scopeFilters.where} AND metric_date BETWEEN ? AND ?`,
      )
        .bind(...scopeFilters.binds, range.from, range.to)
        .first<{ clicks: number }>(),
      queryDemoUtmDimension(scope, range, previousRange, 'utm_campaign'),
      queryDemoUtmDimension(scope, range, previousRange, 'utm_source'),
      queryDemoUtmDimension(scope, range, previousRange, 'utm_medium'),
    ])
    return readyUtm(
      'demo',
      coverage,
      previousCoverage,
      'local_demo',
      toCount(total?.clicks),
      { campaigns, sources, mediums },
    )
  } catch (error) {
    console.error('Local demo UTM query failed.', safeErrorMessage(error))
    return unavailableUtm(
      'demo',
      coverage,
      previousCoverage,
      'upstream_error',
      'local_demo',
    )
  }
}

async function queryDemoUtmDimension(
  scope: InsightScope,
  range: DateRange,
  previousRange: DateRange,
  column: 'utm_campaign' | 'utm_source' | 'utm_medium',
) {
  const filters = demoScopeFilters(scope)
  const { results } = await analyticsEnv.LINKS_DB.prepare(
    `SELECT
       ${column} AS value,
       SUM(CASE WHEN metric_date BETWEEN ? AND ? THEN human_clicks ELSE 0 END) AS current_clicks,
       SUM(CASE WHEN metric_date BETWEEN ? AND ? THEN human_clicks ELSE 0 END) AS previous_clicks
     FROM demo_click_slices
     WHERE ${filters.where}
       AND ${column} != ''
       AND metric_date BETWEEN ? AND ?
     GROUP BY ${column}
     HAVING current_clicks > 0 OR previous_clicks > 0
     ORDER BY current_clicks DESC, previous_clicks DESC, value ASC
     LIMIT ${TOP_ITEMS}`,
  )
    .bind(
      range.from,
      range.to,
      previousRange.from,
      previousRange.to,
      ...filters.binds,
      previousRange.from,
      range.to,
    )
    .all<AnalyticsRow>()
  return results
}

function readyHeatmap(
  source: AnalyticsHeatmap['source'],
  coverage: DateRange & { truncated: boolean },
  retention: AnalyticsHeatmap['coverage']['retention'],
  rows: AnalyticsRow[],
): AnalyticsHeatmap {
  const bySlot = new Map(
    rows.map((row) => [`${toInteger(row.day)}:${toInteger(row.hour)}`, toCount(row.clicks)]),
  )
  const cells: AnalyticsHeatmapCell[] = []
  for (let day = 1; day <= 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      cells.push({
        day: day as AnalyticsHeatmapCell['day'],
        hour,
        clicks: bySlot.get(`${day}:${hour}`) ?? 0,
      })
    }
  }
  return {
    status: 'ready',
    source,
    scope: 'human',
    coverage: { ...coverage, retention },
    totalClicks: cells.reduce((total, cell) => total + cell.clicks, 0),
    cells,
  }
}

function unavailableHeatmap(
  source: AnalyticsHeatmap['source'],
  coverage: DateRange & { truncated?: boolean },
  reason: NonNullable<AnalyticsHeatmap['reason']>,
  retention: AnalyticsHeatmap['coverage']['retention'],
): AnalyticsHeatmap {
  return {
    status: 'unavailable',
    reason,
    source,
    scope: 'human',
    coverage: normalizedCoverage(coverage, retention),
    totalClicks: 0,
    cells: [],
  }
}

function readyUtm(
  source: AnalyticsUtmPerformance['source'],
  coverage: DateRange & { truncated: boolean },
  previousCoverage: DateRange & { truncated: boolean },
  retention: AnalyticsUtmPerformance['coverage']['retention'],
  totalClicks: number,
  dimensions: Partial<Record<UtmDimension, AnalyticsRow[]>>,
): AnalyticsUtmPerformance {
  return {
    status: 'ready',
    source,
    scope: 'human',
    coverage: { ...coverage, retention },
    previousCoverage: { ...previousCoverage, retention },
    totalClicks,
    campaigns: toUtmItems(dimensions.campaigns ?? [], totalClicks),
    sources: toUtmItems(dimensions.sources ?? [], totalClicks),
    mediums: toUtmItems(dimensions.mediums ?? [], totalClicks),
  }
}

function unavailableUtm(
  source: AnalyticsUtmPerformance['source'],
  coverage: DateRange & { truncated?: boolean },
  previousCoverage: DateRange & { truncated?: boolean },
  reason: NonNullable<AnalyticsUtmPerformance['reason']>,
  retention: AnalyticsUtmPerformance['coverage']['retention'],
): AnalyticsUtmPerformance {
  return {
    status: 'unavailable',
    reason,
    source,
    scope: 'human',
    coverage: normalizedCoverage(coverage, retention),
    previousCoverage: normalizedCoverage(previousCoverage, retention),
    totalClicks: 0,
    campaigns: [],
    sources: [],
    mediums: [],
  }
}

function toUtmItems(rows: AnalyticsRow[], totalClicks: number): AnalyticsUtmItem[] {
  return rows
    .map((row) => {
      const currentClicks = toCount(row.current_clicks)
      const previousClicks = toCount(row.previous_clicks)
      return {
        value: String(row.value ?? '').trim(),
        currentClicks,
        previousClicks,
        sharePercent: totalClicks > 0 ? (currentClicks / totalClicks) * 100 : 0,
        delta: compare(currentClicks, previousClicks),
      }
    })
    .filter((item) => item.value && (item.currentClicks > 0 || item.previousClicks > 0))
    .slice(0, TOP_ITEMS)
}

function analyticsCredentials() {
  const accountId = analyticsEnv.CLOUDFLARE_ACCOUNT_ID?.trim() ?? ''
  const token = analyticsEnv.ANALYTICS_ENGINE_API_TOKEN?.trim() ?? ''
  return /^[a-f0-9]{32}$/i.test(accountId) && token ? { accountId, token } : null
}

async function queryAnalyticsEngine(
  credentials: { accountId: string; token: string },
  query: string,
): Promise<AnalyticsRow[]> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        'content-type': 'text/plain; charset=utf-8',
      },
      body: query,
      signal: AbortSignal.timeout(ANALYTICS_TIMEOUT_MS),
    },
  )
  if (!response.ok) throw new Error(`Cloudflare SQL API returned ${response.status}.`)
  const payload: unknown = await response.json()
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('Cloudflare SQL API returned an invalid response.')
  }
  return payload.data.filter(isRecord)
}

function analyticsWhere(
  scope: InsightScope,
  range: DateRange,
  timeZone: string,
) {
  const bounds = localRangeToUtc(range, timeZone)
  return [
    analyticsScopeWhere(scope),
    `timestamp >= toDateTime('${toSqlDateTime(bounds.from)}', 'Etc/UTC')`,
    `timestamp < toDateTime('${toSqlDateTime(bounds.toExclusive)}', 'Etc/UTC')`,
  ].join(' AND ')
}

function toSqlDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function analyticsScopeWhere(scope: InsightScope) {
  const filters = [
    `${ANALYTICS_COLUMNS.workspaceId} = '${escapeSqlString(scope.workspaceId)}'`,
    `${ANALYTICS_COLUMNS.isBot} = 0`,
  ]
  if (scope.kind === 'link') {
    filters.unshift(`${ANALYTICS_COLUMNS.linkId} = '${escapeSqlString(scope.linkId)}'`)
  }
  return filters.join(' AND ')
}

function demoFilters(scope: InsightScope, range: DateRange) {
  const filters = demoScopeFilters(scope)
  return {
    where: `${filters.where} AND metric_date BETWEEN ? AND ?`,
    binds: [...filters.binds, range.from, range.to],
  }
}

function demoScopeFilters(scope: InsightScope) {
  const where = ['workspace_id = ?']
  const binds: unknown[] = [scope.workspaceId]
  if (scope.kind === 'link') {
    where.push('link_id = ?')
    binds.push(scope.linkId)
  }
  return { where: where.join(' AND '), binds }
}

function cloudflareCoverage(range: DateRange) {
  const today = new Date()
  const retentionFloor = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3, today.getUTCDate()),
  )
  const floor = toDateString(retentionFloor)
  const ceiling = toDateString(today)
  const from = range.from < floor ? floor : range.from
  const to = range.to > ceiling ? ceiling : range.to
  return { from, to, truncated: from !== range.from || to !== range.to }
}

function normalizedCoverage(
  coverage: DateRange & { truncated?: boolean },
  retention: AnalyticsInsightStatus['coverage']['retention'],
) {
  return { ...coverage, truncated: coverage.truncated ?? false, retention }
}

function compare(current: number, previous: number): AnalyticsDelta {
  const absolute = current - previous
  if (previous === 0) {
    return current > 0
      ? { status: 'new', absolute, percent: null, trend: 'up' }
      : { status: 'no-baseline', absolute: 0, percent: null, trend: 'flat' }
  }
  return {
    status: 'comparable',
    absolute,
    percent: (absolute / previous) * 100,
    trend: absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'flat',
  }
}

function analyticsSource() {
  return analyticsEnv.ANALYTICS_DATA_SOURCE === 'demo' ? 'demo' : 'analytics_engine'
}

function isLocalDemoAllowed(baseUrl?: string) {
  if (!baseUrl) return false
  try {
    const hostname = new URL(baseUrl).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function isValidScope(scope: InsightScope) {
  return (
    /^wsp_[a-z0-9_-]{1,80}$/i.test(scope.workspaceId) &&
    (scope.kind === 'workspace' || /^lnk_[a-z0-9_-]{1,80}$/i.test(scope.linkId))
  )
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function toInteger(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.trunc(number) : 0
}

function toCount(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0
}

function escapeSqlString(value: string) {
  return value.replaceAll("'", "''")
}

function isRecord(value: unknown): value is AnalyticsRow {
  return typeof value === 'object' && value !== null
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown analytics error.'
}
