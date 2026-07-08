import { cva, type VariantProps } from 'class-variance-authority'
import {
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ReactElement,
} from 'react'
import { cn } from '#/lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
        outline:
          'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
        ghost:
          'border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        destructive:
          'border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90',
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
  }

function Button({ asChild, children, className, size, variant, ...props }: ButtonProps) {
  const mergedClassName = cn(buttonVariants({ className, size, variant }))

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>
    return cloneElement(child, {
      className: cn(mergedClassName, child.props.className),
      ...props,
    })
  }

  return (
    <button
      className={mergedClassName}
      data-slot="button"
      {...props}
    >
      {children}
    </button>
  )
}

export { Button, buttonVariants }
