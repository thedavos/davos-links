import { Tooltip } from '@base-ui/react/tooltip'
import type { MouseEventHandler, ReactElement, ReactNode } from 'react'
import { buttonVariants } from '#/components/ui/button'
import { cn } from '#/lib/utils'

export function ActionTooltip({
  children,
  className,
  disabled,
  label,
  onClick,
  render,
}: {
  children: ReactNode
  className?: string
  disabled?: boolean
  label: string
  onClick?: MouseEventHandler<HTMLElement>
  render?: ReactElement
}) {
  const trigger = render ?? <button disabled={disabled} type="button" />

  return (
    <Tooltip.Provider delay={250}>
      <Tooltip.Root>
        <Tooltip.Trigger
          aria-label={label}
          className={cn(buttonVariants({ size: 'icon', variant: 'ghost' }), className)}
          disabled={disabled}
          onClick={onClick}
          render={trigger}
        >
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal keepMounted>
          <Tooltip.Positioner
            align="center"
            className="z-50"
            collisionPadding={12}
            side="top"
            sideOffset={7}
          >
            <Tooltip.Popup
              className="rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-foreground shadow-[0_14px_36px_-18px_#164bd8]"
              role="tooltip"
            >
              {label}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
