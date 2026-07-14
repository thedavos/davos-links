import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BarChart3,
  Check,
  Gauge,
  Link2,
  type LucideIcon,
} from 'lucide-react'
import { BrandLockup } from '#/components/brand/BrandLockup'
import { DitherGradient } from '#/components/dither-kit'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'

export function HomePage() {
  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-background text-foreground"
      id="main-content"
    >
      <DitherGradient
        bloom="off"
        cell={4}
        className="opacity-90"
        direction="right"
        from="blue"
        opacity={0.18}
      />

      <section className="relative z-10 mx-auto grid min-h-dvh max-w-7xl content-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:items-center lg:gap-20 lg:px-12">
        <div className="max-w-3xl">
          <div className="mb-7 flex flex-wrap items-center gap-3">
            <BrandLockup className="text-lg text-foreground" markClassName="h-8" />
            <span className="mono inline-flex items-center gap-2 border border-primary/30 bg-background/85 px-3 py-2 text-xs text-primary">
              <span className="size-2 bg-primary" aria-hidden="true" />
              links.davosdo.dev
            </span>
          </div>
          <h1 className="text-balance text-5xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            Enlaces breves.
            <span className="block text-primary">Resultados claros.</span>
          </h1>
          <p className="mt-7 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            atajo reúne tus enlaces de marca y sus métricas en un panel
            rápido, simple y hecho para tomar decisiones.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button
              asChild
              bloom="low"
              ditherColor="blue"
              ditherVariant="gradient"
            >
              <Link to="/dashboard">
                Ir al panel <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              ditherColor="blue"
              ditherVariant="solid"
              variant="ghost"
            >
              <Link to="/login">Iniciar sesión</Link>
            </Button>
          </div>
          <p className="mono mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="text-primary" size={14} aria-hidden="true" />
            Dominio propio · analítica diaria · control de campañas
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:mx-0">
          <div
            className="absolute -inset-3 translate-x-3 translate-y-3 border border-primary/20 bg-primary/5"
            aria-hidden="true"
          />
          <Card className="relative overflow-hidden border-primary/25 bg-card/95 p-0 shadow-xl shadow-primary/10">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="mono text-[0.6875rem] text-muted-foreground">
                  ENLACE ACTIVO
                </p>
                <p className="mt-1 text-sm font-medium">Campaña de producto</p>
              </div>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-success">
                <span className="size-2 bg-success" aria-hidden="true" />
                En línea
              </span>
            </div>

            <div className="border-b border-border bg-primary/5 px-5 py-7 sm:px-7">
              <p className="mono text-xs text-muted-foreground">TU ENLACE</p>
              <p className="mono mt-2 break-all text-lg font-medium text-primary sm:text-xl">
                links.davosdo.dev/nuevo
              </p>
              <div className="mt-7 grid grid-cols-2 gap-6">
                <div>
                  <p className="mono text-xs text-muted-foreground">CLICS</p>
                  <p className="mono mt-1 text-3xl font-semibold tabular-nums">1.284</p>
                </div>
                <div>
                  <p className="mono text-xs text-muted-foreground">VARIACIÓN</p>
                  <p className="mono mt-1 text-3xl font-semibold tabular-nums text-primary">
                    +18,6%
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-px bg-border sm:grid-cols-3">
              {(
                [
                  [
                    'Rutas memorables',
                    'Tu marca, sin URLs largas',
                    Link2,
                    'text-secondary-foreground',
                  ],
                  [
                    'Siempre disponibles',
                    'Resolución rápida y confiable',
                    Gauge,
                    'text-success',
                  ],
                  [
                    'Métricas útiles',
                    'Clics y rendimiento diario',
                    BarChart3,
                    'text-primary',
                  ],
                ] satisfies Array<[string, string, LucideIcon, string]>
              ).map(([title, detail, Icon, iconClass]) => (
                <div className="bg-card p-4" key={title}>
                  <Icon className={iconClass} size={18} aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </main>
  )
}
