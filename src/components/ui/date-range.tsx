import { useMemo } from 'react'
import { Button } from './button'
import { Input } from './input'

export type DateRange = {
  from: string
  to: string
}

export function defaultDateRange(days = 30): DateRange {
  const to = new Date()
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - (days - 1))
  return { from: toISOStringDate(from), to: toISOStringDate(to) }
}

export function DateRangePicker({
  onChange,
  value,
}: {
  onChange: (value: DateRange) => void
  value: DateRange
}) {
  const presets = useMemo(
    () => [
      { label: '7d', days: 7 },
      { label: '30d', days: 30 },
      { label: '90d', days: 90 },
    ],
    [],
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            onClick={() => onChange(defaultDateRange(preset.days))}
            size="sm"
            type="button"
            variant="outline"
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <Input
        aria-label="Desde"
        className="h-8 w-36"
        onChange={(event) => onChange({ ...value, from: event.target.value })}
        type="date"
        value={value.from}
      />
      <Input
        aria-label="Hasta"
        className="h-8 w-36"
        onChange={(event) => onChange({ ...value, to: event.target.value })}
        type="date"
        value={value.to}
      />
    </div>
  )
}

function toISOStringDate(date: Date) {
  return date.toISOString().slice(0, 10)
}
