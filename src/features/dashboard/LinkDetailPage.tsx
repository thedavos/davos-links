import { Link } from '@tanstack/react-router'
import { Copy, Download, ExternalLink, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ComparisonTrendChart, type ChartPoint } from '#/components/Charts'
import { PageHeader } from '#/components/DashboardShell'
import { useTimeZone } from '#/components/TimeZoneProvider'
import { ActionTooltip } from '#/components/ui/action-tooltip'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { InfoTooltip } from '#/components/ui/info-tooltip'
import {
  DateRangePicker,
  defaultDateRange,
  type DateRange,
} from '#/components/ui/date-range'
import { PUBLIC_ORIGIN } from '#/lib/constants'
import type {
  AnalyticsBreakdowns,
  AnalyticsHeatmap,
  AnalyticsUtmPerformance,
  LinkRow,
} from '#/lib/types'
import {
  AnalyticsHeatmapPanel,
  UtmPerformancePanel,
} from './AnalyticsPanels'
import { AnalyticsSectionHeader } from './AnalyticsSectionHeader'
import { TrafficBreakdownCard } from './TrafficBreakdowns'

type LinkAnalyticsTotals = {
  humanClicks: number
  botClicks: number
  averageDailyHumanClicks: number
  botSharePercent: number
}

type LinkAnalyticsComparison = {
  currentClicks: number
  previousClicks: number
  delta: number
  deltaPercent: number | null
  trend: 'up' | 'down' | 'flat'
}

