import { describe, expect, it, vi } from 'vitest'
import { analyticsOverviewHandler } from '#/routes/api/analytics/overview'
import { analyticsExportCsvHandler } from '#/routes/api/analytics/export[.]csv'
import {
  deleteLinkHandler,
  getLinkHandler,
  patchLinkHandler,
} from '#/routes/api/links/$id'
import { archiveLinkHandler } from '#/routes/api/links/$id/archive'
import { disableLinkHandler } from '#/routes/api/links/$id/disable'
import { linkAnalyticsHandler } from '#/routes/api/links/$id/analytics'
import { checkPathHandler } from '#/routes/api/links/check-path'
import { makeLinkRow } from '../helpers/factories'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(async () => ({ id: 'usr_test' })),
  getLink: vi.fn(),
  updateLink: vi.fn(),
  deleteLink: vi.fn(),
  archiveLink: vi.fn(),
  toggleLinkStatus: vi.fn(),
  checkPath: vi.fn(),
  getLinkAnalytics: vi.fn(),
  getAnalyticsOverview: vi.fn(),
  exportMetricsCsv: vi.fn(),
  parseDateRange: vi.fn(() => ({ from: '2026-07-01', to: '2026-07-07' })),
  isDateRangeValidationError: vi.fn(
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      error.code === 'invalid_date_range',
  ),
}))

vi.mock('../../src/lib/auth/server', () => ({
  requireUser: mocks.requireUser,
}))

vi.mock('../../src/lib/links/store', () => ({
  getLink: mocks.getLink,
  updateLink: mocks.updateLink,
  deleteLink: mocks.deleteLink,
  archiveLink: mocks.archiveLink,
  toggleLinkStatus: mocks.toggleLinkStatus,
  checkPath: mocks.checkPath,
}))

vi.mock('../../src/lib/analytics', () => ({
  getLinkAnalytics: mocks.getLinkAnalytics,
  getAnalyticsOverviewForRange: mocks.getAnalyticsOverview,
  exportMetricsCsv: mocks.exportMetricsCsv,
  parseDateRange: mocks.parseDateRange,
  isDateRangeValidationError: mocks.isDateRangeValidationError,
}))

describe('link detail API handlers', () => {
  it('returns link detail or 404', async () => {
    const link = makeLinkRow()
    mocks.getLink.mockResolvedValueOnce(link).mockResolvedValueOnce(null)
    expect(await (await getLinkHandler(new Request('https://x'), 'lnk')).json()).toEqual({
      link,
    })
    expect((await getLinkHandler(new Request('https://x'), 'missing')).status).toBe(404)
  })

  it('patches and deletes links with status mapping', async () => {
    mocks.updateLink.mockResolvedValue({ ok: false, error: 'bad' })
    mocks.deleteLink.mockResolvedValue({ ok: true, data: { id: 'lnk' } })
    const patch = new Request('https://x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    })
    expect((await patchLinkHandler(patch, 'lnk')).status).toBe(400)
    expect((await deleteLinkHandler(new Request('https://x'), 'lnk')).status).toBe(200)
  })

  it('archives, disables, checks paths, and returns analytics', async () => {
    mocks.archiveLink.mockResolvedValue({
      ok: true,
      data: makeLinkRow({ status: 'archived' }),
    })
    mocks.toggleLinkStatus.mockResolvedValue({
      ok: true,
      data: makeLinkRow({ status: 'inactive' }),
    })
    mocks.checkPath.mockResolvedValue({ available: true, path: 'railway' })
    mocks.getLinkAnalytics.mockResolvedValue({ series: [{ clicks: 1 }] })
    mocks.getAnalyticsOverview.mockResolvedValue({ totals: {}, series: [] })

    expect((await archiveLinkHandler(new Request('https://x'), 'lnk')).status).toBe(200)
    expect((await disableLinkHandler(new Request('https://x'), 'lnk')).status).toBe(200)
    expect(
      await (
        await checkPathHandler(
          new Request('https://links.davosdo.dev/api/links/check-path?path=Railway'),
        )
      ).json(),
    ).toEqual({ available: true, path: 'railway' })
    expect(await (await linkAnalyticsHandler(new Request('https://x'), 'lnk')).json()).toEqual({
      series: [{ clicks: 1 }],
    })
    expect(await (await analyticsOverviewHandler(new Request('https://x'))).json()).toEqual({
      totals: {},
      series: [],
    })
  })

  it('returns analytics CSV exports with attachment headers', async () => {
    mocks.exportMetricsCsv.mockResolvedValue('date,clicks\n2026-07-07,1')

    const response = await analyticsExportCsvHandler(
      new Request('https://x/api/analytics/export.csv?from=2026-07-07&to=2026-07-01'),
    )

    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toContain(
      'davos-links-analytics.csv',
    )
    expect(await response.text()).toBe('date,clicks\n2026-07-07,1')
    expect(mocks.exportMetricsCsv).toHaveBeenCalledWith(
      { from: '2026-07-01', to: '2026-07-07' },
      null,
    )
  })

  it('returns a clear 400 response for invalid analytics ranges', async () => {
    const rangeError = Object.assign(new Error('El rango no es válido.'), {
      code: 'invalid_date_range',
      field: 'range',
    })
    mocks.parseDateRange.mockImplementationOnce(() => {
      throw rangeError
    })

    const response = await analyticsOverviewHandler(
      new Request(
        'https://x/api/analytics/overview?from=2026-07-07&to=2026-07-01',
      ),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      code: 'invalid_date_range',
      error: 'El rango no es válido.',
      field: 'range',
    })
  })
})
