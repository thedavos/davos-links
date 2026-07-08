import { createFileRoute } from '@tanstack/react-router'
import { TagsPage } from '#/features/dashboard/PlaceholderPages'

export const Route = createFileRoute('/_protected/dashboard/tags')({
  component: TagsPage,
})
