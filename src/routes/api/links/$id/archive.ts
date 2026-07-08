import { createFileRoute } from '@tanstack/react-router'
import { json } from '#/lib/http'
import { requireUser } from '#/lib/auth/server'
import { archiveLink } from '#/lib/links/store'

export async function archiveLinkHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const result = await archiveLink(id)
  return json(result, { status: result.ok ? 200 : 404 })
}

export const Route = createFileRoute('/api/links/$id/archive')({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => archiveLinkHandler(request, params.id),
    },
  },
})
