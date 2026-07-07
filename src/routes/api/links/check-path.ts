import { createFileRoute } from '@tanstack/react-router'
import { json } from '../../../lib/http'
import { requireUser } from '../../../lib/auth/server'
import { checkPath } from '../../../lib/links/store'

export async function checkPathHandler(request: Request) {
  await requireUser(request.headers)
  const path = new URL(request.url).searchParams.get('path') ?? ''
  return json(await checkPath(path))
}

export const Route = createFileRoute('/api/links/check-path')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => checkPathHandler(request),
    },
  },
})
