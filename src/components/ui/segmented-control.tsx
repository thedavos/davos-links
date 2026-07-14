import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

type SegmentTone = 'blue' | 'coral'

export type SegmentedControlOption<TValue extends string> = {
  value: TValue
  label: string
  ariaLabel?: string
  visual?: ReactNode
  tone?: SegmentTone
}

const toneClasses: Record<
  SegmentTone,
  { active: string; inactive: string; focus: string }
> = {
  blue: {
    active: 'dither-static bg-blue-50 text-blue-950',
    inactive: 'hover:bg-blue-50/60 hover:text-blue-900',
    focus: 'focus-visible:ring-blue-500',
  },
  coral: {
    active: 'dither-static bg-coral-50 text-coral-950',
    inactive: 'hover:bg-coral-50 hover:text-coral-900',
    focus: 'focus-visible:ring-coral-700',
  },
}

export function SegmentedControl<TValue extends string>({
  ariaLabel,
  className,
  onChange,
  options,
  size = 'default',
  value,
}: {
  ariaLabel: string
  className?: string
  onChange: (value: TValue) => void
  options: readonly SegmentedControlOption<TValue>[]
  size?: 'default' | 'sm'
  value: TValue
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        'inline-grid auto-cols-fr grid-flow-col overflow-hidden rounded-md border border-border bg-white',
        className,
      )}
      role="group"
    >
      {options.map((option, index) => {
        const selected = option.value === value
        const tone = toneClasses[option.tone ?? 'blue']

        return (
          <button
            aria-label={option.ariaLabel}
            aria-pressed={selected}
            className={cn(
              'relative flex min-h-8 items-center justify-center gap-2 px-3 font-medium text-muted-foreground transition-[background-color,color] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
              size === 'sm' && 'min-h-7 gap-1.5 px-2.5 text-xs',
              index > 0 && 'border-l border-l-border',
              tone.focus,
              selected ? tone.active : tone.inactive,
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.visual}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
