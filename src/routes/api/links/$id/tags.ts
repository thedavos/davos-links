import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '../../../../lib/auth/server'
import { json, readJson } from '../../../../lib/http'
import { getLink, setLinkTags } from '../../../../lib/links/store'

type Body = {
  tagIds?: string[]
}

export async function getLinkTagsHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const link = await getLink(id)
  return link
    ? json({ tags: link.tags ?? [] })
    : json({ error: 'Not found' }, { status: 404 })
}

export async function putLinkTagsHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const body = await readJson<Body>(request)
  const result = await setLinkTags(id, body.tagIds ?? [])
  return json(result, { status: result.ok ? 200 : 400 })
}

export const Route = createFileRoute('/api/links/$id/tags')({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => getLinkTagsHandler(request, params.id),
      PUT: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => putLinkTagsHandler(request, params.id),
    },
  },
})
