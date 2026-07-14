import type * as React from 'react'
import { cn } from '#/lib/utils'

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-card shadow-[0_1px_0_color-mix(in_srgb,var(--blue)_8%,transparent)]">
      <table
        className={cn('w-full min-w-[900px] border-collapse text-sm', className)}
        data-slot="table"
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn(
        'bg-secondary/55 text-left text-xs uppercase tracking-[0.04em] text-secondary-foreground',
        className,
      )}
      data-slot="table-header"
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      className={cn('divide-y divide-border', className)}
      data-slot="table-body"
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-blue/5 focus-within:bg-blue/5 data-[state=selected]:bg-secondary',
        className,
      )}
      data-slot="table-row"
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn('border-b border-border px-3 py-2.5 font-semibold', className)}
      data-slot="table-head"
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-3 py-3', className)} data-slot="table-cell" {...props} />
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }
