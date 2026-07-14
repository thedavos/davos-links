import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChartPoint } from '#/components/Charts'
import {
  ANALYTICS_TIME_ZONE,
  isSameDateRange,
  previousDateRange,
  type DateRange,
} from '#/lib/date-range'

export type AnalyticsComparison = {
  currentClicks: number
  previousClicks: number
  delta: number
  deltaPercent: number
  trend: 'up' | 'down' | 'flat'
}

export type OverviewTopLink = {
  id: string
  title: string
  short_path: string
  clicks: number
  trafficShare?: number
  delta?: number
  deltaPercent?: number | null
}

export type OverviewAnalytics = {
  totals: {
    totalClicks: number
    clicks7d: number
    clicks30d: number
    activeLinks: number
    humanClicks?: number
    activeLinksWithClicks?: number
    dailyAverage?: number
    botClicks?: number
  }
  series: ChartPoint[]
  previousSeries: ChartPoint[]
  comparison: AnalyticsComparison
  heatmap: ChartPoint[]
  topLinks: OverviewTopLink[]
  range: DateRange
  previousRange: DateRange
  timeZone: string
}

type RequestState<T> = {
  data: T | null
  error: string
  isInitialLoading: boolean
  isUpdating: boolean
}

const emptyComparison: AnalyticsComparison = {
  currentClicks: 0,
  previousClicks: 0,
  delta: 0,
  deltaPercent: 0,
  trend: 'flat',
}

export function useOverviewAnalytics<T extends { range: DateRange } = OverviewAnalytics>(
  range: DateRange,
  normalize?: (payload: unknown, requestedRange: DateRange) => T,
) {
  const [requestState, setRequestState] = useState<RequestState<T>>({
    data: null,
    error: '',
    isInitialLoading: true,
    isUpdating: false,
  })
  const [retryNonce, setRetryNonce] = useState(0)
  const latestRequestId = useRef(0)

  useEffect(() => {
    const requestId = latestRequestId.current + 1
    latestRequestId.current = requestId
    const controller = new AbortController()

    setRequestState((current) => ({
      ...current,
      error: '',
      isInitialLoading: current.data === null,
      isUpdating: current.data !== null,
    }))

    const request: Promise<T> = normalize
      ? fetchOverviewPayload(range, controller.signal).then((payload) =>
          normalize(payload, range),
        )
      : fetchOverviewAnalytics(range, controller.signal).then(
          (data) => data as unknown as T,
        )

    void request
      .then((data) => {
        if (controller.signal.aborted || requestId !== latestRequestId.current)
          return
        setRequestState({
          data,
          error: '',
          isInitialLoading: false,
          isUpdating: false,
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestId !== latestRequestId.current)
          return
        setRequestState((current) => ({
          ...current,
          error: errorMessage(error),
          isInitialLoading: false,
          isUpdating: false,
        }))
      })

    return () => controller.abort()
  }, [range.from, range.to, retryNonce, normalize])

  const retry = useCallback(() => setRetryNonce((value) => value + 1), [])
  const hasStaleData = Boolean(
    requestState.data && !isSameDateRange(requestState.data.range, range),
  )

  return {
    ...requestState,
    hasStaleData,
    isUpdating: requestState.isUpdating || hasStaleData,
    retry,
  }
}

export async function fetchOverviewAnalytics(
  range: DateRange,
  signal?: AbortSignal,
): Promise<OverviewAnalytics> {
  const payload = (await fetchOverviewPayload(range, signal)) as Partial<OverviewAnalytics> & {
    timezone?: string
  }

  return {
    totals: payload.totals ?? {
      totalClicks: 0,
      clicks7d: 0,
      clicks30d: 0,
      activeLinks: 0,
    },
    series: payload.series ?? [],
    previousSeries: payload.previousSeries ?? [],
    comparison: payload.comparison ?? emptyComparison,
    heatmap: payload.heatmap ?? payload.series ?? [],
    topLinks: payload.topLinks ?? [],
    range: payload.range ?? range,
    previousRange: payload.previousRange ?? previousDateRange(range),
    timeZone: payload.timeZone ?? payload.timezone ?? ANALYTICS_TIME_ZONE,
  }
}

async function fetchOverviewPayload(range: DateRange, signal?: AbortSignal) {
  const params = new URLSearchParams(range)
  const response = await fetch(`/api/analytics/overview?${params.toString()}`, {
    signal,
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = (await response.json()) as unknown
  if (!payload || typeof payload !== 'object') {
    throw new Error('Respuesta analítica inválida')
  }
  return payload
}

function errorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return 'No se pudo conectar para cargar las métricas.'
  }
  if (error instanceof Error && error.message.startsWith('HTTP ')) {
    return 'El servidor no pudo cargar las métricas.'
  }
  return 'No se pudieron cargar las métricas.'
}
