import { cn } from '../../lib/format'
import { fixtureTone, requestTone } from '../../lib/constants'

export function Badge({ tone = 'slate', children, dot = false, className }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 ring-slate-500/10',
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/10',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
    orange: 'bg-orange-50 text-orange-700 ring-orange-600/10',
    red: 'bg-red-50 text-red-700 ring-red-600/10',
    purple: 'bg-purple-50 text-purple-700 ring-purple-600/10',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  }
  const dots = {
    slate: 'bg-slate-400',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset',
        tones[tone] || tones.slate,
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone] || dots.slate)} /> : null}
      {children}
    </span>
  )
}

export function FixtureStatusBadge({ status, className }) {
  const tone = fixtureTone(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset',
        tone.chip,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
      {tone.label}
    </span>
  )
}

export function RequestStatusBadge({ status, className }) {
  const tone = requestTone(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset',
        tone.chip,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
      {tone.label}
    </span>
  )
}

export function DeptTag({ children, tone = 'slate' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <span className={cn('rounded-lg px-2.5 py-1 text-[11px] font-bold', tones[tone])}>{children}</span>
  )
}

export default Badge
