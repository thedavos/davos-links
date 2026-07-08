import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ActivityHeatmap,
  ComparisonTrendChart,
  MetricSparkline,
  MiniBars,
} from '#/components/Charts'
import { DashboardShell, PageHeader } from '#/components/DashboardShell'
import { LoginPage } from '#/features/auth/LoginPage'
import { HomePage } from '#/features/home/HomePage'
import { LinkDetailPage } from '#/features/dashboard/LinkDetailPage'
import { LinksPage } from '#/features/dashboard/LinksPage'
import { NewLinkPage } from '#/features/dashboard/NewLinkPage'
import { OverviewPage } from '#/features/dashboard/OverviewPage'
import {
  CampaignsPage,
  SettingsPage,
  TagsPage,
} from '#/features/dashboard/PlaceholderPages'
import { makeLinkRow } from '../helpers/factories'

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

const authMocks = vi.hoisted(() => ({
  signOut: vi.fn(async () => ({})),
  signInEmail: vi.fn<
    () => Promise<{ data?: { user: { id: string } }; error?: { message: string } }>
  >(async () => ({ data: { user: { id: 'usr' } } })),
}))

vi.mock('@tanstack/react-router', () => {
  function Link({
    children,
    to,
    href,
    activeProps,
    activeOptions: _activeOptions,
    className,
    ...props
  }: {
    children: ReactNode
    to?: string
    href?: string
    activeProps?: { className?: string }
    activeOptions?: unknown
    className?: string
    [key: string]: unknown
  }) {
    void _activeOptions
    const activeClassName = to === '/dashboard' ? activeProps?.className : undefined
    return (
      <a
        className={[className, activeClassName].filter(Boolean).join(' ')}
        href={href ?? to ?? '#'}
        {...props}
      >
        {children}
      </a>
    )
  }

  return {
    Link,
    Outlet: () => <div data-testid="outlet" />,
    useRouter: () => ({ navigate: routerMocks.navigate }),
    redirect: (value: unknown) => value,
    createRootRoute: (config: unknown) => config,
    createFileRoute: () => (config: Record<string, unknown>) => ({
      ...config,
      useRouteContext: () => ({ user: { name: 'Ada Lovelace' } }),
      useSearch: () => ({ redirect: '/dashboard' }),
      useParams: () => ({ id: 'lnk_test' }),
    }),
    HeadContent: () => null,
    Scripts: () => null,
  }
})

vi.mock('../../src/lib/auth/client', () => ({
  authClient: {
    signOut: authMocks.signOut,
    signIn: { email: authMocks.signInEmail },
  },
}))

describe('public and shared UI', () => {
  beforeEach(() => {
    routerMocks.navigate.mockClear()
    authMocks.signOut.mockClear()
    authMocks.signInEmail.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true, data: { id: 'lnk_test' } })),
    )
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn() },
    })
  })

  it('renders the public home and shared chart states', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { name: 'Davos Links' })).toBeInTheDocument()
    expect(screen.getByText('links.davosdo.dev/demo')).toBeInTheDocument()

    const { rerender } = render(<MiniBars data={[]} />)
    expect(screen.getByText('Todavía no hay datos')).toBeInTheDocument()
    rerender(<MiniBars data={[{ clicks: 1 }]} />)
    expect(screen.getByTitle('1')).toHaveClass('w-2')
    expect(screen.getByTitle('1')).toHaveStyle({ height: '50%' })
    rerender(<MiniBars data={[{ clicks: 5 }, { clicks: 10 }]} />)
    expect(screen.getByTitle('10')).toBeInTheDocument()

    rerender(<MetricSparkline data={[]} label="Sparkline vacía" />)
    expect(screen.getByText('Sin datos')).toBeInTheDocument()

    rerender(
      <ComparisonTrendChart
        current={[
          { metric_date: '2026-07-06', clicks: 5 },
          { metric_date: '2026-07-07', clicks: 10 },
        ]}
        previous={[
          { metric_date: '2026-06-29', clicks: 3 },
          { metric_date: '2026-06-30', clicks: 4 },
        ]}
      />,
    )
    expect(screen.getByText('Periodo anterior')).toBeInTheDocument()
    fireEvent.mouseEnter(screen.getByRole('button', { name: /07 jul.*10 clics/i }))
    expect(screen.getByText('Anterior')).toBeInTheDocument()
    expect(screen.getByText('Delta')).toBeInTheDocument()

    rerender(
      <ActivityHeatmap
        data={[
          { metric_date: '2026-07-06', clicks: 0 },
          { metric_date: '2026-07-07', clicks: 8 },
        ]}
      />,
    )
    expect(screen.getByText('Actividad diaria')).toBeInTheDocument()
    fireEvent.focus(screen.getByRole('button', { name: /07 jul.*8 clics/i }))
    expect(screen.getByText('Actual')).toBeInTheDocument()
  })

  it('renders dashboard shell, header, and signs out', async () => {
    render(<DashboardShell userName="Ada" />)
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resumen' })).toHaveClass(
      'bg-background',
      'border-border',
    )
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalled())
    expect(routerMocks.navigate).toHaveBeenCalledWith({ to: '/login' })

    render(<PageHeader title="Plain" />)
    expect(screen.getByRole('heading', { name: 'Plain' })).toBeInTheDocument()
  })

  it('submits login and hides self-service registration', async () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Correo'), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await waitFor(() => expect(authMocks.signInEmail).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Need an account?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('shows login errors', async () => {
    authMocks.signInEmail.mockResolvedValueOnce({
      error: { message: 'Invalid credentials' },
    })
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Correo'), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })
})

