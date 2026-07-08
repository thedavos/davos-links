import { createFileRoute } from '@tanstack/react-router'
import { LoginPage } from '#/features/auth/LoginPage'

export const Route = createFileRoute('/login')({
  component: LoginRoute,
})

function LoginRoute() {
  const search = Route.useSearch() as { redirect?: string }
  return <LoginPage redirectTo={search.redirect || '/dashboard'} />
}
