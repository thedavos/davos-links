import { useMemo, useState } from 'react'
import {
  ActiveDot,
  Area,
  AreaChart,
  Bar,
  BarChart,
  Grid,
  Legend,
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
  previous: { label: 'Periodo anterior', color: 'coral' },
} as const

const currentConfig = {
  current: comparisonConfig.current,
} as const

type ChartView = 'current' | 'comparison'
type ChartDisplay = 'trend' | 'daily'

const chartDisplayOptions: readonly SegmentedControlOption<ChartDisplay>[] = [
  {
    value: 'trend',
    label: 'Tendencia',
    ariaLabel: 'Mostrar tendencia continua',
    tone: 'blue',
    visual: (
      <svg
        aria-hidden="true"
        className="h-3 w-4 shrink-0 text-blue-600"
        fill="none"
        viewBox="0 0 16 12"
      >
        <path
          d="M2 9.5 7 6.5 14 2.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="2" cy="9.5" fill="currentColor" r="1.5" />
        <circle cx="7" cy="6.5" fill="currentColor" r="1.5" />
        <circle cx="14" cy="2.5" fill="currentColor" r="1.5" />
      </svg>
    ),
  },
  {
    value: 'daily',
    label: 'Por día',
    ariaLabel: 'Mostrar barras por día',
    tone: 'blue',
    visual: (
      <span aria-hidden="true" className="flex h-3 w-4 shrink-0 items-end gap-0.5">
        <span className="h-1.5 flex-1 bg-blue-300" />
        <span className="h-3 flex-1 bg-blue-600" />
        <span className="h-2 flex-1 bg-blue-400" />
      </span>
    ),
  },
]

const chartViewOptions: readonly SegmentedControlOption<ChartView>[] = [
  {
    value: 'current',
    label: 'Solo periodo',
    ariaLabel: 'Mostrar solo el periodo seleccionado',
    tone: 'blue',
    visual: (
      <span aria-hidden="true" className="relative h-3 w-4 shrink-0">
        <span className="absolute inset-x-0 top-[5px] h-px bg-blue-500" />
        <span className="absolute right-0 top-[3px] size-1.5 rounded-full border border-white bg-blue-600 shadow-[0_0_0_1px_#275dff]" />
      </span>
    ),
  },
  {
    value: 'comparison',
    label: 'Comparar periodo anterior',
    ariaLabel: 'Comparar con el periodo anterior',
    tone: 'coral',
    visual: (
      <span aria-hidden="true" className="relative h-3 w-4 shrink-0">
        <span className="absolute inset-x-0 top-[2px] h-px bg-blue-500" />
        <span className="absolute inset-x-0 top-[8px] border-t border-dashed border-coral-700" />
      </span>
    ),
  },
]

export function ComparisonTrendChart({
  allowComparison = true,
  current,
  previous = [],
  size = 'default',
}: {
  allowComparison?: boolean
  current: ChartPoint[]
  previous?: ChartPoint[]
  size?: 'default' | 'prominent'
}) {
  const [display, setDisplay] = useState<ChartDisplay>('trend')
  const [view, setView] = useState<ChartView>('current')
  const isComparing = allowComparison && view === 'comparison'
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

  const heightClassName = size === 'prominent' ? 'h-64 md:h-80' : 'h-64'

  if (!rows.length) return <EmptyChart className={heightClassName} />

  const chartConfig = isComparing ? comparisonConfig : currentConfig
  const chartAriaLabel = isComparing
    ? display === 'daily'
      ? 'Clics humanos por día del periodo seleccionado comparados con el periodo anterior'
      : 'Clics humanos del periodo seleccionado comparados con el periodo anterior'
    : display === 'daily'
      ? 'Clics humanos por día del periodo seleccionado'
      : 'Clics humanos del periodo seleccionado'
  const pointLabel = (row: ComparisonRow) =>
    isComparing
      ? `${formatLongDate(row.currentDate)}: ${formatNumber(row.current)} clics humanos; ${formatLongDate(row.previousDate)}: ${formatNumber(row.previous)} del periodo anterior`
      : `${formatLongDate(row.currentDate)}: ${formatNumber(row.current)} clics humanos`

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel="Representación del gráfico"
            onChange={setDisplay}
            options={chartDisplayOptions}
            value={display}
          />
          {allowComparison ? (
            <SegmentedControl
              ariaLabel="Periodo del gráfico"
              onChange={setView}
              options={chartViewOptions}
              value={view}
            />
          ) : null}
        </div>
        {allowComparison ? (
          <span>
            {display === 'daily'
              ? isComparing
                ? 'Barras por día equivalente'
                : 'Una barra por fecha'
              : isComparing
                ? 'Comparación por día equivalente'
                : 'Clics humanos por día'}
          </span>
        ) : null}
      </div>
      <div className={cn('min-w-0', heightClassName)}>
        {display === 'trend' ? (
          <AreaChart
            animate={false}
            ariaLabel={chartAriaLabel}
            bloom="off"
            className="rounded-lg bg-blue-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            config={chartConfig}
            data={rows}
            getPointLabel={pointLabel}
            key={`${display}-${view}`}
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
            {isComparing ? (
              <Area dataKey="previous" strokeVariant="dashed" variant="gradient">
                <ActiveDot variant="colored-border" />
              </Area>
            ) : null}
            <Area dataKey="current" variant="gradient">
              <ActiveDot variant="colored-border" />
            </Area>
          </AreaChart>
        ) : (
          <BarChart
            animate={false}
            ariaLabel={chartAriaLabel}
            bloom="off"
            className="rounded-lg bg-blue-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            config={chartConfig}
            data={rows}
            getPointLabel={pointLabel}
            key={`${display}-${view}`}
            margins={{ top: 24, right: 14, bottom: 30, left: 42 }}
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
            <Bar dataKey="current" variant="gradient" />
            {isComparing ? (
              <Bar dataKey="previous" strokeVariant="dashed" variant="gradient" />
            ) : null}
          </BarChart>
        )}
      </div>
    </div>
  )
}

function EmptyChart({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'grid place-items-center rounded-lg border border-dashed border-blue-200 bg-blue-50 px-4 text-center text-sm text-muted-foreground',
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
