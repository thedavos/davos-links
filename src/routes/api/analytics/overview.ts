import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '#/lib/auth/server'
import {
  getAnalyticsOverviewForRange,
  isDateRangeValidationError,
  parseDateRange,
  parseTimeZone,
} from '#/lib/analytics/index'
import { json } from '#/lib/http'

export async function analyticsOverviewHandler(request: Request) {
  await requireUser(request.headers)
  const url = new URL(request.url)
  try {
    return json(
      await getAnalyticsOverviewForRange(parseDateRange(url), parseTimeZone(url)),
    )
  } catch (error) {
    if (!isDateRangeValidationError(error)) throw error
    return json(
      { code: error.code, error: error.message, field: error.field },
      { status: 400 },
    )
  }
}

export const Route = createFileRoute('/api/analytics/overview')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        analyticsOverviewHandler(request),
    },
  },
})
