import type { CachedLink } from '../types'
import { trackClick } from '../analytics'
import { resolveLink } from '../links/store'
import {
  isReservedPath,
  mergeQueryParams,
  normalizeShortPath,
} from '../validation/links'

export async function handlePublicRedirect(request: Request, ctx?: ExecutionContext) {
  const url = new URL(request.url)
  const host = url.hostname
  const shortPath = normalizeShortPath(url.pathname)

  if (!shortPath || isReservedPath(shortPath)) {
    return notFound(shortPath)
  }

  const { link } = await resolveLink(host, shortPath)
  if (!link) return notFound(shortPath)

  if (link.status !== 'active') {
    return statusPage('Link disabled', 'This short link is not active.')
  }

  if (isExpired(link)) {
    if (link.fallback_url) {
      return Response.redirect(link.fallback_url, link.redirect_type)
    }
    return statusPage('Link expired', 'This short link has expired.')
  }

  const destination =
    link.preserve_query_params === 1
      ? mergeQueryParams(link.destination_url, url)
      : link.destination_url

  ctx?.waitUntil(trackClick(request, link))
  return Response.redirect(destination, link.redirect_type)
}

function isExpired(link: CachedLink) {
  return Boolean(link.expires_at && Date.parse(link.expires_at) <= Date.now())
}

function notFound(path: string) {
  return statusPage(
    'Enlace no encontrado',
    path ? `No existe un enlace configurado para /${path}.` : '',
  )
}

function statusPage(title: string, message: string, status = 404) {
  return new Response(
    `<!doctype html><html><head><title>${escapeHtml(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:ui-sans-serif,system-ui,sans-serif;margin:0;display:grid;min-height:100vh;place-items:center;background:#fafafa;color:#111"><main style="width:min(420px,calc(100vw - 32px));border:1px solid #e5e5e5;background:white;padding:24px"><p style="font:12px ui-monospace,monospace;color:#737373;margin:0 0 12px">Davos Links</p><h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(title)}</h1><p style="color:#525252;margin:0;line-height:1.5">${escapeHtml(message)}</p></main></body></html>`,
    {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    },
  )
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[char] ?? char
  })
}
