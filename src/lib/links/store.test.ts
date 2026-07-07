import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installCloudflareMocks } from '../../../test/helpers/cloudflare'
import { makeCachedLink, makeLinkRow } from '../../../test/helpers/factories'
import {
  archiveLink,
  checkPath,
  createLink,
  deleteLink,
  getLink,
  listLinks,
  resolveLink,
  toggleLinkStatus,
  updateLink,
} from './store'

describe('link store', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
  })

  it('lists and gets links after ensuring default workspace', async () => {
    const link = makeLinkRow()
    const mocks = installCloudflareMocks({
      dbResults: [[link], link],
    })

    await expect(listLinks()).resolves.toEqual([link])
    await expect(getLink('lnk_test')).resolves.toEqual(link)
    expect(mocks.calls.filter((call) => call.method === 'all')).toHaveLength(1)
    expect(mocks.calls.filter((call) => call.method === 'first')).toHaveLength(1)
  })

  it('checks path availability and validation errors', async () => {
    installCloudflareMocks({ dbResults: [null, { id: 'lnk_existing' }] })
    await expect(checkPath('railway')).resolves.toEqual({
      available: true,
      path: 'railway',
    })
    await expect(checkPath('github')).resolves.toEqual({
      available: false,
      path: 'github',
    })
    await expect(checkPath('dashboard')).resolves.toMatchObject({
      available: false,
      error: 'This path is reserved.',
    })
  })

  it('creates links with normalized input and defaults', async () => {
    const created = makeLinkRow({
      id: 'lnk_00000000-0000-4000-8000-000000000001',
      title: 'railway.com',
      short_path: 'railway',
      short_path_normalized: 'railway',
    })
    const mocks = installCloudflareMocks({ dbResults: [null, created] })

    const result = await createLink({
      destinationUrl: 'https://railway.com',
      shortPath: 'Railway',
      redirectType: 999,
    })

    expect(result).toEqual({ ok: true, data: created })
    const insert = mocks.calls.find((call) => call.sql.includes('INSERT INTO links'))
    expect(insert?.binds.slice(0, 10)).toEqual([
      'lnk_00000000-0000-4000-8000-000000000001',
      'wsp_default',
      'dom_links_davosdo_dev',
      'railway.com',
      null,
      'https://railway.com/',
      'railway',
      'railway',
      302,
      1,
    ])
  })

  it('generates random slugs when no custom path is provided', async () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      const bytes = array as Uint8Array
      bytes.fill(0)
      return array
    })
    const created = makeLinkRow({
      short_path: 'aaaaaa',
      short_path_normalized: 'aaaaaa',
    })
    installCloudflareMocks({ dbResults: [null, null, created] })

    await expect(createLink({ destinationUrl: 'https://example.com' })).resolves.toEqual({
      ok: true,
      data: created,
    })
  })

  it('throws when random slug generation cannot find an available path', async () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      const bytes = array as Uint8Array
      bytes.fill(0)
      return array
    })
    installCloudflareMocks({
      dbResults: Array.from({ length: 8 }, () => ({ id: 'lnk_existing' })),
    })

    await expect(createLink({ destinationUrl: 'https://example.com' })).rejects.toThrow(
      'Could not generate a unique slug.',
    )
  })

  it('rejects invalid, reserved, and duplicate paths on create', async () => {
    installCloudflareMocks({ dbResults: [{ id: 'lnk_existing' }] })

    await expect(
      createLink({ destinationUrl: 'javascript:alert(1)', shortPath: 'x' }),
    ).resolves.toMatchObject({ ok: false, error: 'Enter a valid http or https URL.' })
    await expect(
      createLink({ destinationUrl: 'https://example.com', shortPath: 'api' }),
    ).resolves.toMatchObject({ ok: false, field: 'shortPath' })
    await expect(
      createLink({ destinationUrl: 'https://example.com', shortPath: 'taken' }),
    ).resolves.toMatchObject({
      ok: false,
      error: 'That path is already in use.',
      field: 'shortPath',
    })
  })

  it('updates links and invalidates KV cache', async () => {
    const original = makeLinkRow()
    const updated = makeLinkRow({ title: 'Updated', preserve_query_params: 0 })
    const mocks = installCloudflareMocks({ dbResults: [original, updated] })

    await expect(
      updateLink('lnk_test', {
        title: 'Updated',
        destinationUrl: 'https://example.com',
        preserveQueryParams: false,
      }),
    ).resolves.toEqual({ ok: true, data: updated })

    expect(mocks.kv.delete).toHaveBeenCalledWith('link:links.davosdo.dev:railway')
  })

  it('rejects invalid destination updates and skips cache invalidation without a host', async () => {
    const link = makeLinkRow({ domain: undefined })
    const mocks = installCloudflareMocks({ dbResults: [link, link, link] })

    await expect(
      updateLink('lnk_test', { destinationUrl: 'data:text/plain,bad' }),
    ).resolves.toEqual({ ok: false, error: 'Enter a valid http or https URL.' })
    await expect(updateLink('lnk_test', { title: '' })).resolves.toEqual({
      ok: true,
      data: link,
    })
    expect(mocks.kv.delete).not.toHaveBeenCalled()
  })

  it('returns not found for update/delete/status changes when link is missing', async () => {
    installCloudflareMocks({ dbResults: [null, null, null] })
    await expect(updateLink('missing', {})).resolves.toEqual({
      ok: false,
      error: 'Link not found.',
    })
    await expect(deleteLink('missing')).resolves.toEqual({
      ok: false,
      error: 'Link not found.',
    })
    await expect(toggleLinkStatus('missing', 'inactive')).resolves.toEqual({
      ok: false,
      error: 'Link not found.',
    })
  })

  it('changes status, archives, and soft deletes links', async () => {
    const link = makeLinkRow()
    const inactive = makeLinkRow({ status: 'inactive' })
    const archived = makeLinkRow({ status: 'archived' })
    const mocks = installCloudflareMocks({
      dbResults: [link, inactive, link, archived, link],
    })

    await expect(toggleLinkStatus('lnk_test', 'inactive')).resolves.toEqual({
      ok: true,
      data: inactive,
    })
    await expect(archiveLink('lnk_test')).resolves.toEqual({
      ok: true,
      data: archived,
    })
    await expect(deleteLink('lnk_test')).resolves.toEqual({
      ok: true,
      data: { id: 'lnk_test' },
    })
    expect(mocks.kv.delete).toHaveBeenCalledTimes(3)
  })

  it('resolves links from KV cache first', async () => {
    const cached = makeCachedLink()
    const mocks = installCloudflareMocks({
      kvInitial: new Map([['link:links.davosdo.dev:railway', cached]]),
    })

    await expect(resolveLink('links.davosdo.dev', '/Railway/')).resolves.toEqual({
      link: cached,
      cacheStatus: 'hit',
    })
    expect(mocks.db.prepare).not.toHaveBeenCalled()
  })

  it('resolves links from D1 on cache miss and refreshes KV', async () => {
    const link = makeCachedLink()
    const mocks = installCloudflareMocks({ dbResults: [link] })

    await expect(resolveLink('links.davosdo.dev', 'railway')).resolves.toEqual({
      link,
      cacheStatus: 'miss',
    })
    expect(mocks.kv.put).toHaveBeenCalledWith(
      'link:links.davosdo.dev:railway',
      JSON.stringify(link),
      { expirationTtl: 600 },
    )
  })

  it('returns null when D1 cannot resolve the link', async () => {
    installCloudflareMocks({ dbResults: [null] })
    await expect(resolveLink('links.davosdo.dev', 'missing')).resolves.toEqual({
      link: null,
      cacheStatus: 'miss',
    })
  })
})
