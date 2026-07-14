import { useEffect, useMemo, useRef } from "react"
import { useChart } from "./chart-context"
import {
  backingSize,
  bloomLayerStyle,
  clamp01,
  easeOutCubic,
  paintColumn,
  prefersReducedMotion,
  sparkleFrame,
} from "./dither-paint"
import { rgb } from "./palette"

type Bars = { top: number[]; base: number[] } // per data index, in backing rows
type BarStar = {
  key: string
  seriesIndex: number
  dataIndex: number
  xDepth: number
  yDepth: number
  phase: number
}

// Fraction of the timeline spent staggering bar starts — the rest is each bar's
// own grow window, so the rise sweeps across the chart as a wave.
const STAGGER = 0.55

/**
 * Dither canvas for bar charts. Each category owns a band; grouped series split
 * it into side-by-side bars, stacked series share its full width and pile in y.
 * Every bar is filled with the shared {@link paintColumn} ordered dither. Bars
 * grow up from their base in a staggered left-to-right wave (eased), and the
 * hovered category lifts while the rest dim.
 */
export function BarCanvas() {
  const ctx = useChart()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bloomRef = useRef<HTMLCanvasElement>(null)

  const { width, height } = ctx.plot
  const { cols, rows } = backingSize(width, height)
  const { ready, configKeys, bands, y } = ctx

  // Memoized: per-series bar tops/bases (backing rows) over the data indices.
  // The canvas re-renders on every hover/cursor tick, so pin this map to the
  // exact ctx fields it reads plus the backing geometry — a bar hover must not
  // rebuild every band's geometry.
  const targets = useMemo(() => {
    const out: Record<string, Bars> = {}
    if (!ready) return out
    const h = height || 1
    for (const key of configKeys) {
      const band = bands[key]
      if (!band) continue
      out[key] = {
        top: band.map((b) => (y(b[1]) / h) * (rows - 1)),
        base: band.map((b) => (y(b[0]) / h) * (rows - 1)),
      }
    }
    return out
  }, [ready, configKeys, bands, y, height, rows])

  const stars = useMemo(() => {
    const out: BarStar[] = []
    if (ctx.sparkles === "off" || ctx.dataLength === 0) return out
    const perSeries =
      ctx.sparkles === "burst"
        ? Math.min(8, Math.max(3, Math.ceil(ctx.dataLength / 3)))
        : Math.max(4, Math.ceil(ctx.dataLength / 2))
    configKeys.forEach((key, seriesIndex) => {
      for (let i = 0; i < perSeries; i++) {
        const seed = i * 67 + 13 + seriesIndex * 131
        out.push({
          key,
          seriesIndex,
          dataIndex: seed % ctx.dataLength,
          xDepth: 0.2 + (((seed * 29 + 11) % 100) / 100) * 0.6,
          yDepth: 0.15 + (((seed * 53 + 7) % 100) / 100) * 0.7,
          phase: (seed * 41) % 360,
        })
      }
    })
    return out
  }, [ctx.sparkles, ctx.dataLength, configKeys])

  // The RAF loop reads these through refs so it always sees the latest values;
  // refs are written in an effect (never during render) — mutating a ref
  // mid-render tears under Strict Mode / concurrent rendering.
  const state = useRef(ctx)
  const targetsRef = useRef(targets)
  const starsRef = useRef(stars)
  const burstRef = useRef({ revision: 0, startedAt: 0 })
  useEffect(() => {
    state.current = ctx
    targetsRef.current = targets
    starsRef.current = stars
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const c = canvas?.getContext("2d")
    if (!(canvas && c) || cols <= 0 || rows <= 0) return
    canvas.width = cols
    canvas.height = rows

    const bloomCanvas = bloomRef.current
    const bloomCtx = bloomCanvas?.getContext("2d") ?? null
    if (bloomCanvas) {
      bloomCanvas.width = cols
      bloomCanvas.height = rows
    }

    const reduce = prefersReducedMotion()
    const animate = state.current.animate && !reduce
    const duration = state.current.animationDuration
    const fx = cols / Math.max(width, 1)

    // Eased grow factor for bar `i` at global progress `prog`.
    const barProgress = (i: number, len: number, prog: number) => {
      if (!animate) return 1
      const start = len > 1 ? (i / (len - 1)) * STAGGER : 0
      return easeOutCubic(clamp01((prog - start) / (1 - STAGGER)))
    }

    const paint = (prog: number) => {
      const s = state.current
      c.clearRect(0, 0, cols, rows)
      const stacked = s.stackType === "stacked" || s.stackType === "percent"
      const keys = s.configKeys
      keys.forEach((key, si) => {
        const t = targetsRef.current[key]
        if (!t) return
        const seed = s.seedOf(key)
        const variant = s.seriesSpecs[key]?.variant ?? "gradient"
        const emphasis = s.selectedDataKey ?? s.focusDataKey
        const selDim = emphasis !== null && emphasis !== key ? 0.3 : 1
        for (let i = 0; i < s.dataLength; i++) {
          const bp = barProgress(i, s.dataLength, prog)
          const base = t.base[i] ?? rows - 1
          const top = base + ((t.top[i] ?? base) - base) * bp
          const active = s.hoverIndex === i
          const hoverDim =
            s.hoverIndex != null && !active && s.isMouseInChart ? 0.5 : 1
          const slot = s.barSlot(i, si, keys.length)
          const c0 = Math.round(slot.x * fx)
          const c1 = Math.round((slot.x + slot.width) * fx)
          for (let x = c0; x < c1; x++) {
            paintColumn(c, x, top, base, seed, {
              variant,
              intensity: intensity + (active ? 0.4 : 0),
              dim: selDim * hoverDim,
              stacked,
            })
          }
        }
      })
    }

    const paintSparkles = (prog: number, opacity: number, tick: number) => {
      const s = state.current
      for (const star of starsRef.current) {
        const target = targetsRef.current[star.key]
        if (!target) continue
        const base = target.base[star.dataIndex] ?? rows - 1
        const targetTop = target.top[star.dataIndex] ?? base
        const top = base + (targetTop - base) * barProgress(star.dataIndex, s.dataLength, prog)
        if (base - top < 1) continue
        const slot = s.barSlot(
          star.dataIndex,
          star.seriesIndex,
          s.configKeys.length
        )
        const sx = Math.round((slot.x + slot.width * star.xDepth) * fx)
        const sy = Math.round(top + (base - top) * star.yDepth)
        const tw = (Math.sin((tick + star.phase) * 0.35) + 1) / 2
        const lift = tw * opacity * (0.7 + 0.3 * intensity)
        if (lift < 0.45 || sy < 0 || sy >= rows) continue
        const starColor = s.seedOf(star.key).fill
        c.fillStyle = rgb(starColor, 1, lift)
        c.fillRect(sx, sy, 1, 1)
        if (tw > 0.9) {
          c.fillStyle = rgb(starColor, 1, lift * 0.6 * (tw - 0.9) * 10)
          c.fillRect(sx - 1, sy, 1, 1)
          c.fillRect(sx + 1, sy, 1, 1)
          c.fillRect(sx, sy - 1, 1, 1)
          c.fillRect(sx, sy + 1, 1, 1)
        }
      }
    }

    let raf = 0
    let animStart = 0
    let lastProg = -1
    let lastRevision = state.current.revision
    let intensity = 0
    let needsFill = true
    let sparkleTick = 0
    let sparklesWereVisible = false
    let lastPaintSig = ""
    let lastSelected: string | null | undefined = Symbol() as never
    let lastHover: number | null | undefined = Symbol() as never

    const draw = (now: number) => {
      const s = state.current
      if (!s.ready) return
      if (bloomCtx) {
        const on =
          s.bloom !== "off" &&
          (!s.bloomOnHover || s.isMouseInChart || s.hovered)
        if (on) {
          bloomCtx.clearRect(0, 0, cols, rows)
          bloomCtx.drawImage(canvas, 0, 0)
        }
      }
      if (s.revision !== lastRevision) {
        lastRevision = s.revision
        animStart = 0 // re-play the wave on data change / replay
        lastProg = -1
      }
      if (!animStart) animStart = now
      const prog = animate ? Math.min(1, (now - animStart) / duration) : 1

      if (prog !== lastProg) {
        lastProg = prog
        needsFill = true
      }
      const emphasisNow = s.selectedDataKey ?? s.focusDataKey
      if (emphasisNow !== lastSelected) {
        lastSelected = emphasisNow
        needsFill = true
      }
      if (s.hoverIndex !== lastHover) {
        lastHover = s.hoverIndex
        needsFill = true
      }
      const itTarget = s.isMouseInChart || s.hovered ? 1 : 0
      if (Math.abs(intensity - itTarget) > 0.001) {
        intensity += (itTarget - intensity) * (reduce ? 1 : 0.16)
        needsFill = true
      } else intensity = itTarget

      if (
        s.sparkles === "burst" &&
        s.sparkleRevision > burstRef.current.revision
      ) {
        burstRef.current = { revision: s.sparkleRevision, startedAt: now }
      }
      const sparkleElapsed = burstRef.current.startedAt
        ? now - burstRef.current.startedAt
        : 0
      const sparkle = sparkleFrame(
        s.sparkles,
        s.sparkleRevision,
        sparkleElapsed,
        reduce
      )
      if (sparklesWereVisible && !sparkle.active) needsFill = true
      sparklesWereVisible = sparkle.active
      if (sparkle.active) {
        sparkleTick += 1
        needsFill = true
      }

      // Live tweak repaint (variant, stacking) without replaying the wave.
      const paintSig = `${s.stackType}|${s.configKeys
        .map((k) => s.seriesSpecs[k]?.variant ?? "")
        .join(",")}`
      if (paintSig !== lastPaintSig) {
        lastPaintSig = paintSig
        needsFill = true
      }

      if (!needsFill) return
      paint(prog)
      if (sparkle.active) paintSparkles(prog, sparkle.opacity, sparkleTick)
      needsFill = false
      if (
        (animate && prog < 1) ||
        Math.abs(intensity - itTarget) > 0.001 ||
        sparkle.active
      ) {
        raf = requestAnimationFrame(draw)
      }
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [
    cols,
    rows,
    width,
    ctx.revision,
    ctx.hoverIndex,
    ctx.isMouseInChart,
    ctx.hovered,
    ctx.selectedDataKey,
    ctx.focusDataKey,
    ctx.seriesSpecs,
    ctx.sparkles,
    ctx.sparkleRevision,
  ])

  const bloomActive = ctx.bloomOnHover
    ? ctx.isMouseInChart || ctx.hovered
    : true
  const bloom = bloomLayerStyle(ctx.bloom, bloomActive)
  const pos = {
    left: ctx.margins.left,
    top: ctx.margins.top,
    width,
    height,
  } as const

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute"
        style={{ ...pos, imageRendering: "pixelated" }}
      />
      <canvas
        ref={bloomRef}
        className="pointer-events-none absolute"
        style={{
          ...pos,
          transition: "opacity 220ms ease",
          ...(bloom ?? { opacity: 0 }),
        }}
      />
    </>
  )
}
