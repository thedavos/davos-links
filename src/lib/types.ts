export type LinkStatus = 'active' | 'inactive' | 'archived'

export type TagRow = {
  id: string
  workspace_id: string
  name: string
  slug: string
  color: string | null
  created_at: string
  updated_at: string
  link_count?: number
}

export type CampaignRow = {
  id: string
  workspace_id: string
  name: string
  slug: string
  description: string | null
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  link_count?: number
}

export type LinkFilters = {
  q?: string
  status?: LinkStatus
  tagId?: string
  campaignId?: string
  createdFrom?: string
  createdTo?: string
  limit?: number
  offset?: number
}

export type LinkRow = {
  id: string
  workspace_id: string
  domain_id: string
  domain?: string
  title: string
  description: string | null
  destination_url: string
  short_path: string
  short_path_normalized: string
  redirect_type: 301 | 302 | 307 | 308
  status: LinkStatus
  preserve_query_params: 0 | 1
  expires_at: string | null
  fallback_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  clicks?: number
  tags?: TagRow[]
  campaigns?: CampaignRow[]
}

export type CachedLink = Pick<
  LinkRow,
  | 'id'
  | 'workspace_id'
  | 'domain_id'
  | 'title'
  | 'destination_url'
  | 'short_path'
  | 'short_path_normalized'
  | 'redirect_type'
  | 'status'
  | 'preserve_query_params'
  | 'expires_at'
  | 'fallback_url'
> & {
  domain: string
}

export type ApiResult<T> =
  | { ok: true; data: T; error?: never; field?: never }
  | { ok: false; error: string; field?: string; data?: never }

export type AnalyticsBreakdownItem = {
  value: string
  clicks: number
  percentage: number
}

export type AnalyticsBreakdowns = {
  status: 'ready' | 'unavailable'
  reason?: 'not_configured' | 'upstream_error'
  source: 'analytics_engine' | 'demo'
  scope: 'human'
  totalClicks: number
  coverage: {
    from: string
    to: string
    truncated: boolean
    retention: '3_months' | 'local_demo'
  }
  referrers: AnalyticsBreakdownItem[]
  countries: AnalyticsBreakdownItem[]
  devices: AnalyticsBreakdownItem[]
}
