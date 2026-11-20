import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/format'
import { useLanguage } from '../../context/LanguageContext'
import { EmptyState } from './Card'

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

function resolveValue(column, row) {
  if (typeof column.sortValue === 'function') return column.sortValue(row)
  return row[column.key]
}

export default function DataTable({
  columns,
  rows,
  rowKey = (row) => row._id || row.SN || row.OrderNo,
  onRowClick,
  selectedKey,
  pageSize = 10,
  initialSort = null,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  toolbar,
  dense = false,
  className,
  footerNote,
  embedded = false,
}) {
  const { t } = useLanguage()
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    if (!sort?.key) return rows
    const column = columns.find((item) => item.key === sort.key)
    if (!column) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const left = resolveValue(column, a)
      const right = resolveValue(column, b)
      if (left === right) return 0
      if (left === null || left === undefined || left === '') return 1
      if (right === null || right === undefined || right === '') return -1
      const bothNumeric =
        (typeof left === 'number' || (!Number.isNaN(Number(left)) && String(left).trim() !== '')) &&
        (typeof right === 'number' || (!Number.isNaN(Number(right)) && String(right).trim() !== ''))
      const result = bothNumeric ? Number(left) - Number(right) : collator.compare(String(left), String(right))
      return sort.direction === 'asc' ? result : -result
    })
    return copy
  }, [rows, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const pageRows = sorted.slice(start, start + pageSize)

  const toggleSort = (column) => {
    if (column.sortable === false) return
    setSort((current) => {
      if (current?.key !== column.key) return { key: column.key, direction: 'asc' }
      return { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    })
    setPage(1)
  }

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const set = new Set([1, totalPages, safePage, safePage - 1, safePage + 1])
    return [...set].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b)
  }, [totalPages, safePage])

  return (
    <div
      className={cn(
        'table-shell',
        embedded && 'flex h-full min-h-0 flex-col !rounded-none !border-0 !shadow-none',
        className,
      )}
    >
      {toolbar ? <div className="shrink-0 border-b border-slate-100 bg-white p-3.5 sm:p-4">{toolbar}</div> : null}

      {pageRows.length === 0 ? (
        <div className={cn('min-h-0', embedded && 'flex-1')}>
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle ?? t('ไม่พบข้อมูล', 'No data')}
            description={emptyDescription}
            action={emptyAction}
            className={embedded ? 'h-full justify-start !py-8' : undefined}
          />
        </div>
      ) : (
        <div className={cn('overflow-x-auto', embedded && 'min-h-0 flex-1 overflow-y-auto')}>
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                {columns.map((column) => {
                  const isSorted = sort?.key === column.key
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cn(
                        'sticky top-0 z-10 whitespace-nowrap bg-slate-50/90 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 backdrop-blur',
                        column.align === 'right' && 'text-right',
                        column.align === 'center' && 'text-center',
                        column.headerClassName,
                      )}
                      style={column.width ? { width: column.width } : undefined}
                    >
                      {column.sortable === false ? (
                        column.header
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleSort(column)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
                            column.align === 'right' && 'flex-row-reverse',
                          )}
                        >
                          {column.header}
                          {isSorted ? (
                            sort.direction === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-blue-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-blue-600" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-300" />
                          )}
                        </button>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row, index) => {
                const key = rowKey(row)
                const isSelected = selectedKey !== undefined && String(selectedKey) === String(key)
                return (
                  <tr
                    key={key ?? index}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'transition-colors',
                      'bg-white',
                      onRowClick && 'cursor-pointer hover:bg-slate-50/70',
                      isSelected && 'bg-blue-50/70 hover:bg-blue-50',
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'px-5 align-middle text-[13px] text-slate-600',
                          dense ? 'py-2.5' : 'py-3.5',
                          column.align === 'right' && 'text-right',
                          column.align === 'center' && 'text-center',
                          column.className,
                        )}
                      >
                        {column.render ? column.render(row) : row[column.key] ?? '-'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-medium text-slate-400">
          {footerNote ? `${footerNote} · ` : ''}
          {sorted.length === 0
            ? t('0 รายการ', '0 items')
            : `${t('แสดง', 'Showing')} ${start + 1}–${Math.min(start + pageSize, sorted.length)} ${t('จาก', 'of')} ${sorted.length.toLocaleString()} ${t('รายการ', 'items')}`}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={safePage === 1}
            aria-label={t('หน้าก่อนหน้า', 'Previous page')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageNumbers.map((number, index) => {
            const previous = pageNumbers[index - 1]
            return (
              <span key={number} className="flex items-center gap-1.5">
                {previous && number - previous > 1 ? <span className="px-0.5 text-slate-300">…</span> : null}
                <button
                  type="button"
                  onClick={() => setPage(number)}
                  aria-current={number === safePage ? 'page' : undefined}
                  className={cn(
                    'h-8 min-w-8 rounded-lg px-2 text-[11px] font-bold transition-colors',
                    number === safePage
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'border border-slate-200 text-slate-500 hover:bg-slate-50',
                  )}
                >
                  {number}
                </button>
              </span>
            )
          })}
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={safePage === totalPages}
            aria-label={t('หน้าถัดไป', 'Next page')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
