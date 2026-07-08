import { describe, expect, it, vi } from 'vitest'
import { getLinksHandler, postLinksHandler } from '#/routes/api/links'
import { makeLinkRow } from '../helpers/factories'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(async () => ({ id: 'usr_test' })),
  listLinks: vi.fn(),
  createLink: vi.fn(),
}))

vi.mock('../../src/lib/auth/server', () => ({
  requireUser: mocks.requireUser,
}))

vi.mock('../../src/lib/links/store', () => ({
  listLinks: mocks.listLinks,
  createLink: mocks.createLink,
}))

describe('/api/links handlers', () => {
  it('returns links for authenticated users', async () => {
    const link = makeLinkRow()
    mocks.listLinks.mockResolvedValue([link])
    const response = await getLinksHandler(new Request('https://links.davosdo.dev/api/links'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ links: [link] })
    expect(mocks.requireUser).toHaveBeenCalled()
  })

  it('creates links and maps failures to 400', async () => {
    mocks.createLink.mockResolvedValueOnce({ ok: true, data: { id: 'lnk_test' } })
    mocks.createLink.mockResolvedValueOnce({ ok: false, error: 'Invalid' })
    const request = new Request('https://links.davosdo.dev/api/links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ destinationUrl: 'https://example.com' }),
    })

    const clonedRequest = () =>
      request.clone() as unknown as Parameters<typeof postLinksHandler>[0]

    expect((await postLinksHandler(clonedRequest())).status).toBe(201)
    expect((await postLinksHandler(clonedRequest())).status).toBe(400)
  })
})
