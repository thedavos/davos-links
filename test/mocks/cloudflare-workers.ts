/// <reference path="../../worker-configuration.d.ts" />

type TestCloudflareEnv = Omit<Env, 'BETTER_AUTH_URL'> & {
  BETTER_AUTH_URL: string
  BETTER_AUTH_SECRET?: string
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
}

export function setCloudflareEnv(next: Partial<TestCloudflareEnv>) {
  Object.assign(env, next)
}
