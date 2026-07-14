# Davos Links Product

Davos Links is a small, production-quality URL shortener for davosdo.dev links.
Its public product identity is **atajo by davosdo**; Davos Links remains the
technical project and infrastructure name.

## Goals

- Create short, branded links on `links.davosdo.dev`.
- Redirect public visitors quickly and reliably.
- Give authenticated operators a compact dashboard for link management.
- Capture useful click telemetry without slowing down redirects.
- Run entirely on Cloudflare infrastructure.

## Users

Primary users are Davos operators who create, edit, copy, and monitor short links. Public visitors only interact with the redirect surface.

## MVP Scope

- Authenticated dashboard.
- Link creation with custom short paths.
- Reserved-path validation.
- Link list with copy actions and status.
- Link creation, status changes, archive flow, and detail inspection.
- Public redirect by short path.
- D1 canonical storage.
- KV redirect cache.
- Workers Analytics Engine click events.

## Non-Goals

- Multi-tenant billing.
- Public self-service onboarding.
- Complex campaign automation.
- Custom domains beyond the primary domain.
- Heavy reporting beyond basic click telemetry.

## Core Workflows

1. Operator signs in.
2. Operator creates a short link with destination, short path, title, and optional description.
3. App validates the destination URL and reserved short paths.
4. App writes the link to D1; redirect resolution populates KV on demand.
5. Operator copies the public short URL.
6. Visitor opens the short URL.
7. Worker resolves the destination and redirects.
8. Worker emits a click event to Analytics Engine.

## Success Criteria

- Short-link redirects feel immediate.
- Operators can create a link in under a minute.
- Invalid or reserved paths are blocked clearly.
- Dashboard data never renders for unauthenticated users.
- Redirect telemetry failure never breaks a valid redirect.
