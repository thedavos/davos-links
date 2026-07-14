import { Link, Outlet, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  BarChart3,
  FolderKanban,
  Link2,
  LogOut,
  Plus,
  Settings,
  Tag,
} from 'lucide-react'
import { BrandLockup } from '#/components/brand/BrandLockup'
import { DitherAvatar, DitherGradient } from '#/components/dither-kit'
import { Button } from '#/components/ui/button'
import { TimeZoneProvider } from '#/components/TimeZoneProvider'
import { authClient } from '#/lib/auth/client'
import { cn } from '#/lib/utils'

const nav = [
  { to: '/dashboard', label: 'Resumen', icon: BarChart3 },
  { to: '/dashboard/links', label: 'Enlaces', icon: Link2 },
  { to: '/dashboard/campaigns', label: 'Campañas', icon: FolderKanban },
  { to: '/dashboard/tags', label: 'Etiquetas', icon: Tag },
  { to: '/dashboard/settings', label: 'Ajustes', icon: Settings },
] as const

export function DashboardShell({ userName }: { userName: string }) {
  return (
    <TimeZoneProvider>
      <DashboardShellContent userName={userName} />
    </TimeZoneProvider>
  )
}

function DashboardShellContent({ userName }: { userName: string }) {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const currentUserName = session?.user.name ?? userName

  async function signOut() {
    await authClient.signOut()
    await router.navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 overflow-hidden border-r border-border bg-card px-3 py-4 md:block">
        <DitherGradient
          bloom="off"
          cell={4}
          className="opacity-75"
          direction="up"
          from="coral"
          opacity={0.12}
        />
        <div className="relative z-10 flex h-full flex-col">
          <Link
            aria-label="Ir al resumen de atajo"
            className="flex items-center px-3 pb-5 text-sm text-foreground"
            to="/dashboard"
          >
            <BrandLockup markClassName="h-7" />
          </Link>

          <section
            aria-label={`Cuenta de ${currentUserName}`}
            className="mb-5 flex items-center gap-3 rounded-lg border border-blue-100 bg-background/90 p-3"
          >
            <DitherAvatar
              decorative
              animate
              animationDuration={600}
              bloom="off"
              className="size-10 shrink-0 border border-blue-200 bg-background ring-2 ring-blue-50"
              name={currentUserName}
            />
            <div className="min-w-0">
              <p className="mono flex items-center gap-1.5 text-[0.625rem] font-medium tracking-[0.12em] text-blue-700">
                <span aria-hidden="true" className="size-1.5 bg-blue-500" />
                CUENTA
              </p>
              <p className="mt-1 truncate text-sm font-semibold tracking-[-0.01em]">
                {currentUserName}
              </p>
            </div>
          </section>

          <nav aria-label="Navegación principal" className="grid gap-1">
            {nav.map((item) => (
              <Link
                activeOptions={{ exact: item.to === '/dashboard' }}
                activeProps={{
                  className:
                    'border-secondary-foreground/20 bg-secondary text-secondary-foreground',
                }}
                className="flex items-center gap-3 border border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                key={item.to}
                to={item.to}
              >
                <item.icon size={16} aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>

          <Button
            className="mt-auto w-full justify-center"
            ditherVariant="dotted-subtle"
            onClick={signOut}
            type="button"
            variant="ghost"
          >
            <LogOut aria-hidden="true" />
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background px-4 md:hidden">
          <Link
            aria-label="Ir al resumen de atajo"
            className="flex items-center text-sm"
            to="/dashboard"
          >
            <BrandLockup markClassName="h-7" showByline={false} />
          </Link>
          <div className="flex items-center gap-2">
            <DitherAvatar
              ariaLabel={`Avatar de ${currentUserName}`}
              animate
              animationDuration={600}
              bloom="off"
              className="size-8 border border-primary/20 bg-background"
              name={currentUserName}
            />
            <Button asChild size="sm">
              <Link to="/dashboard/links/new">
                <Plus aria-hidden="true" />
                <span className="hidden min-[360px]:inline">Nuevo</span>
              </Link>
            </Button>
            <Button
              aria-label="Cerrar sesión"
              onClick={signOut}
              size="icon"
              type="button"
              variant="ghost"
            >
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </header>
        <main
          className="mx-auto max-w-6xl px-4 py-6 pb-24 md:px-8 md:py-8"
          id="main-content"
        >
          <Outlet />
        </main>

        <nav
          aria-label="Navegación móvil"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {nav.map((item) => (
            <Link
              activeOptions={{ exact: item.to === '/dashboard' }}
              activeProps={{ className: 'bg-secondary text-secondary-foreground' }}
              className="flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[0.5625rem] font-medium leading-none text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring min-[360px]:text-[0.625rem]"
              key={item.to}
              to={item.to}
            >
              <item.icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}

export function PageHeader({
  className,
  title,
  detail,
  meta,
  action,
}: {
  className?: string
  title: string
  detail?: string
  meta?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={cn('mb-7 flex flex-col justify-between gap-4 border-b border-primary/20 pb-5 md:flex-row md:items-end', className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {detail ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p>
        ) : null}
        {meta ? <div className="mt-3">{meta}</div> : null}
      </div>
      {action ? <div className={cn('flex shrink-0 gap-2')}>{action}</div> : null}
    </div>
  )
}
