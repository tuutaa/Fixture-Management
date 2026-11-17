import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '../../lib/format'

const ToastContext = createContext(null)

const TONES = {
  success: {
    wrap: 'border-emerald-200 bg-white text-emerald-900',
    icon: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    Icon: CheckCircle2,
  },
  error: {
    wrap: 'border-red-200 bg-white text-red-900',
    icon: 'bg-red-500',
    bar: 'bg-red-500',
    Icon: XCircle,
  },
  warning: {
    wrap: 'border-orange-200 bg-white text-orange-900',
    icon: 'bg-orange-500',
    bar: 'bg-orange-500',
    Icon: AlertTriangle,
  },
  info: {
    wrap: 'border-blue-200 bg-white text-blue-900',
    icon: 'bg-blue-500',
    bar: 'bg-blue-500',
    Icon: Info,
  },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (type, message, options = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const duration = options.duration ?? 5000
      setToasts((current) => [...current.slice(-3), { id, type, message, title: options.title, duration }])
      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration)
        timers.current.set(id, timer)
      }
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      push,
      dismiss,
      success: (message, options) => push('success', message, options),
      error: (message, options) => push('error', message, options),
      warning: (message, options) => push('warning', message, options),
      info: (message, options) => push('info', message, options),
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2.5">
        {toasts.map((toast) => {
          const tone = TONES[toast.type] || TONES.info
          const Icon = tone.Icon
          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                'animate-toast-in pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border p-3.5 pr-10 shadow-xl shadow-slate-200/70',
                tone.wrap,
              )}
            >
              <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white', tone.icon)}>
                <Icon className="h-4 w-4" strokeWidth={2.4} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                {toast.title ? (
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-60">{toast.title}</p>
                ) : null}
                <p className="text-xs font-bold leading-snug">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {toast.duration > 0 ? (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-slate-100">
                  <span
                    className={cn('block h-full origin-left', tone.bar)}
                    style={{ animation: `fan2-toast-progress ${toast.duration}ms linear forwards` }}
                  />
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}

export default ToastProvider
