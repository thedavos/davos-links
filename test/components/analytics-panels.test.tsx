import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  AnalyticsHeatmapPanel,
  CategoryPerformancePanel,
  UtmPerformancePanel,
} from '#/features/dashboard/AnalyticsPanels'
import type { AnalyticsHeatmap, AnalyticsUtmPerformance } from '#/lib/types'

const coverage = {
  from: '2026-07-01',
  to: '2026-07-14',
  truncated: false,
  retention: '3_months' as const,
}

describe('analytics panels', () => {
  it('switches between associated campaign and tag performance', () => {
    render(
      <CategoryPerformancePanel
        campaigns={[
          {
            id: 'cmp_1',
            label: 'Lanzamiento',
            currentClicks: 20,
            previousClicks: 10,
            delta: { status: 'comparable', absolute: 10, percent: 100, trend: 'up' },
          },
        ]}
        tags={[]}
      />,
    )
    const chart = screen.getByRole('group', { name: /clics asociados por campaña/i })
    const selector = screen.getByRole('group', { name: 'Agrupar rendimiento por' })
    expect(chart).toBeInTheDocument()
    expect(selector.closest('[data-slot="card"]')).toBe(chart.closest('[data-slot="card"]'))
    expect(screen.getByRole('button', { name: 'Campañas' })).toHaveClass(
      'min-h-7',
      'text-xs',
    )
    expect(screen.getByRole('button', { name: 'Periodo seleccionado' }).parentElement).toHaveClass(
      'bottom-0',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Etiquetas' }))
    expect(screen.getByText(/no hay etiquetas con clics asociados/i)).toBeInTheDocument()
  })

  it('renders one keyboard stop and moves through heatmap cells with arrow keys', () => {
    const cells: AnalyticsHeatmap['cells'] = []
    for (let day = 1; day <= 7; day += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        cells.push({
          day: day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
          hour,
          clicks: day === 2 && hour === 14 ? 12 : 0,
        })
      }
    }
    render(
      <AnalyticsHeatmapPanel
        heatmap={{
          status: 'ready',
          source: 'analytics_engine',
          scope: 'human',
          coverage,
          totalClicks: 12,
          cells,
        }}
        loading={false}
        onRetry={vi.fn()}
      />,
    )

    const gridCells = screen.getAllByRole('gridcell')
    expect(gridCells).toHaveLength(168)
    expect(gridCells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1)
    fireEvent.focus(gridCells[0])
    fireEvent.keyDown(gridCells[0], { key: 'ArrowRight' })
    expect(gridCells[1]).toHaveFocus()
    expect(screen.getByText(/mayor actividad: martes, 14:00/i)).toBeInTheDocument()
  })

  it('shows UTM unavailable state without affecting other panels', () => {
    const retry = vi.fn()
    const utm: AnalyticsUtmPerformance = {
      status: 'unavailable',
      reason: 'upstream_error',
      source: 'analytics_engine',
      scope: 'human',
      coverage,
      previousCoverage: coverage,
      totalClicks: 0,
      campaigns: [],
      sources: [],
      mediums: [],
    }
    render(<UtmPerformancePanel loading={false} onRetry={retry} utm={utm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
