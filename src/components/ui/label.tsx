import type * as React from 'react'
import { cn } from '#/lib/utils'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className={cn('grid gap-2 text-sm font-medium text-foreground', className)}
      data-slot="label"
      {...props}
    />
  )
}

export { Label }
