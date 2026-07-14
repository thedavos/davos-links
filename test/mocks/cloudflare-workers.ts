/// <reference path="../../worker-configuration.d.ts" />

type TestCloudflareEnv = Omit<Env, 'BETTER_AUTH_URL'> & {
  BETTER_AUTH_URL: string
  BETTER_AUTH_SECRET?: string
  ANALYTICS_DATA_SOURCE?: string
  ANALYTICS_ENGINE_API_TOKEN?: string
  CLOUDFLARE_ACCOUNT_ID?: string
}

function unconfiguredBinding<T>() {
  return undefined as T
}

export const env: TestCloudflareEnv = {
  LINKS_DB: unconfiguredBinding<D1Database>(),
  SHORT_LINK_CACHE: unconfiguredBinding<KVNamespace>(),
  CLICK_ANALYTICS: unconfiguredBinding<AnalyticsEngineDataset>(),
  BETTER_AUTH_URL: 'https://links.davosdo.dev',
  BETTER_AUTH_SECRET: 'unit-test-secret-with-more-than-thirty-two-characters',
  ANALYTICS_DATA_SOURCE: 'cloudflare',
}

export function setCloudflareEnv(next: Partial<TestCloudflareEnv>) {
  Object.assign(env, next)
}
