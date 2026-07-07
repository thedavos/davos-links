import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '../../../features/dashboard/PlaceholderPages'

export const Route = createFileRoute('/_protected/dashboard/settings')({
  component: SettingsRoute,
})

function SettingsRoute() {
  const { user } = Route.useRouteContext()
  return <SettingsPage user={user} />
}
