import { createFileRoute } from '@tanstack/react-router'
import { EditLinkPage } from '#/features/dashboard/EditLinkPage'

export const Route = createFileRoute('/_protected/dashboard/links/$id/edit')({
  component: EditLinkRoute,
})

function EditLinkRoute() {
  const { id } = Route.useParams()
  return <EditLinkPage id={id} />
}
