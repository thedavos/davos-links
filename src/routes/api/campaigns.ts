import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '../../lib/auth/server'
import { json, readJson } from '../../lib/http'
import { createCampaign, listCampaigns } from '../../lib/links/store'

export async function getCampaignsHandler(request: Request) {
  await requireUser(request.headers)
  return json({ campaigns: await listCampaigns() })
}

export async function postCampaignsHandler(request: Request) {
  await requireUser(request.headers)
  const result = await createCampaign(await readJson(request))
  return json(result, { status: result.ok ? 201 : 400 })
}

export const Route = createFileRoute('/api/campaigns')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => getCampaignsHandler(request),
      POST: async ({ request }: { request: Request }) => postCampaignsHandler(request),
    },
  },
})
