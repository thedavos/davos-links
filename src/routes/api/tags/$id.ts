import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '../../../lib/auth/server'
import { json, readJson } from '../../../lib/http'
import { deleteTag, getTag, updateTag } from '../../../lib/links/store'

export async function getTagHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const tag = await getTag(id)
  return tag ? json({ tag }) : json({ error: 'Not found' }, { status: 404 })
}

export async function patchTagHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const result = await updateTag(id, await readJson(request))
  return json(result, { status: result.ok ? 200 : 400 })
}

export async function deleteTagHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const result = await deleteTag(id)
  return json(result, { status: result.ok ? 200 : 404 })
}

export const Route = createFileRoute('/api/tags/$id')({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => getTagHandler(request, params.id),
      PATCH: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => patchTagHandler(request, params.id),
      DELETE: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => deleteTagHandler(request, params.id),
    },
  },
})
