import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

export type ActionFeedback = {
  action?: string
  kind: 'success' | 'error'
  message: ReactNode
  targetId?: string
}

export function ActionNotification({
  className,
  feedback,
}: {
  className?: string
  feedback: ActionFeedback
}) {
  return (
    <p
      className={cn(
        'fixed right-4 top-4 z-50 w-[min(360px,calc(100vw-2rem))] border bg-background px-3 py-2 text-sm shadow-sm',
        feedback.kind === 'success'
          ? 'border-border text-muted-foreground'
          : 'border-destructive text-destructive',
        className,
      )}
      role={feedback.kind === 'success' ? 'status' : 'alert'}
    >
      {feedback.message}
    </p>
  )
}
