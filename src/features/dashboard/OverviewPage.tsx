import { Link } from '@tanstack/react-router'
import { Activity, Download, Plus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { ComparisonTrendChart, type ChartPoint } from '#/components/Charts'
import { PageHeader } from '#/components/DashboardShell'
import { useTimeZone } from '#/components/TimeZoneProvider'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { InfoTooltip } from '#/components/ui/info-tooltip'
import {
  DateRangePicker,
  defaultDateRange,
  type DateRange,
} from '#/components/ui/date-range'
import type {
  AnalyticsBreakdowns,
  AnalyticsHeatmap,
  AnalyticsPerformanceItem,
} from '#/lib/types'
import { cn } from '#/lib/utils'
import { TrafficBreakdowns } from './TrafficBreakdowns'
import {
  AnalyticsHeatmapPanel,
  CategoryPerformancePanel,
} from './AnalyticsPanels'
import { AnalyticsSectionHeader } from './AnalyticsSectionHeader'
import { useOverviewAnalytics } from './useOverviewAnalytics'

type AnalyticsComparison = {
  currentClicks: number
  previousClicks: number
  delta: number
  deltaPercent: number | null
  hasPreviousBase: boolean
}

type TopLink = {
  id: string
  title: string
  shortPath: string
  humanClicks: number
  sharePercent: number
  delta: number | null
}

type Overview = {
  aggregationMode: 'local' | 'mixed' | 'legacy-utc'
  localAccuracyStartsOn: string
  totals: {
    humanClicks: number
    botClicks: number
    linksWithActivity: number
    averageDailyHumanClicks: number
    activeLinksNow: number
  }
  series: ChartPoint[]
  previousSeries: ChartPoint[]
  comparison: AnalyticsComparison
  topLinks: TopLink[]
  range: DateRange
  previousRange: DateRange
  timezone: string
  breakdowns: AnalyticsBreakdowns | null
  heatmap: AnalyticsHeatmap | null
  categoryPerformance: {
    campaigns: AnalyticsPerformanceItem[]
    tags: AnalyticsPerformanceItem[]
  }
}

type UnknownRecord = Record<string, unknown>

export function OverviewPage() {
  const { timeZone, timeZoneLabel } = useTimeZone()
  const [range, setRange] = useState<DateRange>(() =>
    defaultDateRange(30, new Date(), timeZone),
  )
  const {
    data: overview,
    error,
    hasStaleData,
    isInitialLoading,
    isUpdating,
    retry,
  } = useOverviewAnalytics(range, normalizeOverview, timeZone)

  const effectiveRange = overview?.range ?? range
  const exportQuery = new URLSearchParams(range)
  exportQuery.set('timeZone', timeZone)

  return (
    <>
      <PageHeader
        className="mb-6"
        action={
          <>
            <Button asChild ditherVariant="dotted-subtle" variant="ghost">
              <a href={`/api/analytics/export.csv?${exportQuery.toString()}`}>
                <Download size={16} />
                Exportar CSV
              </a>
            </Button>
            <Button asChild className="hidden md:inline-flex">
              <Link to="/dashboard/links/new">
                <Plus size={16} />
                Nuevo enlace
              </Link>
            </Button>
          </>
        }
        meta={
          overview ? (
            <CurrentStatus activeLinks={overview.totals.activeLinksNow} />
          ) : isInitialLoading ? (
            <CurrentStatusSkeleton />
          ) : null
        }
        title="Resumen"
      />

      <section aria-labelledby="period-performance-title">
        <AnalyticsSectionHeader
          action={
            <DateRangePicker
              className="w-full lg:w-auto lg:justify-self-end"
              framed={false}
              onChange={setRange}
              showSummary={false}
              timeZone={timeZone}
              value={range}
            />
          }
          description={`Clics humanos · comparación con el periodo anterior · ${timeZoneLabel}`}
          title="Rendimiento del periodo"
          titleId="period-performance-title"
        />

        {error ? (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-destructive bg-coral-50 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            <span>{error}</span>
            <Button onClick={retry} size="sm" variant="destructive">
              <RefreshCw aria-hidden="true" size={14} />
              Reintentar
            </Button>
          </div>
        ) : null}

        <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">
          {isInitialLoading || isUpdating
            ? 'Actualizando métricas'
            : `Métricas actualizadas para ${formatRange(effectiveRange)}`}
        </div>

        {hasStaleData ? (
          <p className="mt-4 text-xs text-muted-foreground" role="status">
            Mostrando el periodo anterior mientras se actualizan las métricas.
          </p>
        ) : null}

        <div className="mt-6">
          {isInitialLoading ? (
            <OverviewSkeleton onRetry={retry} />
          ) : overview ? (
            <>
              <PerformanceMetrics overview={overview} />

              <section className="mt-8 min-w-0 md:mt-12" aria-labelledby="overview-trend-title">
                  <div className="mb-3 flex min-h-5 items-center gap-1">
                    <h2 className="text-base font-semibold leading-5" id="overview-trend-title">
                      Clics humanos en el tiempo
                    </h2>
                    <InfoTooltip label="Información sobre clics humanos en el tiempo">
                      Muestra los clics humanos del rango seleccionado como tendencia o como
                      barras por día.
                    </InfoTooltip>
                  </div>
                  {overview.totals.humanClicks > 0 ? (
                    <Card className="p-4">
                      <ComparisonTrendChart
                        allowComparison={false}
                        current={overview.series}
                      />
                    </Card>
                  ) : (
                    <AnalyticsEmptyState
                      description="No se registraron clics humanos en las fechas seleccionadas."
                      title="Sin clics en este periodo"
                    />
                  )}
              </section>

              <div className="mt-8 grid items-start gap-8 md:mt-12 lg:grid-cols-12 lg:gap-6">
                <div className="lg:col-span-5">
                <TopLinksPanel links={overview.topLinks} />
                </div>
                <div className="lg:col-span-7">
                  <CategoryPerformancePanel
                    campaigns={overview.categoryPerformance.campaigns}
                    tags={overview.categoryPerformance.tags}
                  />
                </div>
              </div>

              <AnalyticsHeatmapPanel
                className="mt-12"
                heatmap={overview.heatmap}
                loading={false}
                onRetry={retry}
                timeZone={timeZone}
              />

              {overview.breakdowns ? (
                <TrafficBreakdowns
                  breakdowns={overview.breakdowns}
                  className="mt-12"
                  loading={false}
                  onRetry={retry}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </>
  )
}

function PerformanceMetrics({ overview }: { overview: Overview }) {
  const { totals, comparison } = overview
  const botShare = percentage(totals.botClicks, totals.humanClicks + totals.botClicks)

  return (
    <section aria-label="Métricas del periodo">
      <dl className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
        <Metric
          comparison={formatComparison(comparison)}
          label="Clics humanos"
          primary
          value={formatNumber(totals.humanClicks)}
        />
        <Metric
          detail="Con al menos un clic humano"
          label="Enlaces con actividad"
          value={formatNumber(totals.linksWithActivity)}
        />
        <Metric
          detail="Clics humanos por día"
          label="Promedio diario"
          value={formatDecimal(totals.averageDailyHumanClicks)}
        />
        <Metric
          detail={`${formatNumber(totals.botClicks)} clics automatizados`}
          label="Tráfico automatizado"
          value={`${formatDecimal(botShare)}%`}
        />
      </dl>
    </section>
  )
}

function Metric({
  comparison,
  detail,
  label,
  primary = false,
  value,
}: {
  comparison?: string
  detail?: string
  label: string
  primary?: boolean
  value: string
}) {
  return (
    <Card className="grid content-start gap-2 p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'mono font-semibold tracking-[-0.03em] text-foreground',
          primary ? 'text-3xl' : 'text-2xl',
        )}
      >
        {value}
      </dd>
      {comparison ? (
        <dd className="text-xs text-blue-800">{comparison}</dd>
      ) : detail ? (
        <dd className="text-xs text-muted-foreground">{detail}</dd>
      ) : null}
    </Card>
  )
}

function CurrentStatus({ activeLinks }: { activeLinks: number }) {
  return (
    <aside
      aria-label="Estado actual"
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-blue-600" />
      <p>
        <strong className="mono font-semibold text-foreground">{formatNumber(activeLinks)}</strong>{' '}
        {activeLinks === 1 ? 'enlace activo ahora' : 'enlaces activos ahora'}
      </p>
    </aside>
  )
}

function CurrentStatusSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-center gap-2">
      <span className="size-2 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
      <span className="h-4 w-36 animate-pulse rounded bg-muted motion-reduce:animate-none" />
    </div>
  )
}

function TopLinksPanel({ links }: { links: TopLink[] }) {
  return (
    <section aria-labelledby="top-links-title" className="min-w-0">
      <div className="mb-3 flex min-h-5 items-center gap-1">
        <h2 className="text-base font-semibold" id="top-links-title">
          Enlaces con más clics
        </h2>
        <InfoTooltip label="Información sobre enlaces con más clics">
          Ordena los cinco enlaces con más clics humanos del periodo. El porcentaje
          muestra su participación en el tráfico y la variación se calcula frente al
          periodo anterior equivalente.
        </InfoTooltip>
      </div>
      {links.length ? (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {links.map((link) => (
              <li key={link.id}>
                <Link
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                  params={{ id: link.id }}
                  to="/dashboard/links/$id"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {link.title || `/${link.shortPath}`}
                    </span>
                    <span className="mono mt-1 block truncate text-xs text-muted-foreground">
                      /{link.shortPath}
                    </span>
                  </span>
                  <span className="max-w-36 text-right">
                    <span className="sr-only">
                      {formatNumber(link.humanClicks)} clics humanos,{' '}
                      {formatDecimal(link.sharePercent)}% del tráfico,{' '}
                      {formatLinkDelta(link.delta)}
                    </span>
                    <span aria-hidden="true" className="mono block text-sm font-semibold text-foreground">
                      {formatNumber(link.humanClicks)}
                    </span>
                    <span aria-hidden="true" className="mono mt-1 block text-xs leading-4 text-muted-foreground">
                      {formatDecimal(link.sharePercent)}% del tráfico ·{' '}
                      {formatLinkDelta(link.delta)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <AnalyticsEmptyState
          compact
          description="Ningún enlace recibió clics humanos en estas fechas."
          title="Sin enlaces con actividad"
        />
      )}
    </section>
  )
}

function AnalyticsEmptyState({
  compact = false,
  description,
  title,
}: {
  compact?: boolean
  description: string
  title: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start justify-center rounded-lg border border-dashed border-blue-200 bg-blue-50 p-6',
        compact ? 'min-h-40' : 'min-h-72',
      )}
    >
      <span className="grid size-8 place-items-center rounded-md bg-blue-100 text-blue-700">
        <Activity aria-hidden="true" size={16} />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      <Button asChild className="mt-4" size="sm" variant="outline">
        <Link to="/dashboard/links/new">
          <Plus aria-hidden="true" size={14} />
          Crear enlace
        </Link>
      </Button>
    </div>
  )
}

function OverviewSkeleton({ onRetry }: { onRetry: () => void }) {
  return (
    <div aria-label="Cargando métricas" role="status">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card className="grid gap-2 p-4" key={index}>
            <span className="h-4 w-28 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <span className="h-8 w-20 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <span className="h-3 w-36 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </Card>
        ))}
      </div>
      <section aria-label="Cargando gráfico" className="mt-8 md:mt-12">
          <span className="mb-3 block h-5 w-56 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <Card className="p-4">
            <div className="h-64 animate-pulse rounded-lg bg-muted/70 motion-reduce:animate-none" />
          </Card>
      </section>
      <div className="mt-8 grid items-start gap-8 md:mt-12 lg:grid-cols-12 lg:gap-6">
        <section aria-label="Cargando enlaces con más clics" className="lg:col-span-5">
          <span className="mb-3 block h-5 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <Card className="divide-y divide-border overflow-hidden">
            {Array.from({ length: 5 }, (_, index) => (
              <div className="flex items-center justify-between gap-4 px-4 py-3" key={index}>
                <span className="h-4 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <span className="h-4 w-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              </div>
            ))}
          </Card>
        </section>
        <section aria-label="Cargando rendimiento por campañas y etiquetas" className="lg:col-span-7">
          <span className="mb-3 block h-5 w-56 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <Card className="p-4">
            <div className="h-64 animate-pulse rounded-lg bg-muted/70 motion-reduce:animate-none" />
          </Card>
        </section>
      </div>
      <AnalyticsHeatmapPanel
        className="mt-12"
        heatmap={null}
        loading
        onRetry={onRetry}
      />
      <TrafficBreakdowns
        breakdowns={null}
        className="mt-12"
        loading
        onRetry={onRetry}
      />
      <span className="sr-only">Cargando métricas del periodo</span>
    </div>
  )
}

