import { createFileRoute } from '@tanstack/react-router'
import { json, readJson } from '../../lib/http'
import { requireUser } from '../../lib/auth/server'
import { createLink, listLinks } from '../../lib/links/store'
import type { LinkStatus } from '../../lib/types'

type CreateLinkBody = {
  title?: string
  description?: string
  destinationUrl: string
  shortPath?: string
  redirectType?: number
  preserveQueryParams?: boolean
  expiresAt?: string | null
  fallbackUrl?: string | null
}

export async function getLinksHandler(request: Request) {
  await requireUser(request.headers)
  const url = new URL(request.url)
  return json({
    links: await listLinks({
      q: url.searchParams.get('q') ?? undefined,
      status: parseStatus(url.searchParams.get('status')),
      tagId: url.searchParams.get('tagId') ?? undefined,
      campaignId: url.searchParams.get('campaignId') ?? undefined,
      createdFrom: url.searchParams.get('createdFrom') ?? undefined,
      createdTo: url.searchParams.get('createdTo') ?? undefined,
      limit: parseInteger(url.searchParams.get('limit')),
      offset: parseInteger(url.searchParams.get('offset')),
    }),
  })
}

export async function postLinksHandler(request: Request) {
  await requireUser(request.headers)
  const body = await readJson<CreateLinkBody>(request)
  const result = await createLink(body)
  return json(result, { status: result.ok ? 201 : 400 })
}

export const Route = createFileRoute('/api/links')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => getLinksHandler(request),
      POST: async ({ request }: { request: Request }) => postLinksHandler(request),
    },
  },
})

function parseStatus(value: string | null): LinkStatus | undefined {
  return value === 'active' || value === 'inactive' || value === 'archived'
    ? value
    : undefined
}

function parseInteger(value: string | null) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}
