import { cva, type VariantProps } from 'class-variance-authority'
import {
  cloneElement,
  isValidElement,
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  DitherButtonSurface,
  type ButtonVariant as DitherVariant,
} from '#/components/dither-kit/button'
import type { PixelBloom, PixelColor } from '#/components/dither-kit/pixel'
import { cn } from '#/lib/utils'

const buttonVariants = cva(
  'group/dither relative isolate inline-flex min-h-10 items-center justify-center gap-2 overflow-hidden rounded-md border text-sm font-semibold transition-[border-color,background-color,color,transform,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border-blue-500/70 bg-blue-50 text-blue-950 shadow-[0_8px_22px_-16px_rgba(53,143,243,0.95)] hover:border-blue-600',
        outline:
          'border-purple-500 bg-white text-purple-950 hover:border-purple-600 hover:bg-purple-50',
        ghost:
          'border-transparent bg-transparent text-muted-foreground hover:bg-purple-50 hover:text-purple-950',
        destructive:
          'border-red-400/80 bg-red-50 text-red-950 hover:border-red-600',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
        icon: 'size-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    ditherColor?: PixelColor
    ditherVariant?: DitherVariant
    bloom?: PixelBloom
  }

function Button({
  asChild,
  bloom,
  children,
  className,
  disabled,
  ditherColor,
  ditherVariant,
  size,
  variant,
  ...props
}: ButtonProps) {
  const resolvedVariant = variant ?? 'default'
  const mergedClassName = cn(buttonVariants({ className, size, variant }))
  const color = ditherColor ?? colorForVariant(resolvedVariant)
  const texture = ditherVariant ?? textureForVariant(resolvedVariant)
  const resolvedBloom = bloom ?? (resolvedVariant === 'default' ? 'low' : 'off')
  const useCanvas = size !== 'icon' && resolvedVariant !== 'ghost'
  const content = (
    <>
      {useCanvas ? (
        <DitherButtonSurface color={color} variant={texture} bloom={resolvedBloom} />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_1px_1px,currentColor_0.8px,transparent_1px)] bg-[size:4px_4px] opacity-0 transition-opacity duration-200 group-hover/dither:opacity-15 group-focus-visible/dither:opacity-20',
            resolvedVariant === 'destructive' ? 'text-red-500' : 'text-purple-500',
          )}
        />
      )}
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </>
  )

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string; children?: ReactNode }>
    return cloneElement(child, {
      className: cn(mergedClassName, child.props.className),
      ...props,
      ...(disabled
        ? {
            'aria-disabled': true,
            onClick: (event: MouseEvent<HTMLElement>) => {
              event.preventDefault()
              event.stopPropagation()
            },
            tabIndex: -1,
          }
        : null),
      children: (
        <>
          {useCanvas ? (
            <DitherButtonSurface color={color} variant={texture} bloom={resolvedBloom} />
          ) : (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_1px_1px,currentColor_0.8px,transparent_1px)] bg-[size:4px_4px] opacity-0 transition-opacity duration-200 group-hover/dither:opacity-15 group-focus-visible/dither:opacity-20"
            />
          )}
          <span className="relative z-10 inline-flex items-center justify-center gap-2">
            {child.props.children}
          </span>
        </>
      ),
    })
  }

  return (
    <button
      className={mergedClassName}
      data-slot="button"
      disabled={disabled}
      {...props}
    >
      {content}
    </button>
  )
}

function colorForVariant(variant: NonNullable<ButtonProps['variant']>): PixelColor {
  if (variant === 'destructive') return 'red'
  if (variant === 'outline' || variant === 'ghost') return 'purple'
  return 'blue'
}

function textureForVariant(variant: NonNullable<ButtonProps['variant']>): DitherVariant {
  if (variant === 'destructive') return 'hatched'
  if (variant === 'outline') return 'dotted-subtle'
  if (variant === 'ghost') return 'dotted'
  return 'gradient'
}

export { Button, buttonVariants, type ButtonProps }
