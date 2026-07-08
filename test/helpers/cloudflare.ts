/// <reference path="../../worker-configuration.d.ts" />

import { vi } from 'vitest'
import { setCloudflareEnv } from '../mocks/cloudflare-workers'

type QueryResult = unknown

export type D1Call = {
  sql: string
  binds: unknown[]
  method: 'run' | 'first' | 'all'
}

function createD1Meta(): D1Meta & Record<string, unknown> {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changed_db: false,
    changes: 0,
  }
}

function createD1Result<T>(results: T[] = []): D1Result<T> {
  return {
    success: true,
    meta: createD1Meta(),
    results,
  }
}

function createD1Raw(): D1PreparedStatement['raw'] {
  function raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>
  function raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>
  async function raw<T = unknown[]>(options?: { columnNames?: boolean }) {
    if (options?.columnNames) return [[]] as [string[], ...T[]]
    return [] as T[]
  }
  return raw
}

async function emptyD1Batch<T = unknown>() {
  return [] as D1Result<T>[]
}

function createD1Session(prepare: D1Database['prepare']): D1DatabaseSession {
  return {
    prepare,
    batch: emptyD1Batch,
    getBookmark: () => null,
  }
}

export function createD1Mock(results: QueryResult[] = []) {
  const calls: D1Call[] = []
  const queue = [...results]

  const prepare: D1Database['prepare'] = vi.fn((sql: string) => {
    let binds: unknown[] = []
    const statement: D1PreparedStatement = {
      bind(...values: unknown[]) {
        binds = values
        return statement
      },
      async run<T = Record<string, unknown>>() {
        calls.push({ sql, binds, method: 'run' })
        return createD1Result<T>()
      },
      async first<T = Record<string, unknown>>() {
        calls.push({ sql, binds, method: 'first' })
        return (queue.shift() ?? null) as T | null
      },
      async all<T = Record<string, unknown>>() {
        calls.push({ sql, binds, method: 'all' })
        const result = queue.shift()
        if (Array.isArray(result)) return createD1Result(result as T[])
        return (result as D1Result<T>) ?? createD1Result<T>()
      },
      raw: createD1Raw(),
    }
    return statement
  })

  const db: D1Database = {
    prepare,
    batch: emptyD1Batch,
    exec: vi.fn(async () => ({ count: 0, duration: 0 })),
    withSession: () => createD1Session(prepare),
    dump: vi.fn(async () => new ArrayBuffer(0)),
  }

  return { db, calls }
}

