import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL:
    typeof window === 'undefined' ? 'https://links.davosdo.dev' : window.location.origin,
})
