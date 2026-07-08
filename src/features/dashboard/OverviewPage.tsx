import { Link } from '@tanstack/react-router'
import { Download, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MiniBars } from '#/components/Charts'
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
  series: Array<Record<string, string | number>>
}

export function OverviewPage() {
  const [overview, setOverview] = useState<Overview>({
    totals: { totalClicks: 0, clicks7d: 0, clicks30d: 0, activeLinks: 0 },
    series: [],
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
        setOverview(overviewData as Overview)
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
        {[
          ['Clics totales', overview.totals.totalClicks],
          ['Últimos 7 días', overview.totals.clicks7d],
          ['Últimos 30 días', overview.totals.clicks30d],
          ['Enlaces activos', overview.totals.activeLinks],
        ].map(([label, value]) => (
          <Card className="p-4" key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>
      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="mb-3 text-sm font-medium">Clics en el tiempo</h2>
          <MiniBars data={overview.series} />
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
    </>
  )
}
