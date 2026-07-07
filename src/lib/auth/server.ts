import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env } from 'cloudflare:workers'

type Session = Awaited<ReturnType<ReturnType<typeof getAuth>['api']['getSession']>>
const cloudflareEnv = env as Env & { BETTER_AUTH_SECRET?: string }

export function getAuth() {
  return betterAuth({
    database: cloudflareEnv.DB,
    secret:
      cloudflareEnv.BETTER_AUTH_SECRET ??
      'dev-only-davos-links-secret-change-before-production',
    baseURL: cloudflareEnv.BETTER_AUTH_URL ?? 'http://localhost:3000',
    trustedOrigins: [
      'https://links.davosdo.dev',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    advanced: {
      cookiePrefix: 'davos-links',
      useSecureCookies: cloudflareEnv.BETTER_AUTH_URL?.startsWith('https://') ?? false,
      database: {
        generateId: () => crypto.randomUUID(),
      },
    },
    plugins: [tanstackStartCookies()],
  })
}

export async function getSession(headers: Headers): Promise<Session> {
  return getAuth().api.getSession({ headers })
}

export async function requireUser(headers: Headers) {
  const session = await getSession(headers)
  if (!session) {
    throw new Response('Unauthorized', { status: 401 })
  }
  return session.user
}
