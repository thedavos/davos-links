import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '#/lib/auth/server'
import { getLinkAnalytics, parseDateRange } from '#/lib/analytics/index'
import { json } from '#/lib/http'

export async function linkAnalyticsHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const url = new URL(request.url)
  return json(await getLinkAnalytics(id, parseDateRange(url)))
}

export const Route = createFileRoute('/api/links/$id/analytics')({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => linkAnalyticsHandler(request, params.id),
    },
  },
})
