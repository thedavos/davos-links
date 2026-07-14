import { Link } from '@tanstack/react-router'
import { Activity, Download, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ComparisonTrendChart, type ChartPoint } from '#/components/Charts'
import { PageHeader } from '#/components/DashboardShell'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { InfoTooltip } from '#/components/ui/info-tooltip'
import {
  DateRangePicker,
  defaultDateRange,
  type DateRange,
} from '#/components/ui/date-range'
import type { AnalyticsBreakdowns } from '#/lib/types'
import { cn } from '#/lib/utils'
import { TrafficBreakdowns } from './TrafficBreakdowns'

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
}

type UnknownRecord = Record<string, unknown>

export function OverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(30))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadOverview() {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams(range)
        const response = await fetch(`/api/analytics/overview?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Analytics request failed')
        const payload = (await response.json()) as unknown
        if (!controller.signal.aborted) setOverview(normalizeOverview(payload, range))
      } catch (requestError) {
        if (
          !controller.signal.aborted &&
          !(requestError instanceof DOMException && requestError.name === 'AbortError')
        ) {
          setError('No se pudieron cargar las métricas de este periodo.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadOverview()
    return () => controller.abort()
  }, [range, retryKey])

  const effectiveRange = !loading && !error && overview ? overview.range : range
  const exportQuery = new URLSearchParams(range)
  const rangeContext = !loading && !error && overview
    ? `${formatRange(overview.range)} · comparado con ${formatRange(overview.previousRange)} · ${overview.timezone}`
    : `${formatRange(range)} · UTC`

  return (
    <>
      <PageHeader
        action={
          <>
            <Button asChild variant="outline">
              <a href={`/api/analytics/export.csv?${exportQuery.toString()}`}>
                <Download size={16} />
                Exportar CSV
              </a>
            </Button>
            <Button asChild>
              <Link to="/dashboard/links/new">
                <Plus size={16} />
                Nuevo enlace
              </Link>
            </Button>
          </>
        }
        detail="Rendimiento de tus enlaces en el periodo seleccionado."
        title="Resumen"
      />

      <div className="mb-4 flex flex-col items-start justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-foreground">Periodo analizado</p>
          <p className="mono mt-1 text-xs text-muted-foreground">{rangeContext}</p>
        </div>
        <DateRangePicker onChange={setRange} value={range} />
      </div>

      {error ? (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-destructive bg-red-50 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <span>{error}</span>
          <Button onClick={() => setRetryKey((value) => value + 1)} size="sm" variant="destructive">
            <RefreshCw aria-hidden="true" size={14} />
            Reintentar
          </Button>
        </div>
      ) : null}

      <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">
        {loading ? 'Actualizando métricas' : `Métricas actualizadas para ${formatRange(effectiveRange)}`}
      </div>

      {loading ? (
        <OverviewSkeleton />
      ) : !error && overview ? (
        <div>
          <PerformanceMetrics overview={overview} />
          <CurrentStatus activeLinks={overview.totals.activeLinksNow} />

          <section className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex min-h-5 items-center gap-1">
                    <h2 className="text-sm font-semibold leading-5">Clics humanos en el tiempo</h2>
                    <InfoTooltip label="Información sobre clics humanos en el tiempo">
                      El rango seleccionado aparece en azul. La comparación superpone en
                      púrpura el periodo anterior de la misma duración.
                    </InfoTooltip>
                  </div>
                  <p className="mono mt-1 text-xs text-muted-foreground">{rangeContext}</p>
                </div>
              </div>
              {overview.totals.humanClicks > 0 ? (
                <ComparisonTrendChart
                  current={overview.series}
                  previous={overview.previousSeries}
                />
              ) : (
                <AnalyticsEmptyState
                  description="No se registraron clics humanos en las fechas seleccionadas."
                  title="Sin clics en este periodo"
                />
              )}
            </div>

            <TopLinksPanel links={overview.topLinks} />
          </section>
          {overview.breakdowns ? (
            <TrafficBreakdowns
              breakdowns={overview.breakdowns}
              loading={false}
              onRetry={() => setRetryKey((value) => value + 1)}
            />
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function PerformanceMetrics({ overview }: { overview: Overview }) {
  const { totals, comparison } = overview
  const botShare = percentage(totals.botClicks, totals.humanClicks + totals.botClicks)

  return (
    <section aria-label="Métricas del periodo">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          comparison={formatComparison(comparison)}
          label="Clics humanos"
          value={formatNumber(totals.humanClicks)}
        />
        <MetricCard
          detail="Con al menos un clic humano"
          label="Enlaces con actividad"
          value={formatNumber(totals.linksWithActivity)}
        />
        <MetricCard
          detail="Clics humanos por día"
          label="Promedio diario"
          value={formatDecimal(totals.averageDailyHumanClicks)}
        />
        <MetricCard
          detail={`${formatNumber(totals.botClicks)} clics automatizados`}
          label="Tráfico automatizado"
          secondary
          value={`${formatDecimal(botShare)}%`}
        />
      </div>
    </section>
  )
}

function MetricCard({
  comparison,
  detail,
  label,
  secondary = false,
  value,
}: {
  comparison?: string
  detail?: string
  label: string
  secondary?: boolean
  value: string
}) {
  return (
    <Card className={cn('p-4', secondary && 'bg-pink-50/35')}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mono mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">
        {value}
      </p>
      {comparison ? (
        <p className="mt-2 text-xs text-blue-800">{comparison}</p>
      ) : detail ? (
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </Card>
  )
}

function CurrentStatus({ activeLinks }: { activeLinks: number }) {
  return (
    <aside
      aria-label="Estado actual"
      className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-green-200 bg-green-50/45 px-3 py-2.5"
    >
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-green-950">
        <span aria-hidden="true" className="size-2 rounded-full bg-green-600" />
        Ahora
      </span>
      <p className="text-sm text-foreground">
        <strong className="mono font-semibold">{formatNumber(activeLinks)}</strong>{' '}
        {activeLinks === 1 ? 'enlace activo' : 'enlaces activos'}
      </p>
      <p className="text-xs text-green-900/80">Estado actual; no depende del periodo.</p>
    </aside>
  )
}

function TopLinksPanel({ links }: { links: TopLink[] }) {
  return (
    <section aria-labelledby="top-links-title">
      <div className="mb-3">
        <h2 className="text-sm font-semibold" id="top-links-title">
          Enlaces con más clics
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Ordenados por clics humanos del periodo</p>
      </div>
      {links.length ? (
        <Card>
          <ol className="divide-y divide-border">
            {links.map((link, index) => (
              <li key={link.id}>
                <Link
                  className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 p-3 transition-colors hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                  params={{ id: link.id }}
                  to="/dashboard/links/$id"
                >
                  <span
                    aria-label={`Posición ${index + 1}`}
                    className="mono text-xs font-semibold text-blue-700"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {link.title || `/${link.shortPath}`}
                    </span>
                    <span className="mono mt-0.5 block truncate text-xs text-muted-foreground">
                      /{link.shortPath}
                    </span>
                  </span>
                  <span className="max-w-32 text-right">
                    <span className="sr-only">
                      {formatNumber(link.humanClicks)} clics humanos,{' '}
                      {formatDecimal(link.sharePercent)}% del tráfico,{' '}
                      {formatLinkDelta(link.delta)}
                    </span>
                    <span aria-hidden="true" className="mono block text-sm font-semibold text-foreground">
                      {formatNumber(link.humanClicks)}
                    </span>
                    <span aria-hidden="true" className="mono mt-0.5 block text-[11px] text-muted-foreground">
                      {formatDecimal(link.sharePercent)}% · {formatLinkDelta(link.delta)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
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
        'flex flex-col items-start justify-center rounded-lg border border-dashed border-purple-200 bg-purple-50/35 p-5',
        compact ? 'min-h-40' : 'min-h-72',
      )}
    >
      <span className="grid size-8 place-items-center rounded-md bg-purple-100 text-purple-700">
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

function OverviewSkeleton() {
  return (
    <div aria-label="Cargando métricas" role="status">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-28 animate-pulse rounded-lg border border-border bg-muted/70 motion-reduce:animate-none"
            key={index}
          />
        ))}
      </div>
      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="h-80 animate-pulse rounded-lg border border-border bg-muted/70 motion-reduce:animate-none" />
        <div className="h-80 animate-pulse rounded-lg border border-border bg-muted/70 motion-reduce:animate-none" />
      </div>
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
  const comparisonRecord = asRecord(root.comparison)
  const previousClicks = numberFrom(
    comparisonRecord.previousClicks,
    sumHumanClicks(previousSeries),
  )
  const currentClicks = numberFrom(comparisonRecord.currentClicks, humanClicks)
  const delta = numberFrom(comparisonRecord.delta, currentClicks - previousClicks)
  const hasPreviousBase = previousClicks > 0 && !isMissingBaseline(comparisonRecord)

  return {
    totals: {
      humanClicks,
      botClicks,
      linksWithActivity: numberFrom(totals.linksWithActivity, rawTopLinks.length),
      averageDailyHumanClicks: numberFrom(
        totals.averageDailyHumanClicks,
        days ? humanClicks / days : 0,
      ),
      activeLinksNow: numberFrom(totals.activeLinksNow, totals.activeLinks),
    },
    series,
    previousSeries,
    comparison: {
      currentClicks,
      previousClicks,
      delta,
      deltaPercent: hasPreviousBase
        ? numberFrom(comparisonRecord.deltaPercent, (delta / previousClicks) * 100)
        : null,
      hasPreviousBase,
    },
    topLinks: rawTopLinks.map(normalizeTopLink).filter((link) => Boolean(link.id)),
    range,
    previousRange,
    timezone: typeof root.timezone === 'string' ? root.timezone : 'UTC',
    breakdowns: normalizeBreakdowns(root.breakdowns),
  }
}

function normalizeBreakdowns(value: unknown): AnalyticsBreakdowns | null {
  const breakdowns = asRecord(value)
  if (breakdowns.status !== 'ready' && breakdowns.status !== 'unavailable') return null
  return value as AnalyticsBreakdowns
}

function normalizeTopLink(value: unknown): TopLink {
  const link = asRecord(value)
  return {
    id: stringFrom(link.id),
    title: stringFrom(link.title),
    shortPath: stringFrom(link.shortPath, link.short_path),
    humanClicks: numberFrom(link.humanClicks, link.clicks),
    sharePercent: numberFrom(link.sharePercent),
    delta: link.delta === null || link.delta === undefined ? null : numberFrom(link.delta),
  }
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
  if (delta === null) return 'sin base'
  if (delta === 0) return 'sin cambio'
  return `${delta > 0 ? '+' : ''}${formatNumber(delta)} vs. anterior`
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