export function LinkDetailPage({ id }: { id: string }) {
  const { timeZone, timeZoneLabel } = useTimeZone()
  const [link, setLink] = useState<LinkRow | null | undefined>(undefined)
  const [series, setSeries] = useState<ChartPoint[]>([])
  const [previousSeries, setPreviousSeries] = useState<ChartPoint[]>([])
  const [breakdowns, setBreakdowns] = useState<AnalyticsBreakdowns | null>(null)
  const [heatmap, setHeatmap] = useState<AnalyticsHeatmap | null>(null)
  const [utm, setUtm] = useState<AnalyticsUtmPerformance | null>(null)
  const [totals, setTotals] = useState<LinkAnalyticsTotals | null>(null)
  const [comparison, setComparison] = useState<LinkAnalyticsComparison | null>(null)
  const [range, setRange] = useState<DateRange>(() =>
    defaultDateRange(30, new Date(), timeZone),
  )
  const [copied, setCopied] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [analyticsError, setAnalyticsError] = useState('')
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLink(undefined)
    setLinkError('')
    void fetchJson<{ link?: LinkRow }>(`/api/links/${id}`, controller.signal)
      .then((data) => setLink(data.link ?? null))
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setLinkError('No se pudo cargar el enlace.')
        setLink(null)
      })
    return () => controller.abort()
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    setAnalyticsLoading(true)
    setAnalyticsError('')
    const params = new URLSearchParams(range)
    params.set('timeZone', timeZone)
    void fetchJson<{
      series?: ChartPoint[]
      previousSeries?: ChartPoint[]
      breakdowns?: AnalyticsBreakdowns
      heatmap?: AnalyticsHeatmap
      utm?: AnalyticsUtmPerformance
      totals?: LinkAnalyticsTotals
      comparison?: LinkAnalyticsComparison
      scope?: 'human'
      timezone?: string
      aggregationMode?: 'local' | 'mixed' | 'legacy-utc'
      localAccuracyStartsOn?: string
    }>(`/api/links/${id}/analytics?${params.toString()}`, controller.signal)
      .then((analyticsData) => {
        setSeries(analyticsData.series ?? [])
        setPreviousSeries(analyticsData.previousSeries ?? [])
        setBreakdowns(analyticsData.breakdowns ?? null)
        setHeatmap(analyticsData.heatmap ?? null)
        setUtm(analyticsData.utm ?? null)
        setTotals(analyticsData.totals ?? null)
        setComparison(analyticsData.comparison ?? null)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setAnalyticsError(
          'No pudimos cargar los clics humanos de este periodo. Comprueba tu conexión e inténtalo de nuevo.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnalyticsLoading(false)
      })
    return () => controller.abort()
  }, [id, range, retryNonce, timeZone])

  if (link === undefined) {
    return <PageHeader title="Cargando enlace" />
  }

  if (link === null) {
    return <PageHeader detail={linkError || undefined} title="No encontramos este enlace" />
  }

  const shortUrl = `${PUBLIC_ORIGIN}/${link.short_path}`
  const exportParams = new URLSearchParams({ ...range, linkId: link.id })
  exportParams.set('timeZone', timeZone)

  return (
    <>
      <PageHeader
        className="md:items-start"
        action={
          <>
            <ActionTooltip
              label="Exportar CSV"
              render={<a href={`/api/analytics/export.csv?${exportParams.toString()}`} />}
            >
              <Download aria-hidden="true" size={16} />
            </ActionTooltip>
            <ActionTooltip
              label={copied ? 'Copiado' : 'Copiar'}
              onClick={async () => {
                await navigator.clipboard.writeText(shortUrl)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              }}
            >
              <Copy aria-hidden="true" size={16} />
            </ActionTooltip>
            <ActionTooltip
              label="Abrir"
              render={<a href={shortUrl} rel="noreferrer" target="_blank" />}
            >
              <ExternalLink aria-hidden="true" size={16} />
            </ActionTooltip>
            <ActionTooltip
              label="Editar"
              render={<Link params={{ id: link.id }} to="/dashboard/links/$id/edit" />}
            >
              <Pencil aria-hidden="true" size={16} />
            </ActionTooltip>
          </>
        }
        detail={shortUrl}
        title={link.title}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Info label="Destino" value={link.destination_url} />
        <Info label="Estado" value={link.status} />
        <Info label="Clics registrados" value={String(link.clicks ?? 0)} />
      </div>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <AssignmentInfo items={link.tags ?? []} title="Etiquetas" />
        <AssignmentInfo items={link.campaigns ?? []} title="Campañas" />
      </section>
      <section aria-labelledby="link-analytics-title" className="mt-8">
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
          description={`Solo clics humanos · ${timeZoneLabel}`}
          title="Analítica del enlace"
          titleId="link-analytics-title"
        />
        {analyticsError ? (
          <div
            className="mt-4 flex flex-col justify-between gap-3 border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:flex-row sm:items-center"
            role="alert"
          >
            <span>{analyticsError}</span>
            <Button
              onClick={() => setRetryNonce((value) => value + 1)}
              size="sm"
              type="button"
              variant="outline"
            >
              Reintentar
            </Button>
          </div>
        ) : null}

        <LinkPerformanceMetrics
          comparison={comparison}
          loading={analyticsLoading && !totals}
          totals={totals}
        />

        <section aria-labelledby="link-trend-title" className="mt-8 md:mt-12">
          <div className="mb-3 flex min-h-5 items-center gap-1">
            <h3 className="text-sm font-semibold leading-5" id="link-trend-title">
              Clics humanos en el tiempo
            </h3>
            <InfoTooltip label="Información sobre clics humanos en el tiempo">
              Excluye crawlers y previews. “Comparar periodo anterior” superpone el
              periodo inmediatamente anterior con la misma duración.
            </InfoTooltip>
          </div>
          <Card aria-busy={analyticsLoading} className="p-4">
            {analyticsLoading && !series.length ? (
              <AnalyticsChartSkeleton />
            ) : (
              <ComparisonTrendChart current={series} previous={previousSeries} />
            )}
          </Card>
        </section>

        <section
          aria-labelledby="link-acquisition-title"
          className="mt-8 md:mt-12"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold" id="link-acquisition-title">
              Adquisición
            </h3>
            {breakdowns?.source === 'demo' || utm?.source === 'demo' ? (
              <Badge variant="accent">Datos demo</Badge>
            ) : null}
            {breakdowns?.coverage.truncated || utm?.coverage.truncated ? (
              <Badge variant="warning">Rango limitado</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Rendimiento UTM y principales orígenes · máximo 5
          </p>
          <div className="mt-3 grid items-start gap-8 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-7">
              <UtmPerformancePanel
                loading={analyticsLoading && !utm}
                onRetry={() => setRetryNonce((value) => value + 1)}
                showHeader={false}
                utm={utm}
              />
            </div>
            <TrafficBreakdownCard
              className="lg:col-span-5"
              items={breakdowns?.status === 'ready' ? breakdowns.referrers : []}
              kind="referrers"
              loading={analyticsLoading && !breakdowns}
              unavailable={breakdowns?.status === 'unavailable'}
            />
          </div>
        </section>

        <AnalyticsHeatmapPanel
          className="mt-12"
          heatmap={heatmap}
          loading={analyticsLoading && !heatmap}
          onRetry={() => setRetryNonce((value) => value + 1)}
          timeZone={timeZone}
        />

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <TrafficBreakdownCard
            items={breakdowns?.status === 'ready' ? breakdowns.countries : []}
            kind="countries"
            loading={analyticsLoading && !breakdowns}
            unavailable={breakdowns?.status === 'unavailable'}
          />
          <TrafficBreakdownCard
            items={breakdowns?.status === 'ready' ? breakdowns.devices : []}
            kind="devices"
            loading={analyticsLoading && !breakdowns}
            unavailable={breakdowns?.status === 'unavailable'}
          />
        </div>
      </section>
    </>
  )
}

function LinkPerformanceMetrics({
  comparison,
  loading,
  totals,
}: {
  comparison: LinkAnalyticsComparison | null
  loading: boolean
  totals: LinkAnalyticsTotals | null
}) {
  if (loading || !totals) {
    return (
      <div aria-label="Cargando métricas del enlace" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status">
        {Array.from({ length: 4 }, (_, index) => (
          <Card className="h-28 animate-pulse bg-muted/70 motion-reduce:animate-none" key={index} />
        ))}
      </div>
    )
  }

  return (
    <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <LinkMetric label="Clics humanos" value={formatNumber(totals.humanClicks)} />
      <LinkMetric
        detail={comparison ? `${formatSignedNumber(comparison.delta)} clics` : 'Sin comparación'}
        label="Cambio"
        value={formatComparisonPercent(comparison)}
      />
      <LinkMetric
        detail="Clics humanos por día"
        label="Promedio diario"
        value={formatDecimal(totals.averageDailyHumanClicks)}
      />
      <LinkMetric
        detail={`${formatNumber(totals.botClicks)} clics automatizados`}
        label="Tráfico automatizado"
        value={`${formatDecimal(totals.botSharePercent)}%`}
      />
    </dl>
  )
}

function LinkMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="grid content-start gap-2 p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mono text-2xl font-semibold text-foreground">{value}</dd>
      {detail ? <dd className="text-xs text-muted-foreground">{detail}</dd> : null}
    </Card>
  )
}

