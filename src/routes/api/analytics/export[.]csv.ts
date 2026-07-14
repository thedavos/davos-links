import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '#/lib/auth/server'
import {
  exportMetricsCsv,
  isDateRangeValidationError,
  parseDateRange,
  parseTimeZone,
} from '#/lib/analytics/index'
import { json } from '#/lib/http'

export async function analyticsExportCsvHandler(request: Request) {
  await requireUser(request.headers)
  const url = new URL(request.url)
  try {
    const csv = await exportMetricsCsv(
      parseDateRange(url),
      url.searchParams.get('linkId'),
      parseTimeZone(url),
    )
    return new Response(csv, {
      headers: {
        'cache-control': 'no-store',
        'content-disposition': 'attachment; filename="davos-links-analytics.csv"',
        'content-type': 'text/csv; charset=utf-8',
      },
    })
  } catch (error) {
    if (!isDateRangeValidationError(error)) throw error
    return json(
      { code: error.code, error: error.message, field: error.field },
      { status: 400 },
    )
  }
}

export const Route = createFileRoute('/api/analytics/export.csv')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        analyticsExportCsvHandler(request),
    },
  },
})
