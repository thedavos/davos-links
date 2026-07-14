import type * as React from 'react'
import { cn } from '#/lib/utils'

function Checkbox({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'size-4 shrink-0 rounded-[3px] border border-input bg-card accent-primary transition-[border-color,box-shadow] hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20',
        className,
      )}
      data-slot="checkbox"
      type={type ?? 'checkbox'}
      {...props}
    />
  )
}

export { Checkbox }
