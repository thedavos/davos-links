import { Link } from '@tanstack/react-router'
import { ArrowRight, BarChart3, Gauge, Link2, type LucideIcon } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'

export function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto grid min-h-screen max-w-6xl content-center gap-14 px-6 py-20 md:grid-cols-[1fr_420px] md:items-center">
        <div>
          <p className="mono mb-5 text-xs uppercase text-muted-foreground">
            links.davosdo.dev
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-normal md:text-7xl">
            Davos Links
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Crea enlaces cortos con tu propia marca, ordénalos en un solo lugar y
            entiende cuáles funcionan mejor.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/dashboard">
                Ir al panel <ArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
          </div>
        </div>
        <div className="border border-border bg-muted p-4">
          <div className="grid gap-3">
            {(
              [
                ['Rutas fáciles de recordar', 'links.davosdo.dev/demo', Link2],
                ['Enlaces siempre listos', 'Comparte sin depender de URLs largas', Gauge],
                ['Métricas simples', 'Clics, origen y rendimiento', BarChart3],
              ] satisfies Array<[string, string, LucideIcon]>
            ).map(([title, detail, Icon]) => (
              <Card className="grid grid-cols-[36px_1fr] gap-3 bg-background p-4" key={title}>
                <div className="grid size-9 place-items-center border border-border">
                  <Icon size={17} />
                </div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mono mt-1 text-xs text-muted-foreground">{detail}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
