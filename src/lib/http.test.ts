import { describe, expect, it } from 'vitest'
import { json, readJson } from '#/lib/http'

describe('http helpers', () => {
  it('returns JSON with no-store cache control', async () => {
    const response = json({ ok: true }, { status: 201 })
    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ ok: true })
  })

  it('allows explicit headers to override defaults', () => {
    const response = json({ ok: true }, { headers: { 'cache-control': 'max-age=1' } })
    expect(response.headers.get('cache-control')).toBe('max-age=1')
  })

  it('reads JSON only for application/json requests', async () => {
    await expect(
      readJson(
        new Request('https://links.davosdo.dev', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'Railway' }),
        }),
      ),
    ).resolves.toEqual({ title: 'Railway' })

    await expect(readJson(new Request('https://links.davosdo.dev'))).resolves.toEqual(
      {},
    )
  })
})
