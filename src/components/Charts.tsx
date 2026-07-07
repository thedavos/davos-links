export function MiniBars({
  data,
  valueKey = 'clicks',
}: {
  data: Array<Record<string, string | number>>
  valueKey?: string
}) {
  const values = data.map((item) => Number(item[valueKey] ?? 0))
  const max = Math.max(1, ...values)
  return (
    <div className="flex h-40 items-end gap-1 border border-neutral-200 p-3">
      {values.length ? (
        values.map((value, index) => (
          <div
            className="flex-1 bg-neutral-950"
            key={`${value}-${index}`}
            style={{ height: `${Math.max(3, (value / max) * 100)}%` }}
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
