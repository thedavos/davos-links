import {
  DEFAULT_DOMAIN,
  DEFAULT_DOMAIN_ID,
  DEFAULT_WORKSPACE_ID,
} from '../constants'

export async function ensureDefaultWorkspace(db: D1Database) {
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT OR IGNORE INTO workspaces (id, name, slug, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(DEFAULT_WORKSPACE_ID, 'Davos', 'davos', now, now)
    .run()

  await db
    .prepare(
      `INSERT OR IGNORE INTO domains
        (id, workspace_id, domain, is_primary, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      DEFAULT_DOMAIN_ID,
      DEFAULT_WORKSPACE_ID,
      DEFAULT_DOMAIN,
      1,
      'active',
      now,
      now,
    )
    .run()
}
