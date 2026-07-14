import { AlertTriangle, Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '#/lib/utils'

export type ActionFeedback = {
  action: 'archive' | 'copy' | 'pause'
  detail: string
  kind: 'success' | 'error'
  targetId?: string
  title: string
}

export function ActionNotification({
  className,
  feedback,
  onDismiss,
}: {
  className?: string
  feedback: ActionFeedback
  onDismiss: () => void
}) {
  const [isLeaving, setIsLeaving] = useState(false)
  const dismissTimeout = useRef<number | undefined>(undefined)

  useEffect(() => {
    setIsLeaving(false)
  }, [feedback])

  useEffect(
    () => () => {
      window.clearTimeout(dismissTimeout.current)
    },
    [],
  )

  function dismiss() {
    if (isLeaving) return
    setIsLeaving(true)
    dismissTimeout.current = window.setTimeout(onDismiss, 160)
  }

  const StatusIcon = feedback.kind === 'success' ? Check : AlertTriangle

  return (
    <section
      aria-atomic="true"
      className={cn(
        'action-notification fixed right-4 top-4 z-50 flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-[0_18px_48px_rgb(40_24_72/0.18)] transition-[opacity,transform] duration-150 ease-out motion-safe:animate-[notification-enter_180ms_ease-out]',
        feedback.kind === 'success'
          ? 'border-success/45'
          : 'border-destructive/55',
        isLeaving && 'translate-y-[-0.5rem] opacity-0 motion-safe:animate-none',
        className,
      )}
      role={feedback.kind === 'success' ? 'status' : 'alert'}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-8 shrink-0 place-items-center border',
          feedback.kind === 'success'
            ? 'border-success bg-success text-success-foreground'
            : 'border-destructive bg-destructive text-destructive-foreground',
        )}
      >
        <StatusIcon size={16} strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="font-medium leading-5 text-foreground">{feedback.title}</p>
        <p className="mono mt-0.5 truncate text-xs leading-4 text-muted-foreground">
          {feedback.detail}
        </p>
      </div>
      <button
        aria-label="Cerrar notificación"
        className="dither-hover -mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={dismiss}
        type="button"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </section>
  )
}
