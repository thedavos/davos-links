import { describe, expect, it, vi } from 'vitest'
import { getCampaignsHandler, postCampaignsHandler } from '#/routes/api/campaigns'
import {
  deleteCampaignHandler,
  getCampaignHandler,
  patchCampaignHandler,
} from '#/routes/api/campaigns/$id'
import {
  getLinkCampaignsHandler,
  putLinkCampaignsHandler,
} from '#/routes/api/links/$id/campaigns'
import {
  getLinkTagsHandler,
  putLinkTagsHandler,
} from '#/routes/api/links/$id/tags'
import { getTagsHandler, postTagsHandler } from '#/routes/api/tags'
import {
  deleteTagHandler,
  getTagHandler,
  patchTagHandler,
} from '#/routes/api/tags/$id'
import type { CampaignRow, TagRow } from '#/lib/types'
import { makeLinkRow } from '../helpers/factories'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(async () => ({ id: 'usr_test' })),
  listTags: vi.fn(),
  createTag: vi.fn(),
  getTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  listCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  getCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  getLink: vi.fn(),
  setLinkTags: vi.fn(),
  setLinkCampaigns: vi.fn(),
}))

vi.mock('../../src/lib/auth/server', () => ({
  requireUser: mocks.requireUser,
}))

vi.mock('../../src/lib/links/store', () => ({
  listTags: mocks.listTags,
  createTag: mocks.createTag,
  getTag: mocks.getTag,
  updateTag: mocks.updateTag,
  deleteTag: mocks.deleteTag,
  listCampaigns: mocks.listCampaigns,
  createCampaign: mocks.createCampaign,
  getCampaign: mocks.getCampaign,
  updateCampaign: mocks.updateCampaign,
  deleteCampaign: mocks.deleteCampaign,
  getLink: mocks.getLink,
  setLinkTags: mocks.setLinkTags,
  setLinkCampaigns: mocks.setLinkCampaigns,
}))

describe('tag and campaign API handlers', () => {
  it('lists and creates tags', async () => {
    const tag = makeTag()
    mocks.listTags.mockResolvedValue([tag])
    mocks.createTag.mockResolvedValueOnce({ ok: true, data: tag })
    mocks.createTag.mockResolvedValueOnce({ ok: false, error: 'bad' })

    expect(await (await getTagsHandler(new Request('https://x'))).json()).toEqual({
      tags: [tag],
    })

    const request = new Request('https://x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Launch' }),
    })
    const clonedRequest = () =>
      request.clone() as unknown as Parameters<typeof postTagsHandler>[0]
    expect((await postTagsHandler(clonedRequest())).status).toBe(201)
    expect((await postTagsHandler(clonedRequest())).status).toBe(400)
  })

  it('gets, updates, and deletes tags', async () => {
    const tag = makeTag()
    mocks.getTag.mockResolvedValueOnce(tag).mockResolvedValueOnce(null)
    mocks.updateTag.mockResolvedValue({ ok: true, data: tag })
    mocks.deleteTag.mockResolvedValue({ ok: true, data: { id: 'tag_1' } })

    expect(await (await getTagHandler(new Request('https://x'), 'tag_1')).json()).toEqual({
      tag,
    })
    expect((await getTagHandler(new Request('https://x'), 'missing')).status).toBe(404)
    expect(
      (
        await patchTagHandler(
          new Request('https://x', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ color: '#111111' }),
          }),
          'tag_1',
        )
      ).status,
    ).toBe(200)
    expect((await deleteTagHandler(new Request('https://x'), 'tag_1')).status).toBe(200)
  })

  it('lists and creates campaigns', async () => {
    const campaign = makeCampaign()
    mocks.listCampaigns.mockResolvedValue([campaign])
    mocks.createCampaign.mockResolvedValueOnce({ ok: true, data: campaign })

    expect(
      await (await getCampaignsHandler(new Request('https://x'))).json(),
    ).toEqual({ campaigns: [campaign] })
    expect(
      (
        await postCampaignsHandler(
          new Request('https://x', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'Q3' }),
          }),
        )
      ).status,
    ).toBe(201)
  })

  it('gets, updates, and archives campaigns', async () => {
    const campaign = makeCampaign()
    mocks.getCampaign.mockResolvedValue(campaign)
    mocks.updateCampaign.mockResolvedValue({ ok: false, error: 'bad' })
    mocks.deleteCampaign.mockResolvedValue({ ok: true, data: { id: 'cmp_1' } })

    expect(
      await (await getCampaignHandler(new Request('https://x'), 'cmp_1')).json(),
    ).toEqual({ campaign })
    expect(
      (
        await patchCampaignHandler(
          new Request('https://x', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: '' }),
          }),
          'cmp_1',
        )
      ).status,
    ).toBe(400)
    expect(
      (await deleteCampaignHandler(new Request('https://x'), 'cmp_1')).status,
    ).toBe(200)
  })

  it('gets and replaces link tag and campaign assignments', async () => {
    const tag = makeTag()
    const campaign = makeCampaign()
    mocks.getLink.mockResolvedValueOnce(makeLinkRow({ tags: [tag] }))
    mocks.getLink.mockResolvedValueOnce(makeLinkRow({ campaigns: [campaign] }))
    mocks.setLinkTags.mockResolvedValue({ ok: true, data: makeLinkRow({ tags: [tag] }) })
    mocks.setLinkCampaigns.mockResolvedValue({
      ok: true,
      data: makeLinkRow({ campaigns: [campaign] }),
    })

    expect(await (await getLinkTagsHandler(new Request('https://x'), 'lnk')).json()).toEqual({
      tags: [tag],
    })
    expect(
      await (await getLinkCampaignsHandler(new Request('https://x'), 'lnk')).json(),
    ).toEqual({ campaigns: [campaign] })

    expect(
      (
        await putLinkTagsHandler(
          new Request('https://x', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ tagIds: ['tag_1'] }),
          }),
          'lnk',
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await putLinkCampaignsHandler(
          new Request('https://x', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ campaignIds: ['cmp_1'] }),
          }),
          'lnk',
        )
      ).status,
    ).toBe(200)
  })
})

function makeTag(overrides: Partial<TagRow> = {}): TagRow {
  return {
    id: 'tag_1',
    workspace_id: 'wsp_default',
    name: 'Launch',
    slug: 'launch',
    color: null,
    created_at: '2026-07-07T00:00:00.000Z',
    updated_at: '2026-07-07T00:00:00.000Z',
    ...overrides,
  }
}

function makeCampaign(overrides: Partial<CampaignRow> = {}): CampaignRow {
  return {
    id: 'cmp_1',
    workspace_id: 'wsp_default',
    name: 'Q3',
    slug: 'q3',
    description: null,
    starts_at: null,
    ends_at: null,
    created_at: '2026-07-07T00:00:00.000Z',
    updated_at: '2026-07-07T00:00:00.000Z',
    archived_at: null,
    ...overrides,
  }
}
