import { createFileRoute } from '@tanstack/react-router'
import { DashboardShell } from '../../components/DashboardShell'

export const Route = createFileRoute('/_protected/dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  const { user } = Route.useRouteContext()
  return <DashboardShell userName={user.name} />
}
