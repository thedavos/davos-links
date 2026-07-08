import { vi } from 'vitest'
import { setCloudflareEnv } from '../mocks/cloudflare-workers'

type QueryResult = unknown

export type D1Call = {
  sql: string
  binds: unknown[]
  method: 'run' | 'first' | 'all'
}

export function createD1Mock(results: QueryResult[] = []) {
  const calls: D1Call[] = []
  const queue = [...results]

  const db = {
    prepare: vi.fn((sql: string) => {
      const statement = {
        binds: [] as unknown[],
        bind(...values: unknown[]) {
          statement.binds = values
          return statement
        },
        async run() {
          calls.push({ sql, binds: statement.binds, method: 'run' })
          return { success: true } as D1Result
        },
        async first<T>() {
          calls.push({ sql, binds: statement.binds, method: 'first' })
          return (queue.shift() ?? null) as T | null
        },
        async all<T>() {
          calls.push({ sql, binds: statement.binds, method: 'all' })
          const result = queue.shift()
          if (Array.isArray(result)) return { results: result as T[] }
          return (result as D1Result<T>) ?? { results: [] as T[] }
        },
      }
      return statement
    }),
  } as unknown as D1Database

  return { db, calls }
}

export function createKvMock(initial = new Map<string, unknown>()) {
  const storage = new Map(initial)
  const kv = {
    get: vi.fn(async (key: string) => storage.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      storage.set(key, JSON.parse(value))
    }),
    delete: vi.fn(async (key: string) => {
      storage.delete(key)
    }),
  } as unknown as KVNamespace

  return { kv, storage }
}

export function createAnalyticsMock() {
  return {
    writeDataPoint: vi.fn(),
  } as unknown as AnalyticsEngineDataset
}

export function installCloudflareMocks(options: {
  dbResults?: QueryResult[]
  kvInitial?: Map<string, unknown>
} = {}) {
  const db = createD1Mock(options.dbResults)
  const kv = createKvMock(options.kvInitial)
  const analytics = createAnalyticsMock()
  setCloudflareEnv({
    LINKS_DB: db.db,
    SHORT_LINK_CACHE: kv.kv,
    CLICK_ANALYTICS: analytics,
  })
  return { ...db, ...kv, analytics }
}
