import { type DitherColor, PALETTE, type Rgb } from "./palette"

// 4×4 ordered (Bayer) matrix, normalized to 0–1 thresholds — the same matrix
// the charts dither with.
export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16))

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)

/** 32-bit FNV-1a hash — turns any string seed into a stable uint32. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Tiny deterministic PRNG (xorshift32) — returns floats in [0, 1). */
export function xorshift32(seed: number): () => number {
  let s = seed || 0x9e3779b9
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 0x100000000
  }
}

/** A named color from the atajo blue/coral system or neutral grey. */
export type PixelColor = DitherColor

/** Resolve a {@link PixelColor} to its rgb fill. */
export function fillOf(color: PixelColor): Rgb {
  return PALETTE[color].fill
}

// Bloom — same recipe as the charts: a blurred copy of the crisp canvas,
// composited additively so the glow stays in the dither's own colour.
export type PixelBloom = "off" | "low" | "high" | "aura"

const BLOOM_PRESET: Record<
  Exclude<PixelBloom, "off">,
  { blur: number; brightness: number; opacity: number; saturate: number }
> = {
  low: { blur: 3, brightness: 1.35, opacity: 0.7, saturate: 1.4 },
  high: { blur: 5, brightness: 1.5, opacity: 0.78, saturate: 1.5 },
  aura: { blur: 15, brightness: 2.9, opacity: 0.1, saturate: 3 },
}

export type PixelBloomStyle = {
  filter: string
  opacity: number
  mixBlendMode: "plus-lighter"
  imageRendering: "auto"
}

/** Style for the bloom layer canvas. null when off. */
export function pixelBloomStyle(bloom: PixelBloom): PixelBloomStyle | null {
  if (bloom === "off") return null
  const cfg = BLOOM_PRESET[bloom]
  return {
    filter: `blur(${cfg.blur}px) brightness(${cfg.brightness}) saturate(${cfg.saturate})`,
    opacity: cfg.opacity,
    mixBlendMode: "plus-lighter",
    imageRendering: "auto",
  }
}

/** Whether the OS asks for reduced motion (skip entrances). */
export function pixelPrefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
  )
}
