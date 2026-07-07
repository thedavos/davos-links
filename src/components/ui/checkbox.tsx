import type * as React from 'react'
import { cn } from '../../lib/utils'

function Checkbox({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'size-4 border border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
        className,
      )}
      data-slot="checkbox"
      type={type ?? 'checkbox'}
      {...props}
    />
  )
}

export { Checkbox }
