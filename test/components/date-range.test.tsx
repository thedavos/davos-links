import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateRangePicker } from '#/components/ui/date-range'

const now = new Date('2026-07-13T12:00:00.000Z')
const initialRange = { from: '2026-06-14', to: '2026-07-13' }

describe('DateRangePicker', () => {
  it('exposes labels, presets, effective dates and UTC context', () => {
    render(
      <DateRangePicker now={now} onChange={vi.fn()} value={initialRange} />,
    )

    expect(screen.getByText('Periodo de análisis')).toBeInTheDocument()
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-06-14')
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-07-13')
    expect(screen.getByRole('button', { name: '30d' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText(/Periodo efectivo:/)).toHaveTextContent(
      'Comparación:',
    )
    expect(screen.getByText(/Periodo efectivo:/)).toHaveTextContent('UTC')
  })

  it('keeps custom edits local until the user applies a valid range', () => {
    const onChange = vi.fn()
    render(
      <DateRangePicker now={now} onChange={onChange} value={initialRange} />,
    )

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-07-01' },
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(/Cambios sin aplicar/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(onChange).toHaveBeenCalledWith({
      from: '2026-07-01',
      to: '2026-07-13',
    })
  })

  it('does not apply empty, inverted, future or oversized ranges', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <DateRangePicker now={now} onChange={onChange} value={initialRange} />,
    )

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Completa las fechas')
    expect(screen.getByLabelText('Desde')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled()

    rerender(
      <DateRangePicker now={now} onChange={onChange} value={initialRange} />,
    )
    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-07-13' },
    })
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-07-12' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'no puede ser posterior',
    )

    rerender(
      <DateRangePicker
        key="future"
        now={now}
        onChange={onChange}
        value={initialRange}
      />,
    )
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-07-14' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent('fechas futuras')

    rerender(
      <DateRangePicker
        key="oversized"
        now={now}
        onChange={onChange}
        value={initialRange}
      />,
    )
    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2025-07-12' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent('366 días')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies presets immediately and restores the default range', () => {
    const onChange = vi.fn()
    render(
      <DateRangePicker
        now={now}
        onChange={onChange}
        value={{ from: '2026-07-01', to: '2026-07-13' }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '7d' }))
    expect(onChange).toHaveBeenLastCalledWith({
      from: '2026-07-07',
      to: '2026-07-13',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Restablecer' }))
    expect(onChange).toHaveBeenLastCalledWith(initialRange)
  })
})
