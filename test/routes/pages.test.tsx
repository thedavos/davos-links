import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ComparisonTrendChart,
} from '#/components/Charts'
import { DashboardShell, PageHeader } from '#/components/DashboardShell'
import { DitherAvatar } from '#/components/dither-kit'
import { Button } from '#/components/ui/button'
import { ActionNotification } from '#/components/ui/feedback'
import { InfoTooltip } from '#/components/ui/info-tooltip'
import { SegmentedControl } from '#/components/ui/segmented-control'
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

  it('renders the public home and the comparison chart states', () => {
    render(<HomePage />)
    expect(
      screen.getByRole('heading', { name: /Enlaces breves.*Resultados claros/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('links.davosdo.dev')).toBeInTheDocument()

    const { rerender } = render(
      <ComparisonTrendChart
        current={[
          { metric_date: '2026-07-06', human_clicks: 5 },
          { metric_date: '2026-07-07', human_clicks: 10 },
        ]}
        previous={[
          { metric_date: '2026-06-29', human_clicks: 3 },
          { metric_date: '2026-06-30', human_clicks: 4 },
        ]}
      />,
    )
    const currentView = screen.getByRole('button', {
      name: 'Mostrar solo el periodo seleccionado',
    })
    const compareView = screen.getByRole('button', {
      name: 'Comparar con el periodo anterior',
    })
    expect(currentView).toHaveAttribute('aria-pressed', 'true')
    expect(compareView).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText('Periodo anterior')).not.toBeInTheDocument()

    fireEvent.click(compareView)
    expect(currentView).toHaveAttribute('aria-pressed', 'false')
    expect(compareView).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Periodo anterior')).toBeInTheDocument()
    const currentLegend = screen.getByRole('button', { name: 'Periodo seleccionado' })
    expect(currentLegend).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(currentLegend)
    expect(currentLegend).toHaveAttribute('aria-pressed', 'true')
    const comparison = screen.getByRole('group', {
      name: /Clics humanos del periodo seleccionado comparados/i,
    })
    expect(comparison).toHaveAttribute('data-chart-animation', 'off')
    expect(comparison).toHaveAttribute('data-chart-sparkles', 'off')
    fireEvent.focus(comparison)
    expect(screen.getByRole('status')).toHaveTextContent(
      /7 de julio de 2026.*10 clics humanos.*30 de junio de 2026.*4 del periodo anterior/i,
    )
    fireEvent.keyDown(comparison, { key: 'Home' })
    expect(screen.getByRole('status')).toHaveTextContent(
      /6 de julio de 2026.*5 clics humanos.*29 de junio de 2026.*3 del periodo anterior/i,
    )
    fireEvent.keyDown(comparison, { key: 'Escape' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    fireEvent.click(currentView)
    const currentChart = screen.getByRole('group', {
      name: 'Clics humanos del periodo seleccionado',
    })
    fireEvent.focus(currentChart)
    expect(screen.getByRole('status')).toHaveTextContent(
      /7 de julio de 2026.*10 clics humanos/i,
    )
    expect(screen.getByRole('status')).not.toHaveTextContent(/periodo anterior/i)

    rerender(<ComparisonTrendChart current={[]} />)
    expect(screen.getByText('No hay clics humanos en este periodo')).toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('exposes reusable segmented controls and accessible information tooltips', async () => {
    const onChange = vi.fn()
    render(
      <>
        <SegmentedControl
          ariaLabel="Vista de prueba"
          onChange={onChange}
          options={[
            { value: 'first', label: 'Primero' },
            { value: 'second', label: 'Segundo', tone: 'purple' },
          ]}
          value="first"
        />
        <InfoTooltip label="Información del gráfico">
          Explicación del gráfico
        </InfoTooltip>
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Segundo' }))
    expect(onChange).toHaveBeenCalledWith('second')

    fireEvent.focus(screen.getByRole('button', { name: 'Información del gráfico' }))
    expect(await screen.findByText('Explicación del gráfico')).toBeInTheDocument()
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
      vi.fn(async () =>
        Response.json({
          totals: {
            humanClicks: 12,
            botClicks: 3,
            linksWithActivity: 1,
            averageDailyHumanClicks: 1.7,
          },
          activeLinksNow: 4,
          series: [
            { metric_date: '2026-07-07', human_clicks: 12, bot_clicks: 3 },
          ],
          previousSeries: [
            { metric_date: '2026-06-30', human_clicks: 0, bot_clicks: 0 },
          ],
          comparison: {
            humanClicks: {
              status: 'new',
              absolute: 12,
              percent: null,
              trend: 'up',
            },
          },
          topLinks: [
            {
              id: link.id,
              title: link.title,
              shortPath: link.short_path,
              humanClicks: 12,
              sharePercent: 100,
              delta: {
                status: 'new',
                absolute: 12,
                percent: null,
                trend: 'up',
              },
            },
          ],
          breakdowns: {
            status: 'ready',
            source: 'demo',
            scope: 'human',
            totalClicks: 12,
            coverage: {
              from: '2026-07-01',
              to: '2026-07-07',
              truncated: false,
              retention: 'local_demo',
            },
            referrers: [{ value: 'google.com', clicks: 6, percentage: 50 }],
            countries: [{ value: 'PE', clicks: 7, percentage: 58.3 }],
            devices: [{ value: 'Mobile', clicks: 8, percentage: 66.7 }],
          },
          range: { from: '2026-07-01', to: '2026-07-07' },
          previousRange: { from: '2026-06-24', to: '2026-06-30' },
          timezone: 'UTC',
        }),
      ),
    )
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn() },
    })
  })

  it('renders coherent period metrics, current status, and ranked links', async () => {
    render(<OverviewPage />)
    expect(await screen.findByText('Clics humanos')).toBeInTheDocument()
    expect(screen.getByText('Enlaces con actividad')).toBeInTheDocument()
    expect(screen.getByText('Promedio diario')).toBeInTheDocument()
    expect(screen.getByText('Tráfico automatizado')).toBeInTheDocument()
    expect(screen.getByText('Ahora')).toBeInTheDocument()
    expect(
      screen.getByRole('complementary', { name: 'Estado actual' }),
    ).toHaveTextContent('4 enlaces activos')
    expect(screen.getByText('Enlaces con más clics')).toBeInTheDocument()
    expect(await screen.findByText('/railway')).toBeInTheDocument()
    expect(screen.getByText('Nuevo vs. periodo anterior')).toBeInTheDocument()
    expect(screen.queryByText(/100% vs\. periodo anterior/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/1 jul–7 jul 2026/i).length).toBeGreaterThan(0)
    expect(screen.queryByText('Clics totales')).not.toBeInTheDocument()
    expect(screen.queryByText('Últimos 7 días')).not.toBeInTheDocument()
    expect(screen.queryByText('Últimos 30 días')).not.toBeInTheDocument()
    expect(screen.queryByText('Actividad diaria')).not.toBeInTheDocument()
    expect(screen.getByText('Desglose del tráfico')).toBeInTheDocument()
    expect(screen.getByText('google.com')).toBeInTheDocument()
    expect(screen.getByText('Perú')).toBeInTheDocument()
    expect(screen.getByText('Móvil')).toBeInTheDocument()
  })

  it('shows actionable overview empty states', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          totals: {
            humanClicks: 0,
            botClicks: 0,
            linksWithActivity: 0,
            averageDailyHumanClicks: 0,
            activeLinksNow: 0,
          },
          series: [{ metric_date: '2026-07-07', human_clicks: 0, bot_clicks: 0 }],
          previousSeries: [
            { metric_date: '2026-06-30', human_clicks: 0, bot_clicks: 0 },
          ],
          comparison: { currentClicks: 0, previousClicks: 0, delta: 0 },
          topLinks: [],
          range: { from: '2026-07-01', to: '2026-07-07' },
          previousRange: { from: '2026-06-24', to: '2026-06-30' },
          timezone: 'UTC',
        }),
      ),
    )

    render(<OverviewPage />)
    expect(await screen.findByText('Sin clics en este periodo')).toBeInTheDocument()
    expect(screen.getByText('Sin enlaces con actividad')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Crear enlace' })).toHaveLength(2)
    expect(screen.getByText('Sin base anterior')).toBeInTheDocument()
  })

  it('updates period metrics, ranking, and export when a preset changes', async () => {
    const rangeRequests: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        const params = new URL(url, 'https://links.davosdo.dev').searchParams
        const from = params.get('from') ?? '2026-07-01'
        const to = params.get('to') ?? '2026-07-30'
        const days = Math.round(
          (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
            86_400_000,
        ) + 1
        rangeRequests.push(url)
        return Response.json({
          totals: {
            humanClicks: days,
            botClicks: 0,
            linksWithActivity: 1,
            averageDailyHumanClicks: 1,
            activeLinksNow: 2,
          },
          series: [{ metric_date: to, human_clicks: days, bot_clicks: 0 }],
          previousSeries: [{ metric_date: from, human_clicks: days - 1, bot_clicks: 0 }],
          comparison: {
            currentClicks: days,
            previousClicks: days - 1,
            delta: 1,
            deltaPercent: 100 / Math.max(1, days - 1),
          },
          topLinks: [
            {
              id: 'lnk_range',
              title: `Enlace ${days} días`,
              shortPath: `periodo-${days}`,
              humanClicks: days,
              sharePercent: 100,
              delta: 1,
            },
          ],
          range: { from, to },
          previousRange: { from, to },
          timezone: 'UTC',
        })
      }),
    )

    render(<OverviewPage />)
    await screen.findByText('Enlace 30 días')
    fireEvent.click(screen.getByRole('button', { name: '7d' }))

    expect(await screen.findByText('Enlace 7 días')).toBeInTheDocument()
    const metrics = screen.getByRole('region', { name: 'Métricas del periodo' })
    expect(within(metrics).getByText('7')).toBeInTheDocument()
    expect(screen.getByText('/periodo-7')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Exportar CSV/i })).toHaveAttribute(
      'href',
      expect.stringMatching(/from=.*&to=.*/),
    )
    expect(rangeRequests.at(-1)).toContain('/api/analytics/overview?from=')
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
        .mockResolvedValueOnce(
          Response.json({
            series: [{ metric_date: '2026-07-07', clicks: 12 }],
            breakdowns: {
              status: 'ready',
              source: 'demo',
              scope: 'human',
              totalClicks: 10,
              coverage: {
                from: '2026-07-01',
                to: '2026-07-07',
                truncated: false,
                retention: 'local_demo',
              },
              referrers: [{ value: 'google.com', clicks: 4, percentage: 40 }],
              countries: [{ value: 'PE', clicks: 5, percentage: 50 }],
              devices: [{ value: 'Mobile', clicks: 6, percentage: 60 }],
            },
          }),
        ),
    )
    render(<LinkDetailPage id="lnk_test" />)
    expect(await screen.findByText('https://links.davosdo.dev/railway')).toBeInTheDocument()
    expect(await screen.findByText('Datos demo')).toBeInTheDocument()
    expect(screen.getByText('google.com')).toBeInTheDocument()
    expect(screen.getByText('Perú')).toBeInTheDocument()
    expect(screen.getByText('Móvil')).toBeInTheDocument()
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
