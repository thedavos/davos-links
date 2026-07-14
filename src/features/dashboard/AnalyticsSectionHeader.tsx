import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

export function AnalyticsSectionHeader({
  action,
  className,
  description,
  title,
  titleId,
}: {
  action: ReactNode
  className?: string
  description: string
  title: string
  titleId: string
}) {
  return (
    <div
      className={cn(
        'grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center',
        className,
      )}
    >
      <div className="shrink-0">
        <h2 className="text-base font-semibold" id={titleId}>
          {title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}
