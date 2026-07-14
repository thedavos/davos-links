import type { ReactNode } from 'react'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  FALLBACK_TIME_ZONE,
  detectBrowserTimeZone,
  formatTimeZoneLabel,
  isValidTimeZone,
} from '#/lib/time-zone'

type TimeZoneContextValue = {
  detectedTimeZone: string
  preference: string | null
  setPreference: (value: string | null) => void
  timeZone: string
  timeZoneLabel: string
}

const TimeZoneContext = createContext<TimeZoneContextValue | null>(null)
const subscribe = () => () => undefined
const fallbackContext: TimeZoneContextValue = {
  detectedTimeZone: FALLBACK_TIME_ZONE,
  preference: null,
  setPreference: () => undefined,
  timeZone: FALLBACK_TIME_ZONE,
  timeZoneLabel: formatTimeZoneLabel(FALLBACK_TIME_ZONE),
}

export function TimeZoneProvider({ children }: { children: ReactNode }) {
  const detectedTimeZone = useSyncExternalStore(
    subscribe,
    detectBrowserTimeZone,
    () => FALLBACK_TIME_ZONE,
  )
  const [preference, setPreference] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/settings/preferences', { signal: controller.signal })
      .then((response) => response.json())
      .then((value: unknown) => {
        const data = value as { timeZone?: unknown }
        if (data.timeZone === null || isValidTimeZone(data.timeZone)) {
          setPreference(data.timeZone)
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('No se pudo cargar la zona horaria.', error)
        }
      })
    return () => controller.abort()
  }, [])

  const timeZone = preference ?? detectedTimeZone
  const value = useMemo(
    () => ({
      detectedTimeZone,
      preference,
      setPreference,
      timeZone,
      timeZoneLabel: formatTimeZoneLabel(timeZone),
    }),
    [detectedTimeZone, preference, timeZone],
  )

  return <TimeZoneContext.Provider value={value}>{children}</TimeZoneContext.Provider>
}

export function useTimeZone() {
  const value = useContext(TimeZoneContext)
  return value ?? fallbackContext
}
