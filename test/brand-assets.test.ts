import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const publicDir = resolve(process.cwd(), 'public')

async function pngSize(fileName: string) {
  const buffer = await readFile(resolve(publicDir, fileName))
  expect(buffer.subarray(1, 4).toString()).toBe('PNG')
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)] as const
}

describe('atajo brand assets', () => {
  it('publishes the complete PWA icon set at the expected dimensions', async () => {
    await expect(pngSize('apple-touch-icon.png')).resolves.toEqual([180, 180])
    await expect(pngSize('icon-192.png')).resolves.toEqual([192, 192])
    await expect(pngSize('icon-512.png')).resolves.toEqual([512, 512])
    await expect(pngSize('icon-maskable-512.png')).resolves.toEqual([512, 512])
    await expect(pngSize('logo192.png')).resolves.toEqual([192, 192])
    await expect(pngSize('logo512.png')).resolves.toEqual([512, 512])

    const favicon = await readFile(resolve(publicDir, 'favicon.ico'))
    expect(favicon.readUInt16LE(2)).toBe(1)
    expect(favicon.readUInt16LE(4)).toBe(5)
  })

  it('publishes the social image and canonical vector marks', async () => {
    await expect(pngSize('og-image.png')).resolves.toEqual([1200, 630])

    const brandMark = await readFile(resolve(publicDir, 'brand-mark.svg'), 'utf8')
    const faviconSvg = await readFile(resolve(publicDir, 'favicon.svg'), 'utf8')
    expect(brandMark).toContain('<title>atajo</title>')
    expect(brandMark).toContain('#275DFF')
    expect(faviconSvg).toContain('#FAF9F6')
  })

  it('declares the public brand and maskable icon in the manifest', async () => {
    const manifest = JSON.parse(
      await readFile(resolve(publicDir, 'manifest.json'), 'utf8'),
    ) as {
      short_name: string
      name: string
      theme_color: string
      background_color: string
      icons: Array<{ src: string; purpose?: string }>
    }

    expect(manifest.short_name).toBe('atajo')
    expect(manifest.name).toBe('atajo by davosdo')
    expect(manifest.theme_color).toBe('#faf9f6')
    expect(manifest.background_color).toBe('#faf9f6')
    expect(manifest.icons).toContainEqual(
      expect.objectContaining({
        src: '/icon-maskable-512.png',
        purpose: 'maskable',
      }),
    )
  })
})
