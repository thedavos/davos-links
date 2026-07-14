import type { CachedLink } from '#/lib/types'
import { trackClick } from '#/lib/analytics/index'
import { resolveLink } from '#/lib/links/store'
import {
  isReservedPath,
  mergeQueryParams,
  normalizeShortPath,
} from '#/lib/validation/links'

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
    return statusPage('Enlace desactivado', 'Este enlace corto no está activo.')
  }

  if (isExpired(link)) {
    if (link.fallback_url) {
      return Response.redirect(link.fallback_url, link.redirect_type)
    }
    return statusPage('Enlace vencido', 'Este enlace corto ha vencido.')
  }

  const destination =
    link.preserve_query_params === 1
      ? mergeQueryParams(link.destination_url, url)
      : link.destination_url

  const clickTracking = trackClick(request, link)
  if (ctx) {
    ctx.waitUntil(clickTracking)
  } else {
    await clickTracking
  }
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
    `<!doctype html><html lang="es"><head><title>${escapeHtml(title)} · Davos Links</title><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><style>:root{color-scheme:light;font-family:Geist,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18181b;background:#fbfbff}*{box-sizing:border-box}body{margin:0;display:grid;min-height:100vh;place-items:center;padding:24px;overflow:hidden;background:#fbfbff}body:before{content:"";position:fixed;inset:-20%;background:radial-gradient(circle at 18% 22%,rgba(53,143,243,.2),transparent 28%),radial-gradient(circle at 82% 78%,rgba(150,110,255,.19),transparent 31%),radial-gradient(circle at 1px 1px,rgba(255,61,155,.2) 1px,transparent 1.2px);background-size:auto,auto,5px 5px;transform:rotate(-3deg)}main{position:relative;width:min(440px,100%);border:1px solid rgba(53,143,243,.38);border-radius:12px;background:rgba(255,255,255,.94);padding:30px;box-shadow:12px 12px 0 rgba(150,110,255,.12),0 28px 70px -48px rgba(53,143,243,.95)}.brand{display:flex;align-items:center;gap:9px;margin:0 0 24px;font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#246dbb;letter-spacing:.04em}.mark{width:10px;height:10px;background:#358ff3;box-shadow:4px 4px 0 rgba(150,110,255,.35)}h1{margin:0 0 10px;font-size:clamp(24px,7vw,34px);line-height:1.05;letter-spacing:-.035em}p{margin:0;color:#52525b;line-height:1.6}.rule{height:4px;margin-top:28px;background:linear-gradient(90deg,#358ff3 0 28%,#966eff 28% 52%,#ff3d9b 52% 72%,#37d67a 72% 86%,#ff9632 86%)}</style></head><body><main><p class="brand"><span class="mark" aria-hidden="true"></span>Davos Links</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><div class="rule" aria-hidden="true"></div></main></body></html>`,
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
