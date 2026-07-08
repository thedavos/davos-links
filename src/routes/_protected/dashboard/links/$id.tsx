import { createFileRoute } from '@tanstack/react-router'
import { LinkDetailPage } from '#/features/dashboard/LinkDetailPage'

export const Route = createFileRoute('/_protected/dashboard/links/$id')({
  component: LinkDetailRoute,
})

function LinkDetailRoute() {
  const { id } = Route.useParams()
  return <LinkDetailPage id={id} />
}