describe('dashboard pages', () => {
  const link = makeLinkRow({ clicks: 12 })

  beforeEach(() => {
    routerMocks.navigate.mockClear()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            totals: { totalClicks: 12, clicks7d: 5, clicks30d: 10, activeLinks: 1 },
            series: [{ metric_date: '2026-07-07', clicks: 12 }],
          }),
        )
        .mockResolvedValueOnce(Response.json({ links: [link] })),
    )
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn() },
    })
  })

  it('renders dashboard overview with fetched metrics and top links', async () => {
    render(<OverviewPage />)
    expect(await screen.findByText('Clics totales')).toBeInTheDocument()
    expect(await screen.findByText('/railway')).toBeInTheDocument()
    expect(screen.getAllByText('12').length).toBeGreaterThan(0)
  })

  it('renders links table and action buttons', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url === '/api/tags') return Response.json({ tags: [] })
        if (url === '/api/campaigns') return Response.json({ campaigns: [] })
        if (url.includes('/disable') || url.includes('/archive')) {
          return Response.json({ ok: true, data: link })
        }
        return Response.json({ links: [link] })
      }),
    )
    render(<LinksPage />)
    expect(await screen.findByText('Railway')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Copiar'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://links.davosdo.dev/railway',
    )
    fireEvent.click(screen.getByTitle('Pausar'))
    fireEvent.click(screen.getByTitle('Archivar'))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  })

  it('renders links empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url === '/api/tags') return Response.json({ tags: [] })
        if (url === '/api/campaigns') return Response.json({ campaigns: [] })
        return Response.json({ links: [] })
      }),
    )
    render(<LinksPage />)
    expect(
      await screen.findByText('Todavía no tienes enlaces. Crea el primero cuando quieras.'),
    ).toBeInTheDocument()
  })

  it('creates a new link and navigates to detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url === '/api/tags') return Response.json({ tags: [] })
        if (url === '/api/campaigns') return Response.json({ campaigns: [] })
        if (url.endsWith('/tags') || url.endsWith('/campaigns')) {
          return Response.json({ ok: true, data: link })
        }
        return Response.json({ ok: true, data: { id: 'lnk_test' } })
      }),
    )
    render(<NewLinkPage />)
    fireEvent.change(screen.getByLabelText('Enlace de destino'), {
      target: { value: 'https://example.com' },
    })
    fireEvent.change(screen.getByLabelText('Ruta corta'), {
      target: { value: 'example' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear enlace' }))
    await waitFor(() =>
      expect(routerMocks.navigate).toHaveBeenCalledWith({
        to: '/dashboard/links/$id',
        params: { id: 'lnk_test' },
      }),
    )
  })

  it('shows create link errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url === '/api/tags') return Response.json({ tags: [] })
        if (url === '/api/campaigns') return Response.json({ campaigns: [] })
        return Response.json({ ok: false, error: 'Reserved' })
      }),
    )
    render(<NewLinkPage />)
    fireEvent.change(screen.getByLabelText('Enlace de destino'), {
      target: { value: 'https://example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear enlace' }))
    expect(await screen.findByText('Reserved')).toBeInTheDocument()
  })

  it('uses a fallback create-link error when the API omits one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url === '/api/tags') return Response.json({ tags: [] })
        if (url === '/api/campaigns') return Response.json({ campaigns: [] })
        return Response.json({ ok: false })
      }),
    )
    render(<NewLinkPage />)
    fireEvent.change(screen.getByLabelText('Enlace de destino'), {
      target: { value: 'https://example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear enlace' }))
    expect(await screen.findByText('No se pudo guardar el enlace.')).toBeInTheDocument()
  })

  it('renders link detail states', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ link }))
        .mockResolvedValueOnce(Response.json({ series: [{ clicks: 12 }] })),
    )
    render(<LinkDetailPage id="lnk_test" />)
    expect(await screen.findByText('https://links.davosdo.dev/railway')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalled()

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({}))
        .mockResolvedValueOnce(Response.json({ series: [] })),
    )
    cleanup()
    render(<LinkDetailPage id="lnk_test" />)
    expect(await screen.findByText('No encontramos este enlace')).toBeInTheDocument()
  })

  it('renders placeholder management pages', () => {
    const { rerender } = render(<CampaignsPage />)
    expect(screen.getByText('Todavía no tienes campañas.')).toBeInTheDocument()
    rerender(<TagsPage />)
    expect(screen.getByText('Todavía no tienes etiquetas.')).toBeInTheDocument()
    rerender(<SettingsPage />)
    expect(screen.getByText('Dominio principal')).toBeInTheDocument()
    expect(screen.getByText('Métricas')).toBeInTheDocument()
  })
})
