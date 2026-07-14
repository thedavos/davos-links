import { Link } from '@tanstack/react-router'
import { Copy, Download, ExternalLink, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ComparisonTrendChart, type ChartPoint } from '#/components/Charts'
import { PageHeader } from '#/components/DashboardShell'
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
import type { AnalyticsBreakdowns, LinkRow } from '#/lib/types'
import { TrafficBreakdowns } from './TrafficBreakdowns'

export function LinkDetailPage({ id }: { id: string }) {
  const [link, setLink] = useState<LinkRow | null | undefined>(undefined)
  const [series, setSeries] = useState<ChartPoint[]>([])
  const [previousSeries, setPreviousSeries] = useState<ChartPoint[]>([])
  const [comparison, setComparison] = useState<AnalyticsComparison | null>(null)
  const [breakdowns, setBreakdowns] = useState<AnalyticsBreakdowns | null>(null)
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(30))
  const [copied, setCopied] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [analyticsError, setAnalyticsError] = useState('')
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [retryNonce, setRetryNonce] = useState(0)
  const [effectiveRange, setEffectiveRange] = useState<DateRange | null>(null)
  const [previousRange, setPreviousRange] = useState<DateRange | null>(null)

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
    setSeries([])
    setPreviousSeries([])
    setComparison(null)
    setBreakdowns(null)
    const params = new URLSearchParams(range)
    void fetchJson<{
      series?: ChartPoint[]
      previousSeries?: ChartPoint[]
      comparison?: AnalyticsComparison
      breakdowns?: AnalyticsBreakdowns
      range?: DateRange
      previousRange?: DateRange
      scope?: 'human'
      timezone?: 'UTC'
    }>(`/api/links/${id}/analytics?${params.toString()}`, controller.signal)
      .then((analyticsData) => {
        setSeries(analyticsData.series ?? [])
        setPreviousSeries(analyticsData.previousSeries ?? [])
        setComparison(analyticsData.comparison ?? null)
        setBreakdowns(analyticsData.breakdowns ?? null)
        setEffectiveRange(analyticsData.range ?? range)
        setPreviousRange(analyticsData.previousRange ?? null)
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
  }, [id, range, retryNonce])

  if (link === undefined) {
    return <PageHeader title="Cargando enlace" />
  }

  if (link === null) {
    return <PageHeader detail={linkError || undefined} title="No encontramos este enlace" />
  }

  const shortUrl = `${PUBLIC_ORIGIN}/${link.short_path}`
  const exportParams = new URLSearchParams({ ...range, linkId: link.id })

  return (
    <>
      <PageHeader
        action={
          <>
            <Button asChild variant="outline">
              <a href={`/api/analytics/export.csv?${exportParams.toString()}`}>
                <Download size={16} />
                Exportar CSV
              </a>
            </Button>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(shortUrl)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              }}
              type="button"
              variant="outline"
            >
              <Copy size={16} />
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button asChild variant="outline">
              <a href={shortUrl} rel="noreferrer" target="_blank">
                <ExternalLink size={16} />
                Abrir
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link params={{ id: link.id }} to="/dashboard/links/$id/edit">
                <Pencil size={16} />
                Editar
              </Link>
            </Button>
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
      <section className="mt-8">
        <div className="mb-3 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <div className="flex min-h-5 items-center gap-1">
              <h2 className="text-sm font-medium leading-5">Clics humanos en el tiempo</h2>
              <InfoTooltip label="Información sobre Clics humanos en el tiempo">
                Excluye crawlers y previews. Los días se agrupan en UTC. “Comparar
                anterior” superpone el periodo inmediatamente anterior con la misma
                duración.
              </InfoTooltip>
            </div>
            {comparison && effectiveRange ? (
              <ComparisonSummary
                comparison={comparison}
                currentRange={effectiveRange}
                previousRange={previousRange}
              />
            ) : null}
          </div>
          <DateRangePicker onChange={setRange} value={range} />
        </div>
        {analyticsError ? (
          <div
            className="mb-3 flex flex-col justify-between gap-3 border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:flex-row sm:items-center"
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
        {analyticsLoading ? <AnalyticsChartSkeleton /> : <ComparisonTrendChart current={series} previous={previousSeries} />}
      </section>
      <TrafficBreakdowns
        breakdowns={breakdowns}
        loading={analyticsLoading}
        onRetry={() => setRetryNonce((value) => value + 1)}
      />
    </>
  )
}

function AnalyticsChartSkeleton() {
  return (
    <div
      aria-label="Cargando métricas"
      className="grid h-72 place-items-center rounded-lg border border-dashed border-blue-200 bg-blue-50/35 text-sm text-muted-foreground"
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

type AnalyticsComparison = {
  currentClicks: number
  previousClicks: number
  delta: number
  deltaPercent: number | null
  trend: 'up' | 'down' | 'flat'
}

function ComparisonSummary({
  comparison,
  currentRange,
  previousRange,
}: {
  comparison: AnalyticsComparison
  currentRange: DateRange
  previousRange: DateRange | null
}) {
  const delta =
    comparison.previousClicks === 0
      ? comparison.currentClicks > 0
        ? 'Nuevo · sin base anterior'
        : 'Sin actividad humana en ambos periodos'
      : `${formatSignedNumber(comparison.delta)} clics humanos · ${formatSignedPercent(comparison.deltaPercent)} vs periodo anterior`

  return (
    <p className="mono mt-1 text-xs text-muted-foreground">
      {delta} · {formatRange(currentRange)}
      {previousRange ? ` vs ${formatRange(previousRange)}` : ''} · UTC
    </p>
  )
}

function formatSignedNumber(value: number) {
  return `${value > 0 ? '+' : ''}${new Intl.NumberFormat('es').format(value)}`
}

function formatSignedPercent(value: number | null) {
  if (value === null) return 'Sin base anterior'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatRange(range: DateRange) {
  return `${formatDate(range.from)}–${formatDate(range.to)}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`))
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
