import type { ReactNode } from 'react'
import { Button } from './button'

export function ConfirmDialog({
  cancelLabel = 'Cancelar',
  children,
  confirmLabel,
  onCancel,
  onConfirm,
  title,
}: {
  cancelLabel?: string
  children?: ReactNode
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
  title: string
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4"
      role="dialog"
    >
      <div className="w-full max-w-sm border border-border bg-background p-4 shadow-lg">
        <h2 className="text-sm font-medium">{title}</h2>
        {children ? <div className="mt-2 text-sm text-muted-foreground">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="outline">
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} type="button">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
