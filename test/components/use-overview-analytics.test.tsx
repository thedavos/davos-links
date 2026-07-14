import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DateRange } from '#/lib/date-range'
import { useOverviewAnalytics } from '#/features/dashboard/useOverviewAnalytics'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function responseFor(range: DateRange, clicks: number) {
  return Response.json({
    totals: {
      totalClicks: clicks,
      clicks7d: clicks,
      clicks30d: clicks,
      activeLinks: 1,
    },
    series: [{ metric_date: range.to, clicks }],
    previousSeries: [],
    range,
    topLinks: [],
  })
}

describe('useOverviewAnalytics', () => {
  it('aborts prior requests and ignores responses that finish out of order', async () => {
    const ranges = {
      seven: { from: '2026-07-07', to: '2026-07-13' },
      ninety: { from: '2026-04-15', to: '2026-07-13' },
      thirty: { from: '2026-06-14', to: '2026-07-13' },
    }
    const requests = [
      deferred<Response>(),
      deferred<Response>(),
      deferred<Response>(),
    ]
    const signals: AbortSignal[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signals.push(init?.signal as AbortSignal)
        return requests[signals.length - 1].promise
      }),
    )

    const { result, rerender } = renderHook(
      ({ range }: { range: DateRange }) => useOverviewAnalytics(range),
      { initialProps: { range: ranges.seven } },
    )

    rerender({ range: ranges.ninety })
    rerender({ range: ranges.thirty })
    expect(signals).toHaveLength(3)
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(true)

    await act(async () => requests[2].resolve(responseFor(ranges.thirty, 30)))
    await waitFor(() =>
      expect(result.current.data?.totals.totalClicks).toBe(30),
    )

    await act(async () => {
      requests[0].resolve(responseFor(ranges.seven, 7))
      requests[1].resolve(responseFor(ranges.ninety, 90))
    })

    expect(result.current.data?.range).toEqual(ranges.thirty)
    expect(result.current.data?.totals.totalClicks).toBe(30)
    expect(fetch).not.toHaveBeenCalledWith('/api/links', expect.anything())
  })

  it('keeps prior data visible while a new range is updating', async () => {
    const first = { from: '2026-07-07', to: '2026-07-13' }
    const second = { from: '2026-06-14', to: '2026-07-13' }
    const update = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(responseFor(first, 7))
        .mockImplementationOnce(() => update.promise),
    )

    const { result, rerender } = renderHook(
      ({ range }: { range: DateRange }) => useOverviewAnalytics(range),
      { initialProps: { range: first } },
    )
    await waitFor(() => expect(result.current.data?.totals.totalClicks).toBe(7))

    rerender({ range: second })
    expect(result.current.data?.totals.totalClicks).toBe(7)
    expect(result.current.isUpdating).toBe(true)
    expect(result.current.hasStaleData).toBe(true)

    await act(async () => update.resolve(responseFor(second, 30)))
    await waitFor(() => expect(result.current.hasStaleData).toBe(false))
  })

  it('reports HTTP errors and retries successfully', async () => {
    const range = { from: '2026-06-14', to: '2026-07-13' }
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('fail', { status: 500 }))
        .mockResolvedValueOnce(responseFor(range, 30)),
    )

    const { result } = renderHook(() => useOverviewAnalytics(range))
    await waitFor(() =>
      expect(result.current.error).toBe(
        'El servidor no pudo cargar las métricas.',
      ),
    )

    act(() => result.current.retry())
    await waitFor(() =>
      expect(result.current.data?.totals.totalClicks).toBe(30),
    )
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('reports network errors with retry available', async () => {
    const range = { from: '2026-06-14', to: '2026-07-13' }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValueOnce(new TypeError('offline')),
    )

    const { result } = renderHook(() => useOverviewAnalytics(range))
    await waitFor(() =>
      expect(result.current.error).toBe(
        'No se pudo conectar para cargar las métricas.',
      ),
    )
    expect(result.current.retry).toEqual(expect.any(Function))
  })
})
