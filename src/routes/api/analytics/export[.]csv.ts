import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '#/lib/auth/server'
import { exportMetricsCsv, parseDateRange } from '#/lib/analytics/index'

export async function analyticsExportCsvHandler(request: Request) {
  await requireUser(request.headers)
  const url = new URL(request.url)
  const csv = await exportMetricsCsv(parseDateRange(url), url.searchParams.get('linkId'))
  return new Response(csv, {
    headers: {
      'cache-control': 'no-store',
      'content-disposition': 'attachment; filename="davos-links-analytics.csv"',
      'content-type': 'text/csv; charset=utf-8',
    },
  })
}

export const Route = createFileRoute('/api/analytics/export.csv')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        analyticsExportCsvHandler(request),
    },
  },
})
