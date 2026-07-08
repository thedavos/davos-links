import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeCachedLink } from '../../../test/helpers/factories'
import { handlePublicRedirect } from '#/lib/redirect/handler'

const mocks = vi.hoisted(() => ({
  resolveLink: vi.fn(),
  trackClick: vi.fn(async () => undefined),
}))

vi.mock('../links/store', () => ({
  resolveLink: mocks.resolveLink,
}))

vi.mock('../analytics', () => ({
  trackClick: mocks.trackClick,
}))

describe('handlePublicRedirect', () => {
  beforeEach(() => {
    mocks.resolveLink.mockReset()
    mocks.trackClick.mockClear()
  })

  it('does not resolve reserved or empty paths', async () => {
    const dashboard = await handlePublicRedirect(
      new Request('https://links.davosdo.dev/dashboard'),
    )
    const empty = await handlePublicRedirect(new Request('https://links.davosdo.dev/'))

    expect(dashboard.status).toBe(404)
    expect(empty.status).toBe(404)
    expect(mocks.resolveLink).not.toHaveBeenCalled()
  })

  it('returns a 404 page for missing links', async () => {
    mocks.resolveLink.mockResolvedValue({ link: null, cacheStatus: 'miss' })
    const response = await handlePublicRedirect(
      new Request('https://links.davosdo.dev/railway'),
    )
    expect(response.status).toBe(404)
    expect(await response.text()).toContain('No existe un enlace configurado para /railway')
  })

  it('returns disabled and expired pages when links cannot redirect', async () => {
    mocks.resolveLink.mockResolvedValueOnce({
      link: makeCachedLink({ status: 'inactive' }),
    })
    expect(
      await (
        await handlePublicRedirect(new Request('https://links.davosdo.dev/railway'))
      ).text(),
    ).toContain('Link disabled')

    mocks.resolveLink.mockResolvedValueOnce({
      link: makeCachedLink({ expires_at: '2020-01-01T00:00:00.000Z' }),
    })
    expect(
      await (
        await handlePublicRedirect(new Request('https://links.davosdo.dev/railway'))
      ).text(),
    ).toContain('Link expired')
  })

  it('redirects expired links to fallback when present', async () => {
    mocks.resolveLink.mockResolvedValue({
      link: makeCachedLink({
        expires_at: '2020-01-01T00:00:00.000Z',
        fallback_url: 'https://fallback.example',
        redirect_type: 307,
      }),
    })
    const response = await handlePublicRedirect(
      new Request('https://links.davosdo.dev/railway'),
    )
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://fallback.example/')
  })

  it('redirects active links, merges query params, and tracks without blocking', async () => {
    const link = makeCachedLink()
    const waitUntil = vi.fn()
    mocks.resolveLink.mockResolvedValue({ link, cacheStatus: 'hit' })

    const response = await handlePublicRedirect(
      new Request('https://links.davosdo.dev/railway?utm_source=codex'),
      { waitUntil } as unknown as ExecutionContext,
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'https://railway.com/?referralCode=david&utm_source=codex',
    )
    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise))
    expect(mocks.trackClick).toHaveBeenCalledWith(expect.any(Request), link)
  })

  it('tracks active redirects when an execution context is unavailable', async () => {
    const link = makeCachedLink()
    mocks.resolveLink.mockResolvedValue({ link, cacheStatus: 'hit' })

    const response = await handlePublicRedirect(
      new Request('https://links.davosdo.dev/railway'),
    )

    expect(response.status).toBe(302)
    expect(mocks.trackClick).toHaveBeenCalledWith(expect.any(Request), link)
  })

  it('preserves destination query exactly when preserve query params is off', async () => {
    mocks.resolveLink.mockResolvedValue({
      link: makeCachedLink({ preserve_query_params: 0 }),
      cacheStatus: 'miss',
    })
    const response = await handlePublicRedirect(
      new Request('https://links.davosdo.dev/railway?utm_source=codex'),
    )
    expect(response.headers.get('location')).toBe(
      'https://railway.com/?referralCode=david',
    )
  })
})
