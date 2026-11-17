import { cn } from '../../lib/format'

export default function Tabs({ tabs, value, onChange, className, size = 'md' }) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        const Icon = tab.icon
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-xl font-bold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20',
              size === 'sm' ? 'px-3 py-2 text-[11px]' : 'px-4 py-2.5 text-xs',
              active
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={2.2} /> : null}
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px] font-black',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function FilterChip({ active, onClick, children, tone = 'blue' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold ring-1 ring-inset transition-all',
        active
          ? tone === 'red'
            ? 'bg-red-600 text-white ring-red-600'
            : 'bg-blue-600 text-white ring-blue-600'
          : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50 hover:text-slate-800',
      )}
    >
      {children}
    </button>
  )
}
