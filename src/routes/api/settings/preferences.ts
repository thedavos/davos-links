import { createFileRoute } from '@tanstack/react-router'
import { requireUser } from '#/lib/auth/server'
import { json } from '#/lib/http'
import {
  getTimeZonePreference,
  saveTimeZonePreference,
} from '#/lib/preferences'
import { isValidTimeZone } from '#/lib/time-zone'

export async function settingsPreferencesHandler(request: Request) {
  const user = await requireUser(request.headers)
  if (request.method === 'GET') {
    return json({ timeZone: await getTimeZonePreference(user.id) })
  }

  const body = (await request.json().catch(() => null)) as {
    timeZone?: unknown
  } | null
  const timeZone = body?.timeZone
  if (timeZone !== null && !isValidTimeZone(timeZone)) {
    return json(
      { error: 'Selecciona una zona horaria válida.', field: 'timeZone' },
      { status: 400 },
    )
  }
  return json({
    timeZone: await saveTimeZonePreference(user.id, timeZone),
  })
}

export const Route = createFileRoute('/api/settings/preferences')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        settingsPreferencesHandler(request),
      PATCH: async ({ request }: { request: Request }) =>
        settingsPreferencesHandler(request),
    },
  },
})
