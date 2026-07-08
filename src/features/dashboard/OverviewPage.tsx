import { Link } from '@tanstack/react-router'
import { Download, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  ActivityHeatmap,
  ComparisonTrendChart,
  MetricSparkline,
  type ChartPoint,
} from '#/components/Charts'
import { PageHeader } from '#/components/DashboardShell'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import {
  DateRangePicker,
  defaultDateRange,
  type DateRange,
} from '#/components/ui/date-range'
import type { LinkRow } from '#/lib/types'

type Overview = {
  totals: {
    totalClicks: number
    clicks7d: number
    clicks30d: number
    activeLinks: number
  }
  series: ChartPoint[]
  previousSeries: ChartPoint[]
  comparison: AnalyticsComparison
  heatmap: ChartPoint[]
}

type AnalyticsComparison = {
  currentClicks: number
  previousClicks: number
  delta: number
  deltaPercent: number
  trend: 'up' | 'down' | 'flat'
}

const emptyComparison: AnalyticsComparison = {
  currentClicks: 0,
  previousClicks: 0,
  delta: 0,
  deltaPercent: 0,
  trend: 'flat',
}

export function OverviewPage() {
  const [overview, setOverview] = useState<Overview>({
    totals: { totalClicks: 0, clicks7d: 0, clicks30d: 0, activeLinks: 0 },
    series: [],
    previousSeries: [],
    comparison: emptyComparison,
    heatmap: [],
  })
  const [links, setLinks] = useState<LinkRow[]>([])
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(30))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams(range)
    void Promise.all([
      fetch(`/api/analytics/overview?${params.toString()}`).then((response) =>
        response.json(),
      ),
      fetch('/api/links').then((response) => response.json()),
    ])
      .then(([overviewData, linksData]) => {
        const typedLinksData = linksData as { links?: LinkRow[] }
        const typedOverviewData = overviewData as Partial<Overview>
        setOverview({
          totals: typedOverviewData.totals ?? {
            totalClicks: 0,
            clicks7d: 0,
            clicks30d: 0,
            activeLinks: 0,
          },
          series: typedOverviewData.series ?? [],
          previousSeries: typedOverviewData.previousSeries ?? [],
          comparison: typedOverviewData.comparison ?? emptyComparison,
          heatmap: typedOverviewData.heatmap ?? typedOverviewData.series ?? [],
        })
        setLinks(typedLinksData.links ?? [])
      })
      .catch(() => setError('No se pudieron cargar las métricas.'))
      .finally(() => setLoading(false))
  }, [range])

  const topLinks = links.slice(0, 5)

  return (
    <>
      <PageHeader
        action={
          <>
            <Button asChild variant="outline">
              <a href={`/api/analytics/export.csv?${new URLSearchParams(range)}`}>
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
        detail="Una vista rápida de cómo se están usando tus enlaces."
        title="Resumen"
      />
      <div className="mb-4 flex justify-end">
        <DateRangePicker onChange={setRange} value={range} />
      </div>
      {error ? (
        <p className="mb-4 border border-destructive px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="mb-4 border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Cargando métricas...
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Clics totales"
          previousSeries={overview.previousSeries}
          series={overview.series}
          value={overview.totals.totalClicks}
        />
        <MetricCard
          label="Últimos 7 días"
          previousSeries={overview.previousSeries.slice(-7)}
          series={overview.series.slice(-7)}
          value={overview.totals.clicks7d}
        />
        <MetricCard
          label="Últimos 30 días"
          previousSeries={overview.previousSeries.slice(-30)}
          series={overview.series.slice(-30)}
          value={overview.totals.clicks30d}
        />
        <MetricCard label="Enlaces activos" value={overview.totals.activeLinks} />
      </div>
      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="mb-3 text-sm font-medium">Clics en el tiempo</h2>
          <ComparisonTrendChart
            current={overview.series}
            previous={overview.previousSeries}
          />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-medium">Enlaces con más actividad</h2>
          <Card className="divide-y divide-border">
            {topLinks.length ? (
              topLinks.map((link) => (
                <Link
                  className="block p-3 hover:bg-muted"
                  key={link.id}
                  params={{ id: link.id }}
                  to="/dashboard/links/$id"
                >
                  <p className="truncate text-sm font-medium">{link.title}</p>
                  <p className="mono mt-1 truncate text-xs text-muted-foreground">
                    /{link.short_path}
                  </p>
                </Link>
              ))
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                Todavía no tienes enlaces.
              </p>
            )}
          </Card>
        </div>
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium">Actividad diaria</h2>
        <ActivityHeatmap data={overview.heatmap} />
      </section>
    </>
  )
}

function MetricCard({
  label,
  previousSeries,
  series,
  value,
}: {
  label: string
  previousSeries?: ChartPoint[]
  series?: ChartPoint[]
  value: number
}) {
  const comparison = series ? comparePoints(series, previousSeries ?? []) : null

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold">{formatNumber(value)}</p>
        </div>
        {comparison ? (
          <span className="mono mt-1 text-xs text-muted-foreground">
            {formatSignedNumber(comparison.delta)} ·{' '}
            {formatSignedPercent(comparison.deltaPercent)}
          </span>
        ) : null}
      </div>
      {series ? (
        <div className="mt-4">
          <MetricSparkline data={series} label={`${label} en el tiempo`} />
        </div>
      ) : (
        <p className="mt-5 text-xs text-muted-foreground">Sin histórico diario</p>
      )}
    </Card>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es').format(value)
}

function formatSignedNumber(value: number) {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function comparePoints(series: ChartPoint[], previousSeries: ChartPoint[]) {
  const currentClicks = sumClicks(series)
  const previousClicks = sumClicks(previousSeries)
  const delta = currentClicks - previousClicks
  const deltaPercent =
    previousClicks === 0 ? (currentClicks > 0 ? 100 : 0) : (delta / previousClicks) * 100

  return { delta, deltaPercent }
}

function sumClicks(series: ChartPoint[]) {
  return series.reduce((total, point) => total + point.clicks, 0)
}
