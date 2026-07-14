import { useMemo, useState } from 'react'
import {
  ActiveDot,
  Area,
  AreaChart,
  Grid,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from '#/components/dither-kit'
import {
  SegmentedControl,
  type SegmentedControlOption,
} from '#/components/ui/segmented-control'
import { cn } from '#/lib/utils'

export type ChartPoint = {
  metric_date: string
  human_clicks?: number
  bot_clicks?: number
  /** Compatibilidad transitoria con el contrato anterior. */
  clicks?: number
}

type ComparisonRow = {
  currentDate: string
  previousDate: string
  tooltipLabel: string
  current: number
  previous: number
}

const comparisonConfig = {
  current: { label: 'Periodo seleccionado', color: 'blue' },
  previous: { label: 'Periodo anterior', color: 'purple' },
} as const

const currentConfig = {
  current: comparisonConfig.current,
} as const

type ChartView = 'current' | 'comparison'

const chartViewOptions: readonly SegmentedControlOption<ChartView>[] = [
  {
    value: 'current',
    label: 'Solo periodo',
    ariaLabel: 'Mostrar solo el periodo seleccionado',
    tone: 'blue',
    visual: (
      <span aria-hidden="true" className="relative h-3 w-4 shrink-0">
        <span className="absolute inset-x-0 top-[5px] h-px bg-blue-500" />
        <span className="absolute right-0 top-[3px] size-1.5 rounded-full border border-white bg-blue-600 shadow-[0_0_0_1px_#358ff3]" />
      </span>
    ),
  },
  {
    value: 'comparison',
    label: 'Comparar periodo anterior',
    ariaLabel: 'Comparar con el periodo anterior',
    tone: 'purple',
    visual: (
      <span aria-hidden="true" className="relative h-3 w-4 shrink-0">
        <span className="absolute inset-x-0 top-[2px] h-px bg-blue-500" />
        <span className="absolute inset-x-0 top-[8px] border-t border-dashed border-purple-600" />
      </span>
    ),
  },
]

export function ComparisonTrendChart({
  current,
  previous = [],
}: {
  current: ChartPoint[]
  previous?: ChartPoint[]
}) {
  const [view, setView] = useState<ChartView>('current')
  const isComparing = view === 'comparison'
  const rows = useMemo<ComparisonRow[]>(
    () =>
      current.map((point, index) => {
        const previousPoint = previous[index]
        const previousDate = previousPoint?.metric_date ?? ''
        return {
          currentDate: point.metric_date,
          previousDate,
          tooltipLabel: previousDate
            ? `${formatDate(point.metric_date)} · anterior ${formatDate(previousDate)}`
            : formatDate(point.metric_date),
          current: getHumanClicks(point),
          previous: previousPoint ? getHumanClicks(previousPoint) : 0,
        }
      }),
    [current, previous],
  )

  if (!rows.length) return <EmptyChart className="h-64" />

  return (
    <div className="overflow-hidden rounded-lg border border-blue-200/80 bg-card p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <SegmentedControl
          ariaLabel="Vista del gráfico"
          onChange={setView}
          options={chartViewOptions}
          value={view}
        />
        <span>{isComparing ? 'Comparación por día equivalente' : 'Clics humanos por día'}</span>
      </div>
      <div className="h-64 min-w-0">
        <AreaChart
          animate={false}
          ariaLabel={
            isComparing
              ? 'Clics humanos del periodo seleccionado comparados con el periodo anterior'
              : 'Clics humanos del periodo seleccionado'
          }
          bloom="off"
          className="rounded-md bg-blue-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          config={isComparing ? comparisonConfig : currentConfig}
          data={rows}
          getPointLabel={(row) =>
            isComparing
              ? `${formatLongDate(row.currentDate)}: ${formatNumber(row.current)} clics humanos; ${formatLongDate(row.previousDate)}: ${formatNumber(row.previous)} del periodo anterior`
              : `${formatLongDate(row.currentDate)}: ${formatNumber(row.current)} clics humanos`
          }
          key={view}
          margins={{ top: 30, right: 14, bottom: 30, left: 42 }}
        >
          <Grid horizontal vertical={false} />
          <XAxis
            dataKey="currentDate"
            maxTicks={7}
            tickFormatter={(value) => formatDate(String(value))}
          />
          <YAxis tickFormatter={formatNumber} />
          {isComparing ? <Legend isClickable /> : null}
          <Tooltip
            labelFormatter={(value) =>
              isComparing ? String(value) : formatDate(String(value))
            }
            labelKey={isComparing ? 'tooltipLabel' : 'currentDate'}
            valueFormatter={(value) => `${formatNumber(value)} clics humanos`}
          />
          <Area dataKey="current" variant="gradient">
            <ActiveDot variant="colored-border" />
          </Area>
          {isComparing ? (
            <Line dataKey="previous" variant="dotted">
              <ActiveDot variant="colored-border" />
            </Line>
          ) : null}
        </AreaChart>
      </div>
    </div>
  )
}

function EmptyChart({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'grid place-items-center rounded-lg border border-dashed border-purple-200 bg-purple-50/40 px-4 text-center text-sm text-muted-foreground',
        className,
      )}
    >
      No hay clics humanos en este periodo
    </div>
  )
}

function getHumanClicks(point: ChartPoint) {
  return Number(point.human_clicks ?? point.clicks ?? 0)
}

function formatDate(date: string) {
  return formatDateWithOptions(date, { day: '2-digit', month: 'short' })
}

function formatLongDate(date: string) {
  return formatDateWithOptions(date, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateWithOptions(
  date: string,
  options: Intl.DateTimeFormatOptions,
) {
  if (!date) return 'Sin fecha'
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es', { ...options, timeZone: 'UTC' }).format(parsed)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es').format(value)
}
