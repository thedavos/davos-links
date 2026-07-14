import {
  Children,
  type ComponentType,
  isValidElement,
  type KeyboardEvent,
  type ReactNode,
  useState,
} from "react"
import {
  type ChartConfig,
  ChartContext,
  type ChartType,
  type Margins,
  useChartController,
} from "./chart-context"
import { CommonChartContext } from "./common-context"
import type { BloomInput } from "./dither-paint"
import { cn } from "./lib"
import type { StackType } from "./scales"
import { useChartDimensions } from "./use-chart-dimensions"

// `object` rather than `Record<string, unknown>`: interfaces don't get an
// implicit index signature, so interface-typed rows failed to satisfy the
// generic. Internal layers still index rows through their own Row type.
type Row = object

const DEFAULT_MARGINS: Margins = {
  top: 10,
  right: 12,
  bottom: 22,
  left: 36,
}

export type CartesianChartProps<TData extends Row> = {
  data: TData[]
  config: ChartConfig
  children: ReactNode
  stackType?: StackType
  margins?: Partial<Margins>
  className?: string
  animate?: boolean
  animationDuration?: number
  replayToken?: number // change to re-play the entrance without remounting
  /** Set false for a decorative sparkline: keeps the hover lift but no scrub
   * crosshair / tooltip. */
  interactive?: boolean
  /** Controlled crosshair position (e.g. a committed point) — overrides the
   * internal hover when set. */
  markerIndex?: number | null
  /** Parent-driven hover (e.g. the whole card/row) — lifts the fill. */
  hovered?: boolean
  /** Glow on the dither fill. */
  bloom?: BloomInput
  /** Only bloom while the chart is hovered. */
  bloomOnHover?: boolean
  /** Fires with the scrubbed index as the pointer moves (null on leave). */
  onHoverChange?: (index: number | null) => void
  defaultSelectedDataKey?: string | null
  onSelectionChange?: (key: string | null) => void
  /** Accessible name exposed by the single keyboard-focusable chart root. */
  ariaLabel?: string
  /** Announces the active point while the chart is navigated with the keyboard. */
  getPointLabel?: (row: TData, index: number) => string
  /** Decorative winking pixels. Disable for dense analytical dashboards. */
  sparkles?: boolean
}

/** Which render layer a composed part targets — defaults to the front SVG. */
function layerOf(node: ReactNode): "back" | "dom" | "svg" {
  if (!isValidElement(node) || typeof node.type === "string") return "svg"
  return (node.type as { chartLayer?: "back" | "dom" }).chartLayer ?? "svg"
}

/**
 * Shared root for the cartesian dither charts (area, line, bar). Owns the
 * measured size, the shared context, and pointer interaction; every visual is
 * composed as children. Back chrome (grid) sits behind the dither canvas; the
 * canvas paints the fill/line/bars + stars; front chrome (axes, dots) and DOM
 * legend/tooltip layer on top. `chartType` drives the scales/interaction and the
 * `Canvas` prop supplies the family's painter (continuous for area/line, bars for
 * bar) — so each chart ships only its own canvas.
 */
export function CartesianRoot<TData extends Row>({
  chartType,
  Canvas,
  data,
  config,
  children,
  stackType = "default",
  margins: marginsProp,
  className,
  animate = true,
  animationDuration = 900,
  replayToken = 0,
  interactive = true,
  markerIndex = null,
  hovered = false,
  bloom = "off",
  bloomOnHover = false,
  onHoverChange,
  defaultSelectedDataKey = null,
  onSelectionChange,
  ariaLabel = "Gráfica",
  getPointLabel,
  sparkles = true,
}: CartesianChartProps<TData> & {
  chartType: ChartType
  Canvas: ComponentType
}) {
  const { ref, size } = useChartDimensions<HTMLDivElement>()
  const [keyboardActive, setKeyboardActive] = useState(false)
  const margins = { ...DEFAULT_MARGINS, ...marginsProp }

  const ctx = useChartController({
    chartType,
    // Safe: the controller only reads row[key] for the configured series keys.
    data: data as Record<string, unknown>[],
    config,
    stackType,
    dimensions: size,
    margins,
    animate,
    animationDuration,
    replayToken,
    markerIndex,
    hovered,
    bloom,
    bloomOnHover,
    sparkles,
    defaultSelectedDataKey,
    onSelectionChange,
  })

  const backChildren: ReactNode[] = []
  const svgChildren: ReactNode[] = []
  const domChildren: ReactNode[] = []
  Children.forEach(children, (child) => {
    const layer = layerOf(child)
    if (layer === "back") backChildren.push(child)
    else if (layer === "dom") domChildren.push(child)
    else svgChildren.push(child)
  })

  const onMove = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = clientX - rect.left - margins.left
    const index = ctx.indexAtX(px)
    ctx.setHoverIndex(index)
    ctx.setCursorX(clientX - rect.left)
    onHoverChange?.(index)
  }

  const activateIndex = (index: number | null) => {
    ctx.setHoverIndex(index)
    if (index != null) {
      ctx.setCursorX(margins.left + ctx.xCenter(index))
    }
    onHoverChange?.(index)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !data.length) return
    const current = ctx.hoverIndex ?? data.length - 1
    let next: number | null = null
    if (event.key === "ArrowLeft") next = Math.max(0, current - 1)
    else if (event.key === "ArrowRight") next = Math.min(data.length - 1, current + 1)
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = data.length - 1
    else if (event.key === "Escape") next = null
    else return
    event.preventDefault()
    activateIndex(next)
  }

  return (
    <ChartContext value={ctx}>
      <CommonChartContext value={ctx.common}>
        <div
          ref={ref}
          className={cn("relative h-full w-full", className)}
          role={interactive ? "group" : undefined}
          aria-label={interactive ? ariaLabel : undefined}
          tabIndex={interactive && data.length ? 0 : undefined}
          onKeyDown={onKeyDown}
          onFocus={(event) => {
            if (!interactive || event.currentTarget !== event.target) return
            setKeyboardActive(true)
            activateIndex(data.length ? data.length - 1 : null)
          }}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget)) return
            setKeyboardActive(false)
            activateIndex(null)
          }}
          onPointerEnter={() => ctx.setMouseInChart(true)}
          onPointerMove={interactive ? (e) => onMove(e.clientX) : undefined}
          onPointerLeave={() => {
            ctx.setMouseInChart(false)
            if (!keyboardActive) activateIndex(null)
          }}
        >
          {ctx.ready && backChildren.length > 0 && (
            <svg
              width={size.width}
              height={size.height}
              className="absolute inset-0 overflow-visible"
              aria-hidden
              role="presentation"
            >
              <g transform={`translate(${margins.left},${margins.top})`}>
                {backChildren}
              </g>
            </svg>
          )}
          <Canvas />
          {ctx.ready && (
            <svg
              width={size.width}
              height={size.height}
              className="absolute inset-0 overflow-visible"
              aria-hidden
              role="presentation"
            >
              <g transform={`translate(${margins.left},${margins.top})`}>
                {svgChildren}
              </g>
            </svg>
          )}
          {domChildren}
          {keyboardActive && ctx.hoverIndex != null && getPointLabel ? (
            <span className="sr-only" role="status" aria-live="polite">
              {getPointLabel(data[ctx.hoverIndex], ctx.hoverIndex)}
            </span>
          ) : null}
        </div>
      </CommonChartContext>
    </ChartContext>
  )
}

export type AreaChartProps<TData extends Row> = CartesianChartProps<TData>
