import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { PageHeader } from '#/components/DashboardShell'
import type { CampaignRow, LinkRow, TagRow } from '#/lib/types'
import { LinkForm } from '#/features/dashboard/LinkForm'

export function NewLinkPage() {
  const router = useRouter()
  const [tags, setTags] = useState<TagRow[]>([])
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])

  useEffect(() => {
    void Promise.all([
      fetch('/api/tags').then((response) => response.json()),
      fetch('/api/campaigns').then((response) => response.json()),
    ]).then(([tagsData, campaignsData]) => {
      setTags((tagsData as { tags?: TagRow[] }).tags ?? [])
      setCampaigns((campaignsData as { campaigns?: CampaignRow[] }).campaigns ?? [])
    })
  }, [])

  return (
    <>
      <PageHeader
        detail="Pega el enlace largo, elige un nombre corto y compártelo con más confianza."
        title="Nuevo enlace"
      />
      <LinkForm
        campaigns={campaigns}
        mode="create"
        onSaved={async (link: LinkRow) =>
          router.navigate({
            to: '/dashboard/links/$id',
            params: { id: link.id },
          })
        }
        tags={tags}
      />
    </>
  )
}
