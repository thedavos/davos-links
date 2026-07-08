import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
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
    <main className="grid min-h-screen place-items-center bg-muted px-4">
      <Card className="w-full max-w-sm bg-background p-6">
        <form onSubmit={submit}>
          <p className="mono text-xs text-muted-foreground">Davos Links</p>
          <h1 className="mt-2 text-2xl font-semibold">Iniciar sesión</h1>
          <div className="mt-6 grid gap-4">
            <Label>
              Correo
              <Input
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </Label>
            <Label>
              Contraseña
              <Input
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </Label>
          </div>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          <Button className="mt-6 w-full" disabled={loading} type="submit">
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </Button>
        </form>
      </Card>
    </main>
  )
}
