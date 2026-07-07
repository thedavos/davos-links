import { describe, expect, it } from 'vitest'
import { createD1Mock } from '../../../test/helpers/cloudflare'
import { ensureDefaultWorkspace } from './seed'

describe('ensureDefaultWorkspace', () => {
  it('inserts the default workspace and domain idempotently', async () => {
    const { db, calls } = createD1Mock()
    await ensureDefaultWorkspace(db)

    expect(calls).toHaveLength(2)
    expect(calls[0]?.sql).toContain('INSERT OR IGNORE INTO workspaces')
    expect(calls[0]?.binds.slice(0, 3)).toEqual(['wsp_default', 'Davos', 'davos'])
    expect(calls[1]?.sql).toContain('INSERT OR IGNORE INTO domains')
    expect(calls[1]?.binds.slice(0, 3)).toEqual([
      'dom_links_davosdo_dev',
      'wsp_default',
      'links.davosdo.dev',
    ])
  })
})