export function normalizeOverview(payload: unknown, requestedRange: DateRange): Overview {
  const root = asRecord(payload)
  const totals = asRecord(root.totals)
  const series = normalizeSeries(root.series)
  const previousSeries = normalizeSeries(root.previousSeries)
  const range = normalizeRange(root.range, requestedRange)
  const previousRange = normalizeRange(root.previousRange, previousDateRange(range))
  const humanClicks = numberFrom(totals.humanClicks, totals.totalClicks, sumHumanClicks(series))
  const botClicks = numberFrom(totals.botClicks, sumBotClicks(series))
  const days = inclusiveDays(range)
  const rawTopLinks = Array.isArray(root.topLinks) ? root.topLinks : []
  const comparisonRoot = asRecord(root.comparison)
  const comparisonRecord = Object.keys(asRecord(comparisonRoot.humanClicks)).length
    ? asRecord(comparisonRoot.humanClicks)
    : comparisonRoot
  const previousClicks = numberFrom(
    comparisonRecord.previousClicks,
    sumHumanClicks(previousSeries),
  )
  const currentClicks = numberFrom(comparisonRecord.currentClicks, humanClicks)
  const delta = numberFrom(
    comparisonRecord.absolute,
    comparisonRecord.delta,
    currentClicks - previousClicks,
  )
  const hasPreviousBase =
    comparisonRecord.status === 'comparable' ||
    (previousClicks > 0 && !isMissingBaseline(comparisonRecord))

  return {
    aggregationMode:
      root.aggregationMode === 'mixed' || root.aggregationMode === 'legacy-utc'
        ? root.aggregationMode
        : 'local',
    localAccuracyStartsOn: isDateString(root.localAccuracyStartsOn)
      ? root.localAccuracyStartsOn
      : range.from,
    totals: {
      humanClicks,
      botClicks,
      linksWithActivity: numberFrom(totals.linksWithActivity, rawTopLinks.length),
      averageDailyHumanClicks: numberFrom(
        totals.averageDailyHumanClicks,
        days ? humanClicks / days : 0,
      ),
      activeLinksNow: numberFrom(root.activeLinksNow, totals.activeLinksNow, totals.activeLinks),
    },
    series,
    previousSeries,
    comparison: {
      currentClicks,
      previousClicks,
      delta,
      deltaPercent: hasPreviousBase
        ? numberFrom(
            comparisonRecord.percent,
            comparisonRecord.deltaPercent,
            (delta / previousClicks) * 100,
          )
        : null,
      hasPreviousBase,
    },
    topLinks: rawTopLinks.map(normalizeTopLink).filter((link) => Boolean(link.id)),
    range,
    previousRange,
    timezone: typeof root.timezone === 'string' ? root.timezone : 'UTC',
    breakdowns: normalizeBreakdowns(root.breakdowns),
    heatmap: normalizeHeatmap(root.heatmap),
    categoryPerformance: normalizeCategoryPerformance(root.categoryPerformance),
  }
}

