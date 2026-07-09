import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

export type ActionFeedback = {
  action?: string
  kind: 'success' | 'error'
  message: ReactNode
  targetId?: string
}

export function InlineFeedback({
  className,
  feedback,
}: {
  className?: string
  feedback: ActionFeedback
}) {
  return (
    <p
      className={cn(
        'border px-3 py-2 text-sm',
        feedback.kind === 'success'
          ? 'border-border bg-muted/40 text-muted-foreground'
          : 'border-destructive text-destructive',
        className,
      )}
      role={feedback.kind === 'success' ? 'status' : 'alert'}
    >
      {feedback.message}
    </p>
  )
}
