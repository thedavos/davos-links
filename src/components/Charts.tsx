import { cn } from '#/lib/utils'

export function MiniBars({
  data,
  valueKey = 'clicks',
}: {
  data: Array<Record<string, string | number>>
  valueKey?: string
}) {
  const values = data.map((item) => Number(item[valueKey] ?? 0))
  const max = Math.max(2, ...values)
  const sparse = values.length > 0 && values.length <= 7

  return (
    <div
      className={cn(
        'flex h-40 items-end gap-1 border border-neutral-200 p-3',
        sparse && 'justify-center',
      )}
    >
      {values.length ? (
        values.map((value, index) => (
          <div
            className={cn('bg-neutral-950', sparse ? 'w-2' : 'flex-1')}
            key={`${value}-${index}`}
            style={{ height: value > 0 ? `${Math.max(3, (value / max) * 100)}%` : 0 }}
            title={`${value}`}
          />
        ))
      ) : (
        <div className="grid h-full w-full place-items-center text-sm text-neutral-500">
          Todavía no hay datos
        </div>
      )}
    </div>
  )
}
