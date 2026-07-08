import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { getSession as readSession } from '#/lib/auth/server'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  return readSession(getRequestHeaders())
})

export const ensureSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await readSession(getRequestHeaders())
    if (!session) {
      throw new Error('Unauthorized')
    }
    return session
  },
)
