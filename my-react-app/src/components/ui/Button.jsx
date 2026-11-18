import { cn } from '../../lib/format'

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none',
  warning:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-200 transition-all hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none',
  yellow:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-semibold text-yellow-950 shadow-lg shadow-yellow-200 transition-all hover:bg-yellow-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none',
  purple:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-200 transition-all hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none',
  slate:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-200 transition-all hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none',
}

const SIZES = {
  sm: 'px-3.5 py-2 text-xs',
  md: '',
  lg: 'px-6 py-4 text-sm',
  icon: 'h-9 w-9 rounded-xl px-0 py-0',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  type = 'button',
  ...props
}) {
  return (
    <button type={type} className={cn(VARIANTS[variant] || VARIANTS.primary, SIZES[size], className)} {...props}>
      {Icon ? <Icon className={size === 'icon' ? 'h-4 w-4' : 'h-4 w-4 shrink-0'} strokeWidth={2.2} /> : null}
      {children}
      {IconRight ? <IconRight className="h-4 w-4 shrink-0" strokeWidth={2.2} /> : null}
    </button>
  )
}
