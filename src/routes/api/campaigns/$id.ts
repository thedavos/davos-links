import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '../../../lib/auth/server'
import { json, readJson } from '../../../lib/http'
import { deleteCampaign, getCampaign, updateCampaign } from '../../../lib/links/store'

export async function getCampaignHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const campaign = await getCampaign(id)
  return campaign
    ? json({ campaign })
    : json({ error: 'Not found' }, { status: 404 })
}

export async function patchCampaignHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const result = await updateCampaign(id, await readJson(request))
  return json(result, { status: result.ok ? 200 : 400 })
}

export async function deleteCampaignHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const result = await deleteCampaign(id)
  return json(result, { status: result.ok ? 200 : 404 })
}

export const Route = createFileRoute('/api/campaigns/$id')({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => getCampaignHandler(request, params.id),
      PATCH: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => patchCampaignHandler(request, params.id),
      DELETE: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => deleteCampaignHandler(request, params.id),
    },
  },
})
