import { env } from 'cloudflare:workers'
import { DEFAULT_WORKSPACE_ID } from '#/lib/constants'
import type { AnalyticsBreakdownItem, AnalyticsBreakdowns } from '#/lib/types'
import { FALLBACK_TIME_ZONE, localRangeToUtc } from '#/lib/time-zone'

const ANALYTICS_DATASET = 'davos_links_clicks'
const ANALYTICS_TIMEOUT_MS = 8_000
const TOP_ITEMS = 5

export const ANALYTICS_COLUMNS = {
  workspaceId: 'blob2',
  country: 'blob5',
  referrerDomain: 'blob10',
  device: 'blob14',
  utmSource: 'blob16',
  utmMedium: 'blob17',
  utmCampaign: 'blob18',
  isBot: 'double1',
  linkId: 'index1',
} as const

type AnalyticsEnv = Env & {
  ANALYTICS_DATA_SOURCE?: string
  ANALYTICS_ENGINE_API_TOKEN?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  BETTER_AUTH_URL?: string
}

type DateRange = {
  from: string
  to: string
}

type AnalyticsRow = {
  value?: unknown
  clicks?: unknown
}

type Dimension = 'referrers' | 'countries' | 'devices'

type BreakdownScope =
  | { kind: 'link'; linkId: string; workspaceId: string }
  | { kind: 'workspace'; workspaceId: string }

const analyticsEnv = env as AnalyticsEnv

export async function getTrafficBreakdowns(
  linkId: string,
  range: DateRange,
  timeZone = FALLBACK_TIME_ZONE,
): Promise<AnalyticsBreakdowns> {
  return getBreakdowns(
    { kind: 'link', linkId, workspaceId: DEFAULT_WORKSPACE_ID },
    range,
    timeZone,
  )
}

export async function getGlobalTrafficBreakdowns(
  range: DateRange,
  timeZone = FALLBACK_TIME_ZONE,
): Promise<AnalyticsBreakdowns> {
  return getBreakdowns(
    { kind: 'workspace', workspaceId: DEFAULT_WORKSPACE_ID },
    range,
    timeZone,
  )
}

async function getBreakdowns(
  scope: BreakdownScope,
  range: DateRange,
  timeZone: string,
): Promise<AnalyticsBreakdowns> {
  const source = analyticsEnv.ANALYTICS_DATA_SOURCE === 'demo' ? 'demo' : 'analytics_engine'

  if (source === 'demo') {
    if (!isLocalDemoAllowed(analyticsEnv.BETTER_AUTH_URL)) {
      console.error('Analytics demo source was rejected outside localhost.')
      return unavailableBreakdowns('demo', range, 'not_configured', 'local_demo')
    }
    return getDemoBreakdowns(scope, range)
  }

  return getCloudflareBreakdowns(scope, range, timeZone)
}

async function getCloudflareBreakdowns(
  scope: BreakdownScope,
  range: DateRange,
  timeZone: string,
): Promise<AnalyticsBreakdowns> {
  const coverage = cloudflareCoverage(range)
  const accountId = analyticsEnv.CLOUDFLARE_ACCOUNT_ID?.trim() ?? ''
  const token = analyticsEnv.ANALYTICS_ENGINE_API_TOKEN?.trim() ?? ''

  if (!isValidAccountId(accountId) || !token) {
    return unavailableBreakdowns(
      'analytics_engine',
      coverage,
      'not_configured',
      '3_months',
    )
  }

  if (!isValidScope(scope) || coverage.from > coverage.to) {
    return readyBreakdowns('analytics_engine', coverage, '3_months', 0, {})
  }

  const where = analyticsWhere(scope, coverage, timeZone)

  try {
    const [totalRows, referrerRows, countryRows, deviceRows] = await Promise.all([
      queryAnalyticsEngine(
        accountId,
        token,
        `SELECT SUM(_sample_interval) AS clicks FROM ${ANALYTICS_DATASET} WHERE ${where}`,
      ),
      queryDimension(accountId, token, ANALYTICS_COLUMNS.referrerDomain, where),
      queryDimension(accountId, token, ANALYTICS_COLUMNS.country, where),
      queryDimension(accountId, token, ANALYTICS_COLUMNS.device, where),
    ])
    const totalClicks = toCount(totalRows[0]?.clicks)

    return readyBreakdowns('analytics_engine', coverage, '3_months', totalClicks, {
      referrers: toBreakdownItems(referrerRows, totalClicks),
      countries: toBreakdownItems(countryRows, totalClicks),
      devices: toBreakdownItems(deviceRows, totalClicks),
    })
  } catch (error) {
    console.error('Analytics Engine breakdown query failed.', safeErrorMessage(error))
    return unavailableBreakdowns(
      'analytics_engine',
      coverage,
      'upstream_error',
      '3_months',
    )
  }
}

