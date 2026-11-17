import { cn } from '../../lib/format'

export function FormField({ label, hint, error, required, className, children, htmlFor }) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-1 text-red-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 ml-1 text-[11px] font-semibold text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 ml-1 text-[11px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}

export function Input({ className, ...props }) {
  return <input className={cn('field-input', className)} {...props} />
}

export function InputSm({ className, ...props }) {
  return <input className={cn('field-input-sm', className)} {...props} />
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} className={cn('field-input resize-none', className)} {...props} />
}

export function NativeSelect({ className, children, ...props }) {
  return (
    <div className="relative">
      <select className={cn('field-input appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export default FormField
