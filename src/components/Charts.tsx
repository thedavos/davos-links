import { useMemo, useState, type CSSProperties } from 'react'
import { cn } from '#/lib/utils'

export type ChartPoint = {
  metric_date: string
  clicks: number
  bot_clicks?: number
}

type TooltipPoint = {
  date: string
  current: number
  previous?: number
}

export function MetricSparkline({
  data,
  label,
}: {
  data: ChartPoint[]
  label: string
}) {
  const values = data.map((point) => point.clicks)
  const drawing = useMemo(() => createLineDrawing(values, 180, 48, 4), [values])
  const lastPoint = drawing.points.at(-1)

  if (!data.length) {
    return (
      <div className="grid h-12 place-items-center border border-dashed border-border text-xs text-muted-foreground">
        Sin datos
      </div>
    )
  }

  return (
    <svg
      aria-label={label}
      className="h-12 w-full overflow-visible"
      role="img"
      viewBox="0 0 180 48"
    >
      {drawing.area ? <path d={drawing.area} fill="rgb(245 245 245)" /> : null}
      <path d={drawing.line} fill="none" stroke="rgb(23 23 23)" strokeWidth="1.8" />
      {lastPoint ? (
        <circle cx={lastPoint.x} cy={lastPoint.y} fill="rgb(23 23 23)" r="2.4" />
      ) : null}
    </svg>
  )
}