function AnalyticsChartSkeleton() {
  return (
    <div
      aria-label="Cargando métricas"
      className="grid h-64 place-items-center rounded-lg bg-muted/70 text-sm text-muted-foreground"
      role="status"
    >
      Cargando métricas...
    </div>
  )
}

async function fetchJson<T>(input: RequestInfo | URL, signal?: AbortSignal): Promise<T> {
  const response = await fetch(input, { signal })
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
  return response.json() as Promise<T>
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function AssignmentInfo({
  items,
  title,
}: {
  items: Array<{ id: string; name: string }>
  title: string
}) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <Badge key={item.id} variant="outline">
              {item.name}
            </Badge>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Sin asignaciones.</p>
        )}
      </div>
    </Card>
  )
}

export function Info({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-sm font-medium">
        {label === 'Estado' ? <Badge variant="outline">{value}</Badge> : value}
      </p>
    </Card>
  )
}

function formatComparisonPercent(comparison: LinkAnalyticsComparison | null) {
  if (!comparison) return '—'
  if (comparison.previousClicks === 0) {
    return comparison.currentClicks > 0 ? 'Nuevo' : 'Sin base'
  }
  const value = comparison.deltaPercent ?? 0
  return `${value > 0 ? '+' : ''}${formatDecimal(value)}%`
}

function formatSignedNumber(value: number) {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es').format(value)
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat('es', { maximumFractionDigits: 1 }).format(value)
}
