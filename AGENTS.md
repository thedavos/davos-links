# Davos Links / atajo Agent Rules

## Preserve These Decisions

- Project and infrastructure name: Davos Links / `davos-links`
- Public brand: `atajo`
- Public brand signature: `atajo by davosdo`
- Brand tagline: `La ruta corta.`
- Public domain: `links.davosdo.dev`
- Dashboard route: `/dashboard`
- Public short links: `/:shortPath`
- Framework/runtime: TanStack Start on Cloudflare Workers
- Data: Cloudflare D1, KV, Workers Analytics Engine
- Auth: Better Auth at `/api/auth/*`
- UI: Tripwire-inspired vivid-light developer-tool surface

## Stack Boundaries

Use TanStack Start, React, TypeScript, Tailwind CSS, Wrangler, Better Auth, D1, KV, and Workers Analytics Engine. Do not introduce alternate app frameworks, auth providers, or server runtimes.

## Server/Client Boundaries

- Cloudflare bindings must stay in server route handlers or server functions.
- Dashboard client components should call protected API routes for D1/KV/Analytics-backed data.
- Better Auth secrets and session reads must stay server-side.
- Keep `pnpm build` clean with strict TypeScript.

## Redirect Rules

Public redirect flow:

1. Parse host and path.
2. Reject reserved/internal paths.
3. Normalize the short path.
4. Resolve `link:${host}:${short_path_normalized}` from `SHORT_LINK_CACHE`.
5. Fall back to D1 on miss.
6. Cache active link payloads with TTL.
7. Respect inactive, archived, expired, and fallback behavior.
8. Emit click telemetry through `ctx.waitUntil()`.
9. Redirect with the link redirect type.

## Reserved Paths

Never allow these as custom short paths:

`dashboard`, `api`, `health`, `assets`, `_build`, `_static`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `login`, `logout`, `register`, `settings`, `admin`, `app`.

Also reject paths starting with `dashboard/`, `api/`, `assets/`, `_build/`, or `_static/`.

## Design Rules

- Use the geometric atajo A mark; do not replace it with a chain-link icon.
- Keep the wordmark lowercase and show `by davosdo` on spacious brand surfaces.
- Use a precise developer-tool layout.
- Use Geist-style sans and mono typography.
- Keep the application light-only with white/off-white surfaces and dark text.
- Use only the atajo blue and route coral families plus warm neutrals: blue for primary/current/info/success and coral for comparison/campaigns/warning/destructive. Preserve meaning with labels, icons, shapes, and patterns.
- User-selected tag swatches are content and may use arbitrary colors; do not propagate those colors into application chrome.
- Use controlled dither texture and bloom; reserve Canvas for major surfaces and labeled CTAs, and use the static CSS Bayer pattern for repeated or compact controls.
- Keep spacing compact and consistent.
- Keep tables scan-friendly.
- Maintain WCAG AA contrast, visible focus rings, non-color status cues, and reduced-motion behavior.
- Avoid glass effects, oversized cards, permanent sparkles, and ornamental icons.

## Collaboration Rules

- Read files before editing.
- Do not revert unrelated changes.
- Keep migrations idempotent.
- Run `pnpm generate-routes` after route changes.
- Run `pnpm build` before handoff when code changes.
