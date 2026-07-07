export function json<T>(data: T, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      'cache-control': 'no-store',
      ...init.headers,
    },
  })
}

export async function readJson<T extends Record<string, unknown>>(
  request: Request,
): Promise<T> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return {} as T
  }

  return (await request.json()) as T
}
