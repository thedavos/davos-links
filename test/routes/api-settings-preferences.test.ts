import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  requireUser: vi.fn(),
  save: vi.fn(),
}))

vi.mock('#/lib/auth/server', () => ({ requireUser: mocks.requireUser }))
vi.mock('#/lib/preferences', () => ({
  getTimeZonePreference: mocks.get,
  saveTimeZonePreference: mocks.save,
}))

describe('settings preferences API', async () => {
  const { settingsPreferencesHandler } = await import(
    '#/routes/api/settings/preferences'
  )

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ id: 'usr_test' })
  })

  it('reads and updates a valid IANA preference', async () => {
    mocks.get.mockResolvedValue('America/Lima')
    expect(
      await (
        await settingsPreferencesHandler(
          new Request('https://links.davosdo.dev/api/settings/preferences'),
        )
      ).json(),
    ).toEqual({ timeZone: 'America/Lima' })

    mocks.save.mockResolvedValue('Europe/Madrid')
    const response = await settingsPreferencesHandler(
      new Request('https://links.davosdo.dev/api/settings/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ timeZone: 'Europe/Madrid' }),
      }),
    )
    expect(response.status).toBe(200)
    expect(mocks.save).toHaveBeenCalledWith('usr_test', 'Europe/Madrid')
  })

  it('supports automatic mode and rejects invalid zones', async () => {
    mocks.save.mockResolvedValue(null)
    await settingsPreferencesHandler(
      new Request('https://links.davosdo.dev/api/settings/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ timeZone: null }),
      }),
    )
    expect(mocks.save).toHaveBeenCalledWith('usr_test', null)

    const invalid = await settingsPreferencesHandler(
      new Request('https://links.davosdo.dev/api/settings/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ timeZone: 'not/a-zone' }),
      }),
    )
    expect(invalid.status).toBe(400)
  })
})
