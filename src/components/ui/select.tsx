import type * as React from 'react'
import { cn } from '#/lib/utils'

function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 [font-family:inherit] text-sm font-normal leading-5 tracking-normal text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.7)] outline-none transition-[border-color,box-shadow,background-color] hover:border-secondary-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20',
        className,
      )}
      data-slot="select"
      {...props}
    />
  )
}

export { Select }
