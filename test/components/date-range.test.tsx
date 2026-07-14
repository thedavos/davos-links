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
    expect(screen.getByLabelText('Desde')).toHaveClass('sm:w-[10.5rem]')
    const selectedPreset = screen.getByRole('button', { name: '30d' })
    const inactivePreset = screen.getByRole('button', { name: '7d' })
    expect(selectedPreset).toHaveAttribute('aria-pressed', 'true')
    expect(inactivePreset).toHaveAttribute('aria-pressed', 'false')
    expect(selectedPreset.querySelector('canvas')).toBeInTheDocument()
    expect(inactivePreset.querySelector('canvas')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Restablecer' }).querySelector('canvas'),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Periodo efectivo:/)).toHaveTextContent(
      'Comparación:',
    )
    expect(screen.getByText(/Periodo efectivo:/)).toHaveTextContent('UTC')
  })

  it('supports an unframed picker without the effective-period summary', () => {
    render(
      <DateRangePicker
        framed={false}
        now={now}
        onChange={vi.fn()}
        showSummary={false}
        value={initialRange}
      />,
    )

    const picker = screen.getByRole('group', { name: 'Periodo de análisis' })
    expect(picker).not.toHaveClass('border', 'bg-card', 'p-3')
    expect(screen.queryByText(/Periodo efectivo:/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Desde')).not.toHaveAttribute('aria-describedby')
    const reset = screen.getByRole('button', { name: 'Restablecer' })
    expect(screen.queryByRole('button', { name: 'Aplicar' })).not.toBeInTheDocument()
    expect(reset.parentElement).toHaveClass('flex', 'items-center', 'gap-2')
    expect(picker.firstElementChild?.nextElementSibling).toHaveClass(
      'flex-wrap',
      'items-center',
    )
  })

  it('applies valid custom date changes immediately', () => {
    const onChange = vi.fn()
    render(
      <DateRangePicker now={now} onChange={onChange} value={initialRange} />,
    )

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-07-01' },
    })

    expect(onChange).toHaveBeenCalledWith({
      from: '2026-07-01',
      to: '2026-07-13',
    })
    expect(screen.queryByRole('button', { name: 'Aplicar' })).not.toBeInTheDocument()
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
    expect(screen.queryByRole('button', { name: 'Aplicar' })).not.toBeInTheDocument()

    rerender(
      <DateRangePicker key="inverted" now={now} onChange={onChange} value={initialRange} />,
    )
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-06-13' },
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
