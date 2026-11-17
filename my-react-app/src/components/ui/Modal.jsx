import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/format'

const TONES = {
  blue: {
    header: 'border-blue-100 bg-blue-50/60',
    title: 'text-blue-950',
    subtitle: 'text-blue-600',
    tile: 'bg-blue-100 text-blue-600',
  },
  red: {
    header: 'border-red-100 bg-red-50/60',
    title: 'text-red-950',
    subtitle: 'text-red-600',
    tile: 'bg-red-100 text-red-600',
  },
  orange: {
    header: 'border-orange-100 bg-orange-50/60',
    title: 'text-orange-950',
    subtitle: 'text-orange-600',
    tile: 'bg-orange-100 text-orange-600',
  },
  emerald: {
    header: 'border-emerald-100 bg-emerald-50/60',
    title: 'text-emerald-950',
    subtitle: 'text-emerald-600',
    tile: 'bg-emerald-100 text-emerald-600',
  },
  slate: {
    header: 'border-slate-100 bg-slate-50',
    title: 'text-slate-900',
    subtitle: 'text-slate-500',
    tile: 'bg-slate-100 text-slate-600',
  },
}

const SIZES = {
  sm: 'max-w-[440px]',
  md: 'max-w-[580px]',
  lg: 'max-w-[760px]',
  xl: 'max-w-[960px]',
  '2xl': 'max-w-[1120px]',
}

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  tone = 'blue',
  size = 'md',
  footer,
  children,
  className,
  bodyClassName,
  closeOnBackdrop = true,
}) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      }
      if (event.key !== 'Tab') return
      const nodes = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )
      if (!nodes || nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector(
        'input, textarea, select, button:not([data-close])',
      )
      focusable?.focus()
    }, 40)

    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(timer)
    }
  }, [open, onClose])

  if (!open) return null

  const palette = TONES[tone] || TONES.blue

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        className={cn(
          'animate-fade-up flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200 bg-white shadow-2xl sm:rounded-[1.75rem]',
          SIZES[size] || SIZES.md,
          className,
        )}
      >
        {title ? (
          <div className={cn('flex items-start justify-between gap-4 border-b p-5', palette.header)}>
            <div className="flex min-w-0 items-start gap-3.5">
              {Icon ? (
                <div
                  className={cn(
                    'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    palette.tile,
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.1} />
                </div>
              ) : null}
              <div className="min-w-0">
                <h2 className={cn('text-lg font-bold leading-tight tracking-tight', palette.title)}>
                  {title}
                </h2>
                {subtitle ? (
                  <p className={cn('mt-1 text-[10px] font-bold uppercase tracking-[0.16em]', palette.subtitle)}>
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              data-close
              onClick={onClose}
              aria-label="Close dialog"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-colors hover:text-red-500"
            >
              <X className="h-5 w-5" strokeWidth={2.4} />
            </button>
          </div>
        ) : null}

        <div className={cn('min-h-0 flex-1 overflow-y-auto p-5 sm:p-6', bodyClassName)}>{children}</div>

        {footer ? (
          <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:px-6">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
