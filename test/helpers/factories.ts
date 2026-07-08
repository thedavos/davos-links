import type { CachedLink, LinkRow } from '#/lib/types'

export function makeCachedLink(overrides: Partial<CachedLink> = {}): CachedLink {
  return {
    id: 'lnk_test',
    workspace_id: 'wsp_default',
    domain_id: 'dom_links_davosdo_dev',
    domain: 'links.davosdo.dev',
    title: 'Railway',
    destination_url: 'https://railway.com?referralCode=david',
    short_path: 'railway',
    short_path_normalized: 'railway',
    redirect_type: 302,
    status: 'active',
    preserve_query_params: 1,
    expires_at: null,
    fallback_url: null,
    ...overrides,
  }
}

export function makeLinkRow(overrides: Partial<LinkRow> = {}): LinkRow {
  return {
    ...makeCachedLink(),
    description: null,
    created_at: '2026-07-07T00:00:00.000Z',
    updated_at: '2026-07-07T00:00:00.000Z',
    deleted_at: null,
    clicks: 0,
    tags: [],
    campaigns: [],
    ...overrides,
  }
}
