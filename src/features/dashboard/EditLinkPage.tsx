import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/DashboardShell'
import type { CampaignRow, LinkRow, TagRow } from '../../lib/types'
import { LinkForm } from './LinkForm'

export function EditLinkPage({ id }: { id: string }) {
  const router = useRouter()
  const [link, setLink] = useState<LinkRow | null | undefined>(undefined)
  const [tags, setTags] = useState<TagRow[]>([])
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    setLink(undefined)
    setError('')
    void Promise.all([
      fetch(`/api/links/${id}`).then((response) => response.json()),
      fetch('/api/tags').then((response) => response.json()),
      fetch('/api/campaigns').then((response) => response.json()),
    ])
      .then(([linkData, tagsData, campaignsData]) => {
        setLink((linkData as { link?: LinkRow }).link ?? null)
        setTags((tagsData as { tags?: TagRow[] }).tags ?? [])
        setCampaigns((campaignsData as { campaigns?: CampaignRow[] }).campaigns ?? [])
      })
      .catch(() => {
        setError('No se pudo cargar el enlace.')
        setLink(null)
      })
  }, [id])

  if (link === undefined) {
    return <PageHeader detail="Cargando datos del enlace." title="Editar enlace" />
  }

  if (link === null) {
    return <PageHeader detail={error || undefined} title="No encontramos este enlace" />
  }

  return (
    <>
      <PageHeader
        detail="Actualiza destino, ruta corta, etiquetas y campañas."
        title="Editar enlace"
      />
      <LinkForm
        campaigns={campaigns}
        initialLink={link}
        mode="edit"
        onSaved={async (savedLink) =>
          router.navigate({
            to: '/dashboard/links/$id',
            params: { id: savedLink.id },
          })
        }
        tags={tags}
      />
    </>
  )
}
