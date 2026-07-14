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

export type AnalyticsInsightStatus = {
  status: 'ready' | 'unavailable'
  reason?: 'not_configured' | 'upstream_error'
  source: 'analytics_engine' | 'demo'
  scope: 'human'
  coverage: {
    from: string
    to: string
    truncated: boolean
    retention: '3_months' | 'local_demo'
  }
}

export type AnalyticsHeatmapCell = {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7
  hour: number
  clicks: number
}

export type AnalyticsHeatmap = AnalyticsInsightStatus & {
  totalClicks: number
  cells: AnalyticsHeatmapCell[]
}

export type AnalyticsPerformanceItem = {
  id: string
  label: string
  currentClicks: number
  previousClicks: number
  delta: AnalyticsDelta
}

export type AnalyticsUtmItem = {
  value: string
  currentClicks: number
  previousClicks: number
  sharePercent: number
  delta: AnalyticsDelta
}

export type AnalyticsUtmPerformance = AnalyticsInsightStatus & {
  totalClicks: number
  previousCoverage: AnalyticsInsightStatus['coverage']
  campaigns: AnalyticsUtmItem[]
  sources: AnalyticsUtmItem[]
  mediums: AnalyticsUtmItem[]
}
export type AnalyticsDateRange = {
  from: string
  to: string
}

export type AnalyticsDelta =
  | {
      status: 'comparable'
      absolute: number
      percent: number
      trend: 'up' | 'down' | 'flat'
    }
  | {
      status: 'new'
      absolute: number
      percent: null
      trend: 'up'
    }
  | {
      status: 'no-baseline'
      absolute: 0
      percent: null
      trend: 'flat'
    }

export type AnalyticsPerformanceTotals = {
  humanClicks: number
  botClicks: number
  linksWithActivity: number
  averageDailyHumanClicks: number
}

export type AnalyticsSeriesPoint = {
  metric_date: string
  human_clicks: number
  bot_clicks: number
}

export type AnalyticsTopLink = {
  id: string
  title: string
  shortPath: string
  humanClicks: number
  sharePercent: number
  delta: AnalyticsDelta
}

export type AnalyticsOverview = {
  timezone: string
  aggregationMode: 'local' | 'mixed' | 'legacy-utc'
  localAccuracyStartsOn: string
  range: AnalyticsDateRange
  previousRange: AnalyticsDateRange
  totals: AnalyticsPerformanceTotals
  previousTotals: AnalyticsPerformanceTotals
  activeLinksNow: number
  series: AnalyticsSeriesPoint[]
  previousSeries: AnalyticsSeriesPoint[]
  breakdowns: AnalyticsBreakdowns
  heatmap: AnalyticsHeatmap
  categoryPerformance: {
    campaigns: AnalyticsPerformanceItem[]
    tags: AnalyticsPerformanceItem[]
  }
  comparison: {
    humanClicks: AnalyticsDelta
    botClicks: AnalyticsDelta
    linksWithActivity: AnalyticsDelta
    averageDailyHumanClicks: AnalyticsDelta
  }
  topLinks: AnalyticsTopLink[]
}
