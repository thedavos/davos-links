import { createFileRoute } from '@tanstack/react-router'
import { NewLinkPage } from '#/features/dashboard/NewLinkPage'

export const Route = createFileRoute('/_protected/dashboard/links/new')({
  component: NewLinkPage,
})
