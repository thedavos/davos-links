import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '#/lib/auth/server'
import { json, readJson } from '#/lib/http'
import { createTag, listTags } from '#/lib/links/store'

export async function getTagsHandler(request: Request) {
  await requireUser(request.headers)
  return json({ tags: await listTags() })
}

export async function postTagsHandler(request: Request) {
  await requireUser(request.headers)
  const result = await createTag(await readJson(request))
  return json(result, { status: result.ok ? 201 : 400 })
}

export const Route = createFileRoute('/api/tags')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => getTagsHandler(request),
      POST: async ({ request }: { request: Request }) => postTagsHandler(request),
    },
  },
})
