# Davos Links

Davos Links is a Cloudflare-native branded URL shortener for `links.davosdo.dev`.

- Public entry: `https://links.davosdo.dev/`
- Dashboard: `https://links.davosdo.dev/dashboard`
- Short links: `https://links.davosdo.dev/:shortPath`

## Stack

- TanStack Start, React, TypeScript, TanStack Router
- Tailwind CSS
- Cloudflare Workers
- Cloudflare D1 binding: `LINKS_DB`
- Cloudflare KV binding: `SHORT_LINK_CACHE`
- Workers Analytics Engine binding: `CLICK_ANALYTICS`
- Better Auth at `/api/auth/*`
- Wrangler

## Architecture

D1 stores canonical auth, workspace, domain, link, tag, campaign, API key, and daily metric data. KV stores compact redirect payloads keyed as `link:${host}:${short_path_normalized}`. Public redirects resolve KV first, fall back to D1, refresh KV, emit Analytics Engine telemetry through `ctx.waitUntil()`, and redirect without waiting on analytics.

The dashboard is protected with Better Auth. Client dashboard pages load data through protected `/api/*` routes so Cloudflare bindings stay server-only.

## Setup

```bash
pnpm install
pnpm cf-typegen
pnpm db:migrate:local
pnpm dev
```

Set local auth values in `.dev.vars`:

```bash
BETTER_AUTH_SECRET="replace-with-a-random-secret"
BETTER_AUTH_URL="http://localhost:3000"
```

Local demo credentials after seeding:

```txt
Email: demo@links.davosdo.dev
Password: DavosLinksDemo123!
```

For production, replace the placeholder Cloudflare resource IDs in `wrangler.jsonc`, then set:

```bash
wrangler secret put BETTER_AUTH_SECRET
```

`BETTER_AUTH_URL` is configured as `https://links.davosdo.dev` in `wrangler.jsonc`.

## Scripts

```bash
pnpm dev              # Vite dev server
pnpm generate-routes  # TanStack route tree
pnpm build            # Vite build + strict TypeScript
pnpm preview          # Preview build
pnpm deploy           # Build and deploy with Wrangler
pnpm cf-typegen       # Generate Cloudflare binding types
pnpm db:migrate:local # Apply D1 migrations locally
pnpm db:migrate       # Apply D1 migrations remotely
pnpm ui:detect        # Run Impeccable detector
```

## Routes

- `/` public product entry
- `/login` Better Auth email/password sign-in
- `/dashboard`
- `/dashboard/links`
- `/dashboard/links/new`
- `/dashboard/links/$id`
- `/dashboard/campaigns`
- `/dashboard/tags`
- `/dashboard/settings`
- `/api/auth/*`
- `/api/links`
- `/api/links/check-path`
- `/api/links/$id`
- `/api/links/$id/disable`
- `/api/links/$id/archive`
- `/api/analytics/overview`
- `/api/links/$id/analytics`
- `/health`
- `/:shortPath`

Reserved paths are blocked for custom short links: `dashboard`, `api`, `health`, `assets`, `_build`, `_static`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `login`, `logout`, `register`, `settings`, `admin`, and `app`.

## Deploy

1. Create Cloudflare resources:
   - D1 database: `davos-links-db`
   - KV namespace: `SHORT_LINK_CACHE`
   - Analytics Engine dataset: `davos_links_clicks`
2. Replace placeholder IDs in `wrangler.jsonc`.
3. Run `pnpm cf-typegen`.
4. Run `pnpm db:migrate`.
5. Run `pnpm deploy`.

## Design

The dashboard uses a Tripwire-inspired vivid-light system: Geist-style sans and mono typography, warm white surfaces, dark text, vivid semantic colors, tinted borders, controlled dither textures, compact controls, and reduced-motion-safe animation. Blue represents primary/current data, purple navigation/previous data, green success/active, orange warning/inactive, red destructive/error, and pink campaigns or secondary accents. The app remains light-only and targets WCAG AA contrast.

The vendored Dither Kit subset lives in `src/components/dither-kit/` and is pinned to upstream commit `9fb0b141d2caab257bd75f02834bbe529cf741d0`. It includes only the chart, sparkline, button, avatar, gradient, and core primitives required by the product; local wrappers preserve Davos Links semantics and accessibility.

Optional review tools:

```bash
npx impeccable detect src/
npx skills add Leonxlnx/taste-skill
```

## Known Limitations

- Analytics dashboards read D1 daily aggregates; raw Analytics Engine SQL querying is prepared conceptually but not exposed in the UI yet.
- Tags and campaigns have schema and placeholder pages; full CRUD is future work.
- Link detail has inspect/copy/open actions; full edit form is future work.
- Registration is intentionally hidden from the UI because this is a private single-operator app.
- Email/password sign-up is disabled in Better Auth; create users intentionally through local setup or an admin-only process.
