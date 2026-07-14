import { spawnSync } from 'node:child_process'
import { hashPassword } from 'better-auth/crypto'

const email = 'demo@links.davosdo.dev'
const password = 'DavosLinksDemo123!'
const now = Date.now()
const passwordHash = await hashPassword(password)

const userSql = `
INSERT INTO "user" (id, name, email, emailVerified, image, createdAt, updatedAt)
VALUES ('usr_demo', 'Demo Davos', '${email}', 1, NULL, ${now}, ${now})
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  emailVerified = 1,
  updatedAt = excluded.updatedAt;

INSERT INTO account (
  id, accountId, providerId, userId, password, createdAt, updatedAt
)
SELECT
  'acc_demo_credential', id, 'credential', id, '${passwordHash}', ${now}, ${now}
FROM "user"
WHERE email = '${email}'
ON CONFLICT(providerId, accountId) DO UPDATE SET
  password = excluded.password,
  updatedAt = excluded.updatedAt;
`

runWrangler(['--command', userSql])
runWrangler(['--file', 'scripts/seed-demo-data.sql'])

console.log(`Demo local listo: ${email} / ${password}`)

function runWrangler(inputArgs) {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      'davos-links-db',
      '--local',
      ...inputArgs,
    ],
    { cwd: process.cwd(), stdio: 'inherit' },
  )

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
