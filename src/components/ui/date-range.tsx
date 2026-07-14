import { RotateCcw } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { ActionTooltip } from '#/components/ui/action-tooltip'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  ANALYTICS_TIME_ZONE,
  MAX_ANALYTICS_RANGE_DAYS,
  defaultDateRange,
  describeDateRange,
  isSameDateRange,
  validateDateRange,
  type DateRange,
} from '#/lib/date-range'
import { cn } from '#/lib/utils'

export { defaultDateRange, type DateRange } from '#/lib/date-range'

export function DateRangePicker({
  className,
  defaultDays = 30,
  framed = true,
  maxDays = MAX_ANALYTICS_RANGE_DAYS,
  now,
  onChange,
  showSummary = true,
  timeZone = ANALYTICS_TIME_ZONE,
  value,
}: {
  className?: string
  defaultDays?: number
  framed?: boolean
  maxDays?: number
  now?: Date
  onChange: (value: DateRange) => void
  showSummary?: boolean
  timeZone?: string
  value: DateRange
}) {
  const [draft, setDraft] = useState(value)
  const [showValidation, setShowValidation] = useState(false)
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const today = defaultDateRange(1, now, timeZone).to
  const validation = validateDateRange(draft, { maxDays, now, timeZone })
  const description = describeDateRange(value, { timeZone })
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
    const next = defaultDateRange(days, now, timeZone)
    setDraft(next)
    setShowValidation(false)
    onChange(next)
  }

  const updateDraft = (field: keyof DateRange, fieldValue: string) => {
    const next = { ...draft, [field]: fieldValue }
    const nextValidation = validateDateRange(next, { maxDays, now, timeZone })
    setDraft(next)
    setShowValidation(!nextValidation.valid)
    if (nextValidation.valid) onChange(next)
  }

  const reset = () => {
    const next = defaultDateRange(defaultDays, now, timeZone)
    setDraft(next)
    setShowValidation(false)
    onChange(next)
  }

  const validationMessage = showValidation && !validation.valid ? validation.message : ''
  const describedBy = validationMessage ? errorId : showSummary ? hintId : undefined

  return (
    <fieldset
      className={cn(
        'min-w-0',
        framed && 'rounded-lg border border-border bg-card p-3',
        className,
      )}
    >
      <legend className="sr-only">
        Periodo de análisis
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        <div
          aria-label="Rangos rápidos"
          className="flex w-fit shrink-0 gap-1"
          role="group"
        >
          {presets.map((preset) => {
            const active = isPresetActive(value, preset.days, now, timeZone)
            return (
              <Button
                aria-pressed={active}
                ditherVariant={active ? 'gradient' : 'dotted-subtle'}
                key={preset.label}
                onClick={() => applyPreset(preset.days)}
                size="sm"
                type="button"
                variant={active ? 'default' : 'ghost'}
              >
                {preset.label}
              </Button>
            )
          })}
        </div>
        <div className="order-3 grid w-full min-w-0 grid-cols-2 items-center gap-2 sm:order-none sm:w-auto sm:flex-none">
          <label className="min-w-0">
            <span className="sr-only">Desde</span>
            <Input
              aria-describedby={describedBy}
              aria-invalid={Boolean(validationMessage)}
              className="h-8 w-full sm:w-[10.5rem]"
              max={today}
              onChange={(event) => updateDraft('from', event.target.value)}
              type="date"
              value={draft.from}
            />
          </label>
          <label className="min-w-0">
            <span className="sr-only">Hasta</span>
            <Input
              aria-describedby={describedBy}
              aria-invalid={Boolean(validationMessage)}
              className="h-8 w-full sm:w-[10.5rem]"
              max={today}
              onChange={(event) => updateDraft('to', event.target.value)}
              type="date"
              value={draft.to}
            />
          </label>
        </div>
        <div aria-label="Acciones del periodo" className="flex items-center gap-2" role="group">
          <ActionTooltip
            label="Restablecer"
            onClick={reset}
          >
            <RotateCcw aria-hidden="true" size={15} />
          </ActionTooltip>
        </div>
      </div>
      {showSummary ? (
        <p className="mt-3 text-xs text-muted-foreground" id={hintId}>
          Periodo efectivo: {description.rangeLabel} · Comparación: {description.previousRangeLabel}{' '}
          · {timeZone}
        </p>
      ) : null}
      {validationMessage ? (
        <p className="mt-1 text-xs text-destructive" id={errorId} role="alert">
          {validationMessage}
        </p>
      ) : null}
    </fieldset>
  )
}

function isPresetActive(
  value: DateRange,
  days: number,
  now?: Date,
  timeZone?: string,
) {
  return isSameDateRange(value, defaultDateRange(days, now, timeZone))
}
