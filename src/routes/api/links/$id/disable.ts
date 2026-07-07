import { createFileRoute } from '@tanstack/react-router'
import { json } from '../../../../lib/http'
import { requireUser } from '../../../../lib/auth/server'
import { toggleLinkStatus } from '../../../../lib/links/store'

export async function disableLinkHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const result = await toggleLinkStatus(id, 'inactive')
  return json(result, { status: result.ok ? 200 : 404 })
}

export const Route = createFileRoute('/api/links/$id/disable')({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => disableLinkHandler(request, params.id),
    },
  },
})
