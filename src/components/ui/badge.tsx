import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '#/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-semibold leading-4',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-primary-foreground',
        secondary: 'border-blue-200 bg-secondary text-secondary-foreground',
        outline: 'border-blue-200 bg-card text-foreground',
        success: 'border-success/30 bg-success/10 text-success',
        warning: 'border-warning/35 bg-warning/10 text-warning',
        destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
        accent: 'border-coral-200 bg-accent text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: 'secondary',
    },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(badgeVariants({ className, variant }))}
      data-slot="badge"
      {...props}
    />
  )
}

export { Badge, badgeVariants }
