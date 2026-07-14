import type { CachedLink } from '#/lib/types'
import { trackClick } from '#/lib/analytics/index'
import { BRAND_BYLINE, BRAND_FULL_NAME, BRAND_NAME } from '#/lib/constants'
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
    `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="theme-color" content="#faf9f6">
    <title>${escapeHtml(title)} · ${BRAND_FULL_NAME}</title>
    <style>
      :root{color-scheme:light;font-family:Geist,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#151515;background:#faf9f6}
      *{box-sizing:border-box}
      body{margin:0;display:grid;min-height:100dvh;place-items:center;padding:24px;overflow:hidden;background:#faf9f6}
      body:before{content:"";position:fixed;inset:-20%;background:radial-gradient(circle at 18% 22%,rgba(39,93,255,.18),transparent 28%),radial-gradient(circle at 82% 78%,rgba(255,107,74,.16),transparent 31%),radial-gradient(circle at 1px 1px,rgba(39,93,255,.15) 1px,transparent 1.2px);background-size:auto,auto,5px 5px;transform:rotate(-3deg)}
      main{position:relative;width:min(440px,100%);border:1px solid rgba(39,93,255,.32);border-radius:12px;background:rgba(255,255,255,.95);padding:30px;box-shadow:12px 12px 0 rgba(255,107,74,.1),0 28px 70px -48px rgba(39,93,255,.9)}
      .brand{display:flex;align-items:center;gap:4px;margin:0 0 26px;color:#151515}
      .brand svg{width:34px;height:auto;flex:none}
      .brand-copy{display:flex;flex-direction:column;align-items:flex-start;justify-content:center}
      .wordmark{font-size:18px;font-weight:550;line-height:1;letter-spacing:-.045em}
      .byline{margin-top:2px;font-size:10px;font-weight:550;line-height:1;color:#625f6d;letter-spacing:-.01em}
      h1{margin:0 0 10px;font-size:clamp(24px,7vw,34px);line-height:1.05;letter-spacing:-.035em}
      p{margin:0;color:#625f59;line-height:1.6}
      .rule{height:4px;margin-top:28px;background:linear-gradient(90deg,#275dff 0 58%,#ff6b4a 58%)}
    </style>
  </head>
  <body>
    <main>
      <div class="brand" aria-label="${BRAND_FULL_NAME}">
        <svg aria-hidden="true" fill="none" viewBox="0 0 80 64" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 58 27.6 9.9A6.5 6.5 0 0 1 33.5 6h10.8a6 6 0 0 1 5.8 4.2L54.2 23 35 33.3 25.7 55.6A4 4 0 0 1 22 58H6Z" fill="#275dff"/>
          <path d="m35 33.3 19.2-10.4L74 58H58a6 6 0 0 1-5.3-3.2L35 33.3Z" fill="#151515"/>
        </svg>
        <span class="brand-copy"><span class="wordmark">${BRAND_NAME}</span><span class="byline">${BRAND_BYLINE}</span></span>
      </div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <div class="rule" aria-hidden="true"></div>
    </main>
  </body>
</html>`,
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
