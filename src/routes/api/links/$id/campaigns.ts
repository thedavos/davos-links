import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '#/lib/auth/server'
import { json, readJson } from '#/lib/http'
import { getLink, setLinkCampaigns } from '#/lib/links/store'

type Body = {
  campaignIds?: string[]
}

export async function getLinkCampaignsHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const link = await getLink(id)
  return link
    ? json({ campaigns: link.campaigns ?? [] })
    : json({ error: 'Not found' }, { status: 404 })
}

export async function putLinkCampaignsHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const body = await readJson<Body>(request)
  const result = await setLinkCampaigns(id, body.campaignIds ?? [])
  return json(result, { status: result.ok ? 200 : 400 })
}

export const Route = createFileRoute('/api/links/$id/campaigns')({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => getLinkCampaignsHandler(request, params.id),
      PUT: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => putLinkCampaignsHandler(request, params.id),
    },
  },
})
