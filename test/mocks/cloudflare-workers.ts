export const env = {
  DB: undefined as unknown as D1Database,
  LINK_CACHE: undefined as unknown as KVNamespace,
  ANALYTICS: undefined as unknown as AnalyticsEngineDataset,
  BETTER_AUTH_URL: 'https://links.davosdo.dev',
  BETTER_AUTH_SECRET: 'unit-test-secret-with-more-than-thirty-two-characters',
}

export function setCloudflareEnv(next: Partial<typeof env>) {
  Object.assign(env, next)
}
