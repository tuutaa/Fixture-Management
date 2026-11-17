import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '../../lib/format'

/**
 * FAN2 searchable dropdown.
 * - Type to filter (label, secondary, group and value are searched).
 * - Up/Down + Enter keyboard support, Escape to close.
 * - Renders in a portal so it can float above modals and scroll containers.
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'เลือกข้อมูล',
  searchPlaceholder = 'พิมพ์เพื่อค้นหา…',
  emptyText = 'ไม่พบข้อมูลที่ตรงกัน',
  disabled = false,
  clearable = false,
  className,
  size = 'md',
  id,
  ariaLabel,
}) {
  const listId = useId()
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState({})

  const selected = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) =>
      [option.label, option.secondary, option.group, option.value]
        .filter(Boolean)
        .some((part) => String(part).toLowerCase().includes(needle)),
    )
  }, [options, query])

  const available = filtered.filter((option) => !option.disabled)

  const place = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const viewportHeight = window.innerHeight
    const below = viewportHeight - rect.bottom
    const width = Math.min(Math.max(rect.width, 260), window.innerWidth - 16)
    const down = below >= 240 || below >= rect.top
    const height = Math.min(330, down ? below - 12 : rect.top - 12)
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
      top: down ? rect.bottom + 6 : Math.max(8, rect.top - Math.max(160, height) - 6),
      maxHeight: Math.max(160, height),
    })
  }

  const show = () => {
    if (disabled) return
    place()
    setQuery('')
    setActive(0)
    setOpen(true)
  }

  const close = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const choose = (option) => {
    if (!option || option.disabled) return
    onChange?.(option.value, option)
    close()
  }

  useEffect(() => {
    if (!open) return undefined
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20)
    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const onResize = () => close(false)
    const onScroll = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      panelRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
    }
  }, [active, open])

  const highlighted = available[Math.min(active, Math.max(0, available.length - 1))]

  return (
    <>
      <div className={cn('relative', className)}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          onClick={() => (open ? close(false) : show())}
          onKeyDown={(event) => {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
              event.preventDefault()
              show()
            }
          }}
          className={cn(
            size === 'sm' ? 'field-input-sm' : 'field-input',
            'flex items-center justify-between gap-2 text-left',
            !selected && 'text-slate-400',
            className,
          )}
        >
          <span className="min-w-0 truncate">{selected ? selected.label : placeholder}</span>
          <span className="flex shrink-0 items-center gap-1">
            {clearable && selected && !disabled ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear selection"
                onClick={(event) => {
                  event.stopPropagation()
                  onChange?.('', null)
                }}
                className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-3 w-3" />
              </span>
            ) : null}
            <ChevronsUpDown className="h-4 w-4 text-slate-400" />
          </span>
        </button>
      </div>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[110] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40"
              style={position}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  ref={inputRef}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-label={searchPlaceholder}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setActive(0)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setActive((index) => Math.min(index + 1, available.length - 1))
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setActive((index) => Math.max(0, index - 1))
                    } else if (event.key === 'Enter') {
                      event.preventDefault()
                      choose(highlighted)
                    } else if (event.key === 'Escape') {
                      event.preventDefault()
                      close()
                    } else if (event.key === 'Tab') {
                      close(false)
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>

              <div
                id={listId}
                role="listbox"
                className="overflow-y-auto overscroll-contain p-1.5"
                style={{ maxHeight: Math.max(120, (position.maxHeight || 300) - 52) }}
              >
                {filtered.length === 0 ? (
                  <div className="px-3 py-8 text-center">
                    <p className="text-xs font-semibold text-slate-500">{emptyText}</p>
                    <p className="mt-1 text-[11px] text-slate-400">ลองพิมพ์คำอื่นหรือล้างคำค้นหา</p>
                  </div>
                ) : (
                  filtered.map((option, index) => {
                    const showGroup = option.group && filtered[index - 1]?.group !== option.group
                    const isSelected = String(option.value) === String(value)
                    return (
                      <div key={`${option.value}-${index}`}>
                        {showGroup ? (
                          <p className="px-3 pb-1 pt-2.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                            {option.group}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={option.disabled}
                          disabled={option.disabled}
                          data-active={option === highlighted}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => choose(option)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                            option === highlighted ? 'bg-blue-50' : 'hover:bg-slate-50',
                            option.disabled && 'cursor-not-allowed opacity-40',
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-slate-700">
                              {option.label}
                            </span>
                            {option.secondary ? (
                              <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                                {option.secondary}
                              </span>
                            ) : null}
                          </span>
                          {isSelected ? <Check className="h-4 w-4 shrink-0 text-blue-600" /> : null}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
