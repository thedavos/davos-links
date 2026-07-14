import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import type { AnalyticsBreakdownItem, AnalyticsBreakdowns } from '#/lib/types'
import { cn } from '#/lib/utils'

const CARD_CONFIG = {
  referrers: {
    id: 'traffic-referrers-title',
    title: 'Principales orígenes',
    fill: 'bg-blue-500',
  },
  countries: {
    id: 'traffic-countries-title',
    title: 'Países destacados',
    fill: 'bg-coral-500',
  },
  devices: {
    id: 'traffic-devices-title',
    title: 'Dispositivos',
    fill: 'bg-blue-700',
  },
} as const

export type BreakdownKind = keyof typeof CARD_CONFIG

export function TrafficBreakdowns({
  breakdowns,
  className,
  detail = 'Solo clics humanos del periodo seleccionado',
  loading,
  onRetry,
  title = 'Desglose del tráfico',
}: {
  breakdowns: AnalyticsBreakdowns | null
  className?: string
  detail?: string
  loading: boolean
  onRetry: () => void
  title?: string
}) {
  const unavailable = breakdowns?.status === 'unavailable'

  return (
    <section
      aria-busy={loading}
      aria-labelledby="traffic-breakdown-title"
      className={cn('mt-8', className)}
    >
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium" id="traffic-breakdown-title">
              {title}
            </h2>
            {breakdowns?.source === 'demo' ? (
              <Badge variant="accent">Datos demo</Badge>
            ) : null}
            {breakdowns?.coverage.truncated ? (
              <Badge variant="warning">Rango limitado</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {detail}
          </p>
        </div>
        {breakdowns?.status === 'ready' ? (
          <p className="mono text-xs text-muted-foreground">
            {formatNumber(breakdowns.totalClicks)} clics analizados
          </p>
        ) : null}
      </div>

      {unavailable ? (
        <div
          className="mb-3 flex flex-col justify-between gap-3 border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-warning sm:flex-row sm:items-center"
          role="alert"
        >
          <span>
            {breakdowns.reason === 'not_configured'
              ? 'Los desgloses todavía no están configurados en este entorno.'
              : 'Los desgloses no están disponibles temporalmente.'}
          </span>
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            Reintentar
          </Button>
        </div>
      ) : null}

      {breakdowns?.coverage.truncated ? (
        <p className="mb-3 text-xs text-muted-foreground">
          La vista detallada comienza el {formatCoverageDate(breakdowns.coverage.from)} por
          la retención de Analytics Engine.
        </p>
      ) : null}

      <div className="grid gap-8 md:grid-cols-3 md:gap-6">
        {(['referrers', 'countries', 'devices'] as const).map((kind) => (
          <TrafficBreakdownCard
            items={breakdowns?.status === 'ready' ? breakdowns[kind] : []}
            key={kind}
            kind={kind}
            loading={loading}
            unavailable={unavailable}
          />
        ))}
      </div>
    </section>
  )
}

export function TrafficBreakdownCard({
  className,
  items,
  kind,
  loading,
  unavailable,
}: {
  className?: string
  items: AnalyticsBreakdownItem[]
  kind: BreakdownKind
  loading: boolean
  unavailable: boolean
}) {
  const config = CARD_CONFIG[kind]

  return (
    <Card
      aria-labelledby={config.id}
      className={cn('min-w-0 p-4', className)}
      role="region"
    >
      <h3 className="text-sm font-semibold" id={config.id}>{config.title}</h3>

      {loading ? (
        <div aria-label={`Cargando ${config.title.toLowerCase()}`} className="mt-4 grid gap-4">
          {[72, 54, 38].map((width) => (
            <div className="grid gap-2" key={width}>
              <div className="h-3 rounded-sm bg-muted" style={{ width: `${width}%` }} />
              <div className="h-1.5 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ) : items.length ? (
        <ol className="mt-4 grid gap-3">
          {items.map((item) => {
            const label = formatBreakdownValue(kind, item.value)
            return (
              <li
                aria-label={`${label}: ${formatNumber(item.clicks)} clics, ${formatPercentage(item.percentage)}`}
                key={item.value || '__empty'}
              >
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-medium" title={label}>
                    {label}
                  </span>
                  <span className="mono shrink-0 text-muted-foreground">
                    {formatNumber(item.clicks)} · {formatPercentage(item.percentage)}
                  </span>
                </div>
                <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('dither-static h-full rounded-full', config.fill)}
                    style={{ width: `${Math.max(1, Math.min(100, item.percentage))}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {unavailable ? 'Datos no disponibles.' : 'Sin clics humanos en este periodo.'}
        </p>
      )}
    </Card>
  )
}

function formatBreakdownValue(kind: BreakdownKind, value: string) {
  if (kind === 'referrers') return value || 'Directo / sin referencia'
  if (kind === 'devices') {
    return (
      {
        Mobile: 'Móvil',
        Tablet: 'Tablet',
        Desktop: 'Escritorio',
        Unknown: 'Desconocido',
      }[value] ?? (value || 'Desconocido')
    )
  }
  if (!value) return 'Desconocido'
  if (value === 'T1') return 'Red Tor'
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(value) ?? value
  } catch {
    return value
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es').format(value)
}

function formatPercentage(value: number) {
  return `${new Intl.NumberFormat('es', { maximumFractionDigits: 1 }).format(value)}%`
}

function formatCoverageDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}
