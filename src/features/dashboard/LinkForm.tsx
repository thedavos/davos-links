import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import { PUBLIC_ORIGIN } from '../../lib/constants'
import type { ApiResult, CampaignRow, LinkRow, TagRow } from '../../lib/types'

type LinkFormValues = {
  destinationUrl: string
  shortPath: string
  title: string
  description: string
  preserveQueryParams: boolean
  redirectType: number
  expiresAt: string
  fallbackUrl: string
  tagIds: string[]
  campaignIds: string[]
}

export function LinkForm({
  campaigns = [],
  initialLink,
  mode,
  onSaved,
  tags = [],
}: {
  campaigns?: CampaignRow[]
  initialLink?: LinkRow
  mode: 'create' | 'edit'
  onSaved: (link: LinkRow) => Promise<void> | void
  tags?: TagRow[]
}) {
  const [values, setValues] = useState<LinkFormValues>(() => ({
    destinationUrl: initialLink?.destination_url ?? '',
    shortPath: initialLink?.short_path ?? '',
    title: initialLink?.title ?? '',
    description: initialLink?.description ?? '',
    preserveQueryParams: initialLink?.preserve_query_params !== 0,
    redirectType: initialLink?.redirect_type ?? 302,
    expiresAt: initialLink?.expires_at?.slice(0, 10) ?? '',
    fallbackUrl: initialLink?.fallback_url ?? '',
    tagIds: initialLink?.tags?.map((tag) => tag.id) ?? [],
    campaignIds: initialLink?.campaigns?.map((campaign) => campaign.id) ?? [],
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const preview = useMemo(
    () => `${PUBLIC_ORIGIN}/${values.shortPath || 'random'}`,
    [values.shortPath],
  )

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const url = mode === 'create' ? '/api/links' : `/api/links/${initialLink?.id}`
      const response = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          destinationUrl: values.destinationUrl,
          shortPath: values.shortPath,
          title: values.title,
          description: values.description,
          redirectType: values.redirectType,
          preserveQueryParams: values.preserveQueryParams,
          expiresAt: values.expiresAt || null,
          fallbackUrl: values.fallbackUrl || null,
        }),
      })
      const result = (await response.json()) as ApiResult<LinkRow | null>
      if (!result.ok || !result.data) {
        setError(result.error ?? 'No se pudo guardar el enlace.')
        return
      }

      const link = result.data
      await Promise.all([
        fetch(`/api/links/${link.id}/tags`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tagIds: values.tagIds }),
        }),
        fetch(`/api/links/${link.id}/campaigns`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ campaignIds: values.campaignIds }),
        }),
      ])
      await onSaved(link)
    } catch {
      setError('No se pudo guardar el enlace.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="grid max-w-2xl gap-5" onSubmit={submit}>
      <Label>
        Enlace de destino
        <Input
          onChange={(event) =>
            setValues((current) => ({ ...current, destinationUrl: event.target.value }))
          }
          placeholder="https://tusitio.com/pagina-importante"
          required
          type="url"
          value={values.destinationUrl}
        />
      </Label>
      <div className="grid gap-4 md:grid-cols-2">
        <Label>
          Ruta corta
          <Input
            className="mono"
            onChange={(event) =>
              setValues((current) => ({ ...current, shortPath: event.target.value }))
            }
            placeholder="promo-verano"
            value={values.shortPath}
          />
        </Label>
        <Label>
          Tipo de redirección
          <Select
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                redirectType: Number(event.target.value),
              }))
            }
            value={values.redirectType}
          >
            {[302, 301, 307, 308].map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Label>
      </div>
      <Label>
        Nombre
        <Input
          onChange={(event) =>
            setValues((current) => ({ ...current, title: event.target.value }))
          }
          placeholder="Promoción de verano"
          value={values.title}
        />
      </Label>
      <Label>
        Descripción
        <Textarea
          onChange={(event) =>
            setValues((current) => ({ ...current, description: event.target.value }))
          }
          value={values.description}
        />
      </Label>
      <div className="grid gap-4 md:grid-cols-2">
        <Label>
          Fecha de expiración
          <Input
            onChange={(event) =>
              setValues((current) => ({ ...current, expiresAt: event.target.value }))
            }
            type="date"
            value={values.expiresAt}
          />
        </Label>
        <Label>
          Fallback
          <Input
            onChange={(event) =>
              setValues((current) => ({ ...current, fallbackUrl: event.target.value }))
            }
            placeholder="https://tusitio.com/alternativa"
            type="url"
            value={values.fallbackUrl}
          />
        </Label>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <Checkbox
          checked={values.preserveQueryParams}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              preserveQueryParams: event.target.checked,
            }))
          }
        />
        Conservar parámetros del enlace original
      </label>
      <AssignmentPicker
        items={tags}
        label="Etiquetas"
        onChange={(tagIds) => setValues((current) => ({ ...current, tagIds }))}
        selectedIds={values.tagIds}
      />
      <AssignmentPicker
        items={campaigns}
        label="Campañas"
        onChange={(campaignIds) => setValues((current) => ({ ...current, campaignIds }))}
        selectedIds={values.campaignIds}
      />
      <Card className="bg-muted p-3">
        <p className="text-xs text-muted-foreground">Vista previa</p>
        <p className="mono mt-1 text-sm">{preview}</p>
      </Card>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button className="w-fit" disabled={saving} type="submit">
        {saving ? 'Guardando...' : mode === 'create' ? 'Crear enlace' : 'Guardar cambios'}
      </Button>
    </form>
  )
}

function AssignmentPicker({
  items,
  label,
  onChange,
  selectedIds,
}: {
  items: Array<{ id: string; name: string }>
  label: string
  onChange: (ids: string[]) => void
  selectedIds: string[]
}) {
  if (!items.length) {
    return (
      <div className="text-sm">
        <p className="font-medium">{label}</p>
        <p className="mt-2 text-muted-foreground">No hay opciones disponibles.</p>
      </div>
    )
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = selectedIds.includes(item.id)
          return (
            <button
              className={[
                'border px-2 py-1 text-xs transition-colors',
                active
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-foreground hover:bg-muted',
              ].join(' ')}
              key={item.id}
              onClick={() =>
                onChange(
                  active
                    ? selectedIds.filter((id) => id !== item.id)
                    : [...selectedIds, item.id],
                )
              }
              type="button"
            >
              <Badge variant={active ? 'default' : 'outline'}>{item.name}</Badge>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
