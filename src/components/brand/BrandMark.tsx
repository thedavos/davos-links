import type { ComponentProps } from 'react'
import { cn } from '#/lib/utils'

export type BrandMarkTone = 'duotone' | 'monochrome' | 'inverse'

export interface BrandMarkProps extends ComponentProps<'svg'> {
  label?: string
  tone?: BrandMarkTone
}

export function BrandMark({
  className,
  label,
  tone = 'duotone',
  ...props
}: BrandMarkProps) {
  const leftFill = tone === 'duotone' ? '#275DFF' : 'currentColor'
  const rightFill = tone === 'duotone' ? '#151515' : 'currentColor'

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn('shrink-0', tone === 'inverse' && 'text-white', className)}
      fill="none"
      role={label ? 'img' : undefined}
      viewBox="0 0 80 64"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M6 58 27.6 9.9A6.5 6.5 0 0 1 33.5 6h10.8a6 6 0 0 1 5.8 4.2L54.2 23 35 33.3 25.7 55.6A4 4 0 0 1 22 58H6Z"
        fill={leftFill}
      />
      <path
        d="m35 33.3 19.2-10.4L74 58H58a6 6 0 0 1-5.3-3.2L35 33.3Z"
        fill={rightFill}
      />
    </svg>
  )
}
