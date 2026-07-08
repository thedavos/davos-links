import { createFileRoute } from '@tanstack/react-router'
import { json, readJson } from '#/lib/http'
import { requireUser } from '#/lib/auth/server'
import { deleteLink, getLink, updateLink } from '#/lib/links/store'

export async function getLinkHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const link = await getLink(id)
  return link ? json({ link }) : json({ error: 'Not found' }, { status: 404 })
}

export async function patchLinkHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const result = await updateLink(id, await readJson(request))
  return json(result, { status: result.ok ? 200 : 400 })
}

export async function deleteLinkHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const result = await deleteLink(id)
  return json(result, { status: result.ok ? 200 : 404 })
}

export const Route = createFileRoute('/api/links/$id')({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => getLinkHandler(request, params.id),
      PATCH: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => patchLinkHandler(request, params.id),
      DELETE: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => deleteLinkHandler(request, params.id),
    },
  },
})
