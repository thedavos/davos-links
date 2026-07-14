import { Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { BrandLockup } from '#/components/brand/BrandLockup'
import { DitherGradient } from '#/components/dither-kit'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth/client'

export function LoginPage({ redirectTo = '/dashboard' }: { redirectTo?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const result = await authClient.signIn.email({ email, password })

    setLoading(false)
    if (result.error) {
      setError(result.error.message ?? 'No se pudo iniciar sesión.')
      return
    }
    await router.navigate({ href: redirectTo })
  }

  return (
    <main
      className="relative grid min-h-dvh overflow-hidden bg-background px-4 py-12 text-foreground sm:px-6"
      id="main-content"
    >
      <DitherGradient
        bloom="off"
        cell={4}
        direction="up"
        from="coral"
        opacity={0.16}
        to="blue"
      />

      <div className="relative z-10 m-auto w-full max-w-md">
        <Link
          className="mono mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          to="/"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Volver a inicio
        </Link>

        <Card className="border-primary/25 bg-card/95 p-0 shadow-xl shadow-primary/10">
          <div className="border-b border-border px-6 py-5 sm:px-8">
            <BrandLockup className="text-lg text-foreground" markClassName="h-9" />
            <h1 className="mt-5 text-3xl font-semibold tracking-tight">Iniciar sesión</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Accede a tus enlaces, campañas y métricas.
            </p>
          </div>

          <form className="px-6 py-6 sm:px-8 sm:py-7" onSubmit={submit}>
            <div className="grid gap-5">
              <Label>
                Correo
                <Input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@correo.com"
                  required
                  type="email"
                  value={email}
                />
              </Label>
              <Label>
                Contraseña
                <Input
                  autoComplete="current-password"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </Label>
            </div>
            {error ? (
              <p
                className="mt-4 border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <Button
              aria-busy={loading}
              bloom="low"
              className="mt-6 w-full"
              disabled={loading}
              ditherColor="blue"
              ditherVariant="gradient"
              type="submit"
            >
              {loading ? 'Entrando...' : 'Iniciar sesión'}
            </Button>
          </form>
        </Card>

        <p className="mono mt-5 text-center text-[0.6875rem] text-muted-foreground">
          links.davosdo.dev · acceso seguro
        </p>
      </div>
    </main>
  )
}
