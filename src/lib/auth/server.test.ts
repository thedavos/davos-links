import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setCloudflareEnv } from '../../../test/mocks/cloudflare-workers'
import { getAuth, getSession, requireUser } from '#/lib/auth/server'

const authMocks = vi.hoisted(() => ({
  betterAuth: vi.fn(),
  tanstackStartCookies: vi.fn(() => 'cookies-plugin'),
  getSession: vi.fn(),
}))

vi.mock('better-auth', () => ({
  betterAuth: authMocks.betterAuth,
}))

vi.mock('better-auth/tanstack-start', () => ({
  tanstackStartCookies: authMocks.tanstackStartCookies,
}))

describe('auth server helpers', () => {
  beforeEach(() => {
    authMocks.getSession.mockReset()
    authMocks.betterAuth.mockReturnValue({
      api: { getSession: authMocks.getSession },
    })
    setCloudflareEnv({
      LINKS_DB: {} as D1Database,
      BETTER_AUTH_URL: 'https://links.davosdo.dev',
      BETTER_AUTH_SECRET: 'unit-test-secret-with-more-than-thirty-two-characters',
    })
  })

  it('creates Better Auth with Workers-compatible options', () => {
    getAuth()
    expect(authMocks.betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        database: expect.anything(),
        secret: 'unit-test-secret-with-more-than-thirty-two-characters',
        baseURL: 'https://links.davosdo.dev',
        trustedOrigins: [
          'https://links.davosdo.dev',
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:5174',
        ],
        emailAndPassword: { enabled: true, disableSignUp: true },
        plugins: ['cookies-plugin'],
      }),
    )
    expect(authMocks.betterAuth.mock.calls[0]?.[0].advanced.useSecureCookies).toBe(true)
  })

  it('reads sessions and returns required users', async () => {
    authMocks.getSession.mockResolvedValue({ user: { id: 'usr_test' } })
    await expect(getSession(new Headers())).resolves.toEqual({
      user: { id: 'usr_test' },
    })
    await expect(requireUser(new Headers())).resolves.toEqual({ id: 'usr_test' })
  })

  it('throws a 401 response when requireUser has no session', async () => {
    authMocks.getSession.mockResolvedValue(null)
    await expect(requireUser(new Headers())).rejects.toMatchObject({ status: 401 })
  })
})
