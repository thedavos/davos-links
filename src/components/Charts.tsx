import { useMemo, useState } from 'react'
import {
  ActiveDot,
  Area,
  AreaChart,
  Bar,
  BarChart,
  Grid,
  Legend,
  Sparkline,
  Tooltip,
  XAxis,
  YAxis,
  type DitherColor,
} from '#/components/dither-kit'
import {
  SegmentedControl,
  type SegmentedControlOption,
} from '#/components/ui/segmented-control'
import { cn } from '#/lib/utils'

export type ChartPoint = {
  metric_date: string
  clicks: number
  bot_clicks?: number
}

type ComparisonRow = {
  date: string
  current: number
  previous: number
}

const comparisonConfig = {
  current: { label: 'Actual', color: 'blue' },
  previous: { label: 'Periodo anterior', color: 'purple' },
} as const

const currentConfig = {
  current: comparisonConfig.current,
} as const

type ChartView = 'current' | 'comparison'

const chartViewOptions: readonly SegmentedControlOption<ChartView>[] = [
  {
    value: 'current',
    label: 'Actual',
    ariaLabel: 'Mostrar solo el periodo actual',
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
    label: 'Comparar',
    ariaLabel: 'Comparar con el periodo anterior',
    tone: 'purple',
    visual: (
      <span aria-hidden="true" className="relative h-3 w-4 shrink-0">
        <span className="absolute inset-x-0 top-[2px] h-px bg-blue-500" />
        <span className="absolute inset-x-0 top-[6px] h-1.5 bg-purple-500/55" />
      </span>
    ),
  },
]

const activityConfig = {
  clicks: { label: 'Clics', color: 'green' },
} as const

export function MetricSparkline({
  color = 'blue',
  data,
  label,
}: {
  color?: DitherColor
  data: ChartPoint[]
  label: string
}) {
  const values = useMemo(() => data.map((point) => point.clicks), [data])

  if (!data.length) {
    return (
      <div className="grid h-12 place-items-center rounded-md border border-dashed border-border bg-muted/50 text-xs text-muted-foreground">
        Sin datos
      </div>
    )
  }

  return (
    <div aria-hidden="true" className="h-12 w-full" data-chart-label={label}>
      <Sparkline
        animate={false}
        bloom="low"
        bloomOnHover
        className="overflow-hidden rounded-sm"
        color={color}
        data={values}
        variant="gradient"
      />
    </div>
  )
}

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
      current.map((point, index) => ({
        date: point.metric_date,
        current: point.clicks,
        previous: previous[index]?.clicks ?? 0,
      })),
    [current, previous],
  )
  const max = Math.max(
    2,
    ...rows.flatMap((row) =>
      isComparing ? [row.current, row.previous] : [row.current],
    ),
  )

  if (!rows.length) return <EmptyChart className="h-64" />

  return (
    <div className="relative overflow-hidden rounded-lg border border-blue-200/80 bg-card p-3 shadow-[0_18px_50px_-42px_rgba(53,143,243,0.9)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <SegmentedControl
          ariaLabel="Vista del gráfico"
          onChange={setView}
          options={chartViewOptions}
          value={view}
        />
        <div className="flex items-center gap-3">
          <span>{isComparing ? 'Comparación por día' : 'Periodo actual'}</span>
          <span className="mono text-blue-700">max {formatNumber(max)}</span>
        </div>
      </div>
      <div className="h-64">
        <AreaChart
          animate={false}
          ariaLabel={
            isComparing
              ? 'Clics en el tiempo comparados con el periodo anterior'
              : 'Clics en el tiempo del periodo actual'
          }
          bloom="low"
          bloomOnHover
          className="rounded-md bg-blue-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          config={isComparing ? comparisonConfig : currentConfig}
          data={rows}
          getPointLabel={(row) =>
            isComparing
              ? `${formatDate(row.date)}: ${formatNumber(row.current)} clics actuales y ${formatNumber(row.previous)} del periodo anterior`
              : `${formatDate(row.date)}: ${formatNumber(row.current)} clics actuales`
          }
          margins={{ top: 36, right: 14, bottom: 30, left: 42 }}
          sparkles="burst"
          key={view}
        >
          <Grid horizontal vertical={false} />
          <XAxis dataKey="date" maxTicks={7} tickFormatter={(value) => formatDate(String(value))} />
          <YAxis tickFormatter={formatNumber} />
          {isComparing ? <Legend isClickable /> : null}
          <Tooltip
            labelFormatter={formatDate}
            labelKey="date"
            valueFormatter={(value) => `${formatNumber(value)} clics`}
          />
          <Area dataKey="current" variant="gradient">
            <ActiveDot variant="colored-border" />
          </Area>
          {isComparing ? (
            <Area dataKey="previous" variant="gradient">
              <ActiveDot variant="colored-border" />
            </Area>
          ) : null}
        </AreaChart>
      </div>
    </div>
  )
}

export function DailyActivityBarChart({ data }: { data: ChartPoint[] }) {
  const rows = useMemo(
    () => data.map((point) => ({ date: point.metric_date, clicks: point.clicks })),
    [data],
  )
  const max = Math.max(1, ...rows.map((row) => row.clicks))

  if (!rows.length) return <EmptyChart className="h-64" />

  return (
    <div className="relative overflow-hidden rounded-lg border border-orange-200/90 bg-card p-3 shadow-[0_18px_50px_-42px_rgba(255,150,50,0.9)]">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Una barra por fecha</span>
        <span className="mono text-orange-700">max {formatNumber(max)}</span>
      </div>
      <div className="h-64 min-w-0">
        <BarChart
          animate={false}
          ariaLabel="Actividad diaria de clics"
          bloom="low"
          bloomOnHover
          className="rounded-md bg-orange-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          config={activityConfig}
          data={rows}
          getPointLabel={(row) => `${formatDate(row.date)}: ${formatNumber(row.clicks)} clics`}
          margins={{ top: 16, right: 14, bottom: 30, left: 42 }}
          sparkles="burst"
        >
          <Grid horizontal vertical={false} />
          <XAxis dataKey="date" maxTicks={8} tickFormatter={(value) => formatDate(String(value))} />
          <YAxis tickFormatter={formatNumber} />
          <Tooltip
            labelFormatter={formatDate}
            labelKey="date"
            valueFormatter={(value) => `${formatNumber(value)} clics`}
          />
          <Bar dataKey="clicks" variant="gradient" />
        </BarChart>
      </div>
    </div>
  )
}

function EmptyChart({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'grid place-items-center rounded-lg border border-dashed border-purple-200 bg-purple-50/40 text-sm text-muted-foreground',
        className,
      )}
    >
      Todavía no hay datos
    </div>
  )
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
