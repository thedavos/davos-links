import { env } from 'cloudflare:workers'
import {
  CACHE_TTL_SECONDS,
  DEFAULT_DOMAIN_ID,
  DEFAULT_WORKSPACE_ID,
} from '#/lib/constants'
import type { CachedLink, CampaignRow, LinkFilters, LinkRow, TagRow } from '#/lib/types'
import {
  generateRandomSlug,
  isValidDestinationUrl,
  normalizeDestinationUrl,
  normalizeShortPath,
  validateShortPath,
} from '#/lib/validation/links'
import { ensureDefaultWorkspace } from '#/lib/db/seed'

type LinkInput = {
  title?: string
  description?: string
  destinationUrl: string
  shortPath?: string
  redirectType?: number
  preserveQueryParams?: boolean
  expiresAt?: string | null
  fallbackUrl?: string | null
}

type LinkDbRow = LinkRow & {
  tags_json?: string | null
  campaigns_json?: string | null
}

type TagInput = {
  name?: string
  slug?: string
  color?: string | null
}

type CampaignInput = {
  name?: string
  slug?: string
  description?: string | null
  startsAt?: string | null
  endsAt?: string | null
}

export async function listLinks(filters: LinkFilters = {}) {
  await ensureDefaultWorkspace(env.LINKS_DB)
  const where = ['links.workspace_id = ?', 'links.deleted_at IS NULL']
  const binds: unknown[] = [DEFAULT_WORKSPACE_ID]

  if (filters.q?.trim()) {
    const query = `%${filters.q.trim().toLowerCase()}%`
    where.push(
      `(lower(links.title) LIKE ? OR lower(links.destination_url) LIKE ? OR lower(links.short_path) LIKE ?)`,
    )
    binds.push(query, query, query)
  }

  if (isLinkStatus(filters.status)) {
    where.push('links.status = ?')
    binds.push(filters.status)
  }

  if (filters.createdFrom && isDateString(filters.createdFrom)) {
    where.push('date(links.created_at) >= date(?)')
    binds.push(filters.createdFrom)
  }

  if (filters.createdTo && isDateString(filters.createdTo)) {
    where.push('date(links.created_at) <= date(?)')
    binds.push(filters.createdTo)
  }

  if (filters.tagId?.trim()) {
    where.push(
      `EXISTS (
        SELECT 1 FROM link_tags
        WHERE link_tags.link_id = links.id AND link_tags.tag_id = ?
      )`,
    )
    binds.push(filters.tagId.trim())
  }

  if (filters.campaignId?.trim()) {
    where.push(
      `EXISTS (
        SELECT 1 FROM campaign_links
        WHERE campaign_links.link_id = links.id AND campaign_links.campaign_id = ?
      )`,
    )
    binds.push(filters.campaignId.trim())
  }

  const limit = normalizeLimit(filters.limit)
  const offset = Math.max(0, Math.trunc(filters.offset ?? 0))

  const { results } = await env.LINKS_DB.prepare(
    `SELECT links.*, domains.domain, COALESCE(SUM(daily_link_metrics.clicks), 0) AS clicks,
      (
        SELECT COALESCE(json_group_array(json_object(
          'id', tags.id,
          'workspace_id', tags.workspace_id,
          'name', tags.name,
          'slug', tags.slug,
          'color', tags.color,
          'created_at', tags.created_at,
          'updated_at', tags.updated_at
        )), '[]')
        FROM link_tags
        JOIN tags ON tags.id = link_tags.tag_id
        WHERE link_tags.link_id = links.id
      ) AS tags_json,
      (
        SELECT COALESCE(json_group_array(json_object(
          'id', campaigns.id,
          'workspace_id', campaigns.workspace_id,
          'name', campaigns.name,
          'slug', campaigns.slug,
          'description', campaigns.description,
          'starts_at', campaigns.starts_at,
          'ends_at', campaigns.ends_at,
          'created_at', campaigns.created_at,
          'updated_at', campaigns.updated_at,
          'archived_at', campaigns.archived_at
        )), '[]')
        FROM campaign_links
        JOIN campaigns ON campaigns.id = campaign_links.campaign_id
        WHERE campaign_links.link_id = links.id AND campaigns.archived_at IS NULL
      ) AS campaigns_json
     FROM links
     JOIN domains ON domains.id = links.domain_id
     LEFT JOIN daily_link_metrics ON daily_link_metrics.link_id = links.id
     WHERE ${where.join(' AND ')}
     GROUP BY links.id
     ORDER BY links.created_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(...binds, limit, offset)
    .all<LinkDbRow>()
  return results.map(hydrateLinkRow)
}

export async function getLink(id: string) {
  await ensureDefaultWorkspace(env.LINKS_DB)
  const row = await env.LINKS_DB.prepare(
    `SELECT links.*, domains.domain, COALESCE(SUM(daily_link_metrics.clicks), 0) AS clicks,
      (
        SELECT COALESCE(json_group_array(json_object(
          'id', tags.id,
          'workspace_id', tags.workspace_id,
          'name', tags.name,
          'slug', tags.slug,
          'color', tags.color,
          'created_at', tags.created_at,
          'updated_at', tags.updated_at
        )), '[]')
        FROM link_tags
        JOIN tags ON tags.id = link_tags.tag_id
        WHERE link_tags.link_id = links.id
      ) AS tags_json,
      (
        SELECT COALESCE(json_group_array(json_object(
          'id', campaigns.id,
          'workspace_id', campaigns.workspace_id,
          'name', campaigns.name,
          'slug', campaigns.slug,
          'description', campaigns.description,
          'starts_at', campaigns.starts_at,
          'ends_at', campaigns.ends_at,
          'created_at', campaigns.created_at,
          'updated_at', campaigns.updated_at,
          'archived_at', campaigns.archived_at
        )), '[]')
        FROM campaign_links
        JOIN campaigns ON campaigns.id = campaign_links.campaign_id
        WHERE campaign_links.link_id = links.id AND campaigns.archived_at IS NULL
      ) AS campaigns_json
     FROM links
     JOIN domains ON domains.id = links.domain_id
     LEFT JOIN daily_link_metrics ON daily_link_metrics.link_id = links.id
     WHERE links.id = ? AND links.workspace_id = ? AND links.deleted_at IS NULL
     GROUP BY links.id`,
  )
    .bind(id, DEFAULT_WORKSPACE_ID)
    .first<LinkDbRow>()
  return row ? hydrateLinkRow(row) : null
}

export async function checkPath(shortPath: string) {
  const validation = validateShortPath(shortPath)
  if (!validation.ok) return { available: false, error: validation.error }

  const existing = await env.LINKS_DB.prepare(
    `SELECT id FROM links
     WHERE domain_id = ? AND short_path_normalized = ? AND deleted_at IS NULL`,
  )
    .bind(DEFAULT_DOMAIN_ID, validation.path)
    .first<{ id: string }>()

  return { available: !existing, path: validation.path }
}

export async function createLink(input: LinkInput) {
  await ensureDefaultWorkspace(env.LINKS_DB)
  if (!isValidDestinationUrl(input.destinationUrl)) {
    return { ok: false as const, error: 'Enter a valid http or https URL.' }
  }

  const shortPath = input.shortPath?.trim()
    ? normalizeShortPath(input.shortPath)
    : await generateUniqueSlug()
  const validation = validateShortPath(shortPath)
  if (!validation.ok) {
    return { ok: false as const, error: validation.error, field: 'shortPath' }
  }

  const availability = await checkPath(validation.path)
  if (!availability.available) {
    return {
      ok: false as const,
      error: availability.error ?? 'That path is already in use.',
      field: 'shortPath',
    }
  }

  const now = new Date().toISOString()
  const destination = normalizeDestinationUrl(input.destinationUrl)
  const id = `lnk_${crypto.randomUUID()}`
  const title = input.title?.trim() || new URL(destination).hostname
  const redirectType = normalizeRedirectType(input.redirectType)

  await env.LINKS_DB.prepare(
    `INSERT INTO links (
      id, workspace_id, domain_id, title, description, destination_url,
      short_path, short_path_normalized, redirect_type, status,
      preserve_query_params, expires_at, fallback_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      DEFAULT_WORKSPACE_ID,
      DEFAULT_DOMAIN_ID,
      title,
      input.description?.trim() || null,
      destination,
      validation.path,
      validation.path,
      redirectType,
      input.preserveQueryParams === false ? 0 : 1,
      input.expiresAt || null,
      input.fallbackUrl || null,
      now,
      now,
    )
    .run()

  const link = await getLink(id)
  return { ok: true as const, data: link }
}

export async function updateLink(id: string, input: Partial<LinkInput>) {
  const link = await getLink(id)
  if (!link) return { ok: false as const, error: 'Link not found.' }

  if (
    input.destinationUrl !== undefined &&
    !isValidDestinationUrl(input.destinationUrl)
  ) {
    return { ok: false as const, error: 'Enter a valid http or https URL.' }
  }

  let nextShortPath = link.short_path
  let nextShortPathNormalized = link.short_path_normalized

  if (input.shortPath !== undefined) {
    const validation = validateShortPath(input.shortPath)
    if (!validation.ok) {
      return { ok: false as const, error: validation.error, field: 'shortPath' }
    }

    const existing = await env.LINKS_DB.prepare(
      `SELECT id FROM links
       WHERE domain_id = ? AND short_path_normalized = ? AND deleted_at IS NULL AND id != ?`,
    )
      .bind(DEFAULT_DOMAIN_ID, validation.path, id)
      .first<{ id: string }>()

    if (existing) {
      return {
        ok: false as const,
        error: 'That path is already in use.',
        field: 'shortPath',
      }
    }

    nextShortPath = validation.path
    nextShortPathNormalized = validation.path
  }

  const now = new Date().toISOString()
  await env.LINKS_DB.prepare(
    `UPDATE links SET
      title = ?,
      description = ?,
      destination_url = ?,
      short_path = ?,
      short_path_normalized = ?,
      redirect_type = ?,
      preserve_query_params = ?,
      expires_at = ?,
      fallback_url = ?,
      updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
  )
    .bind(
      input.title?.trim() || link.title,
      input.description?.trim() ?? link.description,
      input.destinationUrl
        ? normalizeDestinationUrl(input.destinationUrl)
        : link.destination_url,
      nextShortPath,
      nextShortPathNormalized,
      normalizeRedirectType(input.redirectType ?? link.redirect_type),
      input.preserveQueryParams === undefined
        ? link.preserve_query_params
        : input.preserveQueryParams
          ? 1
          : 0,
      input.expiresAt === undefined ? link.expires_at : input.expiresAt,
      input.fallbackUrl === undefined ? link.fallback_url : input.fallbackUrl,
      now,
      id,
      DEFAULT_WORKSPACE_ID,
    )
    .run()

  await invalidateLinkCache(link.domain ?? '', link.short_path_normalized)
  if (nextShortPathNormalized !== link.short_path_normalized) {
    await invalidateLinkCache(link.domain ?? '', nextShortPathNormalized)
  }
  return { ok: true as const, data: await getLink(id) }
}

export async function listTags() {
  await ensureDefaultWorkspace(env.LINKS_DB)
  const { results } = await env.LINKS_DB.prepare(
    `SELECT tags.*, COUNT(link_tags.link_id) AS link_count
     FROM tags
     LEFT JOIN link_tags ON link_tags.tag_id = tags.id
     WHERE tags.workspace_id = ?
     GROUP BY tags.id
     ORDER BY tags.name ASC`,
  )
    .bind(DEFAULT_WORKSPACE_ID)
    .all<TagRow>()
  return results
}

export async function createTag(input: TagInput) {
  await ensureDefaultWorkspace(env.LINKS_DB)
  const name = input.name?.trim()
  if (!name) return { ok: false as const, error: 'Tag name is required.', field: 'name' }

  const slug = slugify(input.slug || name)
  if (!slug) return { ok: false as const, error: 'Tag slug is required.', field: 'slug' }
  const color = normalizeHexColor(input.color)
  if (color === false) {
    return { ok: false as const, error: 'Use a 6-digit hex color.', field: 'color' }
  }
  const now = new Date().toISOString()
  const id = `tag_${crypto.randomUUID()}`
  const existing = await env.LINKS_DB.prepare(
    `SELECT id FROM tags WHERE workspace_id = ? AND slug = ?`,
  )
    .bind(DEFAULT_WORKSPACE_ID, slug)
    .first<{ id: string }>()
  if (existing) return { ok: false as const, error: 'That tag already exists.' }

  await env.LINKS_DB.prepare(
    `INSERT INTO tags (id, workspace_id, name, slug, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, DEFAULT_WORKSPACE_ID, name, slug, color, now, now)
    .run()

  return { ok: true as const, data: await getTag(id) }
}

export async function updateTag(id: string, input: TagInput) {
  const tag = await getTag(id)
  if (!tag) return { ok: false as const, error: 'Tag not found.' }
  const name = input.name?.trim() || tag.name
  const slug = slugify(input.slug || name)
  if (!slug) return { ok: false as const, error: 'Tag slug is required.', field: 'slug' }
  const color =
    input.color === undefined ? tag.color : normalizeHexColor(input.color)
  if (color === false) {
    return { ok: false as const, error: 'Use a 6-digit hex color.', field: 'color' }
  }
  const existing = await env.LINKS_DB.prepare(
    `SELECT id FROM tags WHERE workspace_id = ? AND slug = ? AND id != ?`,
  )
    .bind(DEFAULT_WORKSPACE_ID, slug, id)
    .first<{ id: string }>()
  if (existing) return { ok: false as const, error: 'That tag already exists.' }

  await env.LINKS_DB.prepare(
    `UPDATE tags SET name = ?, slug = ?, color = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
  )
    .bind(
      name,
      slug,
      color,
      new Date().toISOString(),
      id,
      DEFAULT_WORKSPACE_ID,
    )
    .run()
  return { ok: true as const, data: await getTag(id) }
}

export async function deleteTag(id: string) {
  const tag = await getTag(id)
  if (!tag) return { ok: false as const, error: 'Tag not found.' }
  await env.LINKS_DB.prepare(`DELETE FROM link_tags WHERE tag_id = ?`).bind(id).run()
  await env.LINKS_DB.prepare(`DELETE FROM tags WHERE id = ? AND workspace_id = ?`)
    .bind(id, DEFAULT_WORKSPACE_ID)
    .run()
  return { ok: true as const, data: { id } }
}

export async function setLinkTags(id: string, tagIds: string[]) {
  const link = await getLink(id)
  if (!link) return { ok: false as const, error: 'Link not found.' }
  const uniqueIds = uniqueStrings(tagIds)
  const tags = await listTagsByIds(uniqueIds)
  if (tags.length !== uniqueIds.length) {
    return { ok: false as const, error: 'One or more tags were not found.' }
  }
  await env.LINKS_DB.prepare(`DELETE FROM link_tags WHERE link_id = ?`).bind(id).run()
  const now = new Date().toISOString()
  for (const tagId of uniqueIds) {
    await env.LINKS_DB.prepare(
      `INSERT OR IGNORE INTO link_tags (link_id, tag_id, workspace_id, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(id, tagId, DEFAULT_WORKSPACE_ID, now)
      .run()
  }
  return { ok: true as const, data: await getLink(id) }
}

export async function listCampaigns() {
  await ensureDefaultWorkspace(env.LINKS_DB)
  const { results } = await env.LINKS_DB.prepare(
    `SELECT campaigns.*, COUNT(campaign_links.link_id) AS link_count
     FROM campaigns
     LEFT JOIN campaign_links ON campaign_links.campaign_id = campaigns.id
     WHERE campaigns.workspace_id = ? AND campaigns.archived_at IS NULL
     GROUP BY campaigns.id
     ORDER BY campaigns.created_at DESC`,
  )
    .bind(DEFAULT_WORKSPACE_ID)
    .all<CampaignRow>()
  return results
}

export async function createCampaign(input: CampaignInput) {
  await ensureDefaultWorkspace(env.LINKS_DB)
  const name = input.name?.trim()
  if (!name) return { ok: false as const, error: 'Campaign name is required.', field: 'name' }

  const slug = slugify(input.slug || name)
  if (!slug) {
    return { ok: false as const, error: 'Campaign slug is required.', field: 'slug' }
  }
  const now = new Date().toISOString()
  const id = `cam_${crypto.randomUUID()}`
  const existing = await env.LINKS_DB.prepare(
    `SELECT id FROM campaigns WHERE workspace_id = ? AND slug = ? AND archived_at IS NULL`,
  )
    .bind(DEFAULT_WORKSPACE_ID, slug)
    .first<{ id: string }>()
  if (existing) return { ok: false as const, error: 'That campaign already exists.' }

  await env.LINKS_DB.prepare(
    `INSERT INTO campaigns (
      id, workspace_id, name, slug, description, starts_at, ends_at,
      created_at, updated_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  )
    .bind(
      id,
      DEFAULT_WORKSPACE_ID,
      name,
      slug,
      input.description?.trim() || null,
      input.startsAt || null,
      input.endsAt || null,
      now,
      now,
    )
    .run()

  return { ok: true as const, data: await getCampaign(id) }
}

export async function updateCampaign(id: string, input: CampaignInput) {
  const campaign = await getCampaign(id)
  if (!campaign) return { ok: false as const, error: 'Campaign not found.' }
  const name = input.name?.trim() || campaign.name
  const slug = slugify(input.slug || name)
  if (!slug) {
    return { ok: false as const, error: 'Campaign slug is required.', field: 'slug' }
  }
  const existing = await env.LINKS_DB.prepare(
    `SELECT id FROM campaigns
     WHERE workspace_id = ? AND slug = ? AND archived_at IS NULL AND id != ?`,
  )
    .bind(DEFAULT_WORKSPACE_ID, slug, id)
    .first<{ id: string }>()
  if (existing) return { ok: false as const, error: 'That campaign already exists.' }

  await env.LINKS_DB.prepare(
    `UPDATE campaigns SET
      name = ?,
      slug = ?,
      description = ?,
      starts_at = ?,
      ends_at = ?,
      updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
  )
    .bind(
      name,
      slug,
      input.description === undefined
        ? campaign.description
        : input.description?.trim() || null,
      input.startsAt === undefined ? campaign.starts_at : input.startsAt,
      input.endsAt === undefined ? campaign.ends_at : input.endsAt,
      new Date().toISOString(),
      id,
      DEFAULT_WORKSPACE_ID,
    )
    .run()

  return { ok: true as const, data: await getCampaign(id) }
}

export async function deleteCampaign(id: string) {
  const campaign = await getCampaign(id)
  if (!campaign) return { ok: false as const, error: 'Campaign not found.' }
  await env.LINKS_DB.prepare(
    `UPDATE campaigns SET archived_at = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
  )
    .bind(new Date().toISOString(), new Date().toISOString(), id, DEFAULT_WORKSPACE_ID)
    .run()
  return { ok: true as const, data: { id } }
}

export async function setLinkCampaigns(id: string, campaignIds: string[]) {
  const link = await getLink(id)
  if (!link) return { ok: false as const, error: 'Link not found.' }
  const uniqueIds = uniqueStrings(campaignIds)
  const campaigns = await listCampaignsByIds(uniqueIds)
  if (campaigns.length !== uniqueIds.length) {
    return { ok: false as const, error: 'One or more campaigns were not found.' }
  }
  await env.LINKS_DB.prepare(`DELETE FROM campaign_links WHERE link_id = ?`).bind(id).run()
  const now = new Date().toISOString()
  for (const campaignId of uniqueIds) {
    await env.LINKS_DB.prepare(
      `INSERT OR IGNORE INTO campaign_links (
        campaign_id, link_id, workspace_id, created_at
      ) VALUES (?, ?, ?, ?)`,
    )
      .bind(campaignId, id, DEFAULT_WORKSPACE_ID, now)
      .run()
  }
  return { ok: true as const, data: await getLink(id) }
}

export async function toggleLinkStatus(id: string, status: 'active' | 'inactive') {
  return setLinkStatus(id, status)
}

export async function archiveLink(id: string) {
  return setLinkStatus(id, 'archived')
}

export async function deleteLink(id: string) {
  const link = await getLink(id)
  if (!link) return { ok: false as const, error: 'Link not found.' }
  await env.LINKS_DB.prepare(
    `UPDATE links SET deleted_at = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(new Date().toISOString(), new Date().toISOString(), id)
    .run()
  await invalidateLinkCache(link.domain ?? '', link.short_path_normalized)
  return { ok: true as const, data: { id } }
}

export async function resolveLink(host: string, shortPath: string) {
  const normalized = normalizeShortPath(shortPath)
  const cacheKey = linkCacheKey(host, normalized)
  const cached = await env.SHORT_LINK_CACHE.get<CachedLink>(cacheKey, 'json')
  if (cached) return { link: cached, cacheStatus: 'hit' as const }

  const link = await env.LINKS_DB.prepare(
    `SELECT links.*, domains.domain
     FROM links
     JOIN domains ON domains.id = links.domain_id
     WHERE domains.domain = ?
       AND links.short_path_normalized = ?
       AND links.deleted_at IS NULL
     LIMIT 1`,
  )
    .bind(host, normalized)
    .first<CachedLink>()

  if (!link) return { link: null, cacheStatus: 'miss' as const }

  await env.SHORT_LINK_CACHE.put(cacheKey, JSON.stringify(link), {
    expirationTtl: CACHE_TTL_SECONDS,
  })

  return { link, cacheStatus: 'miss' as const }
}

async function setLinkStatus(
  id: string,
  status: 'active' | 'inactive' | 'archived',
) {
  const link = await getLink(id)
  if (!link) return { ok: false as const, error: 'Link not found.' }
  await env.LINKS_DB.prepare(
    `UPDATE links SET status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`,
  )
    .bind(status, new Date().toISOString(), id, DEFAULT_WORKSPACE_ID)
    .run()
  await invalidateLinkCache(link.domain ?? '', link.short_path_normalized)
  return { ok: true as const, data: await getLink(id) }
}

async function generateUniqueSlug() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = generateRandomSlug(attempt < 4 ? 6 : 8)
    const availability = await checkPath(slug)
    if (availability.available) return slug
  }
  throw new Error('Could not generate a unique slug.')
}

function normalizeRedirectType(value?: number) {
  return [301, 302, 307, 308].includes(value ?? 302) ? (value ?? 302) : 302
}

export async function getTag(id: string) {
  await ensureDefaultWorkspace(env.LINKS_DB)
  return env.LINKS_DB.prepare(
    `SELECT tags.*, COUNT(link_tags.link_id) AS link_count
     FROM tags
     LEFT JOIN link_tags ON link_tags.tag_id = tags.id
     WHERE tags.id = ? AND tags.workspace_id = ?
     GROUP BY tags.id`,
  )
    .bind(id, DEFAULT_WORKSPACE_ID)
    .first<TagRow>()
}

export async function getCampaign(id: string) {
  await ensureDefaultWorkspace(env.LINKS_DB)
  return env.LINKS_DB.prepare(
    `SELECT campaigns.*, COUNT(campaign_links.link_id) AS link_count
     FROM campaigns
     LEFT JOIN campaign_links ON campaign_links.campaign_id = campaigns.id
     WHERE campaigns.id = ? AND campaigns.workspace_id = ? AND campaigns.archived_at IS NULL
     GROUP BY campaigns.id`,
  )
    .bind(id, DEFAULT_WORKSPACE_ID)
    .first<CampaignRow>()
}

function hydrateLinkRow(row: LinkDbRow): LinkRow {
  const { tags_json: tagsJson, campaigns_json: campaignsJson, ...link } = row
  return {
    ...link,
    tags: parseJsonArray<TagRow>(tagsJson),
    campaigns: parseJsonArray<CampaignRow>(campaignsJson),
  }
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function isLinkStatus(status: string | undefined) {
  return status === 'active' || status === 'inactive' || status === 'archived'
}

function normalizeLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return 100
  return Math.min(Math.max(Math.trunc(limit), 1), 250)
}

function isDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function normalizeHexColor(value: string | null | undefined) {
  const color = value?.trim() || null
  if (!color) return null
  return /^#[0-9a-f]{6}$/i.test(color) ? color : false
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

async function listTagsByIds(ids: string[]) {
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(', ')
  const { results } = await env.LINKS_DB.prepare(
    `SELECT * FROM tags WHERE workspace_id = ? AND id IN (${placeholders})`,
  )
    .bind(DEFAULT_WORKSPACE_ID, ...ids)
    .all<TagRow>()
  return results
}

async function listCampaignsByIds(ids: string[]) {
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(', ')
  const { results } = await env.LINKS_DB.prepare(
    `SELECT * FROM campaigns
     WHERE workspace_id = ? AND archived_at IS NULL AND id IN (${placeholders})`,
  )
    .bind(DEFAULT_WORKSPACE_ID, ...ids)
    .all<CampaignRow>()
  return results
}

function linkCacheKey(host: string, path: string) {
  return `link:${host}:${path}`
}

async function invalidateLinkCache(host: string, path: string) {
  if (!host) return
  await env.SHORT_LINK_CACHE.delete(linkCacheKey(host, path))
}
