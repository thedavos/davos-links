import { Tooltip } from '@base-ui/react/tooltip'
import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

export function InfoTooltip({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <Tooltip.Provider delay={250}>
      <Tooltip.Root>
        <Tooltip.Trigger
          aria-label={label}
          className="dither-hover grid size-5 shrink-0 place-items-center self-center rounded-sm text-muted-foreground transition-colors hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          type="button"
        >
          <Info aria-hidden="true" size={13} strokeWidth={1.8} />
        </Tooltip.Trigger>
        <Tooltip.Portal keepMounted>
          <Tooltip.Positioner
            align="start"
            className="z-50"
            collisionPadding={12}
            side="top"
            sideOffset={7}
          >
            <Tooltip.Popup
              className="max-w-72 rounded-md border border-border bg-white px-3 py-2 text-xs leading-relaxed text-foreground shadow-[0_14px_36px_-18px_#164bd8]"
              role="tooltip"
            >
              {children}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
