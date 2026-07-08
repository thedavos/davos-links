import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  headers: new Headers({ cookie: 'session=1' }),
  readSession: vi.fn(),
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: () => unknown) => fn,
  }),
}))

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => mocks.headers,
}))

vi.mock('./server', () => ({
  getSession: mocks.readSession,
}))

describe('auth server functions', async () => {
  const mod = await import('#/lib/auth/functions')

  it('returns the current session', async () => {
    mocks.readSession.mockResolvedValueOnce({ user: { id: 'usr_test' } })
    await expect(mod.getSession()).resolves.toEqual({ user: { id: 'usr_test' } })
    expect(mocks.readSession).toHaveBeenCalledWith(mocks.headers)
  })

  it('throws when ensureSession has no session', async () => {
    mocks.readSession.mockResolvedValueOnce(null)
    await expect(mod.ensureSession()).rejects.toThrow('Unauthorized')
  })
})
