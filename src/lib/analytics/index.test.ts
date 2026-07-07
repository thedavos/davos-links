import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installCloudflareMocks } from '../../../test/helpers/cloudflare'
import { makeCachedLink } from '../../../test/helpers/factories'
import {
  detectBot,
  getAnalyticsOverview,
  getLinkAnalytics,
  parseReferrer,
  parseUserAgent,
  parseUtmParams,
  trackClick,
} from './index'

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
    expect(mocks.calls.at(-1)).toMatchObject({
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
  })

  it('returns overview and link analytics from D1 aggregate rows', async () => {
    installCloudflareMocks({
      dbResults: [
        [{ metric_date: '2026-07-07', clicks: 3, bot_clicks: 1 }],
        { total_clicks: 10, clicks_7d: 7, clicks_30d: 9 },
        { active_links: 4 },
        [{ metric_date: '2026-07-07', clicks: 2, bot_clicks: 0 }],
      ],
    })

    await expect(getAnalyticsOverview()).resolves.toEqual({
      totals: { totalClicks: 10, clicks7d: 7, clicks30d: 9, activeLinks: 4 },
      series: [{ metric_date: '2026-07-07', clicks: 3, bot_clicks: 1 }],
      range: { from: '2026-06-08', to: '2026-07-07' },
    })
    await expect(getLinkAnalytics('lnk_test')).resolves.toEqual({
      series: [{ metric_date: '2026-07-07', clicks: 2, bot_clicks: 0 }],
      range: { from: '2026-06-08', to: '2026-07-07' },
    })
  })
})
