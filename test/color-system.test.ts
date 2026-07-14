import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PALETTE } from '#/components/dither-kit/palette'

const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8')

describe('atajo color system', () => {
  it('limits the Dither palette to the two brand families and neutral grey', () => {
    expect(Object.keys(PALETTE)).toEqual(['blue', 'coral', 'grey'])
  })

  it('publishes the approved identity seeds and accessible semantic shades', () => {
    expect(styles).toContain('--blue-500: #275dff;')
    expect(styles).toContain('--blue-600: #164bd8;')
    expect(styles).toContain('--coral-500: #ff6b4a;')
    expect(styles).toContain('--coral-700: #b93420;')
    expect(styles).not.toMatch(/--(?:purple|pink|green|orange|red)(?:-|:)/)
  })

  it.each([
    ['blue seed on white', '#275DFF', '#FFFFFF', 4.5],
    ['blue control on white', '#164BD8', '#FFFFFF', 4.5],
    ['coral seed with ink', '#FF6B4A', '#151515', 4.5],
    ['coral control on white', '#B93420', '#FFFFFF', 4.5],
    ['muted text on warm white', '#625F59', '#FAF9F6', 4.5],
    ['input boundary on white', '#8A8780', '#FFFFFF', 3],
  ])('keeps %s at or above its WCAG target', (_label, foreground, background, minimum) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(minimum)
  })
})

function contrastRatio(first: string, second: string) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)

  if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`)

  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}
