import type * as React from 'react'
import { cn } from '../../lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('border border-border bg-card text-card-foreground', className)}
      data-slot="card"
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid gap-1 p-4', className)} data-slot="card-header" {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('text-sm font-medium leading-none', className)}
      data-slot="card-title"
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-4 pt-0', className)} data-slot="card-content" {...props} />
}

export { Card, CardContent, CardHeader, CardTitle }
