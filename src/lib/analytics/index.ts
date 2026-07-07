import { env } from 'cloudflare:workers'
import { DEFAULT_WORKSPACE_ID } from '../constants'
import type { CachedLink } from '../types'

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
  const browser = lower.includes('firefox')
    ? 'Firefox'
    : lower.includes('edg/')
      ? 'Edge'
      : lower.includes('chrome')
        ? 'Chrome'
        : lower.includes('safari')
          ? 'Safari'
          : 'Other'
  const os = lower.includes('mac os')
    ? 'macOS'
    : lower.includes('windows')
      ? 'Windows'
      : lower.includes('android')
        ? 'Android'
        : lower.includes('iphone') || lower.includes('ipad')
          ? 'iOS'
          : 'Other'
  const device =
    lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')
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

  env.ANALYTICS.writeDataPoint({
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
  await env.DB.prepare(
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

export async function getAnalyticsOverviewForRange(range: DateRange) {
  const { results } = await env.DB.prepare(
    `SELECT metric_date, SUM(clicks) AS clicks, SUM(bot_clicks) AS bot_clicks
     FROM daily_link_metrics
     WHERE workspace_id = ? AND metric_date BETWEEN ? AND ?
     GROUP BY metric_date
     ORDER BY metric_date ASC`,
  )
    .bind(DEFAULT_WORKSPACE_ID, range.from, range.to)
    .all<{ metric_date: string; clicks: number; bot_clicks: number }>()

  const totals = await env.DB.prepare(
    `SELECT
      COALESCE(SUM(clicks), 0) AS total_clicks,
      COALESCE(SUM(CASE WHEN metric_date >= date('now', '-7 days') THEN clicks ELSE 0 END), 0) AS clicks_7d,
      COALESCE(SUM(CASE WHEN metric_date >= date('now', '-30 days') THEN clicks ELSE 0 END), 0) AS clicks_30d
     FROM daily_link_metrics
     WHERE workspace_id = ? AND metric_date BETWEEN ? AND ?`,
  )
    .bind(DEFAULT_WORKSPACE_ID, range.from, range.to)
    .first<{ total_clicks: number; clicks_7d: number; clicks_30d: number }>()

  const activeLinks = await env.DB.prepare(
    `SELECT COUNT(*) AS active_links FROM links
     WHERE workspace_id = ? AND status = 'active' AND deleted_at IS NULL`,
  )
    .bind(DEFAULT_WORKSPACE_ID)
    .first<{ active_links: number }>()

  return {
    totals: {
      totalClicks: totals?.total_clicks ?? 0,
      clicks7d: totals?.clicks_7d ?? 0,
      clicks30d: totals?.clicks_30d ?? 0,
      activeLinks: activeLinks?.active_links ?? 0,
    },
    series: results,
    range,
  }
}

export async function getLinkAnalytics(linkId: string, range = defaultRange()) {
  const { results } = await env.DB.prepare(
    `SELECT metric_date, clicks, bot_clicks
     FROM daily_link_metrics
     WHERE workspace_id = ?
       AND link_id = ?
       AND metric_date BETWEEN ? AND ?
     ORDER BY metric_date ASC
     LIMIT 366`,
  )
    .bind(DEFAULT_WORKSPACE_ID, linkId, range.from, range.to)
    .all<{ metric_date: string; clicks: number; bot_clicks: number }>()

  return { series: results, range }
}

export async function exportMetricsCsv(range: DateRange, linkId?: string | null) {
  const where = [
    'daily_link_metrics.workspace_id = ?',
    'daily_link_metrics.metric_date BETWEEN ? AND ?',
  ]
  const binds: unknown[] = [DEFAULT_WORKSPACE_ID, range.from, range.to]

  if (linkId) {
    where.push('daily_link_metrics.link_id = ?')
    binds.push(linkId)
  }

  const { results } = await env.DB.prepare(
    `SELECT
      daily_link_metrics.metric_date,
      links.id AS link_id,
      links.title,
      links.short_path,
      domains.domain,
      daily_link_metrics.clicks,
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
      'bot_clicks',
      'unique_visitors',
    ],
    ...results.map((row) => [
      row.metric_date,
      row.link_id,
      row.title,
      `https://${row.domain}/${row.short_path}`,
      String(row.clicks),
      String(row.bot_clicks),
      String(row.unique_visitors),
    ]),
  ])
}

export type DateRange = {
  from: string
  to: string
}

export function parseDateRange(url: URL): DateRange {
  const fallback = defaultRange()
  const range = {
    from: validDate(url.searchParams.get('from')) ?? fallback.from,
    to: validDate(url.searchParams.get('to')) ?? fallback.to,
  }
  return range.from <= range.to ? range : { from: range.to, to: range.from }
}

function defaultRange(): DateRange {
  const to = new Date()
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 29)
  return { from: toDateString(from), to: toDateString(to) }
}

function validDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) ? null : value
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
