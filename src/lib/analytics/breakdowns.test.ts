import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installCloudflareMocks } from '../../../test/helpers/cloudflare'
import { setCloudflareEnv } from '../../../test/mocks/cloudflare-workers'
import {
  ANALYTICS_COLUMNS,
  getGlobalTrafficBreakdowns,
  getTrafficBreakdowns,
} from '#/lib/analytics/breakdowns'

describe('traffic breakdowns', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00.000Z'))
    setCloudflareEnv({
      ANALYTICS_DATA_SOURCE: 'cloudflare',
      ANALYTICS_ENGINE_API_TOKEN: undefined,
      BETTER_AUTH_URL: 'https://links.davosdo.dev',
      CLOUDFLARE_ACCOUNT_ID: undefined,
    })
  })

  it('queries sampled human totals and top dimensions from Analytics Engine', async () => {
    installCloudflareMocks()
    setCloudflareEnv({
      ANALYTICS_ENGINE_API_TOKEN: 'read-token',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
    })
    const queries: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const query = String(init?.body ?? '')
        queries.push(query)
        if (!query.includes('GROUP BY')) {
          return Response.json({ data: [{ clicks: 40 }] })
        }
        if (query.includes(ANALYTICS_COLUMNS.referrerDomain)) {
          return Response.json({ data: [{ value: 'google.com', clicks: 16 }] })
        }
        if (query.includes(ANALYTICS_COLUMNS.country)) {
          return Response.json({ data: [{ value: 'PE', clicks: 20 }] })
        }
        return Response.json({ data: [{ value: 'Mobile', clicks: 24 }] })
      }),
    )

    const breakdowns = await getTrafficBreakdowns('lnk_test', {
      from: '2026-03-01',
      to: '2026-08-01',
    })

    expect(breakdowns).toMatchObject({
      status: 'ready',
      source: 'analytics_engine',
      scope: 'human',
      totalClicks: 40,
      coverage: {
        from: '2026-04-07',
        to: '2026-07-07',
        truncated: true,
        retention: '3_months',
      },
      referrers: [{ value: 'google.com', clicks: 16, percentage: 40 }],
      countries: [{ value: 'PE', clicks: 20, percentage: 50 }],
      devices: [{ value: 'Mobile', clicks: 24, percentage: 60 }],
    })
    expect(queries).toHaveLength(4)
    expect(queries.every((query) => query.includes('double1 = 0'))).toBe(true)
    expect(queries.every((query) => query.includes("index1 = 'lnk_test'"))).toBe(true)
    expect(queries.every((query) => query.includes("blob2 = 'wsp_default'"))).toBe(true)
    expect(queries.every((query) => query.includes('_sample_interval'))).toBe(true)
  })

  it('aggregates all Analytics Engine events in the workspace for global breakdowns', async () => {
    installCloudflareMocks()
    setCloudflareEnv({
      ANALYTICS_ENGINE_API_TOKEN: 'read-token',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
    })
    const queries: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const query = String(init?.body ?? '')
        queries.push(query)
        return Response.json({ data: [{ clicks: 10, value: 'PE' }] })
      }),
    )

    const breakdowns = await getGlobalTrafficBreakdowns({
      from: '2026-07-01',
      to: '2026-07-07',
    })

    expect(breakdowns).toMatchObject({
      status: 'ready',
      source: 'analytics_engine',
      totalClicks: 10,
    })
    expect(queries).toHaveLength(4)
    expect(queries.every((query) => query.includes("blob2 = 'wsp_default'"))).toBe(true)
    expect(queries.every((query) => !query.includes('index1 ='))).toBe(true)
    expect(queries.every((query) => query.includes('double1 = 0'))).toBe(true)
  })

  it('returns a safe unavailable state when Cloudflare is not configured or fails', async () => {
    installCloudflareMocks()
    await expect(
      getTrafficBreakdowns('lnk_test', { from: '2026-07-01', to: '2026-07-07' }),
    ).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'not_configured',
      source: 'analytics_engine',
    })

    setCloudflareEnv({
      ANALYTICS_ENGINE_API_TOKEN: 'read-token',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))

    await expect(
      getTrafficBreakdowns('lnk_test', { from: '2026-07-01', to: '2026-07-07' }),
    ).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'upstream_error',
    })
  })

  it('aggregates seeded D1 dimensions only when demo mode is local', async () => {
    installCloudflareMocks({
      dbResults: [
        { clicks: 50 },
        [
          { value: 'google.com', clicks: 20 },
          { value: '', clicks: 15 },
        ],
        [{ value: 'PE', clicks: 25 }],
        [{ value: 'Desktop', clicks: 30 }],
      ],
    })
    setCloudflareEnv({
      ANALYTICS_DATA_SOURCE: 'demo',
      BETTER_AUTH_URL: 'http://localhost:3000',
    })

    const breakdowns = await getTrafficBreakdowns('lnk_demo_launch', {
      from: '2026-07-01',
      to: '2026-07-07',
    })

    expect(breakdowns).toMatchObject({
      status: 'ready',
      source: 'demo',
      totalClicks: 50,
      coverage: { retention: 'local_demo', truncated: false },
      referrers: [
        { value: 'google.com', percentage: 40 },
        { value: '', percentage: 30 },
      ],
      countries: [{ value: 'PE', percentage: 50 }],
      devices: [{ value: 'Desktop', percentage: 60 }],
    })

    setCloudflareEnv({ BETTER_AUTH_URL: 'https://links.davosdo.dev' })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(
      getTrafficBreakdowns('lnk_demo_launch', {
        from: '2026-07-01',
        to: '2026-07-07',
      }),
    ).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'not_configured',
      source: 'demo',
    })
  })

  it('aggregates demo dimensions across every link in the workspace', async () => {
    const mocks = installCloudflareMocks({
      dbResults: [
        { clicks: 80 },
        [{ value: 'direct', clicks: 32 }],
        [{ value: 'PE', clicks: 40 }],
        [{ value: 'Mobile', clicks: 48 }],
      ],
    })
    setCloudflareEnv({
      ANALYTICS_DATA_SOURCE: 'demo',
      BETTER_AUTH_URL: 'http://localhost:3000',
    })

    const breakdowns = await getGlobalTrafficBreakdowns({
      from: '2026-07-01',
      to: '2026-07-07',
    })

    expect(breakdowns).toMatchObject({
      status: 'ready',
      totalClicks: 80,
      referrers: [{ value: 'direct', percentage: 40 }],
      countries: [{ value: 'PE', percentage: 50 }],
      devices: [{ value: 'Mobile', percentage: 60 }],
    })
    expect(mocks.calls).toHaveLength(4)
    expect(mocks.calls.every((call) => !call.sql.includes('link_id = ?'))).toBe(true)
    expect(
      mocks.calls.every(
        (call) =>
          JSON.stringify(call.binds) ===
          JSON.stringify(['wsp_default', '2026-07-01', '2026-07-07']),
      ),
    ).toBe(true)
  })
})