function normalizeBreakdowns(value: unknown): AnalyticsBreakdowns | null {
  const breakdowns = asRecord(value)
  if (breakdowns.status !== 'ready' && breakdowns.status !== 'unavailable') return null
  return value as AnalyticsBreakdowns
}

function normalizeHeatmap(value: unknown): AnalyticsHeatmap | null {
  const heatmap = asRecord(value)
  if (heatmap.status !== 'ready' && heatmap.status !== 'unavailable') return null
  return value as AnalyticsHeatmap
}

function normalizeCategoryPerformance(value: unknown) {
  const performance = asRecord(value)
  return {
    campaigns: normalizePerformanceItems(performance.campaigns),
    tags: normalizePerformanceItems(performance.tags),
  }
}

function normalizePerformanceItems(value: unknown): AnalyticsPerformanceItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = asRecord(item)
    const currentClicks = numberFrom(row.currentClicks)
    const previousClicks = numberFrom(row.previousClicks)
    return {
      id: stringFrom(row.id),
      label: stringFrom(row.label),
      currentClicks,
      previousClicks,
      delta: asRecord(row.delta) as unknown as AnalyticsPerformanceItem['delta'],
    }
  }).filter((item) => item.id && item.label)
}

function normalizeTopLink(value: unknown): TopLink {
  const link = asRecord(value)
  return {
    id: stringFrom(link.id),
    title: stringFrom(link.title),
    shortPath: stringFrom(link.shortPath, link.short_path),
    humanClicks: numberFrom(link.humanClicks, link.clicks),
    sharePercent: numberFrom(link.sharePercent),
    delta: normalizeDelta(link.delta),
  }
}

