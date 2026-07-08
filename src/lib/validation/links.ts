import { RESERVED_PATHS, RESERVED_PREFIXES } from '#/lib/constants'

export function normalizeShortPath(path: string) {
  return path
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase()
}

export function isReservedPath(path: string) {
  const normalized = normalizeShortPath(path)
  return (
    RESERVED_PATHS.has(normalized) ||
    RESERVED_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  )
}

export function validateShortPath(path: string) {
  const normalized = normalizeShortPath(path)

  if (!normalized) {
    return { ok: false as const, error: 'Enter a path or generate one.' }
  }

  if (normalized.length > 80) {
    return { ok: false as const, error: 'Path must be 80 characters or less.' }
  }

  if (!/^[a-z0-9][a-z0-9/_-]*[a-z0-9]$|^[a-z0-9]$/i.test(normalized)) {
    return {
      ok: false as const,
      error: 'Use letters, numbers, dashes, underscores, or slashes.',
    }
  }

  if (normalized.includes('//')) {
    return { ok: false as const, error: 'Path cannot include empty segments.' }
  }

  if (isReservedPath(normalized)) {
    return { ok: false as const, error: 'This path is reserved.' }
  }

  return { ok: true as const, path: normalized }
}

export function isValidDestinationUrl(value: string) {
  if (!value.trim()) return false

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function normalizeDestinationUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Destination URL must start with http:// or https://.')
  }
  return url.toString()
}

export function mergeQueryParams(destination: string, source: URL) {
  const target = new URL(destination)
  source.searchParams.forEach((value, key) => {
    if (!target.searchParams.has(key)) {
      target.searchParams.append(key, value)
    }
  })
  return target.toString()
}

export function generateRandomSlug(size = 6) {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}
