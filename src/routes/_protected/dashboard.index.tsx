import { createFileRoute } from '@tanstack/react-router'
import { OverviewPage } from '../../features/dashboard/OverviewPage'

export const Route = createFileRoute('/_protected/dashboard/')({
  component: OverviewPage,
})