async function getDemoBreakdowns(
  scope: BreakdownScope,
  range: DateRange,
): Promise<AnalyticsBreakdowns> {
  const coverage = { ...range, truncated: false }
  if (!isValidScope(scope)) {
    return readyBreakdowns('demo', coverage, 'local_demo', 0, {})
  }

  const filters = demoFilters(scope, range)

  try {
    const [total, referrers, countries, devices] = await Promise.all([
      analyticsEnv.LINKS_DB.prepare(
        `SELECT COALESCE(SUM(MAX(clicks - bot_clicks, 0)), 0) AS clicks
         FROM daily_link_metrics
         WHERE ${filters.where}`,
      )
        .bind(...filters.binds)
        .first<{ clicks: number }>(),
      queryDemoDimension(scope, range, 'referrers_json'),
      queryDemoDimension(scope, range, 'countries_json'),
      queryDemoDimension(scope, range, 'devices_json'),
    ])
    const totalClicks = toCount(total?.clicks)

    return readyBreakdowns('demo', coverage, 'local_demo', totalClicks, {
      referrers: toBreakdownItems(referrers, totalClicks),
      countries: toBreakdownItems(countries, totalClicks),
      devices: toBreakdownItems(devices, totalClicks),
    })
  } catch (error) {
    console.error('Local demo breakdown query failed.', safeErrorMessage(error))
    return unavailableBreakdowns('demo', coverage, 'upstream_error', 'local_demo')
  }
}

async function queryDemoDimension(
  scope: BreakdownScope,
  range: DateRange,
  column: 'referrers_json' | 'countries_json' | 'devices_json',
) {
  const filters = demoFilters(scope, range)
  const { results } = await analyticsEnv.LINKS_DB.prepare(
    `SELECT dimension.key AS value, SUM(CAST(dimension.value AS INTEGER)) AS clicks
     FROM daily_link_metrics,
       json_each(COALESCE(daily_link_metrics.${column}, '{}')) AS dimension
     WHERE ${filters.where}
     GROUP BY dimension.key
     ORDER BY clicks DESC, value ASC
     LIMIT ${TOP_ITEMS}`,
  )
    .bind(...filters.binds)
    .all<AnalyticsRow>()

  return results
}

function queryDimension(
  accountId: string,
  token: string,
  column: string,
  where: string,
) {
  return queryAnalyticsEngine(
    accountId,
    token,
    `SELECT ${column} AS value, SUM(_sample_interval) AS clicks
     FROM ${ANALYTICS_DATASET}
     WHERE ${where}
     GROUP BY value
     ORDER BY clicks DESC, value ASC
     LIMIT ${TOP_ITEMS}`,
  )
}

async function queryAnalyticsEngine(
  accountId: string,
  token: string,
  query: string,
): Promise<AnalyticsRow[]> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'text/plain; charset=utf-8',
      },
      body: query,
      signal: AbortSignal.timeout(ANALYTICS_TIMEOUT_MS),
    },
  )

  if (!response.ok) {
    throw new Error(`Cloudflare SQL API returned ${response.status}.`)
  }

  const payload: unknown = await response.json()
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('Cloudflare SQL API returned an invalid response.')
  }

  return payload.data.filter(isRecord)
}

