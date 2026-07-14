import { useEffect, useId, useMemo, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  ANALYTICS_TIME_ZONE,
  MAX_ANALYTICS_RANGE_DAYS,
  defaultDateRange,
  describeDateRange,
  isSameDateRange,
  toIsoDate,
  validateDateRange,
  type DateRange,
} from '#/lib/date-range'

export { defaultDateRange, type DateRange } from '#/lib/date-range'

export function DateRangePicker({
  defaultDays = 30,
  maxDays = MAX_ANALYTICS_RANGE_DAYS,
  now,
  onChange,
  value,
}: {
  defaultDays?: number
  maxDays?: number
  now?: Date
  onChange: (value: DateRange) => void
  value: DateRange
}) {
  const [draft, setDraft] = useState(value)
  const [showValidation, setShowValidation] = useState(false)
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const today = toIsoDate(now ?? new Date())
  const validation = validateDateRange(draft, { maxDays, now })
  const hasUnappliedChanges = !isSameDateRange(draft, value)
  const description = describeDateRange(value)
  const presets = useMemo(
    () => [
      { label: '7d', days: 7 },
      { label: '30d', days: 30 },
      { label: '90d', days: 90 },
    ],
    [],
  )

  useEffect(() => {
    setDraft(value)
    setShowValidation(false)
  }, [value.from, value.to])

  const applyPreset = (days: number) => {
    const next = defaultDateRange(days, now)
    setDraft(next)
    setShowValidation(false)
    onChange(next)
  }

  const applyCustomRange = () => {
    setShowValidation(true)
    if (validation.valid) onChange(draft)
  }

  const reset = () => {
    const next = defaultDateRange(defaultDays, now)
    setDraft(next)
    setShowValidation(false)
    onChange(next)
  }

  const validationMessage = showValidation && !validation.valid ? validation.message : ''
  const describedBy = validationMessage ? errorId : hintId

  return (
    <fieldset className="min-w-0 rounded-lg border border-border bg-card p-3">
      <legend className="px-1 text-xs font-medium text-foreground">Periodo de análisis</legend>
      <div className="flex flex-wrap items-end gap-2">
        <div aria-label="Rangos rápidos" className="flex gap-1" role="group">
          {presets.map((preset) => (
            <Button
              aria-pressed={isPresetActive(value, preset.days, now)}
              className={
                isPresetActive(value, preset.days, now)
                  ? 'border-secondary-foreground bg-secondary text-secondary-foreground'
                  : undefined
              }
              key={preset.label}
              onClick={() => applyPreset(preset.days)}
              size="sm"
              type="button"
              variant="outline"
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Desde
          <Input
            aria-describedby={describedBy}
            aria-invalid={Boolean(validationMessage)}
            className="h-8 w-36"
            max={today}
            onChange={(event) => {
              setDraft((current) => ({ ...current, from: event.target.value }))
              setShowValidation(true)
            }}
            type="date"
            value={draft.from}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Hasta
          <Input
            aria-describedby={describedBy}
            aria-invalid={Boolean(validationMessage)}
            className="h-8 w-36"
            max={today}
            onChange={(event) => {
              setDraft((current) => ({ ...current, to: event.target.value }))
              setShowValidation(true)
            }}
            type="date"
            value={draft.to}
          />
        </label>
        <Button
          disabled={!hasUnappliedChanges || !validation.valid}
          onClick={applyCustomRange}
          size="sm"
          type="button"
        >
          Aplicar
        </Button>
        <Button onClick={reset} size="sm" type="button" variant="ghost">
          Restablecer
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground" id={hintId}>
        Periodo efectivo: {description.rangeLabel} · Comparación: {description.previousRangeLabel} ·{' '}
        {ANALYTICS_TIME_ZONE}
        {hasUnappliedChanges ? ' · Cambios sin aplicar' : ''}
      </p>
      {validationMessage ? (
        <p className="mt-1 text-xs text-destructive" id={errorId} role="alert">
          {validationMessage}
        </p>
      ) : null}
    </fieldset>
  )
}

function isPresetActive(value: DateRange, days: number, now?: Date) {
  return isSameDateRange(value, defaultDateRange(days, now))
}
