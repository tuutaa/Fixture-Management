import { Loader2, PackageOpen, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/format'
import { useLanguage } from '../../context/LanguageContext'
import { useServerMessage } from '../../lib/i18n'

export function Card({ className, children, ...props }) {
  return (
    <div className={cn('card', className)} {...props}>
      {children}
    </div>
  )
}

export function PageHeader({ eyebrow, title, description, actions, icon: Icon, className }) {
  return (
    <div className={cn('flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon ? (
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            <Icon className="h-5 w-5" strokeWidth={2.1} />
          </div>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">{eyebrow}</p>
          ) : null}
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900">{title}</h1>
          {description ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function SectionHeader({ title, description, actions, className, icon: Icon }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

const STAT_TONES = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
  slate: 'bg-slate-100 text-slate-500',
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'blue',
  active = false,
  onClick,
  className,
}) {
  const Component = onClick ? 'button' : 'div'
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group rounded-2xl border bg-white p-4 text-left shadow-sm transition-all sm:p-5',
        active
          ? 'border-blue-300 ring-4 ring-blue-500/10'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md',
        onClick ? 'cursor-pointer' : '',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-1.5 text-[25px] font-extrabold leading-none tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        {Icon ? (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:-translate-y-0.5',
              STAT_TONES[tone] || STAT_TONES.blue,
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={2.1} />
          </div>
        ) : null}
      </div>
      {hint ? <p className="mt-2 truncate text-[11px] font-medium text-slate-400">{hint}</p> : null}
    </Component>
  )
}

export function InfoRow({ label, value, className, mono = false }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2.5', className)}>
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <span
        className={cn(
          'max-w-[62%] text-right text-[13px] font-semibold text-slate-700',
          mono && 'font-mono text-xs',
        )}
      >
        {value === null || value === undefined || value === '' ? '-' : value}
      </span>
    </div>
  )
}

export function Spinner({ className, label }) {
  const { t } = useLanguage()
  return (
    <div className={cn('flex items-center justify-center gap-3 py-10 text-slate-400', className)}>
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      <span className="text-xs font-semibold">{label ?? t('กำลังโหลดข้อมูล…', 'Loading…')}</span>
    </div>
  )
}

export function EmptyState({ icon: Icon = PackageOpen, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-7 w-7" strokeWidth={1.7} />
      </div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ message, onRetry, className }) {
  const { t } = useLanguage()
  const sm = useServerMessage()
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <RefreshCw className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{t('โหลดข้อมูลไม่สำเร็จ', 'Failed to load data')}</p>
      <p className="max-w-md text-xs text-slate-500">{sm(message)}</p>
      {onRetry ? (
        <button onClick={onRetry} className="btn-secondary mt-2 px-4 py-2 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> {t('ลองใหม่', 'Retry')}
        </button>
      ) : null}
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-100', className)} />
}

export default Card