function analyticsWhere(
  scope: BreakdownScope,
  range: DateRange,
  timeZone: string,
) {
  const bounds = localRangeToUtc(range, timeZone)
  const from = toSqlDateTime(bounds.from)
  const to = toSqlDateTime(bounds.toExclusive)
  const filters = [
    `${ANALYTICS_COLUMNS.workspaceId} = '${escapeSqlString(scope.workspaceId)}'`,
    `${ANALYTICS_COLUMNS.isBot} = 0`,
    `timestamp >= toDateTime('${from}', 'Etc/UTC')`,
    `timestamp < toDateTime('${to}', 'Etc/UTC')`,
  ]
  if (scope.kind === 'link') {
    filters.unshift(
      `${ANALYTICS_COLUMNS.linkId} = '${escapeSqlString(scope.linkId)}'`,
    )
  }
  return filters.join(' AND ')
}

function toSqlDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function demoFilters(scope: BreakdownScope, range: DateRange) {
  const where = ['workspace_id = ?']
  const binds: unknown[] = [scope.workspaceId]
  if (scope.kind === 'link') {
    where.push('link_id = ?')
    binds.push(scope.linkId)
  }
  where.push('metric_date BETWEEN ? AND ?')
  binds.push(range.from, range.to)
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

  return {
    from,
    to,
    truncated: from !== range.from || to !== range.to,
  }
}

function readyBreakdowns(
  source: AnalyticsBreakdowns['source'],
  coverage: DateRange & { truncated: boolean },
  retention: AnalyticsBreakdowns['coverage']['retention'],
  totalClicks: number,
  dimensions: Partial<Record<Dimension, AnalyticsBreakdownItem[]>>,
): AnalyticsBreakdowns {
  return {
    status: 'ready',
    source,
    scope: 'human',
    totalClicks,
    coverage: { ...coverage, retention },
    referrers: dimensions.referrers ?? [],
    countries: dimensions.countries ?? [],
    devices: dimensions.devices ?? [],
  }
}

function unavailableBreakdowns(
  source: AnalyticsBreakdowns['source'],
  range: DateRange & { truncated?: boolean },
  reason: NonNullable<AnalyticsBreakdowns['reason']>,
  retention: AnalyticsBreakdowns['coverage']['retention'],
): AnalyticsBreakdowns {
  return {
    status: 'unavailable',
    reason,
    source,
    scope: 'human',
    totalClicks: 0,
    coverage: {
      from: range.from,
      to: range.to,
      truncated: range.truncated ?? false,
      retention,
    },
    referrers: [],
    countries: [],
    devices: [],
  }
}

function toBreakdownItems(rows: AnalyticsRow[], totalClicks: number) {
  return rows
    .map((row) => ({ value: String(row.value ?? ''), clicks: toCount(row.clicks) }))
    .filter((row) => row.clicks > 0)
    .slice(0, TOP_ITEMS)
    .map((row) => ({
      ...row,
      percentage: totalClicks > 0 ? (row.clicks / totalClicks) * 100 : 0,
    }))
}

function toCount(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0
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

function isValidAccountId(value: string) {
  return /^[a-f0-9]{32}$/i.test(value)
}

function isValidLinkId(value: string) {
  return /^lnk_[a-z0-9_-]{1,80}$/i.test(value)
}

function isValidScope(scope: BreakdownScope) {
  return (
    /^wsp_[a-z0-9_-]{1,80}$/i.test(scope.workspaceId) &&
    (scope.kind === 'workspace' || isValidLinkId(scope.linkId))
  )
}

function escapeSqlString(value: string) {
  return value.replaceAll("'", "''")
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown analytics error.'
}
