import { Link, Outlet, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  BarChart3,
  FolderKanban,
  Link2,
  LogOut,
  Settings,
  Tag,
} from 'lucide-react'
import { authClient } from '../lib/auth/client'
import { cn } from '../lib/utils'
import { Button } from './ui/button'

const nav = [
  { to: '/dashboard', label: 'Resumen', icon: BarChart3 },
  { to: '/dashboard/links', label: 'Enlaces', icon: Link2 },
  { to: '/dashboard/campaigns', label: 'Campañas', icon: FolderKanban },
  { to: '/dashboard/tags', label: 'Etiquetas', icon: Tag },
  { to: '/dashboard/settings', label: 'Ajustes', icon: Settings },
] as const

export function DashboardShell({ userName }: { userName: string }) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-muted/60 px-3 py-4 md:block">
        <div className="px-3 pb-5">
          <p className="mono text-xs text-muted-foreground">Davos Links</p>
          <p className="mt-1 truncate text-sm font-medium">{userName}</p>
        </div>
        <nav className="grid gap-1">
          {nav.map((item) => (
            <Link
              activeOptions={{ exact: item.to === '/dashboard' }}
              activeProps={{
                className: 'border-border bg-background text-foreground shadow-sm',
              }}
              className="flex items-center gap-3 border border-transparent px-3 py-2 text-sm text-muted-foreground hover:bg-background hover:text-foreground"
              key={item.to}
              to={item.to}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </nav>
        <Button
          className="absolute bottom-4 left-3 right-3 justify-start"
          onClick={async () => {
            await authClient.signOut()
            await router.navigate({ to: '/login' })
          }}
          type="button"
          variant="outline"
        >
          <LogOut size={16} />
          Cerrar sesión
        </Button>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 md:hidden">
          <span className="mono text-xs">Davos Links</span>
          <Button asChild size="sm">
            <Link to="/dashboard/links/new">Nuevo</Link>
          </Button>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  detail,
  action,
}: {
  title: string
  detail?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 border-b border-border pb-5 md:flex-row md:items-end">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {detail ? <p className="mt-2 text-sm text-muted-foreground">{detail}</p> : null}
      </div>
      {action ? <div className={cn('flex shrink-0 gap-2')}>{action}</div> : null}
    </div>
  )
}
