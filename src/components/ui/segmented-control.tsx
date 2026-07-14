import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

type SegmentTone = 'blue' | 'purple'

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
    active:
      'dither-static border-b-blue-500 bg-blue-50 text-blue-950 shadow-[inset_0_0_0_1px_rgba(53,143,243,0.08)]',
    inactive: 'hover:bg-blue-50/60 hover:text-blue-900',
    focus: 'focus-visible:ring-blue-500',
  },
  purple: {
    active:
      'dither-static border-b-purple-500 bg-purple-50 text-purple-950 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.08)]',
    inactive: 'hover:bg-purple-50/70 hover:text-purple-900',
    focus: 'focus-visible:ring-purple-500',
  },
}

export function SegmentedControl<TValue extends string>({
  ariaLabel,
  className,
  onChange,
  options,
  value,
}: {
  ariaLabel: string
  className?: string
  onChange: (value: TValue) => void
  options: readonly SegmentedControlOption<TValue>[]
  value: TValue
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        'inline-grid auto-cols-fr grid-flow-col overflow-hidden rounded-md border border-purple-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_-18px_rgba(76,29,149,0.8)]',
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
              'relative flex min-h-8 items-center justify-center gap-2 border-b-2 border-b-transparent px-3 font-medium text-muted-foreground transition-[background-color,border-color,color,box-shadow] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
              index > 0 && 'border-l border-l-purple-100',
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
