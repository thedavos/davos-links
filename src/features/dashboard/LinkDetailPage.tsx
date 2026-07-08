import { Link } from '@tanstack/react-router'
import { Copy, Download, ExternalLink, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ComparisonTrendChart, type ChartPoint } from '#/components/Charts'
import { PageHeader } from '#/components/DashboardShell'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import {
  DateRangePicker,
  defaultDateRange,
  type DateRange,
} from '#/components/ui/date-range'
import { PUBLIC_ORIGIN } from '#/lib/constants'
import type { LinkRow } from '#/lib/types'

export function LinkDetailPage({ id }: { id: string }) {
  const [link, setLink] = useState<LinkRow | null | undefined>(undefined)
  const [series, setSeries] = useState<ChartPoint[]>([])
  const [previousSeries, setPreviousSeries] = useState<ChartPoint[]>([])
  const [comparison, setComparison] = useState<AnalyticsComparison | null>(null)
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(30))
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLink(undefined)
    setError('')
    setSeries([])
    setPreviousSeries([])
    setComparison(null)
    const params = new URLSearchParams(range)
    void Promise.all([
      fetch(`/api/links/${id}`).then((response) => response.json()),
      fetch(`/api/links/${id}/analytics?${params.toString()}`).then((response) =>
        response.json(),
      ),
    ])
      .then(([linkData, analyticsData]) => {
        const typedLinkData = linkData as { link?: LinkRow }
        const typedAnalyticsData = analyticsData as {
          series?: ChartPoint[]
          previousSeries?: ChartPoint[]
          comparison?: AnalyticsComparison
        }
        setLink(typedLinkData.link ?? null)
        setSeries(typedAnalyticsData.series ?? [])
        setPreviousSeries(typedAnalyticsData.previousSeries ?? [])
        setComparison(typedAnalyticsData.comparison ?? null)
      })
      .catch(() => {
        setError('No se pudo cargar el enlace.')
        setLink(null)
      })
  }, [id, range])

  if (link === undefined) {
    return <PageHeader title="Cargando enlace" />
  }

  if (link === null) {
    return <PageHeader detail={error || undefined} title="No encontramos este enlace" />
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
        <Info label="Clics totales" value={String(link.clicks ?? 0)} />
      </div>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <AssignmentInfo items={link.tags ?? []} title="Etiquetas" />
        <AssignmentInfo items={link.campaigns ?? []} title="Campañas" />
      </section>
      <section className="mt-8">
        <div className="mb-3 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-sm font-medium">Clics en el tiempo</h2>
            {comparison ? <ComparisonSummary comparison={comparison} /> : null}
          </div>
          <DateRangePicker onChange={setRange} value={range} />
        </div>
        <ComparisonTrendChart current={series} previous={previousSeries} />
      </section>
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {['Principales orígenes', 'Países destacados', 'Dispositivos'].map((title) => (
          <Card className="p-4" key={title}>
            <h2 className="text-sm font-medium">{title}</h2>
            <p className="mt-6 text-sm text-muted-foreground">
              Todavía no hay datos suficientes.
            </p>
          </Card>
        ))}
      </section>
    </>
  )
}

type AnalyticsComparison = {
  currentClicks: number
  previousClicks: number
  delta: number
  deltaPercent: number
  trend: 'up' | 'down' | 'flat'
}

function ComparisonSummary({ comparison }: { comparison: AnalyticsComparison }) {
  return (
    <p className="mono mt-1 text-xs text-muted-foreground">
      {formatSignedNumber(comparison.delta)} clics ·{' '}
      {formatSignedPercent(comparison.deltaPercent)} vs periodo anterior
    </p>
  )
}

function formatSignedNumber(value: number) {
  return `${value > 0 ? '+' : ''}${new Intl.NumberFormat('es').format(value)}`
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
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
