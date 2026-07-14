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
  ComparisonTrendChart,
  DailyActivityBarChart,
  MetricSparkline,
} from '#/components/Charts'
import { DashboardShell, PageHeader } from '#/components/DashboardShell'
import { DitherAvatar } from '#/components/dither-kit'
import { Button } from '#/components/ui/button'
import { ActionNotification } from '#/components/ui/feedback'
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
    expect(
      screen.getByRole('heading', { name: /Enlaces breves.*Resultados claros/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('links.davosdo.dev')).toBeInTheDocument()

    const { rerender } = render(<MetricSparkline data={[]} label="Sparkline vacía" />)
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
    const currentLegend = screen.getByRole('button', { name: 'Actual' })
    expect(currentLegend).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(currentLegend)
    expect(currentLegend).toHaveAttribute('aria-pressed', 'true')
    const comparison = screen.getByRole('group', {
      name: /Clics en el tiempo comparados/i,
    })
    fireEvent.focus(comparison)
    expect(screen.getByRole('status')).toHaveTextContent(
      /07 jul.*10 clics actuales.*4 del periodo anterior/i,
    )
    fireEvent.keyDown(comparison, { key: 'Home' })
    expect(screen.getByRole('status')).toHaveTextContent(
      /06 jul.*5 clics actuales.*3 del periodo anterior/i,
    )
    fireEvent.keyDown(comparison, { key: 'Escape' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(
      <DailyActivityBarChart
        data={[
          { metric_date: '2026-07-06', clicks: 0 },
          { metric_date: '2026-07-07', clicks: 8 },
        ]}
      />,
    )
    expect(screen.getByText('Una barra por fecha')).toBeInTheDocument()
    const activity = screen.getByRole('group', { name: 'Actividad diaria de clics' })
    fireEvent.focus(activity)
    expect(screen.getByRole('status')).toHaveTextContent(/07 jul.*8 clics/i)
    fireEvent.keyDown(activity, { key: 'ArrowLeft' })
    expect(screen.getByRole('status')).toHaveTextContent(/06 jul.*0 clics/i)
  })

  it.each([1, 7, 30, 90])(
    'keeps %i daily points keyboard-accessible with at most eight date labels',
    (days) => {
      const data = Array.from({ length: days }, (_, index) => ({
        clicks: index,
        metric_date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
      }))
      const { container } = render(<DailyActivityBarChart data={data} />)
      const chart = screen.getByRole('group', { name: 'Actividad diaria de clics' })

      fireEvent.focus(chart)
      fireEvent.keyDown(chart, { key: 'Home' })
      expect(screen.getByRole('status')).toHaveTextContent(/01 ene.*0 clics/i)
      fireEvent.keyDown(chart, { key: 'End' })
      expect(screen.getByRole('status')).toHaveTextContent(
        new RegExp(`${days - 1} clics`, 'i'),
      )
      expect(
        container.querySelectorAll('text[dominant-baseline="hanging"]').length,
      ).toBeLessThanOrEqual(8)
    },
  )

  it('renders empty analytical charts without focusable chart shells', () => {
    const { rerender } = render(<ComparisonTrendChart current={[]} />)
    expect(screen.getByText('Todavía no hay datos')).toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()

    rerender(<DailyActivityBarChart data={[]} />)
    expect(screen.getByText('Todavía no hay datos')).toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('preserves native button semantics and deterministic avatar identity', () => {
    render(
      <>
        <Button type="submit">Guardar</Button>
        <Button disabled>Deshabilitado</Button>
        <Button asChild>
          <a href="/destino">Abrir enlace</a>
        </Button>
        <Button asChild disabled>
          <a href="/bloqueado">Enlace bloqueado</a>
        </Button>
        <Button aria-label="Acción rápida" size="icon" variant="ghost">
          +
        </Button>
        <Button variant="destructive">Eliminar</Button>
        <Button variant="outline">Acción secundaria</Button>
        <DitherAvatar ariaLabel="Avatar de Ada" animate={false} name="Ada" />
      </>,
    )

    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute(
      'type',
      'submit',
    )
    expect(screen.getByRole('button', { name: 'Deshabilitado' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Abrir enlace' })).toHaveAttribute(
      'href',
      '/destino',
    )
    const disabledLink = screen.getByRole('link', { name: 'Enlace bloqueado' })
    expect(disabledLink).toHaveAttribute('aria-disabled', 'true')
    expect(disabledLink).toHaveAttribute('tabindex', '-1')
    fireEvent.click(disabledLink)
    expect(routerMocks.navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Acción rápida' })).toHaveClass(
      'bg-transparent',
    )
    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveClass('text-red-950')
    expect(
      screen
        .getByRole('button', { name: 'Acción secundaria' })
        .querySelector('canvas[data-dither-variant="dotted-subtle"]'),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Avatar de Ada' })).toBeInTheDocument()
  })

  it('renders dashboard shell, header, and signs out', async () => {
    render(<DashboardShell userName="Ada" />)
    expect(screen.getByText('Ada')).toBeInTheDocument()
    const overviewLinks = screen.getAllByRole('link', { name: 'Resumen' })
    expect(overviewLinks).toHaveLength(2)
    expect(overviewLinks[0]).toHaveClass('bg-secondary')
    expect(screen.getByRole('navigation', { name: 'Navegación móvil' })).toBeInTheDocument()
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /cerrar sesión/i })[0])
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
    const notification = await screen.findByRole('status')
    expect(notification).toHaveTextContent('Enlace copiado')
    expect(notification).toHaveTextContent('links.davosdo.dev/railway')
    expect(notification).toHaveClass('fixed', 'right-4', 'top-4', 'z-50')
    expect(screen.getByRole('button', { name: 'Cerrar notificación' })).toBeInTheDocument()
    expect(screen.getByTitle('Copiado')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Pausar'))
    fireEvent.click(screen.getByText('Pausar'))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/links/lnk_test/disable', {
        method: 'POST',
      }),
    )
    expect(await screen.findByText('inactive')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Enlace pausado')
    expect(screen.getByRole('status')).toHaveTextContent('Railway')

    fireEvent.click(screen.getByTitle('Archivar'))
    fireEvent.click(screen.getByText('Archivar'))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/links/lnk_test/archive', {
        method: 'POST',
      }),
    )
    expect(await screen.findByText('archived')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Enlace archivado')
    expect(screen.getByRole('status')).toHaveTextContent('Railway')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }))
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('renders an accessible error notification', () => {
    render(
      <ActionNotification
        feedback={{
          action: 'copy',
          detail: 'La URL no se añadió al portapapeles.',
          kind: 'error',
          title: 'No se pudo copiar el enlace',
        }}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo copiar el enlace')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La URL no se añadió al portapapeles.',
    )
    expect(screen.getByRole('button', { name: 'Cerrar notificación' })).toBeInTheDocument()
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
