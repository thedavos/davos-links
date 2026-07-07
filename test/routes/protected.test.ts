import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((value) => ({ redirected: value })),
}))

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => null,
  createFileRoute: () => (config: unknown) => config,
  redirect: mocks.redirect,
}))

vi.mock('../../src/lib/auth/functions', () => ({
  getSession: mocks.getSession,
}))

describe('protected route guard', async () => {
  const { Route } = await import('../../src/routes/_protected')
  const protectedRoute = Route as unknown as {
    beforeLoad: (options: { location: { href: string } }) => Promise<unknown>
  }

  it('returns user context when a session exists', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'usr_test' } })
    await expect(
      protectedRoute.beforeLoad({ location: { href: '/dashboard' } }),
    ).resolves.toEqual({ user: { id: 'usr_test' } })
  })

  it('redirects unauthenticated users to login with return path', async () => {
    mocks.getSession.mockResolvedValueOnce(null)
    await expect(
      protectedRoute.beforeLoad({ location: { href: '/dashboard/links' } }),
    ).rejects.toEqual({
      redirected: {
        to: '/login',
        search: { redirect: '/dashboard/links' },
      },
    })
  })
})
