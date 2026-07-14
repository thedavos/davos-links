import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '#/lib/auth/server'
import {
  getLinkAnalytics,
  isDateRangeValidationError,
  parseDateRange,
  parseTimeZone,
} from '#/lib/analytics/index'
import { json } from '#/lib/http'

export async function linkAnalyticsHandler(request: Request, id: string) {
  await requireUser(request.headers)
  const url = new URL(request.url)
  try {
    return json(
      await getLinkAnalytics(id, parseDateRange(url), parseTimeZone(url)),
    )
  } catch (error) {
    if (!isDateRangeValidationError(error)) throw error
    return json(
      { code: error.code, error: error.message, field: error.field },
      { status: 400 },
    )
  }
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
