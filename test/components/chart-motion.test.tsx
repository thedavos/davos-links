import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Area, AreaChart } from '#/components/dither-kit'
import { useChart } from '#/components/dither-kit/chart-context'
import { CartesianRoot } from '#/components/dither-kit/cartesian-root'
import {
  SPARKLE_BURST_DURATION,
  sparkleFrame,
} from '#/components/dither-kit/dither-paint'

const data = [
  { date: '2026-07-12', clicks: 4 },
  { date: '2026-07-13', clicks: 8 },
]

const config = {
  clicks: { label: 'Clics', color: 'blue' },
} as const

function ChartStateProbe() {
  const chart = useChart()
  return <output data-testid="sparkle-revision">{chart.sparkleRevision}</output>
}

function BurstChart() {
  return (
    <CartesianRoot
      Canvas={ChartStateProbe}
      animate={false}
      ariaLabel="Gráfica de prueba"
      chartType="area"
      config={config}
      data={data}
      sparkles="burst"
    >
      {null}
    </CartesianRoot>
  )
}

describe('chart motion', () => {
  it('triggers one burst per pointer entry without replaying on pointer move', () => {
    render(<BurstChart />)
    const chart = screen.getByRole('group', { name: 'Gráfica de prueba' })
    const revision = screen.getByTestId('sparkle-revision')

    expect(revision).toHaveTextContent('0')
    fireEvent.pointerEnter(chart)
    expect(revision).toHaveTextContent('1')
    fireEvent.pointerMove(chart, { clientX: 320 })
    expect(revision).toHaveTextContent('1')
    fireEvent.pointerLeave(chart)
    fireEvent.pointerEnter(chart)
    expect(revision).toHaveTextContent('2')
  })

  it('triggers one burst each time the chart root receives keyboard focus', () => {
    render(<BurstChart />)
    const chart = screen.getByRole('group', { name: 'Gráfica de prueba' })
    const revision = screen.getByTestId('sparkle-revision')

    fireEvent.focus(chart)
    expect(revision).toHaveTextContent('1')
    fireEvent.blur(chart)
    fireEvent.focus(chart)
    expect(revision).toHaveTextContent('2')
  })

  it('bounds bursts to 500ms and disables every mode for reduced motion', () => {
    expect(sparkleFrame('burst', 0, 0, false)).toEqual({
      active: false,
      opacity: 0,
    })
    expect(sparkleFrame('burst', 1, SPARKLE_BURST_DURATION / 2, false)).toEqual({
      active: true,
      opacity: 1,
    })
    expect(sparkleFrame('burst', 1, SPARKLE_BURST_DURATION, false)).toEqual({
      active: false,
      opacity: 0,
    })
    expect(sparkleFrame('continuous', 1, 0, true)).toEqual({
      active: false,
      opacity: 0,
    })
  })

  it('does not reset the canvas backing store while scrubbing between points', () => {
    const { container } = render(
      <AreaChart
        animate={false}
        ariaLabel="Gráfica con hover estable"
        config={config}
        data={data}
      >
        <Area dataKey="clicks" variant="gradient" />
      </AreaChart>,
    )
    const chart = screen.getByRole('group', { name: 'Gráfica con hover estable' })
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
    if (!canvas) return

    let width = canvas.width
    let widthWrites = 0
    Object.defineProperty(canvas, 'width', {
      configurable: true,
      get: () => width,
      set: (next: number) => {
        width = next
        widthWrites += 1
      },
    })

    fireEvent.pointerEnter(chart)
    fireEvent.pointerMove(chart, { clientX: 120 })
    fireEvent.pointerMove(chart, { clientX: 420 })

    expect(widthWrites).toBe(0)
  })
})
