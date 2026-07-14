import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'

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
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4 backdrop-blur-[2px]"
      role="dialog"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-popover p-5 text-popover-foreground shadow-[0_20px_60px_rgb(21_21_21/0.18)]">
        <div aria-hidden="true" className="mb-4 h-1 w-12 rounded-full bg-coral-500" />
        <h2 className="text-base font-semibold tracking-[-0.01em]">{title}</h2>
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
