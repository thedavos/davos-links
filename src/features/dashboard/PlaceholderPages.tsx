import { Archive, Check, Plus, Save } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { PageHeader } from '#/components/DashboardShell'
import { DitherAvatar } from '#/components/dither-kit'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { DEFAULT_DOMAIN } from '#/lib/constants'
import type { ApiResult, CampaignRow, TagRow } from '#/lib/types'

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void loadCampaigns()
  }, [])

  async function loadCampaigns() {
    const data = (await fetch('/api/campaigns').then((response) =>
      response.json(),
    )) as { campaigns?: CampaignRow[] }
    setCampaigns(data.campaigns ?? [])
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    setError('')
    const result = (await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description }),
    }).then((response) => response.json())) as ApiResult<CampaignRow | null>
    if (!result.ok || !result.data) {
      setError(result.error ?? 'No se pudo crear la campaña.')
      return
    }
    setCampaigns((current) => [result.data as CampaignRow, ...current])
    setName('')
    setDescription('')
  }

  async function archive(id: string) {
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    setCampaigns((current) => current.filter((campaign) => campaign.id !== id))
  }

  return (
    <>
      <PageHeader
        detail="Agrupa enlaces relacionados para revisar mejor una iniciativa o lanzamiento."
        title="Campañas"
      />
      <form className="mb-4 grid gap-3 border border-border bg-muted/40 p-3" onSubmit={create}>
        <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
          <Label>
            Nombre
            <Input
              onChange={(event) => setName(event.target.value)}
              placeholder="Lanzamiento Q3"
              required
              value={name}
            />
          </Label>
          <Label>
            Descripción
            <Input
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Iniciativa, canal o audiencia"
              value={description}
            />
          </Label>
          <Button type="submit">
            <Plus size={16} />
            Crear
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
      <div className="grid gap-2">
        {campaigns.length ? (
          campaigns.map((campaign) => (
            <Card
              className="flex flex-col justify-between gap-3 p-3 md:flex-row md:items-center"
              key={campaign.id}
            >
              <div>
                <p className="text-sm font-medium">{campaign.name}</p>
                <p className="mono mt-1 text-xs text-muted-foreground">
                  {campaign.slug}
                </p>
                {campaign.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {campaign.description}
                  </p>
                ) : null}
              </div>
              <Button
                onClick={() => archive(campaign.id)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Archive size={15} />
                Archivar
              </Button>
            </Card>
          ))
        ) : (
          <Empty title="Todavía no tienes campañas." />
        )}
      </div>
    </>
  )
}

export function TagsPage() {
  const [tags, setTags] = useState<TagRow[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState('#111111')
  const [error, setError] = useState('')

  useEffect(() => {
    void loadTags()
  }, [])

  async function loadTags() {
    const data = (await fetch('/api/tags').then((response) =>
      response.json(),
    )) as { tags?: TagRow[] }
    setTags(data.tags ?? [])
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    setError('')
    const result = (await fetch('/api/tags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, color }),
    }).then((response) => response.json())) as ApiResult<TagRow | null>
    if (!result.ok || !result.data) {
      setError(result.error ?? 'No se pudo crear la etiqueta.')
      return
    }
    setTags((current) => [...current, result.data as TagRow].sort((a, b) => a.name.localeCompare(b.name)))
    setName('')
  }

  async function remove(id: string) {
    await fetch(`/api/tags/${id}`, { method: 'DELETE' })
    setTags((current) => current.filter((tag) => tag.id !== id))
  }

  return (
    <>
      <PageHeader
        detail="Usa etiquetas para encontrar y ordenar enlaces más rápido."
        title="Etiquetas"
      />
      <form className="mb-4 grid gap-3 border border-border bg-muted/40 p-3" onSubmit={create}>
        <div className="grid gap-3 md:grid-cols-[1fr_120px_auto] md:items-end">
          <Label>
            Nombre
            <Input
              onChange={(event) => setName(event.target.value)}
              placeholder="Producto"
              required
              value={name}
            />
          </Label>
          <Label>
            Color
            <Input
              onChange={(event) => setColor(event.target.value)}
              type="color"
              value={color}
            />
          </Label>
          <Button type="submit">
            <Plus size={16} />
            Crear
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
      <div className="grid gap-2">
        {tags.length ? (
          tags.map((tag) => (
            <Card
              className="flex items-center justify-between gap-3 p-3"
              key={tag.id}
            >
              <div className="flex items-center gap-3">
                <span
                  className="size-4 border border-border"
                  style={{ backgroundColor: tag.color ?? '#111111' }}
                />
                <div>
                  <p className="text-sm font-medium">{tag.name}</p>
                  <p className="mono mt-1 text-xs text-muted-foreground">{tag.slug}</p>
                </div>
              </div>
              <Button
                onClick={() => remove(tag.id)}
                size="sm"
                type="button"
                variant="outline"
              >
                Eliminar
              </Button>
            </Card>
          ))
        ) : (
          <Empty title="Todavía no tienes etiquetas." />
        )}
      </div>
    </>
  )
}

export function SettingsPage({
  user,
}: {
  user?: { email?: string; name?: string }
}) {
  const [name, setName] = useState(user?.name ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')
    const response = await fetch('/api/auth/update-user', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) {
      setError('No se pudo actualizar el perfil.')
      return
    }
    setMessage('Perfil actualizado.')
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      }),
    })
    if (!response.ok) {
      setError('No se pudo cambiar la contraseña.')
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setMessage('Contraseña actualizada.')
  }

  return (
    <>
      <PageHeader
        detail="Revisa los datos básicos de tu dominio y del entorno local."
        title="Ajustes"
      />
      {message ? (
        <p className="mb-4 flex items-center gap-2 border border-border px-3 py-2 text-sm">
          <Check size={15} />
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 border border-destructive px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DitherAvatar
              decorative
              animate={false}
              bloom="low"
              className="size-11 overflow-hidden rounded-md border border-purple-200 bg-purple-50"
              name={user?.name || user?.email || 'Davos Links'}
            />
            <div>
              <h2 className="text-sm font-medium">Perfil</h2>
              <p className="mono mt-1 text-xs text-purple-700">Identidad del operador</p>
            </div>
          </div>
          <form className="mt-4 grid gap-4" onSubmit={saveProfile}>
            <Label>
              Nombre
              <Input
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </Label>
            <Label>
              Correo
              <Input disabled value={user?.email ?? ''} />
            </Label>
            <Button className="w-fit" type="submit">
              <Save size={16} />
              Guardar
            </Button>
          </form>
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-medium">Contraseña</h2>
          <form className="mt-4 grid gap-4" onSubmit={changePassword}>
            <Label>
              Contraseña actual
              <Input
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                type="password"
                value={currentPassword}
              />
            </Label>
            <Label>
              Nueva contraseña
              <Input
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </Label>
            <Label>
              Confirmar contraseña
              <Input
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </Label>
            <Button className="w-fit" type="submit">
              Cambiar contraseña
            </Button>
          </form>
        </Card>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Setting label="Dominio principal" value={DEFAULT_DOMAIN} />
        <Setting label="Base de datos" value="LINKS_DB" />
        <Setting label="Caché de enlaces" value="SHORT_LINK_CACHE" />
        <Setting label="Métricas" value="CLICK_ANALYTICS" />
      </div>
    </>
  )
}

export function Empty({ title }: { title: string }) {
  return (
    <Card className="p-8 text-center text-sm text-muted-foreground">{title}</Card>
  )
}

export function Setting({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mono mt-2 text-sm">{value}</p>
    </Card>
  )
}
