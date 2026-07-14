import { FolderKanban, Megaphone, RadioTower, Tag, Waypoints } from 'lucide-react'
import { useMemo, useRef, useState, type MutableRefObject } from 'react'
import {
  Bar,
  BarChart,
  Grid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from '#/components/dither-kit'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { InfoTooltip } from '#/components/ui/info-tooltip'
import {
  SegmentedControl,
  type SegmentedControlOption,
} from '#/components/ui/segmented-control'
import type {
  AnalyticsHeatmap,
  AnalyticsPerformanceItem,
  AnalyticsUtmItem,
  AnalyticsUtmPerformance,
} from '#/lib/types'
import { cn } from '#/lib/utils'
import { FALLBACK_TIME_ZONE, formatTimeZoneLabel } from '#/lib/time-zone'

type CategoryView = 'campaigns' | 'tags'
type UtmView = 'campaigns' | 'sources' | 'mediums'

const categoryOptions: readonly SegmentedControlOption<CategoryView>[] = [
  {
    value: 'campaigns',
    label: 'Campañas',
    tone: 'coral',
    visual: <FolderKanban aria-hidden="true" size={14} strokeWidth={1.8} />,
  },
  {
    value: 'tags',
    label: 'Etiquetas',
    tone: 'blue',
    visual: <Tag aria-hidden="true" size={14} strokeWidth={1.8} />,
  },
]

const utmOptions: readonly SegmentedControlOption<UtmView>[] = [
  {
    value: 'campaigns',
    label: 'Campaña',
    tone: 'coral',
    visual: <Megaphone aria-hidden="true" size={14} strokeWidth={1.8} />,
  },
  {
    value: 'sources',
    label: 'Fuente',
    tone: 'blue',
    visual: <RadioTower aria-hidden="true" size={14} strokeWidth={1.8} />,
  },
  {
    value: 'mediums',
    label: 'Medio',
    tone: 'blue',
    visual: <Waypoints aria-hidden="true" size={14} strokeWidth={1.8} />,
  },
]

const comparisonConfig = {
  current: { label: 'Periodo seleccionado', color: 'blue' },
  previous: { label: 'Periodo anterior', color: 'coral' },
} as const

const dayLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const shortDayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function CategoryPerformancePanel({
  campaigns,
  tags,
}: {
  campaigns: AnalyticsPerformanceItem[]
  tags: AnalyticsPerformanceItem[]
}) {
  const [view, setView] = useState<CategoryView>('campaigns')
  const items = view === 'campaigns' ? campaigns : tags

  return (
    <section aria-labelledby="category-performance-title" className="min-w-0">
      <div className="mb-3">
        <div className="flex min-h-5 items-center gap-1">
          <h2 className="text-base font-semibold" id="category-performance-title">
            Rendimiento por campañas y etiquetas
          </h2>
          <InfoTooltip label="Información sobre clics asociados">
            Cada campaña o etiqueta recibe los clics humanos de sus enlaces. Si un
            enlace pertenece a varias, sus clics pueden aparecer más de una vez.
          </InfoTooltip>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Clics asociados · máximo 5</p>
      </div>
      <Card className="p-4">
        <SegmentedControl
          ariaLabel="Agrupar rendimiento por"
          className="mb-3"
          onChange={setView}
          options={categoryOptions}
          size="sm"
          value={view}
        />
        <ComparisonBarChart
          ariaLabel={`Clics asociados por ${view === 'campaigns' ? 'campaña' : 'etiqueta'}`}
          emptyMessage={`No hay ${view === 'campaigns' ? 'campañas' : 'etiquetas'} con clics asociados en estos periodos.`}
          items={items}
        />
      </Card>
    </section>
  )
}

export function UtmPerformancePanel({
  loading,
  onRetry,
  showHeader = true,
  utm,
}: {
  loading: boolean
  onRetry: () => void
  showHeader?: boolean
  utm: AnalyticsUtmPerformance | null
}) {
  const [view, setView] = useState<UtmView>('campaigns')
  const items = utm?.status === 'ready' ? utm[view] : []
  const truncated = Boolean(
    utm?.coverage.truncated || utm?.previousCoverage.truncated,
  )
  const viewLabel = view === 'campaigns' ? 'campaña' : view === 'sources' ? 'fuente' : 'medio'

  return (
    <section
      aria-label={showHeader ? undefined : 'Rendimiento UTM'}
      aria-labelledby={showHeader ? 'utm-performance-title' : undefined}
      className="min-w-0"
    >
      {showHeader ? (
        <div className="mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold" id="utm-performance-title">
              Rendimiento UTM
            </h2>
            {utm?.source === 'demo' ? <Badge variant="accent">Datos demo</Badge> : null}
            {truncated ? <Badge variant="warning">Rango limitado</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo valores UTM presentes · máximo 5
          </p>
        </div>
      ) : null}

      <Card className="p-4">
        <SegmentedControl
          ariaLabel="Dimensión UTM"
          className="mb-3"
          onChange={setView}
          options={utmOptions}
          size="sm"
          value={view}
        />
        {loading ? (
          <PanelSkeleton className="h-64" />
        ) : utm?.status === 'unavailable' ? (
          <UnavailablePanel onRetry={onRetry} />
        ) : (
          <ComparisonBarChart
            ariaLabel={`Clics humanos por ${viewLabel} UTM`}
            emptyMessage={`No se registraron valores de ${viewLabel} UTM en estos periodos.`}
            items={items.map(toPerformanceItem)}
            valueDetail={(item) => `${formatPercentage(item.sharePercent ?? 0)} del tráfico humano`}
          />
        )}
      </Card>
    </section>
  )
}

export function AnalyticsHeatmapPanel({
  className,
  heatmap,
  loading,
  onRetry,
  timeZone = FALLBACK_TIME_ZONE,
}: {
  className?: string
  heatmap: AnalyticsHeatmap | null
  loading: boolean
  onRetry: () => void
  timeZone?: string
}) {
  const cells = heatmap?.status === 'ready' ? heatmap.cells : []
  const maxClicks = Math.max(0, ...cells.map((cell) => cell.clicks))
  const peakIndex = cells.findIndex((cell) => cell.clicks === maxClicks && maxClicks > 0)
  const [activeIndex, setActiveIndex] = useState(peakIndex >= 0 ? peakIndex : 0)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const cellRefs = useRef<Array<HTMLDivElement | null>>([])
  const displayedIndex = hoveredIndex ?? activeIndex
  const displayedCell = cells[displayedIndex]

  function moveFocus(index: number, key: string) {
    const day = Math.floor(index / 24)
    const hour = index % 24
    let next = index
    if (key === 'ArrowLeft') next = day * 24 + Math.max(0, hour - 1)
    if (key === 'ArrowRight') next = day * 24 + Math.min(23, hour + 1)
    if (key === 'ArrowUp') next = Math.max(0, day - 1) * 24 + hour
    if (key === 'ArrowDown') next = Math.min(6, day + 1) * 24 + hour
    if (key === 'Home') next = day * 24
    if (key === 'End') next = day * 24 + 23
    if (next === index) return
    setActiveIndex(next)
    cellRefs.current[next]?.focus()
  }

  return (
    <section
      aria-labelledby="click-heatmap-title"
      className={cn('min-w-0', className)}
    >
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold" id="click-heatmap-title">
              Actividad por día y hora
            </h2>
            {heatmap?.source === 'demo' ? <Badge variant="accent">Datos demo</Badge> : null}
            {heatmap?.coverage.truncated ? (
              <Badge variant="warning">Rango limitado</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Clics humanos agrupados en {formatTimeZoneLabel(timeZone)}
          </p>
        </div>
        {displayedCell ? (
          <p className="mono text-xs text-muted-foreground" aria-live="polite">
            {formatCell(displayedCell.day, displayedCell.hour, displayedCell.clicks, timeZone)}
          </p>
        ) : null}
      </div>

      <Card className="p-4">
        {loading ? (
          <PanelSkeleton className="h-52" />
        ) : heatmap?.status === 'unavailable' ? (
          <UnavailablePanel onRetry={onRetry} />
        ) : maxClicks === 0 ? (
          <EmptyPanel message="No hay clics humanos para construir el patrón horario." />
        ) : (
          <>
            <div className="overflow-x-auto pb-2">
              <div
                aria-label={`Clics humanos por día de la semana y hora de ${timeZone}`}
                aria-rowcount={8}
                aria-colcount={25}
                className="analytics-heatmap-grid min-w-[760px]"
                role="grid"
              >
                <div aria-hidden="true" role="presentation" />
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    aria-colindex={hour + 2}
                    className="mono text-center text-[10px] text-muted-foreground"
                    key={hour}
                    role="columnheader"
                  >
                    {String(hour).padStart(2, '0')}
                  </div>
                ))}
                {shortDayLabels.map((day, dayIndex) => (
                  <HeatmapRow
                    activeIndex={activeIndex}
                    cellRefs={cellRefs}
                    cells={cells}
                    day={day}
                    dayIndex={dayIndex}
                    key={day}
                    maxClicks={maxClicks}
                    moveFocus={moveFocus}
                    onActive={setActiveIndex}
                    onHover={setHoveredIndex}
                    timeZone={timeZone}
                  />
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-col justify-between gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
              <p>{formatPeak(cells[peakIndex], timeZone)}</p>
              <div aria-label="Escala de intensidad" className="flex items-center gap-1.5">
                <span>Menos</span>
                {[1, 2, 3, 4].map((level) => (
                  <span
                    aria-hidden="true"
                    className="analytics-heat-cell size-3 rounded-[2px]"
                    data-level={level}
                    key={level}
                  />
                ))}
                <span>Más</span>
              </div>
            </div>
          </>
        )}
      </Card>
    </section>
  )
}

function HeatmapRow({
  activeIndex,
  cellRefs,
  cells,
  day,
  dayIndex,
  maxClicks,
  moveFocus,
  onActive,
  onHover,
  timeZone,
}: {
  activeIndex: number
  cellRefs: MutableRefObject<Array<HTMLDivElement | null>>
  cells: AnalyticsHeatmap['cells']
  day: string
  dayIndex: number
  maxClicks: number
  moveFocus: (index: number, key: string) => void
  onActive: (index: number) => void
  onHover: (index: number | null) => void
  timeZone: string
}) {
  const offset = dayIndex * 24
  return (
    <>
      <div
        aria-rowindex={dayIndex + 2}
        className="text-xs font-medium text-muted-foreground"
        role="rowheader"
      >
        {day}
      </div>
      {cells.slice(offset, offset + 24).map((cell, hour) => {
        const index = offset + hour
        const label = formatCell(cell.day, cell.hour, cell.clicks, timeZone)
        return (
          <div
            aria-colindex={hour + 2}
            aria-label={label}
            aria-rowindex={dayIndex + 2}
            className="analytics-heat-cell aspect-square min-h-6 rounded-[3px] border border-blue-100 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            data-level={heatLevel(cell.clicks, maxClicks)}
            key={cell.hour}
            onFocus={() => onActive(index)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              moveFocus(index, event.key)
            }}
            onPointerEnter={() => onHover(index)}
            onPointerLeave={() => onHover(null)}
            ref={(node) => {
              cellRefs.current[index] = node
            }}
            role="gridcell"
            tabIndex={activeIndex === index ? 0 : -1}
            title={label}
          />
        )
      })}
    </>
  )
}

function ComparisonBarChart({
  ariaLabel,
  emptyMessage,
  items,
  valueDetail,
}: {
  ariaLabel: string
  emptyMessage: string
  items: Array<AnalyticsPerformanceItem & { sharePercent?: number }>
  valueDetail?: (item: AnalyticsPerformanceItem & { sharePercent?: number }) => string
}) {
  const rows = useMemo(
    () => items.map((item) => ({
      ...item,
      shortLabel: truncateLabel(item.label),
      current: item.currentClicks,
      previous: item.previousClicks,
    })),
    [items],
  )

  if (!rows.length) return <EmptyPanel message={emptyMessage} />

  return (
    <div className="h-64 min-w-0">
      <BarChart
        animate={false}
        ariaLabel={ariaLabel}
        bloom="off"
        className="rounded-lg bg-blue-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        config={comparisonConfig}
        data={rows}
        getPointLabel={(row) => {
          const item = row as (typeof rows)[number]
          const detail = valueDetail?.(item)
          return `${item.label}: ${formatNumber(item.current)} clics humanos en el periodo seleccionado; ${formatNumber(item.previous)} en el anterior${detail ? `; ${detail}` : ''}`
        }}
        margins={{ top: 12, right: 12, bottom: 58, left: 44 }}
      >
        <Grid horizontal vertical={false} />
        <XAxis dataKey="shortLabel" maxTicks={5} />
        <YAxis tickFormatter={formatNumber} />
        <Legend align="left" isClickable position="bottom" />
        <Tooltip
          labelKey="label"
          valueFormatter={(value) => `${formatNumber(value)} clics humanos`}
        />
        <Bar dataKey="current" variant="gradient" />
        <Bar dataKey="previous" strokeVariant="dashed" variant="gradient" />
      </BarChart>
    </div>
  )
}

function PanelSkeleton({ className }: { className: string }) {
  return (
    <div
      aria-label="Cargando datos analíticos"
      className={cn('animate-pulse rounded-lg bg-muted motion-reduce:animate-none', className)}
      role="status"
    />
  )
}

function UnavailablePanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-40 flex-col items-start justify-center rounded-lg border border-dashed border-coral-200 bg-coral-50 p-5">
      <p className="text-sm text-muted-foreground">Estos datos no están disponibles temporalmente.</p>
      <Button className="mt-3" onClick={onRetry} size="sm" type="button" variant="outline">
        Reintentar
      </Button>
    </div>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-blue-200 bg-blue-50/50 px-5 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function toPerformanceItem(item: AnalyticsUtmItem): AnalyticsPerformanceItem & { sharePercent: number } {
  return {
    id: item.value,
    label: item.value,
    currentClicks: item.currentClicks,
    previousClicks: item.previousClicks,
    delta: item.delta,
    sharePercent: item.sharePercent,
  }
}

function truncateLabel(value: string) {
  return value.length > 13 ? `${value.slice(0, 12)}…` : value
}

function heatLevel(clicks: number, max: number) {
  if (clicks <= 0 || max <= 0) return 0
  const ratio = clicks / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

function formatCell(day: number, hour: number, clicks: number, timeZone: string) {
  return `${dayLabels[day - 1]}, ${String(hour).padStart(2, '0')}:00 ${timeZone}: ${formatNumber(clicks)} clics humanos`
}

function formatPeak(
  cell: AnalyticsHeatmap['cells'][number] | undefined,
  timeZone: string,
) {
  if (!cell) return ''
  return `Mayor actividad: ${dayLabels[cell.day - 1].toLowerCase()}, ${String(cell.hour).padStart(2, '0')}:00–${String(cell.hour).padStart(2, '0')}:59 ${timeZone}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es').format(value)
}

function formatPercentage(value: number) {
  return `${new Intl.NumberFormat('es', { maximumFractionDigits: 1 }).format(value)}%`
}
