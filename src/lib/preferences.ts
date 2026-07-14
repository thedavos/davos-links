import { env } from 'cloudflare:workers'

export async function getTimeZonePreference(userId: string) {
  const row = await env.LINKS_DB.prepare(
    'SELECT time_zone FROM user_preferences WHERE user_id = ?',
  )
    .bind(userId)
    .first<{ time_zone: string | null }>()
  return row?.time_zone ?? null
}

export async function saveTimeZonePreference(
  userId: string,
  timeZone: string | null,
) {
  if (timeZone === null) {
    await env.LINKS_DB.prepare('DELETE FROM user_preferences WHERE user_id = ?')
      .bind(userId)
      .run()
    return null
  }
  const now = new Date().toISOString()
  await env.LINKS_DB.prepare(
    `INSERT INTO user_preferences (user_id, time_zone, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       time_zone = excluded.time_zone,
       updated_at = excluded.updated_at`,
  )
    .bind(userId, timeZone, now, now)
    .run()
  return timeZone
}
