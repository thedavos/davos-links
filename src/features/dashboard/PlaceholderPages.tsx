import { Archive, Check, Clock3, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useId, useMemo, useState } from 'react'
import { PageHeader } from '#/components/DashboardShell'
import { useTimeZone } from '#/components/TimeZoneProvider'
import { DitherAvatar } from '#/components/dither-kit'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth/client'
import { BRAND_NAME } from '#/lib/constants'
import type { ApiResult, CampaignRow, TagRow } from '#/lib/types'
import {
  formatTimeZoneLabel,
  isValidTimeZone,
  supportedTimeZones,
} from '#/lib/time-zone'

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
      <form className="mb-6 grid gap-3" onSubmit={create}>
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
                aria-label={`Archivar ${campaign.name}`}
                ditherVariant="dotted-subtle"
                onClick={() => archive(campaign.id)}
                size="sm"
                type="button"
                variant="ghost"
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
      <form className="mb-6 grid gap-3" onSubmit={create}>
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
                <p className="text-sm font-medium">{tag.name}</p>
              </div>
              <Button
                aria-label={`Eliminar ${tag.name}`}
                ditherVariant="dotted-subtle"
                onClick={() => remove(tag.id)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Trash2 size={15} />
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
  const { data: session } = authClient.useSession()
  const {
    detectedTimeZone,
    preference: timeZonePreference,
    setPreference: setTimeZonePreference,
    timeZone,
  } = useTimeZone()
  const currentUser = session?.user ?? user
  const [name, setName] = useState(user?.name ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [timeZoneInput, setTimeZoneInput] = useState(timeZonePreference ?? '')
  const [timeZoneMessage, setTimeZoneMessage] = useState('')
  const [timeZoneError, setTimeZoneError] = useState('')
  const timeZoneListId = useId()
  const timeZoneOptions = useMemo(
    () => supportedTimeZones().map((zone) => ({
      label: formatTimeZoneLabel(zone),
      value: zone,
    })),
    [],
  )

  useEffect(() => {
    setName(currentUser?.name ?? '')
  }, [currentUser?.name])

  useEffect(() => {
    setTimeZoneInput(timeZonePreference ?? '')
  }, [timeZonePreference])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')
    const result = await authClient.updateUser({ name })
    if (result.error) {
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

  async function saveTimeZone(event: FormEvent) {
    event.preventDefault()
    setTimeZoneMessage('')
    setTimeZoneError('')
    const next = timeZoneInput.trim() || null
    if (next !== null && !isValidTimeZone(next)) {
      setTimeZoneError('Selecciona una zona horaria de la lista.')
      return
    }
    const response = await fetch('/api/settings/preferences', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ timeZone: next }),
    })
    const result = (await response.json().catch(() => ({}))) as {
      error?: string
      timeZone?: string | null
    }
    if (!response.ok) {
      setTimeZoneError(result.error ?? 'No se pudo actualizar la zona horaria.')
      return
    }
    const saved = result.timeZone ?? null
    setTimeZonePreference(saved)
    setTimeZoneInput(saved ?? '')
    setTimeZoneMessage(
      saved ? 'Zona horaria actualizada.' : 'Zona automática activada.',
    )
  }

  return (
    <>
      <PageHeader
        detail="Administra tu perfil y las credenciales de acceso."
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DitherAvatar
              decorative
              animate={false}
              bloom="low"
              className="size-11 overflow-hidden rounded-md border border-blue-200 bg-blue-50"
              name={name || currentUser?.email || BRAND_NAME}
            />
            <div>
              <h2 className="text-sm font-medium">Perfil</h2>
              <p className="mono mt-1 text-xs text-blue-700">Identidad del operador</p>
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
              <Input disabled value={currentUser?.email ?? ''} />
            </Label>
            <Button className="w-fit" type="submit">
              <Save size={16} />
              Guardar
            </Button>
          </form>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md border border-blue-200 bg-blue-50 text-blue-700">
              <Clock3 aria-hidden="true" size={18} />
            </div>
            <div>
              <h2 className="text-sm font-medium">Zona horaria</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Fechas y analítica en tu hora local
              </p>
            </div>
          </div>
          <form className="mt-4 grid gap-3" onSubmit={saveTimeZone}>
            <Label>
              Zona IANA
              <Input
                aria-describedby={`${timeZoneListId}-hint`}
                list={timeZoneListId}
                onChange={(event) => setTimeZoneInput(event.target.value)}
                placeholder={formatTimeZoneLabel(detectedTimeZone)}
                value={timeZoneInput}
              />
              <datalist id={timeZoneListId}>
                {timeZoneOptions.map((option) => (
                  <option key={option.value} label={option.label} value={option.value} />
                ))}
              </datalist>
            </Label>
            <p className="text-xs text-muted-foreground" id={`${timeZoneListId}-hint`}>
              {timeZonePreference
                ? `Activa: ${formatTimeZoneLabel(timeZone)}`
                : `Automática: ${formatTimeZoneLabel(detectedTimeZone)}`}
            </p>
            {timeZoneError ? (
              <p className="text-xs text-destructive" role="alert">{timeZoneError}</p>
            ) : null}
            {timeZoneMessage ? (
              <p className="text-xs text-blue-700" role="status">{timeZoneMessage}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="submit">
                <Save size={15} />
                Guardar zona
              </Button>
              <Button
                ditherVariant="dotted-subtle"
                onClick={() => setTimeZoneInput('')}
                size="sm"
                type="button"
                variant="ghost"
              >
                <RotateCcw size={15} />
                Automática
              </Button>
            </div>
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
    </>
  )
}

export function Empty({ title }: { title: string }) {
  return (
    <Card className="p-8 text-center text-sm text-muted-foreground">{title}</Card>
  )
}
