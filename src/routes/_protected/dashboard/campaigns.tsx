import { createFileRoute } from '@tanstack/react-router'
import { CampaignsPage } from '../../../features/dashboard/PlaceholderPages'

export const Route = createFileRoute('/_protected/dashboard/campaigns')({
  component: CampaignsPage,
})
