import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installCloudflareMocks } from '../../../test/helpers/cloudflare'
import { makeCachedLink } from '../../../test/helpers/factories'
import {
  compareMetric,
  DateRangeValidationError,
  detectBot,
  exportMetricsCsv,
  getAnalyticsOverview,
  getAnalyticsOverviewForRange,
  getLinkAnalytics,
  parseDateRange,
  parseReferrer,
  parseUserAgent,
  parseUtmParams,
  trackClick,
} from '#/lib/analytics/index'

describe('analytics helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00.000Z'))
  })

  it('detects known bots case-insensitively', () => {
    expect(detectBot('Mozilla Googlebot/2.1')).toBe(true)
    expect(detectBot('Slackbot-LinkExpanding')).toBe(true)
    expect(detectBot('Mozilla Safari')).toBe(false)
  })

  it('parses UTM, referrer, and user agent data', () => {
    const url = new URL(
      'https://links.davosdo.dev/railway?utm_source=x&utm_medium=y&utm_campaign=z',
    )
    expect(parseUtmParams(url)).toMatchObject({
      utm_source: 'x',
      utm_medium: 'y',
      utm_campaign: 'z',
      utm_content: '',
      utm_term: '',
    })
    expect(
      parseReferrer(
        new Request(url, { headers: { referer: 'https://google.com/search' } }),
      ),
    ).toEqual({
      referrer: 'https://google.com/search',
      referrer_domain: 'google.com',
    })
    expect(parseReferrer(new Request(url, { headers: { referer: 'bad url' } }))).toEqual(
      { referrer: 'bad url', referrer_domain: '' },
    )
    expect(parseReferrer(new Request(url))).toEqual({
      referrer: '',
      referrer_domain: '',
    })
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit Chrome/120 Safari/537',
      ),
    ).toEqual({ browser: 'Chrome', os: 'macOS', device: 'Desktop' })
    expect(parseUserAgent('Mozilla/5.0 (iPhone) Mobile Safari/605')).toEqual({
      browser: 'Safari',
      os: 'iOS',
      device: 'Mobile',
    })
    expect(parseUserAgent('Mozilla Firefox Windows')).toEqual({
      browser: 'Firefox',
      os: 'Windows',
      device: 'Desktop',
    })
    expect(parseUserAgent('Mozilla Edg/120 Android Mobile')).toEqual({
      browser: 'Edge',
      os: 'Android',
      device: 'Mobile',
    })
    expect(parseUserAgent('Unknown')).toEqual({
      browser: 'Other',
      os: 'Other',
      device: 'Desktop',
    })
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 14; Tablet) Safari')).toEqual({
      browser: 'Safari',
      os: 'Android',
      device: 'Tablet',
    })
    expect(parseUserAgent('')).toEqual({
      browser: 'Other',
      os: 'Other',
      device: 'Unknown',
    })
  })

  it('writes compact click analytics and updates daily aggregates', async () => {
    const mocks = installCloudflareMocks()
    const request = new Request(
      'https://links.davosdo.dev/railway?utm_source=codex',
      {
        headers: {
          'user-agent': 'Googlebot',
          referer: 'https://example.com/a',
          'accept-language': 'en-US,en;q=0.9',
        },
      },
    )

    await trackClick(request, makeCachedLink())

    expect(mocks.analytics.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        indexes: ['lnk_test'],
        doubles: [1, Date.parse('2026-07-07T12:00:00.000Z')],
      }),
    )
    expect(mocks.calls.at(-2)).toMatchObject({
      method: 'run',
      binds: [
        'met_lnk_test_2026-07-07',
        'wsp_default',
        'lnk_test',
        '2026-07-07',
        1,
        expect.any(String),
        expect.any(String),
      ],
    })
    expect(mocks.calls.at(-1)).toMatchObject({
      method: 'run',
      binds: [
        'hrm_lnk_test_2026-07-07T12',
        'wsp_default',
        'lnk_test',
        '2026-07-07T12:00:00.000Z',
        1,
        expect.any(String),
        expect.any(String),
      ],
    })
  })

  it('regroups hourly link metrics into the selected local day', async () => {
    installCloudflareMocks({
      dbResults: [
        { starts_at: '2026-07-01T00:00:00.000Z' },
        [
          {
            metric_hour: '2026-07-06T02:00:00.000Z',
            human_clicks: 6,
            bot_clicks: 1,
          },
        ],
        [],
      ],
    })

    const analytics = await getLinkAnalytics(
      'lnk_test',
      { from: '2026-07-05', to: '2026-07-05' },
      'America/Lima',
    )

    expect(analytics).toMatchObject({
      timezone: 'America/Lima',
      aggregationMode: 'local',
      series: [
        {
          metric_date: '2026-07-05',
          human_clicks: 6,
          bot_clicks: 1,
        },
      ],
    })
  })

  it('returns a range-scoped overview with human metrics and a real ranking', async () => {
    const mocks = installCloudflareMocks({
      dbResults: [
        [
          { metric_date: '2026-06-08', human_clicks: 4, bot_clicks: 2 },
          { metric_date: '2026-07-07', human_clicks: -3, bot_clicks: -1 },
        ],
        [{ metric_date: '2026-06-07', human_clicks: 0, bot_clicks: 1 }],
        { human_clicks: 7, bot_clicks: 2, links_with_activity: 2 },
        { human_clicks: 0, bot_clicks: 1, links_with_activity: 0 },
        { active_links: 4 },
        [
          {
            id: 'lnk_beta',
            title: 'Beta',
            short_path: 'beta',
            current_human_clicks: 5,
            previous_human_clicks: 0,
          },
          {
            id: 'lnk_alpha',
            title: 'Alpha',
            short_path: 'alpha',
            current_human_clicks: 2,
            previous_human_clicks: 2,
          },
        ],
        [
          {
            id: 'cmp_launch',
            label: 'Lanzamiento',
            current_clicks: 7,
            previous_clicks: 2,
          },
        ],
        [
          {
            id: 'tag_product',
            label: 'Producto',
            current_clicks: 5,
            previous_clicks: 0,
          },
        ],
      ],
    })

    const overview = await getAnalyticsOverview()
    expect(overview).toMatchObject({
      timezone: 'UTC',
      totals: {
        humanClicks: 7,
        botClicks: 2,
        linksWithActivity: 2,
        averageDailyHumanClicks: 7 / 30,
      },
      previousTotals: {
        humanClicks: 0,
        botClicks: 1,
        linksWithActivity: 0,
        averageDailyHumanClicks: 0,
      },
      activeLinksNow: 4,
      comparison: {
        humanClicks: {
          status: 'new',
          absolute: 7,
          percent: null,
          trend: 'up',
        },
      },
      range: { from: '2026-06-08', to: '2026-07-07' },
      previousRange: { from: '2026-05-09', to: '2026-06-07' },
      topLinks: [
        {
          id: 'lnk_beta',
          shortPath: 'beta',
          humanClicks: 5,
          sharePercent: (5 / 7) * 100,
          delta: { status: 'new', percent: null },
        },
        {
          id: 'lnk_alpha',
          shortPath: 'alpha',
          humanClicks: 2,
          sharePercent: (2 / 7) * 100,
          delta: { status: 'comparable', absolute: 0, percent: 0 },
        },
      ],
      categoryPerformance: {
        campaigns: [
          {
            id: 'cmp_launch',
            label: 'Lanzamiento',
            currentClicks: 7,
            previousClicks: 2,
          },
        ],
        tags: [
          {
            id: 'tag_product',
            label: 'Producto',
            currentClicks: 5,
            previousClicks: 0,
          },
        ],
      },
    })
    expect(overview.series).toHaveLength(30)
    expect(overview.previousSeries).toHaveLength(30)
    expect(overview.series[0]).toEqual({
      metric_date: '2026-06-08',
      human_clicks: 4,
      bot_clicks: 2,
    })
    expect(overview.series.at(-1)).toEqual({
      metric_date: '2026-07-07',
      human_clicks: 0,
      bot_clicks: 0,
    })

    const topLinksCall = mocks.calls.find((call) =>
      call.sql.includes('WITH current_metrics AS'),
    )
    expect(topLinksCall?.binds).toEqual([
      'wsp_default',
      '2026-06-08',
      '2026-07-07',
      'wsp_default',
      '2026-05-09',
      '2026-06-07',
      'wsp_default',
    ])
    expect(topLinksCall?.sql).toContain('current_metrics.current_human_clicks DESC')
    expect(topLinksCall?.sql).toContain('LOWER(links.title) ASC')
    expect(topLinksCall?.sql).toContain('links.id ASC')
  })

  it('keeps historical ranges independent from the current date and fills seven dates', async () => {
    const mocks = installCloudflareMocks({
      dbResults: [
        [{ metric_date: '2025-01-03', human_clicks: 6, bot_clicks: 1 }],
        [],
        { human_clicks: 6, bot_clicks: 1, links_with_activity: 1 },
        { human_clicks: 0, bot_clicks: 0, links_with_activity: 0 },
        { active_links: 2 },
        [],
      ],
    })

    const overview = await getAnalyticsOverviewForRange({
      from: '2025-01-01',
      to: '2025-01-07',
    })

    expect(overview.series).toHaveLength(7)
    expect(overview.series[2]).toEqual({
      metric_date: '2025-01-03',
      human_clicks: 6,
      bot_clicks: 1,
    })
    expect(overview.totals.averageDailyHumanClicks).toBeCloseTo(6 / 7)
    expect(overview.previousRange).toEqual({
      from: '2024-12-25',
      to: '2024-12-31',
    })
    expect(mocks.calls.every((call) => !call.sql.includes("date('now'"))).toBe(true)
  })

  it.each([
    ['7d', '2026-07-01', '2026-07-07', 7],
    ['30d', '2026-06-08', '2026-07-07', 30],
    ['90d', '2026-04-09', '2026-07-07', 90],
    ['custom', '2026-02-01', '2026-02-14', 14],
  ])('parses a valid %s inclusive range', (_label, from, to, days) => {
    const range = parseDateRange(
      new URL(`https://links.davosdo.dev/api/analytics/overview?from=${from}&to=${to}`),
    )
    expect(range).toEqual({ from, to })
    const duration =
      (Date.parse(`${range.to}T00:00:00.000Z`) -
        Date.parse(`${range.from}T00:00:00.000Z`)) /
        86_400_000 +
      1
    expect(duration).toBe(days)
  })

  it('rejects partial, malformed, inverted, future, and oversized ranges', () => {
    const parse = (query: string) =>
      parseDateRange(new URL(`https://links.davosdo.dev/api/analytics/overview?${query}`))

    expect(() => parse('from=2026-07-01')).toThrow(DateRangeValidationError)
    expect(() => parse('from=2026-02-31&to=2026-03-01')).toThrow(
      'La fecha inicial no es válida.',
    )
    expect(() => parse('from=2026-07-07&to=2026-07-01')).toThrow(
      'La fecha inicial no puede ser posterior',
    )
    expect(() => parse('from=2026-07-01&to=2026-07-08')).toThrow(
      'El rango no puede incluir fechas futuras.',
    )
    expect(() => parse('from=2025-07-06&to=2026-07-07')).toThrow(
      'El rango no puede superar 366 días.',
    )
  })

  it('represents zero comparison bases without inventing 100 percent', () => {
    expect(compareMetric(8, 0)).toEqual({
      status: 'new',
      absolute: 8,
      percent: null,
      trend: 'up',
    })
    expect(compareMetric(0, 0)).toEqual({
      status: 'no-baseline',
      absolute: 0,
      percent: null,
      trend: 'flat',
    })
    expect(compareMetric(5, 10)).toEqual({
      status: 'comparable',
      absolute: -5,
      percent: -50,
      trend: 'down',
    })
  })

  it('keeps raw CSV clicks and adds explicit human clicks', async () => {
    installCloudflareMocks({
      dbResults: [
        [
          {
            metric_date: '2026-07-07',
            link_id: 'lnk_test',
            title: 'Railway',
            short_path: 'railway',
            domain: 'links.davosdo.dev',
            clicks: 10,
            human_clicks: 7,
            bot_clicks: 3,
            unique_visitors: 5,
          },
        ],
      ],
    })

    const csv = await exportMetricsCsv({ from: '2026-07-01', to: '2026-07-07' })
    expect(csv.split('\n')[0]).toBe(
      'date,link_id,title,short_url,clicks,human_clicks,bot_clicks,unique_visitors',
    )
    expect(csv).toContain(',10,7,3,5')
  })

  it('uses human clicks consistently in link analytics and exposes UTC scope', async () => {
    installCloudflareMocks({
      dbResults: [
        [{ metric_date: '2026-07-07', clicks: 2, bot_clicks: 0 }],
        [{ metric_date: '2026-06-07', clicks: 5, bot_clicks: 1 }],
      ],
    })

    const linkAnalytics = await getLinkAnalytics('lnk_test')
    expect(linkAnalytics).toMatchObject({
      comparison: {
        currentClicks: 2,
        previousClicks: 4,
        delta: -2,
        deltaPercent: -50,
        trend: 'down',
      },
      range: { from: '2026-06-08', to: '2026-07-07' },
      previousRange: { from: '2026-05-09', to: '2026-06-07' },
      scope: 'human',
      timezone: 'UTC',
      breakdowns: {
        status: 'unavailable',
        reason: 'not_configured',
        source: 'analytics_engine',
      },
    })
    expect(linkAnalytics.series).toHaveLength(30)
    expect(linkAnalytics.series.at(-1)).toEqual({
      metric_date: '2026-07-07',
      clicks: 2,
      human_clicks: 2,
      bot_clicks: 0,
      recorded_clicks: 2,
    })
  })

  it('does not report negative human clicks or invent a comparison percent', async () => {
    installCloudflareMocks({
      dbResults: [
        [{ metric_date: '2026-07-07', clicks: 1, bot_clicks: 3 }],
        [{ metric_date: '2026-06-07', clicks: 0, bot_clicks: 0 }],
      ],
    })

    const linkAnalytics = await getLinkAnalytics('lnk_test')
    expect(linkAnalytics.series.at(-1)).toMatchObject({
      clicks: 0,
      human_clicks: 0,
      bot_clicks: 3,
      recorded_clicks: 1,
    })
    expect(linkAnalytics.comparison).toMatchObject({
      currentClicks: 0,
      previousClicks: 0,
      delta: 0,
      deltaPercent: null,
    })
  })
})
