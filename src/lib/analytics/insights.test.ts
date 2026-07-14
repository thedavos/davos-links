import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installCloudflareMocks } from '../../../test/helpers/cloudflare'
import { setCloudflareEnv } from '../../../test/mocks/cloudflare-workers'
import { ANALYTICS_COLUMNS } from '#/lib/analytics/breakdowns'
import {
  getGlobalClickHeatmap,
  getLinkClickHeatmap,
  getLinkUtmPerformance,
} from '#/lib/analytics/insights'

describe('analytics insights', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'))
    setCloudflareEnv({
      ANALYTICS_DATA_SOURCE: 'cloudflare',
      ANALYTICS_ENGINE_API_TOKEN: undefined,
      BETTER_AUTH_URL: 'https://links.davosdo.dev',
      CLOUDFLARE_ACCOUNT_ID: undefined,
    })
  })

  it('builds a complete UTC heatmap from sampled human events', async () => {
    installCloudflareMocks()
    setCloudflareEnv({
      ANALYTICS_ENGINE_API_TOKEN: 'read-token',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
    })
    const queries: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_input, init?: RequestInit) => {
      queries.push(String(init?.body ?? ''))
      return Response.json({ data: [{ day: 1, hour: 9, clicks: 7 }] })
    }))

    const heatmap = await getGlobalClickHeatmap({
      from: '2026-07-01',
      to: '2026-07-14',
    })

    expect(heatmap).toMatchObject({
      status: 'ready',
      totalClicks: 7,
      coverage: { truncated: false },
    })
    expect(heatmap.cells).toHaveLength(168)
    expect(heatmap.cells.find((cell) => cell.day === 1 && cell.hour === 9)?.clicks).toBe(7)
    expect(heatmap.cells.find((cell) => cell.day === 7 && cell.hour === 23)?.clicks).toBe(0)
    expect(queries[0]).toContain("formatDateTime(timestamp, '%Y-%m-%d %H:%i:%S', 'UTC')")
    expect(queries[0]).not.toContain("formatDateTime(timestamp, '%Y-%m-%d %H:%M:%S'")
    expect(queries[0]).toContain('toDayOfWeek(')
    expect(queries[0]).toContain('toHour(')
    expect(queries[0]).toContain(`${ANALYTICS_COLUMNS.isBot} = 0`)
    expect(queries[0]).toContain("blob2 = 'wsp_default'")
  })

  it('compares the top non-empty UTM values for one link', async () => {
    installCloudflareMocks()
    setCloudflareEnv({
      ANALYTICS_ENGINE_API_TOKEN: 'read-token',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
    })
    const queries: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_input, init?: RequestInit) => {
      const query = String(init?.body ?? '')
      queries.push(query)
      if (!query.includes('GROUP BY value')) return Response.json({ data: [{ clicks: 20 }] })
      const value = query.includes(ANALYTICS_COLUMNS.utmCampaign)
        ? 'lanzamiento'
        : query.includes(ANALYTICS_COLUMNS.utmSource)
          ? 'newsletter'
          : 'email'
      return Response.json({
        data: [{ value, current_clicks: 8, previous_clicks: 4 }],
      })
    }))

    const utm = await getLinkUtmPerformance(
      'lnk_test',
      { from: '2026-07-08', to: '2026-07-14' },
      { from: '2026-07-01', to: '2026-07-07' },
    )

    expect(utm).toMatchObject({
      status: 'ready',
      totalClicks: 20,
      campaigns: [{ value: 'lanzamiento', currentClicks: 8, previousClicks: 4, sharePercent: 40 }],
      sources: [{ value: 'newsletter' }],
      mediums: [{ value: 'email' }],
    })
    expect(queries).toHaveLength(4)
    expect(queries.slice(1).every((query) => query.includes("index1 = 'lnk_test'"))).toBe(true)
    expect(queries.slice(1).every((query) => query.includes("!= ''"))).toBe(true)
    expect(queries.slice(1).every((query) => query.includes('SUM(if('))).toBe(true)
  })

  it('keeps heatmap and UTM failures isolated as unavailable states', async () => {
    installCloudflareMocks()
    await expect(
      getLinkClickHeatmap('lnk_test', { from: '2026-07-01', to: '2026-07-14' }),
    ).resolves.toMatchObject({ status: 'unavailable', reason: 'not_configured' })
    await expect(
      getLinkUtmPerformance(
        'lnk_test',
        { from: '2026-07-08', to: '2026-07-14' },
        { from: '2026-07-01', to: '2026-07-07' },
      ),
    ).resolves.toMatchObject({ status: 'unavailable', reason: 'not_configured' })
  })

  it('reads deterministic demo slices for heatmap and UTM panels', async () => {
    installCloudflareMocks({
      dbResults: [
        [{ day: 2, hour: 14, clicks: 12 }],
        { clicks: 20 },
        [{ value: 'lanzamiento-q3', current_clicks: 10, previous_clicks: 5 }],
        [{ value: 'newsletter', current_clicks: 10, previous_clicks: 5 }],
        [{ value: 'email', current_clicks: 10, previous_clicks: 5 }],
      ],
    })
    setCloudflareEnv({
      ANALYTICS_DATA_SOURCE: 'demo',
      BETTER_AUTH_URL: 'http://localhost:3000',
    })

    const heatmap = await getLinkClickHeatmap('lnk_test', {
      from: '2026-07-08',
      to: '2026-07-14',
    })
    const utm = await getLinkUtmPerformance(
      'lnk_test',
      { from: '2026-07-08', to: '2026-07-14' },
      { from: '2026-07-01', to: '2026-07-07' },
    )

    expect(heatmap).toMatchObject({ status: 'ready', source: 'demo', totalClicks: 12 })
    expect(utm).toMatchObject({
      status: 'ready',
      source: 'demo',
      campaigns: [{ value: 'lanzamiento-q3', sharePercent: 50 }],
    })
  })
})
