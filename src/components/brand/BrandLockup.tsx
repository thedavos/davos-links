import type { ComponentProps } from 'react'
import { BrandMark, type BrandMarkTone } from './BrandMark'
import { BRAND_BYLINE, BRAND_FULL_NAME, BRAND_NAME } from '#/lib/constants'
import { cn } from '#/lib/utils'

export interface BrandLockupProps extends ComponentProps<'span'> {
  markClassName?: string
  showByline?: boolean
  tone?: BrandMarkTone
}

export function BrandLockup({
  className,
  markClassName,
  showByline = true,
  tone = 'duotone',
  ...props
}: BrandLockupProps) {
  return (
    <span
      aria-label={showByline ? BRAND_FULL_NAME : BRAND_NAME}
      className={cn('inline-flex items-center gap-1', className)}
      role="img"
      {...props}
    >
      <BrandMark
        aria-hidden="true"
        className={cn('h-7 w-auto', markClassName)}
        tone={tone}
      />
      <span aria-hidden="true" className="inline-flex flex-col items-start justify-center">
        <span className="text-[1.15em] font-medium leading-none tracking-[-0.045em]">
          {BRAND_NAME}
        </span>
        {showByline ? (
          <span className="mt-0.5 text-[0.62em] font-medium leading-none tracking-[-0.01em] text-muted-foreground">
            {BRAND_BYLINE}
          </span>
        ) : null}
      </span>
    </span>
  )
}