export function ComparisonTrendChart({
  current,
  previous = [],
}: {
  current: ChartPoint[]
  previous?: ChartPoint[]
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const values = [
    ...current.map((point) => point.clicks),
    ...previous.map((point) => point.clicks),
  ]
  const max = Math.max(2, ...values)
  const currentDrawing = createLineDrawing(
    current.map((point) => point.clicks),
    640,
    180,
    16,
    max,
  )
  const previousDrawing = createLineDrawing(
    previous.map((point) => point.clicks),
    640,
    180,
    16,
    max,
  )
  const activePoint =
    activeIndex == null
      ? null
      : {
          date: current[activeIndex]?.metric_date ?? '',
          current: current[activeIndex]?.clicks ?? 0,
          previous: previous[activeIndex]?.clicks ?? 0,
        }

  if (!current.length) {
    return <EmptyChart className="h-56" />
  }

  return (
    <div className="relative border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-px w-5 bg-foreground" />
            Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-px w-5 border-t border-dashed border-muted-foreground" />
            Periodo anterior
          </span>
        </div>
        <span className="mono">max {formatNumber(max)}</span>
      </div>
      <div className="relative h-48">
        <svg
          aria-label="Clics en el tiempo comparados con el periodo anterior"
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 640 180"
        >
          {[0.25, 0.5, 0.75].map((line) => (
            <line
              key={line}
              stroke="rgb(229 229 229)"
              strokeWidth="1"
              x1="0"
              x2="640"
              y1={180 * line}
              y2={180 * line}
            />
          ))}
          {previousDrawing.line ? (
            <path
              d={previousDrawing.line}
              fill="none"
              stroke="rgb(163 163 163)"
              strokeDasharray="5 5"
              strokeLinecap="round"
              strokeWidth="2"
            />
          ) : null}
          {currentDrawing.area ? (
            <path d={currentDrawing.area} fill="rgb(245 245 245)" />
          ) : null}
          <path
            d={currentDrawing.line}
            fill="none"
            stroke="rgb(23 23 23)"
            strokeLinecap="round"
            strokeWidth="2.4"
          />
          {activeIndex != null && currentDrawing.points[activeIndex] ? (
            <g>
              <line
                stroke="rgb(163 163 163)"
                strokeDasharray="3 3"
                x1={currentDrawing.points[activeIndex].x}
                x2={currentDrawing.points[activeIndex].x}
                y1="0"
                y2="180"
              />
              <circle
                cx={currentDrawing.points[activeIndex].x}
                cy={currentDrawing.points[activeIndex].y}
                fill="white"
                r="4"
                stroke="rgb(23 23 23)"
                strokeWidth="2"
              />
            </g>
          ) : null}
        </svg>
        <div className="absolute inset-0 flex">
          {current.map((point, index) => (
            <button
              aria-label={`${formatDate(point.metric_date)}: ${formatNumber(point.clicks)} clics`}
              className="h-full min-w-0 flex-1 cursor-crosshair focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              key={point.metric_date ?? index}
              onBlur={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              type="button"
            />
          ))}
        </div>
        {activePoint ? (
          <ChartTooltip
            point={activePoint}
            style={{
              left: `${positionPercent(activeIndex ?? 0, current.length)}%`,
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

export function ActivityHeatmap({ data }: { data: ChartPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((point) => point.clicks))
  const leadingDays = data[0] ? getDayOffset(data[0].metric_date) : 0
  const cells = [
    ...Array.from({ length: leadingDays }, (_, index) => ({
      key: `empty-${index}`,
      point: null,
    })),
    ...data.map((point) => ({ key: point.metric_date, point })),
  ]
  const activePoint =
    activeIndex == null || !data[activeIndex]
      ? null
      : {
          date: data[activeIndex].metric_date,
          current: data[activeIndex].clicks,
        }

  if (!data.length) {
    return <EmptyChart className="h-36" />
  }

  return (
    <div className="relative border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Actividad diaria</span>
        <span className="mono">max {formatNumber(max)}</span>
      </div>
      <div
        className="grid auto-cols-[minmax(10px,1fr)] grid-flow-col grid-rows-7 gap-1"
        onMouseLeave={() => setActiveIndex(null)}
      >
        {cells.map((cell) =>
          cell.point ? (
            <button
              aria-label={`${formatDate(cell.point.metric_date)}: ${formatNumber(cell.point.clicks)} clics`}
              className={cn(
                'aspect-square min-h-2 border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                intensityClass(cell.point.clicks, max),
              )}
              key={cell.key}
              onBlur={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(data.indexOf(cell.point))}
              onMouseEnter={() => setActiveIndex(data.indexOf(cell.point))}
              title={`${formatDate(cell.point.metric_date)} · ${formatNumber(cell.point.clicks)} clics`}
              type="button"
            />
          ) : (
            <div aria-hidden="true" className="aspect-square min-h-2" key={cell.key} />
          ),
        )}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-xs text-muted-foreground">
        <span>Bajo</span>
        {[0, 1, 2, 3].map((level) => (
          <span
            aria-hidden="true"
            className={cn('h-2.5 w-2.5 border border-border', heatmapLegendClass(level))}
            key={level}
          />
        ))}
        <span>Alto</span>
      </div>
      {activePoint ? <ChartTooltip point={activePoint} style={{ right: 12, top: 34 }} /> : null}
    </div>
  )
}

export function ChartTooltip({
  point,
  style,
}: {
  point: TooltipPoint
  style?: CSSProperties
}) {
  const delta =
    point.previous == null
      ? null
      : {
          value: point.current - point.previous,
          percent:
            point.previous === 0
              ? point.current > 0
                ? 100
                : 0
              : ((point.current - point.previous) / point.previous) * 100,
        }

  return (
    <div
      className="pointer-events-none absolute top-2 z-10 min-w-44 -translate-x-1/2 border border-border bg-background p-3 text-xs shadow-sm"
      role="status"
      style={style}
    >
      <p className="mono text-muted-foreground">{formatDate(point.date)}</p>
      <p className="mt-2 flex items-center justify-between gap-5">
        <span>Actual</span>
        <strong className="mono font-medium">{formatNumber(point.current)}</strong>
      </p>
      {point.previous != null ? (
        <>
          <p className="mt-1 flex items-center justify-between gap-5 text-muted-foreground">
            <span>Anterior</span>
            <span className="mono">{formatNumber(point.previous)}</span>
          </p>
          <p className="mt-1 flex items-center justify-between gap-5 text-muted-foreground">
            <span>Delta</span>
            <span className="mono">
              {formatSignedNumber(delta?.value ?? 0)} ·{' '}
              {formatSignedPercent(delta?.percent ?? 0)}
            </span>
          </p>
        </>
      ) : null}
    </div>
  )
}

export function MiniBars({
  data,
  valueKey = 'clicks',
}: {
  data: Array<Record<string, string | number>>
  valueKey?: string
}) {
  const values = data.map((item) => Number(item[valueKey] ?? 0))
  const max = Math.max(2, ...values)
  const sparse = values.length > 0 && values.length <= 7

  return (
    <div
      className={cn(
        'flex h-40 items-end gap-1 border border-neutral-200 p-3',
        sparse && 'justify-center',
      )}
    >
      {values.length ? (
        values.map((value, index) => (
          <div
            className={cn('bg-neutral-950', sparse ? 'w-2' : 'flex-1')}
            key={`${value}-${index}`}
            style={{ height: value > 0 ? `${Math.max(3, (value / max) * 100)}%` : 0 }}
            title={`${value}`}
          />
        ))
      ) : (
        <div className="grid h-full w-full place-items-center text-sm text-neutral-500">
          Todavía no hay datos
        </div>
      )}
    </div>
  )
}

function EmptyChart({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'grid place-items-center border border-dashed border-border text-sm text-muted-foreground',
        className,
      )}
    >
      Todavía no hay datos
    </div>
  )
}

function createLineDrawing(
  values: number[],
  width: number,
  height: number,
  padding: number,
  forcedMax?: number,
) {
  if (!values.length) return { line: '', area: '', points: [] as Array<Point> }

  const max = Math.max(2, forcedMax ?? Math.max(...values))
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2
  const points = values.map((value, index) => ({
    x: padding + (values.length === 1 ? innerWidth : (index / (values.length - 1)) * innerWidth),
    y: padding + innerHeight - (Math.max(0, value) / max) * innerHeight,
  }))
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const first = points[0]
  const last = points.at(-1)
  const area =
    first && last ? `${line} L ${last.x} ${height - padding} L ${first.x} ${height - padding} Z` : ''

  return { line, area, points }
}

function positionPercent(index: number, count: number) {
  if (count <= 1) return 50
  return Math.min(92, Math.max(8, (index / (count - 1)) * 100))
}

function getDayOffset(date: string) {
  if (!date) return 0
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay()
  return day === 0 ? 6 : day - 1
}

function intensityClass(value: number, max: number) {
  if (value <= 0) return 'bg-white'
  const ratio = value / max
  if (ratio > 0.75) return 'bg-neutral-950'
  if (ratio > 0.45) return 'bg-neutral-700'
  if (ratio > 0.2) return 'bg-neutral-400'
  return 'bg-neutral-200'
}

function heatmapLegendClass(level: number) {
  return ['bg-white', 'bg-neutral-200', 'bg-neutral-700', 'bg-neutral-950'][level]
}

function formatDate(date: string) {
  if (!date) return 'Sin fecha'
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(parsed)
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

type Point = {
  x: number
  y: number
}
