import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '#/lib/auth/server'
import { getAnalyticsOverviewForRange, parseDateRange } from '#/lib/analytics/index'
import { json } from '#/lib/http'

export async function analyticsOverviewHandler(request: Request) {
  await requireUser(request.headers)
  const url = new URL(request.url)
  return json(await getAnalyticsOverviewForRange(parseDateRange(url)))
}

export const Route = createFileRoute('/api/analytics/overview')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        analyticsOverviewHandler(request),
    },
  },
})
