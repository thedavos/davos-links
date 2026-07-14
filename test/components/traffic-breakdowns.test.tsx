import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TrafficBreakdowns } from '#/features/dashboard/TrafficBreakdowns'
import type { AnalyticsBreakdowns } from '#/lib/types'

const readyBreakdowns: AnalyticsBreakdowns = {
  status: 'ready',
  source: 'analytics_engine',
  scope: 'human',
  totalClicks: 20,
  coverage: {
    from: '2026-04-07',
    to: '2026-07-07',
    truncated: true,
    retention: '3_months',
  },
  referrers: [{ value: '', clicks: 8, percentage: 40 }],
  countries: [{ value: 'T1', clicks: 4, percentage: 20 }],
  devices: [{ value: 'Unknown', clicks: 2, percentage: 10 }],
}

describe('TrafficBreakdowns', () => {
  it('renders localized values, totals, and retention coverage', () => {
    render(
      <TrafficBreakdowns
        breakdowns={readyBreakdowns}
        loading={false}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText('20 clics analizados')).toBeInTheDocument()
    expect(screen.getByText('Directo / sin referencia')).toBeInTheDocument()
    expect(screen.getByText('Red Tor')).toBeInTheDocument()
    expect(screen.getByText('Desconocido')).toBeInTheDocument()
    expect(screen.getByText('Rango limitado')).toBeInTheDocument()
    expect(screen.getByText(/comienza el 7 abr 2026/i)).toBeInTheDocument()
  })

  it('renders loading, empty, and retryable unavailable states', () => {
    const onRetry = vi.fn()
    const { rerender } = render(
      <TrafficBreakdowns breakdowns={null} loading onRetry={onRetry} />,
    )
    expect(screen.getByLabelText('Cargando principales orígenes')).toBeInTheDocument()

    rerender(
      <TrafficBreakdowns
        breakdowns={{
          ...readyBreakdowns,
          coverage: { ...readyBreakdowns.coverage, truncated: false },
          referrers: [],
          countries: [],
          devices: [],
          totalClicks: 0,
        }}
        loading={false}
        onRetry={onRetry}
      />,
    )
    expect(screen.getAllByText('Sin clics humanos en este periodo.')).toHaveLength(3)

    rerender(
      <TrafficBreakdowns
        breakdowns={{
          ...readyBreakdowns,
          status: 'unavailable',
          reason: 'not_configured',
          referrers: [],
          countries: [],
          devices: [],
        }}
        loading={false}
        onRetry={onRetry}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('todavía no están configurados')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
