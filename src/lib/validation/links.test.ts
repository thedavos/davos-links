import { describe, expect, it, vi } from 'vitest'
import {
  generateRandomSlug,
  isReservedPath,
  isValidDestinationUrl,
  mergeQueryParams,
  normalizeDestinationUrl,
  normalizeShortPath,
  validateShortPath,
} from '#/lib/validation/links'

describe('link validation helpers', () => {
  it('normalizes URLs, leading slashes, trailing slashes, and case', () => {
    expect(normalizeShortPath(' HTTPS://links.davosdo.dev/Railway/ ')).toBe(
      'railway',
    )
    expect(normalizeShortPath('/Docs/API/')).toBe('docs/api')
  })

  it('detects exact and prefixed reserved paths', () => {
    expect(isReservedPath('dashboard')).toBe(true)
    expect(isReservedPath('/api/links')).toBe(true)
    expect(isReservedPath('_build/assets')).toBe(true)
    expect(isReservedPath('railway')).toBe(false)
  })

  it('validates short path shape and reserved names', () => {
    expect(validateShortPath('')).toMatchObject({ ok: false })
    expect(validateShortPath('a'.repeat(81))).toMatchObject({ ok: false })
    expect(validateShortPath('-bad')).toMatchObject({ ok: false })
    expect(validateShortPath('bad//path')).toMatchObject({ ok: false })
    expect(validateShortPath('dashboard')).toMatchObject({ ok: false })
    expect(validateShortPath('Railway_2026')).toEqual({
      ok: true,
      path: 'railway_2026',
    })
  })

  it('accepts only http and https destination URLs', () => {
    expect(isValidDestinationUrl('https://example.com')).toBe(true)
    expect(isValidDestinationUrl('http://example.com')).toBe(true)
    expect(isValidDestinationUrl('javascript:alert(1)')).toBe(false)
    expect(isValidDestinationUrl('data:text/plain,test')).toBe(false)
    expect(isValidDestinationUrl('file:///tmp/a')).toBe(false)
    expect(isValidDestinationUrl('not a url')).toBe(false)
    expect(isValidDestinationUrl('')).toBe(false)
  })

  it('normalizes destination URLs and rejects unsafe protocols', () => {
    expect(normalizeDestinationUrl('https://example.com/path')).toBe(
      'https://example.com/path',
    )
    expect(() => normalizeDestinationUrl('ftp://example.com')).toThrow(
      'Destination URL must start',
    )
  })

  it('merges source query params without overwriting destination params', () => {
    const merged = mergeQueryParams(
      'https://example.com?a=1&utm_source=existing',
      new URL('https://links.davosdo.dev/x?a=2&utm_source=new&utm_medium=codex'),
    )
    expect(merged).toBe(
      'https://example.com/?a=1&utm_source=existing&utm_medium=codex',
    )
  })

  it('generates random slugs from the allowed alphabet', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      const bytes = array as Uint8Array
      bytes.fill(0)
      return array
    })
    expect(generateRandomSlug(4)).toBe('AAAA')
  })
})