function normalizeDelta(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') {
    const delta = asRecord(value)
    return delta.status === 'comparable' ? numberFrom(delta.absolute) : null
  }
  return numberFrom(value)
}

function normalizeSeries(value: unknown): ChartPoint[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const point = asRecord(item)
    return {
      metric_date: stringFrom(point.metric_date),
      human_clicks: numberFrom(point.human_clicks, point.clicks),
      bot_clicks: numberFrom(point.bot_clicks),
    }
  })
}

function normalizeRange(value: unknown, fallback: DateRange): DateRange {
  const range = asRecord(value)
  return {
    from: isDateString(range.from) ? range.from : fallback.from,
    to: isDateString(range.to) ? range.to : fallback.to,
  }
}

function previousDateRange(range: DateRange): DateRange {
  const days = inclusiveDays(range)
  const previousTo = addDays(range.from, -1)
  return { from: addDays(previousTo, -(days - 1)), to: previousTo }
}

function inclusiveDays(range: DateRange) {
  const from = Date.parse(`${range.from}T00:00:00.000Z`)
  const to = Date.parse(`${range.to}T00:00:00.000Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) return 0
  return Math.floor((to - from) / 86_400_000) + 1
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function formatComparison(comparison: AnalyticsComparison) {
  if (!comparison.hasPreviousBase) {
    return comparison.currentClicks > 0 ? 'Nuevo vs. periodo anterior' : 'Sin base anterior'
  }
  const signedDelta = `${comparison.delta > 0 ? '+' : ''}${formatNumber(comparison.delta)}`
  const percent = comparison.deltaPercent ?? 0
  const signedPercent = `${percent > 0 ? '+' : ''}${formatDecimal(percent)}%`
  return `${signedDelta} · ${signedPercent} vs. periodo anterior`
}

function formatLinkDelta(delta: number | null) {
  if (delta === null) return 'sin comparación'
  if (delta === 0) return 'sin cambios'
  return `${formatNumber(Math.abs(delta))} ${delta > 0 ? 'más' : 'menos'}`
}

function formatRange(range: DateRange) {
  const from = parseDate(range.from)
  const to = parseDate(range.to)
  if (!from || !to) return 'Rango personalizado'
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear()
  const fromLabel = new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(from)
  const toLabel = new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(to)
  return `${fromLabel}–${toLabel}`
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function percentage(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0
}

function sumHumanClicks(points: ChartPoint[]) {
  return points.reduce(
    (total, point) => total + Number(point.human_clicks ?? point.clicks ?? 0),
    0,
  )
}

function sumBotClicks(points: ChartPoint[]) {
  return points.reduce((total, point) => total + Number(point.bot_clicks ?? 0), 0)
}

function isMissingBaseline(comparison: UnknownRecord) {
  const status = comparison.baselineStatus ?? comparison.baseStatus ?? comparison.baseline
  return status === 'none' || status === 'missing' || status === 'no_previous_data'
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {}
}

function numberFrom(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return 0
}

function stringFrom(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string') return value
  }
  return ''
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es', { maximumFractionDigits: 0 }).format(value)
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat('es', { maximumFractionDigits: 1 }).format(value)
}
