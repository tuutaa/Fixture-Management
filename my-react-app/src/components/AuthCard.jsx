import { cn } from '../lib/format'

export const authLabel = 'mb-1.5 ml-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400'

export const authInput =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10'

export const authButton =
  'flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none'

export const authIcon = 'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400'

export default function AuthCard({ icon: Icon, title, subtitle, children, footer, className, tileClassName }) {
  return (
    <div
      className={cn(
        'animate-fade-up w-full max-w-[420px] rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8',
        className,
      )}
    >
      <div className="mb-7 text-center">
        <div
          className={cn(
            'mx-auto mb-4 inline-flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200',
            tileClassName,
          )}
        >
          {Icon ? <Icon className="h-7 w-7" strokeWidth={2.1} /> : <span className="text-2xl font-black">F</span>}
        </div>
        <h1 className="text-2xl font-bold leading-tight text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
      {footer ? <div className="mt-6 text-center text-sm text-slate-500">{footer}</div> : null}
    </div>
  )
}
