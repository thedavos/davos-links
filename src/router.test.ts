import { describe, expect, it, vi } from 'vitest'

const routerMocks = vi.hoisted(() => ({
  createRouter: vi.fn((config) => ({ config })),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createRouter: routerMocks.createRouter,
  }
})

describe('getRouter', async () => {
  const { getRouter } = await import('./router')

  it('creates the TanStack router with route tree and preload defaults', () => {
    const router = getRouter()
    expect(routerMocks.createRouter).toHaveBeenCalledWith(
      expect.objectContaining({
        scrollRestoration: true,
        defaultPreload: 'intent',
        defaultPreloadStaleTime: 0,
      }),
    )
    expect(router).toHaveProperty('config.routeTree')
  })
})
