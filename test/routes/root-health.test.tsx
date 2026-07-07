import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RootDocument } from '../../src/components/RootDocument'
import { Route as HealthRoute } from '../../src/routes/health'
import { Route as ShortPathRoute } from '../../src/routes/$shortPath'

const mocks = vi.hoisted(() => ({
  handlePublicRedirect: vi.fn(async () => new Response('redirected')),
}))

vi.mock('@tanstack/react-router', () => ({
  createRootRoute: (config: unknown) => config,
  createFileRoute: () => (config: unknown) => config,
  Outlet: () => <div data-testid="outlet" />,
  HeadContent: () => <title>Head</title>,
  Scripts: () => <script data-testid="scripts" />,
}))

vi.mock('../../src/lib/redirect/handler', () => ({
  handlePublicRedirect: mocks.handlePublicRedirect,
}))

describe('root, health, and short path routes', () => {
  const healthRoute = HealthRoute as unknown as {
    server: { handlers: { GET: () => Promise<Response> } }
  }
  const shortPathRoute = ShortPathRoute as unknown as {
    server: {
      handlers: {
        GET: (options: {
          request: Request
          context: { cloudflare: { ctx: ExecutionContext } }
        }) => Promise<Response>
      }
    }
  }

  it('renders the root document shell', () => {
    render(<RootDocument>content</RootDocument>)
    expect(screen.getByText('content')).toBeInTheDocument()
    expect(screen.getByTestId('scripts')).toBeInTheDocument()
  })

  it('returns health JSON', async () => {
    const handler = healthRoute.server.handlers.GET
    const response = await handler()
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: 'davos-links',
    })
  })

  it('delegates public short path requests to the redirect handler', async () => {
    const handler = shortPathRoute.server.handlers.GET
    const response = await handler({
      request: new Request('https://links.davosdo.dev/railway'),
      context: { cloudflare: { ctx: { waitUntil: vi.fn() } as unknown as ExecutionContext } },
    })
    expect(await response.text()).toBe('redirected')
    expect(mocks.handlePublicRedirect).toHaveBeenCalled()
  })
})
