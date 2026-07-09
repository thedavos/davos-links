import { Link } from '@tanstack/react-router'
import {
  Archive,
  BarChart3,
  Copy,
  ExternalLink,
  Pause,
  Pencil,
  Plus,
  Search,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { PageHeader } from '#/components/DashboardShell'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/dialog'
import { ActionNotification, type ActionFeedback } from '#/components/ui/feedback'
import { Input } from '#/components/ui/input'
import { Select } from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { PUBLIC_ORIGIN } from '#/lib/constants'
import type { CampaignRow, LinkRow, LinkStatus, TagRow } from '#/lib/types'

type ConfirmedLinkAction = {
  id: string
  title: string
  type: LinkMutationAction
}

type LinkMutationAction = 'pause' | 'archive'

const confirmedActionConfig: Record<
  LinkMutationAction,
  {
    confirmLabel: string
    endpointSuffix: string
    errorMessage: string
    nextStatus: LinkStatus
    successMessage: (title: string) => string
    title: string
  }
> = {
  archive: {
    confirmLabel: 'Archivar',
    endpointSuffix: 'archive',
    errorMessage: 'No se pudo archivar el enlace.',
    nextStatus: 'archived',
    successMessage: (title) => `Enlace archivado: ${title}.`,
    title: 'Archivar enlace',
  },
  pause: {
    confirmLabel: 'Pausar',
    endpointSuffix: 'disable',
    errorMessage: 'No se pudo pausar el enlace.',
    nextStatus: 'inactive',
    successMessage: (title) => `Enlace pausado: ${title}.`,
    title: 'Pausar enlace',
  },
}

export function LinksPage() {
  const [links, setLinks] = useState<LinkRow[]>([])
  const [tags, setTags] = useState<TagRow[]>([])
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [tagId, setTagId] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmedLinkAction | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadLinks()
    }, 180)
    return () => window.clearTimeout(timeout)
  }, [query, status, tagId, campaignId])

  useEffect(() => {
    void Promise.all([
      fetch('/api/tags').then((response) => response.json()),
      fetch('/api/campaigns').then((response) => response.json()),
    ]).then(([tagsData, campaignsData]) => {
      setTags((tagsData as { tags?: TagRow[] }).tags ?? [])
      setCampaigns((campaignsData as { campaigns?: CampaignRow[] }).campaigns ?? [])
    })
  }, [])

  useEffect(() => {
    if (!actionFeedback) return
    const timeout = window.setTimeout(() => setActionFeedback(null), 2200)
    return () => window.clearTimeout(timeout)
  }, [actionFeedback])

  async function loadLinks() {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (status) params.set('status', status)
    if (tagId) params.set('tagId', tagId)
    if (campaignId) params.set('campaignId', campaignId)
    try {
      const response = await fetch(`/api/links?${params.toString()}`)
      const data = (await response.json()) as { links?: LinkRow[] }
      setLinks(data.links ?? [])
    } catch {
      setError('No se pudieron cargar los enlaces.')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink(link: LinkRow) {
    try {
      await navigator.clipboard.writeText(`${PUBLIC_ORIGIN}/${link.short_path}`)
      setActionFeedback({
        action: 'copy',
        kind: 'success',
        message: `Enlace copiado: ${link.short_path}.`,
        targetId: link.id,
      })
    } catch {
      setActionFeedback({
        action: 'copy',
        kind: 'error',
        message: 'No se pudo copiar el enlace.',
        targetId: link.id,
      })
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) return
    const action = confirmAction
    setConfirmAction(null)
    try {
      await requestConfirmedLinkAction(action)
      setLinks((current) =>
        applyConfirmedLinkAction(current, action),
      )
      setActionFeedback(createConfirmedActionFeedback(action, 'success'))
    } catch {
      setActionFeedback(createConfirmedActionFeedback(action, 'error'))
    }
  }

  return (
    <>
      <PageHeader
        action={
          <Button asChild>
            <Link to="/dashboard/links/new">
              <Plus size={16} />
              Nuevo enlace
            </Link>
          </Button>
        }
        detail="Crea, revisa y pausa tus enlaces desde un solo lugar."
        title="Enlaces"
      />
      <div className="mb-4 grid gap-2 border border-border bg-muted/40 p-3 md:grid-cols-[1fr_160px_180px_180px]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={15}
          />
          <Input
            aria-label="Buscar enlaces"
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, destino o ruta"
            value={query}
          />
        </div>
        <Select
          aria-label="Estado"
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Pausados</option>
          <option value="archived">Archivados</option>
        </Select>
        <Select
          aria-label="Etiqueta"
          onChange={(event) => setTagId(event.target.value)}
          value={tagId}
        >
          <option value="">Todas las etiquetas</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Campaña"
          onChange={(event) => setCampaignId(event.target.value)}
          value={campaignId}
        >
          <option value="">Todas las campañas</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </Select>
      </div>
      {error ? (
        <p className="mb-4 border border-destructive px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {actionFeedback ? <ActionNotification feedback={actionFeedback} /> : null}
      <Table>
        <TableHeader>
          <TableRow>
            {[
              'Nombre',
              'Enlace corto',
              'Destino',
              'Estado',
              'Etiquetas',
              'Campañas',
              'Clics',
              'Acciones',
            ].map((heading) => (
              <TableHead key={heading}>{heading}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell className="py-8 text-center text-muted-foreground" colSpan={8}>
                Cargando enlaces...
              </TableCell>
            </TableRow>
          ) : links.length ? (
            links.map((link) => (
              <TableRow key={link.id}>
                <TableCell className="font-medium">{link.title}</TableCell>
                <TableCell className="mono text-xs">
                  links.davosdo.dev/{link.short_path}
                </TableCell>
                <TableCell className="max-w-[280px] truncate text-muted-foreground">
                  {link.destination_url}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{link.status}</Badge>
                </TableCell>
                <TableCell>
                  <BadgeList items={link.tags ?? []} empty="Sin etiquetas" />
                </TableCell>
                <TableCell>
                  <BadgeList items={link.campaigns ?? []} empty="Sin campañas" />
                </TableCell>
                <TableCell>{link.clicks ?? 0}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <IconButton
                      label={
                        actionFeedback?.action === 'copy' &&
                        actionFeedback.kind === 'success' &&
                        actionFeedback.targetId === link.id
                          ? 'Copiado'
                          : 'Copiar'
                      }
                      onClick={() => copyLink(link)}
                    >
                      <Copy size={15} />
                    </IconButton>
                    <Button asChild size="icon" title="Abrir" variant="outline">
                      <a href={`/${link.short_path}`} rel="noreferrer" target="_blank">
                        <ExternalLink size={15} />
                      </a>
                    </Button>
                    <Button asChild size="icon" title="Ver métricas" variant="outline">
                      <Link params={{ id: link.id }} to="/dashboard/links/$id">
                        <BarChart3 size={15} />
                      </Link>
                    </Button>
                    <Button asChild size="icon" title="Editar" variant="outline">
                      <Link params={{ id: link.id }} to="/dashboard/links/$id/edit">
                        <Pencil size={15} />
                      </Link>
                    </Button>
                    <IconButton
                      label="Pausar"
                      onClick={() =>
                        setConfirmAction({
                          id: link.id,
                          title: link.title,
                          type: 'pause',
                        })
                      }
                    >
                      <Pause size={15} />
                    </IconButton>
                    <IconButton
                      label="Archivar"
                      onClick={() =>
                        setConfirmAction({
                          id: link.id,
                          title: link.title,
                          type: 'archive',
                        })
                      }
                    >
                      <Archive size={15} />
                    </IconButton>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="py-8 text-center text-muted-foreground" colSpan={8}>
                Todavía no tienes enlaces. Crea el primero cuando quieras.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {confirmAction ? (
        <ConfirmDialog
          confirmLabel={confirmedActionConfig[confirmAction.type].confirmLabel}
          onCancel={() => setConfirmAction(null)}
          onConfirm={runConfirmedAction}
          title={confirmedActionConfig[confirmAction.type].title}
        >
          {confirmAction.type === 'pause'
            ? `El enlace ${confirmAction.title} dejará de redirigir como activo.`
            : `El enlace ${confirmAction.title} quedará archivado.`}
        </ConfirmDialog>
      ) : null}
    </>
  )
}

async function requestConfirmedLinkAction(action: ConfirmedLinkAction) {
  const config = confirmedActionConfig[action.type]
  const response = await fetch(`/api/links/${action.id}/${config.endpointSuffix}`, {
    method: 'POST',
  })
  const result = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok || result.error) {
    throw new Error(result.error)
  }
}

function applyConfirmedLinkAction(
  links: LinkRow[],
  action: ConfirmedLinkAction,
) {
  const nextStatus = confirmedActionConfig[action.type].nextStatus
  return links.map((link) =>
    link.id === action.id ? { ...link, status: nextStatus } : link,
  )
}

function createConfirmedActionFeedback(
  action: ConfirmedLinkAction,
  kind: ActionFeedback['kind'],
): ActionFeedback {
  const config = confirmedActionConfig[action.type]
  return {
    action: action.type,
    kind,
    message:
      kind === 'success'
        ? config.successMessage(action.title)
        : config.errorMessage,
    targetId: action.id,
  }
}

function BadgeList({
  empty,
  items,
}: {
  empty: string
  items: Array<{ id: string; name: string }>
}) {
  if (!items.length) return <span className="text-xs text-muted-foreground">{empty}</span>
  return (
    <div className="flex max-w-48 flex-wrap gap-1">
      {items.slice(0, 2).map((item) => (
        <Badge key={item.id} variant="outline">
          {item.name}
        </Badge>
      ))}
      {items.length > 2 ? <Badge variant="secondary">+{items.length - 2}</Badge> : null}
    </div>
  )
}

export function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Button onClick={onClick} size="icon" title={label} type="button" variant="outline">
      {children}
    </Button>
  )
}