export function createKvMock(initial = new Map<string, unknown>()) {
  const storage = new Map(initial)

  function get(key: string, options?: Partial<KVNamespaceGetOptions<undefined>>): Promise<string | null>
  function get(key: string, type: 'text'): Promise<string | null>
  function get<ExpectedValue = unknown>(key: string, type: 'json'): Promise<ExpectedValue | null>
  function get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
  function get(key: string, type: 'stream'): Promise<ReadableStream | null>
  function get(key: string, options?: KVNamespaceGetOptions<'text'>): Promise<string | null>
  function get<ExpectedValue = unknown>(
    key: string,
    options?: KVNamespaceGetOptions<'json'>,
  ): Promise<ExpectedValue | null>
  function get(key: string, options?: KVNamespaceGetOptions<'arrayBuffer'>): Promise<ArrayBuffer | null>
  function get(key: string, options?: KVNamespaceGetOptions<'stream'>): Promise<ReadableStream | null>
  function get(key: string[], type: 'text'): Promise<Map<string, string | null>>
  function get<ExpectedValue = unknown>(
    key: string[],
    type: 'json',
  ): Promise<Map<string, ExpectedValue | null>>
  function get(
    key: string[],
    options?: Partial<KVNamespaceGetOptions<undefined>>,
  ): Promise<Map<string, string | null>>
  function get(key: string[], options?: KVNamespaceGetOptions<'text'>): Promise<Map<string, string | null>>
  function get<ExpectedValue = unknown>(
    key: string[],
    options?: KVNamespaceGetOptions<'json'>,
  ): Promise<Map<string, ExpectedValue | null>>
  async function get(key: string | string[], options?: unknown): Promise<unknown> {
    if (Array.isArray(key)) {
      return new Map(key.map((item) => [item, storage.get(item) ?? null]))
    }

    const value = storage.get(key)
    const type = typeof options === 'string' ? options : (options as { type?: string } | undefined)?.type
    if (value == null || type === 'json') return value ?? null
    return typeof value === 'string' ? value : JSON.stringify(value)
  }

  function getWithMetadata<Metadata = unknown>(
    key: string,
    options?: Partial<KVNamespaceGetOptions<undefined>>,
  ): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>>
  function getWithMetadata<Metadata = unknown>(
    key: string,
    type: 'text',
  ): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>>
  function getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
    key: string,
    type: 'json',
  ): Promise<KVNamespaceGetWithMetadataResult<ExpectedValue, Metadata>>
  function getWithMetadata<Metadata = unknown>(
    key: string,
    type: 'arrayBuffer',
  ): Promise<KVNamespaceGetWithMetadataResult<ArrayBuffer, Metadata>>
  function getWithMetadata<Metadata = unknown>(
    key: string,
    type: 'stream',
  ): Promise<KVNamespaceGetWithMetadataResult<ReadableStream, Metadata>>
  function getWithMetadata<Metadata = unknown>(
    key: string,
    options: KVNamespaceGetOptions<'text'>,
  ): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>>
  function getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
    key: string,
    options: KVNamespaceGetOptions<'json'>,
  ): Promise<KVNamespaceGetWithMetadataResult<ExpectedValue, Metadata>>
  function getWithMetadata<Metadata = unknown>(
    key: string,
    options: KVNamespaceGetOptions<'arrayBuffer'>,
  ): Promise<KVNamespaceGetWithMetadataResult<ArrayBuffer, Metadata>>
  function getWithMetadata<Metadata = unknown>(
    key: string,
    options: KVNamespaceGetOptions<'stream'>,
  ): Promise<KVNamespaceGetWithMetadataResult<ReadableStream, Metadata>>
  function getWithMetadata<Metadata = unknown>(
    key: string[],
    type: 'text',
  ): Promise<Map<string, KVNamespaceGetWithMetadataResult<string, Metadata>>>
  function getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
    key: string[],
    type: 'json',
  ): Promise<Map<string, KVNamespaceGetWithMetadataResult<ExpectedValue, Metadata>>>
  function getWithMetadata<Metadata = unknown>(
    key: string[],
    options?: Partial<KVNamespaceGetOptions<undefined>>,
  ): Promise<Map<string, KVNamespaceGetWithMetadataResult<string, Metadata>>>
  function getWithMetadata<Metadata = unknown>(
    key: string[],
    options?: KVNamespaceGetOptions<'text'>,
  ): Promise<Map<string, KVNamespaceGetWithMetadataResult<string, Metadata>>>
  function getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
    key: string[],
    options?: KVNamespaceGetOptions<'json'>,
  ): Promise<Map<string, KVNamespaceGetWithMetadataResult<ExpectedValue, Metadata>>>
  async function getWithMetadata(key: string | string[]): Promise<unknown> {
    const makeResult = (item: string) => ({
      value: storage.get(item) ?? null,
      metadata: null,
      cacheStatus: null,
    })
    if (Array.isArray(key)) {
      return new Map(key.map((item) => [item, makeResult(item)]))
    }
    return makeResult(key)
  }

  async function list<Metadata = unknown>(): Promise<KVNamespaceListResult<Metadata>> {
    return {
      keys: [...storage.keys()].map((name) => ({ name })),
      list_complete: true,
      cacheStatus: null,
    }
  }

  const kv: KVNamespace = {
    get,
    list,
    put: vi.fn(async (key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream) => {
      storage.set(key, typeof value === 'string' ? JSON.parse(value) : value)
    }),
    getWithMetadata,
    delete: vi.fn(async (key: string) => {
      storage.delete(key)
    }),
  }

  return { kv, storage }
}

export function createAnalyticsMock() {
  const analytics: AnalyticsEngineDataset = {
    writeDataPoint: vi.fn(),
  }
  return analytics
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
