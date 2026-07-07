import { createFileRoute } from '@tanstack/react-router'
import { LinksPage } from '../../../features/dashboard/LinksPage'

export const Route = createFileRoute('/_protected/dashboard/links/')({
  component: LinksPage,
})
