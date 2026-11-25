/*
 * Direction contract — Light analytics control center
 * THESIS: a read-only factory operations canvas where the state of every line is
 * legible in one glance; no action controls live inside dashboard content.
 * OWN-WORLD: white/slate glass panels, one indigo signal accent, semantic
 * emerald/amber/rose status color, SVG area/donut/bar graphics, tabular numerals.
 * STORY: total fleet → live utilization → pressure points → ranked breakdown
 * hotspots → the requests behind the numbers.
 * FIRST VIEWPORT: slim header band, six KPI tiles, then a 7-day request trend
 * beside the fixture-health donut and line-utilization bars.
 * FORM: pinned user direction — analytics control center; seed-key: pinned-light-analytics.
 * FINISH: verified in the browser — read-only main (0 clickables), all six panels
 * present, no console errors; chart data comes only from /api/dashboard.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  ClipboardList,
  Gauge,
  Layers3,
  PackageSearch,
  Radio,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import api from '../lib/api'
import { Card, ErrorState, Spinner } from '../components/ui/Card'
import { RequestStatusBadge } from '../components/ui/Badge'
import { cn, formatDate } from '../lib/format'
import { useLabels, useServerMessage } from '../lib/i18n'
import {
  PROCESS_TYPES,
  REQUEST_STATUSES,
} from '../lib/constants'

const ACTIVE_REQUEST_STATUSES = new Set(['Waiting', 'Progress', 'Hold', 'Verify'])
const NG_STATUSES = ['Scrape', 'PR', 'PR Ready', 'Replaced']
const PM_OVERDUE_STATES = new Set(['over-due', 'overdue-remind'])

const COLORS = {
  indigo: '#4f46e5',
  blue: '#0ea5e9',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  violet: '#8b5cf6',
  slate: '#94a3b8',
}

const STATUS_COLORS = {
  Waiting: COLORS.rose,
  Progress: COLORS.blue,
  Hold: COLORS.amber,
  Verify: COLORS.violet,
  Done: COLORS.emerald,
}

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const countBy = (items = [], pick) => {
  const counts = {}
  for (const item of items) {
    const key = pick(item)
    if (!key) continue
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

const statusRows = (known, counts = {}, includeUnknown = true) => {
  const seen = new Set()
  const rows = []
  for (const status of known) {
    rows.push([status, num(counts[status])])
    seen.add(status)
  }
  if (includeUnknown) {
    for (const [status, count] of Object.entries(counts)) {
      if (!seen.has(status)) rows.push([status, num(count)])
    }
  }
  return rows
}

const slotLabel = (slot) => {
  if (!slot) return ''
  const hour = Number(String(slot).split(':')[0])
  if (!Number.isFinite(hour)) return String(slot)
  return `${String(hour).padStart(2, '0')}:00–${String(hour + 1).padStart(2, '0')}:00`
}

const modelLabel = (request) => {
  const from = request?.currentModel || '-'
  const to = request?.changeModel || ''
  return to ? `${from} → ${to}` : from
}

const EmptyLine = ({ children }) => (
  <p className="px-1 py-6 text-center text-[11px] font-semibold text-slate-400">{children}</p>
)

/* --------------------------- SVG chart atoms ---------------------------- */

const AreaChart = ({ series }) => {
  const width = 680
  const height = 176
  const padX = 30
  const padY = 18
  const values = series.map((point) => num(point.count))
  const max = Math.max(4, ...values)
  const stepX = series.length > 1 ? (width - padX * 2) / (series.length - 1) : 0
  const points = values.map((value, index) => ({
    x: padX + index * stepX,
    y: height - padY - (value / max) * (height - padY * 2),
  }))
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const baseY = height - padY
  const area = points.length
    ? `${path} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`
    : ''
  const last = points[points.length - 1]
  const gridLines = [0, 1, 2, 3]

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-[176px] w-full overflow-visible"
        role="img"
        aria-label="7-day request trend"
      >
        <defs>
          <linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.indigo} stopOpacity="0.28" />
            <stop offset="100%" stopColor={COLORS.indigo} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="dash-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLORS.blue} />
            <stop offset="100%" stopColor={COLORS.indigo} />
          </linearGradient>
        </defs>
        {gridLines.map((index) => {
          const y = padY + (index * (height - padY * 2)) / 3
          const label = Math.round(max * (1 - index / 3))
          return (
            <g key={index}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#e2e8f0" strokeDasharray="3 5" />
              <text x={4} y={y + 4} fontSize="10" fill="#94a3b8" fontWeight="700">{label}</text>
            </g>
          )
        })}
        {area ? <path d={area} fill="url(#dash-area)" /> : null}
        {path ? <path d={path} fill="none" stroke="url(#dash-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {points.map((point, index) => (
          <circle key={series[index]?.date || index} cx={point.x} cy={point.y} r={index === points.length - 1 ? 5 : 3} fill="#fff" stroke={COLORS.indigo} strokeWidth={index === points.length - 1 ? 3 : 2} />
        ))}
        {last ? <circle cx={last.x} cy={last.y} r="10" fill={COLORS.indigo} opacity="0.12" /> : null}
      </svg>
      <div className="grid grid-cols-7 px-2 text-center text-[9px] font-bold text-slate-400">
        {series.map((point) => <span key={point.date}>{point.label}</span>)}
      </div>
    </div>
  )
}

const DonutChart = ({ segments, centerValue, centerLabel }) => {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((sum, segment) => sum + Math.max(0, num(segment.value)), 0)
  let offset = 0

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[132px] w-[132px] shrink-0">
        <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90" role="img" aria-label="Fixture status mix">
          <circle cx="66" cy="66" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="15" />
          {total > 0 ? segments.map((segment) => {
            const value = Math.max(0, num(segment.value))
            if (!value) return null
            const length = (value / total) * circumference
            const circle = (
              <circle
                key={segment.label}
                cx="66"
                cy="66"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="15"
                strokeDasharray={`${Math.max(length - 2, 0)} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            )
            offset += length
            return circle
          }) : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black tracking-tight text-slate-900">{centerValue}</span>
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{centerLabel}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-slate-500">{segment.label}</span>
            <span className="font-mono font-black tabular-nums text-slate-800">{num(segment.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const StackedBar = ({ parts = [], scale = 100 }) => (
  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
    {parts.map((part, index) => (
      <span
        key={`${part.key || index}`}
        className="h-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, (num(part.value) / Math.max(1, scale)) * 100))}%`, backgroundColor: part.color }}
      />
    ))}
  </div>
)

const KpiCard = ({ label, value, hint, icon: Icon, color, meter = 0, foot }) => (
  <div className="group relative min-w-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_16px_32px_-24px_rgba(15,23,42,0.35)]">
    <div
      className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full opacity-[0.09] blur-xl transition-transform duration-500 group-hover:scale-125"
      style={{ backgroundColor: color }}
    />
    <div className="flex items-start justify-between gap-2">
      <p className="min-w-0 truncate text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18`, color }}>
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
    </div>
    <p className="mt-2 text-[28px] font-black leading-none tracking-tight text-slate-900">
      {value.toLocaleString()}
    </p>
    <p className="mt-1.5 truncate text-[10px] font-semibold text-slate-400">{hint}</p>
    <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, meter))}%`, backgroundColor: color }}
      />
    </div>
    {foot ? <p className="mt-1.5 truncate text-[9px] font-bold" style={{ color }}>{foot}</p> : null}
  </div>
)

const Panel = ({ eyebrow, title, icon: Icon, children, className }) => (
  <Card className={cn('min-w-0 rounded-3xl border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_18px_36px_-28px_rgba(15,23,42,0.4)] sm:p-5', className)}>
    <div className="mb-4 flex items-start gap-3">
      {Icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
      ) : null}
      <div className="min-w-0">
        {eyebrow ? <p className="text-[9px] font-black uppercase tracking-[0.16em] text-indigo-500">{eyebrow}</p> : null}
        <h2 className="truncate text-[13px] font-black text-slate-900">{title}</h2>
      </div>
    </div>
    {children}
  </Card>
)

/* --------------------------------- Page -------------------------------- */

export default function DashboardPage() {
  const { t, fixtureStatus, pmState, requestStatus, requestType } = useLabels()
  const sm = useServerMessage()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const result = await api.dashboard()
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const summary = useMemo(() => {
    const counts = data?.counts || {}
    const requestCounts = data?.requestStats || {}
    const requestTypeCounts = Object.keys(data?.requestTypeStats || {}).length
      ? data.requestTypeStats
      : countBy(data?.recentRequests || [], (item) => item.type)
    const processCounts = Object.keys(data?.byProcess || {}).length
      ? data.byProcess
      : countBy(data?.recentRequests || [], (item) => item.requestType)
    const total = num(data?.total)
    const ng = NG_STATUSES.reduce((sum, status) => sum + num(counts[status]), 0)
    const requestTotal = Object.values(requestCounts).reduce((sum, value) => sum + num(value), 0)
    const activeRequests = [...ACTIVE_REQUEST_STATUSES].reduce((sum, status) => sum + num(requestCounts[status]), 0)
    const pmOverdue = (data?.pmAlerts || []).filter((fixture) =>
      num(fixture.pmOverdueDays) > 0 || (fixture.pmStates || []).some((state) => PM_OVERDUE_STATES.has(state)),
    ).length
    const inUse = num(counts['In Use'])

    return {
      counts,
      requestCounts,
      requestTypeCounts,
      processCounts,
      total,
      ng,
      requestTotal,
      activeRequests,
      pmOverdue,
      inUse,
      stock: num(counts['In Stock']),
      maintenance: num(counts.Maintenance),
      utilPercent: total ? Math.round((inUse / total) * 100) : 0,
      requestRows: statusRows(REQUEST_STATUSES, requestCounts, false),
      requestTypeRows: statusRows(Object.keys(requestTypeCounts), requestTypeCounts, false),
      processRows: statusRows(PROCESS_TYPES.map((item) => item.value), processCounts, false),
    }
  }, [data])

  const attention = useMemo(() => {
    const relativeDays = (days) => {
      if (!Number.isFinite(days)) return ''
      if (days < 0) return t(`เกิน ${Math.abs(days)} วัน`, `${Math.abs(days)} days overdue`)
      if (days === 0) return t('ครบกำหนดวันนี้', 'Due today')
      return t(`อีก ${days} วัน`, `${days} days left`)
    }

    const requests = (data?.dueRequests || [])
      .filter((item) => !item.status || ACTIVE_REQUEST_STATUSES.has(item.status))
      .map((item) => ({
        id: `request-${item.request_id}`,
        icon: CalendarClock,
        title: item.request_id || '-',
        subtitle: [requestType(item.type), item.currentModel, item.line].filter(Boolean).join(' · '),
        relative: relativeDays(item.daysLeft),
        urgency: Number.isFinite(item.daysLeft) ? item.daysLeft : 999,
        tone: 'indigo',
      }))

    const pm = (data?.pmAlerts || [])
      .filter((item) => num(item.pmOverdueDays) > 0 || (item.pmStates || []).some((state) => PM_OVERDUE_STATES.has(state)))
      .map((item) => ({
        id: `pm-${item.sn}`,
        icon: Wrench,
        title: item.sn || '-',
        subtitle: [item.line, item.model].filter(Boolean).join(' · ') || pmState(item.pmStates?.[0]),
        relative: num(item.pmOverdueDays) > 0
          ? t(`เกิน ${item.pmOverdueDays} วัน`, `${item.pmOverdueDays} days overdue`)
          : pmState(item.pmStates?.[0]),
        urgency: -num(item.pmOverdueDays) - 1,
        tone: 'rose',
      }))

    return [...requests, ...pm].sort((a, b) => a.urgency - b.urgency).slice(0, 8)
  }, [data, pmState, requestType, t])

  if (loading) return <Spinner label={t('กำลังโหลดข้อมูล…', 'Loading…')} />
  if (error) return <ErrorState message={sm(error)} />
  if (!data) return null

  const trend = data.requestTrend || []
  const topBreakdown = data.topBreakdown || []
  const lineStats = data.lineStats || []
  const recentRequests = data.recentRequests || []
  const activeByProcess = data.activeByProcess || {}
  const maxLineTotal = Math.max(1, ...lineStats.map((row) => num(row.total)))
  const maxTopScore = Math.max(1, ...topBreakdown.map((row) => num(row.total)))

  const healthSegments = [
    { label: fixtureStatus('In Stock'), value: summary.stock, color: COLORS.emerald },
    { label: fixtureStatus('In Use'), value: summary.inUse, color: COLORS.blue },
    { label: fixtureStatus('Maintenance'), value: summary.maintenance, color: COLORS.amber },
    { label: t('Order / NG', 'Order / NG'), value: summary.ng, color: COLORS.rose },
  ]

  const maxRequestCount = Math.max(1, ...summary.requestRows.map(([, count]) => count))
  const maxProcessCount = Math.max(1, ...summary.processRows.map(([, count]) => count))

  return (
    <div className="space-y-4">
      {/* Header band — deliberately read-only. */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_20px_45px_-32px_rgba(15,23,42,0.45)] sm:px-7">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-indigo-100/50 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">
              <Sparkles className="h-3.5 w-3.5" /> Fixture Intelligence
            </p>
            <h1 className="mt-1.5 text-[26px] font-black tracking-tight text-slate-900 sm:text-[30px]">
              {t('ภาพรวมการดำเนินงาน', 'Operations Overview')}
            </h1>
            <p className="mt-1 text-[12px] font-medium text-slate-500">
              {t('สถานะ Fixture, คำขอ และจุดที่ต้องโฟกัสแบบเรียลไทม์', 'Live fixture state, request flow, and the hotspots that need attention')}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Live snapshot</p>
              <p className="font-mono text-[11px] font-bold text-slate-700">{formatDate(new Date())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label={t('Fixture ทั้งหมด', 'Total fixtures')} value={summary.total} hint={t('ทุก Line', 'All lines')} icon={Boxes} color={COLORS.indigo} meter={100} />
        <KpiCard label={t('ใช้งานที่ไลน์', 'In use')} value={summary.inUse} hint={`${summary.utilPercent}% ${t('ของทั้งหมด', 'of fleet')}`} icon={Activity} color={COLORS.blue} meter={summary.utilPercent} foot={t(' utilization', ' utilization')} />
        <KpiCard label={t('พร้อมเบิกจ่าย', 'Ready in stock')} value={summary.stock} hint={fixtureStatus('In Stock')} icon={PackageSearch} color={COLORS.emerald} meter={summary.total ? (summary.stock / summary.total) * 100 : 0} />
        <KpiCard label={t('ซ่อมบำรุง', 'Maintenance')} value={summary.maintenance} hint={t('อยู่ในคิวซ่อม', 'In repair queue')} icon={Wrench} color={COLORS.amber} meter={summary.total ? (summary.maintenance / summary.total) * 100 : 0} />
        <KpiCard label={t('คำขอค้าง', 'Active requests')} value={summary.activeRequests} hint={`${summary.requestTotal} ${t('คำขอทั้งหมด', 'total requests')}`} icon={ClipboardList} color={COLORS.violet} meter={summary.requestTotal ? (summary.activeRequests / summary.requestTotal) * 100 : 0} />
        <KpiCard label={t('PM เกินกำหนด', 'PM overdue')} value={summary.pmOverdue} hint={t('เกิน 3 วันต้องมี 4M', '4M required after 3 days')} icon={AlertTriangle} color={COLORS.rose} meter={Math.min(100, summary.pmOverdue * 8)} />
      </div>

      {/* Primary charts */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.72fr)_minmax(0,0.88fr)]">
        <Panel eyebrow="Demand signal" title={t('คำขอ 7 วันล่าสุด', 'Requests · last 7 days')} icon={TrendingUp}>
          <AreaChart series={trend} />
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{t('คำขอในช่วงนี้', 'Requests in window')}</p>
              <p className="text-[18px] font-black text-slate-900">{trend.reduce((sum, row) => sum + num(row.count), 0)}</p>
            </div>
            <span className="flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-600">
              <ArrowUpRight className="h-3 w-3" /> {t('แนวโน้ม', 'Trend')}
            </span>
          </div>
        </Panel>

        <Panel eyebrow="Fleet mix" title={t('สุขภาพ Fixture', 'Fixture health')} icon={Gauge}>
          <DonutChart
            segments={healthSegments}
            centerValue={summary.total}
            centerLabel={t('ทั้งหมด', 'total')}
          />
        </Panel>

        <Panel eyebrow="By line" title={t('การใช้ Fixture ต่อ Line', 'Line utilization')} icon={Layers3}>
          <div className="max-h-[214px] space-y-3 overflow-y-auto pr-1">
            {lineStats.length === 0 ? <EmptyLine>{t('ยังไม่มีข้อมูล Line', 'No line data yet')}</EmptyLine> : null}
            {lineStats.map((row) => {
              const total = num(row.total)
              const other = num(row.inUse) + num(row.maintenance) + num(row.order) + num(row.pmOverdue)
              const stock = Math.max(0, total - other)
              return (
                <div key={row.line} className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate font-mono font-black text-slate-700">{row.line}</span>
                    <span className="shrink-0 font-mono font-bold text-slate-400">{total}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" style={{ width: `${(total / maxLineTotal) * 100}%` }}>
                    <StackedBar
                      scale={Math.max(1, total)}
                      parts={[
                        { key: 'inUse', value: row.inUse, color: COLORS.blue },
                        { key: 'stock', value: stock, color: '#cbd5e1' },
                        { key: 'maint', value: row.maintenance, color: COLORS.amber },
                        { key: 'ng', value: row.order, color: COLORS.violet },
                        { key: 'pm', value: row.pmOverdue, color: COLORS.rose },
                      ]}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-[9px] font-bold text-slate-400">
            <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-blue-500" />In Use</span>
            <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-slate-300" />In Stock</span>
            <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-amber-500" />Maint.</span>
            <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-violet-500" />NG</span>
            <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-rose-500" />PM</span>
          </div>
        </Panel>
      </div>

      {/* Pressure + ranked breakdown */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel eyebrow="Workflow" title={t('ความกดดันของคำขอ', 'Request pressure')} icon={Radio}>
            <div className="space-y-2.5">
              {summary.requestRows.map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <span className="w-[62px] shrink-0 truncate text-[10px] font-bold text-slate-500">
                    {requestStatus(status)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(count / maxRequestCount) * 100}%`, backgroundColor: STATUS_COLORS[status] || COLORS.slate }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right font-mono text-[10px] font-black tabular-nums text-slate-700">{count}</span>
                </div>
              ))}
              {summary.requestRows.length === 0 ? <EmptyLine>{t('ยังไม่มีคำขอ', 'No requests yet')}</EmptyLine> : null}
            </div>
          </Panel>

          <Panel eyebrow="Mix" title={t('ประเภทคำขอ / Process', 'Request & process mix')} icon={ClipboardList}>
            <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{t('ประเภท', 'Types')}</p>
            <div className="flex flex-wrap gap-1.5">
              {summary.requestTypeRows.length === 0 ? <EmptyLine>{t('ยังไม่มีคำขอ', 'No requests yet')}</EmptyLine> : null}
              {summary.requestTypeRows.map(([type, count]) => (
                <span key={type} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                  {requestType(type)} <b className="font-mono text-slate-800">{count}</b>
                </span>
              ))}
            </div>
            <p className="mb-1.5 mt-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Process</p>
            <div className="space-y-2">
              {summary.processRows.map(([process, count]) => (
                <div key={process} className="flex items-center gap-2">
                  <span className="w-[64px] shrink-0 truncate text-[10px] font-semibold text-slate-500">{process}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-400" style={{ width: `${(count / maxProcessCount) * 100}%` }} />
                  </div>
                  <span className="w-5 shrink-0 text-right font-mono text-[10px] font-bold text-slate-600">{count}</span>
                </div>
              ))}
              {summary.processRows.length === 0 ? <EmptyLine>N/A</EmptyLine> : null}
            </div>
          </Panel>
        </div>

        <Panel eyebrow="Hotspots" title={t('Top fixture breakdown', 'Top fixture breakdown')} icon={AlertTriangle}>
          <div className="space-y-2.5">
            {topBreakdown.length === 0 ? (
              <EmptyLine>{t('ไม่มี Fixture ที่ต้อง breakdown', 'No breakdown hotspots right now')}</EmptyLine>
            ) : null}
            {topBreakdown.map((row, index) => (
              <div key={row.key} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <span className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-mono text-[11px] font-black',
                  index === 0
                    ? 'border border-rose-200 bg-white text-rose-700'
                    : index === 1
                      ? 'border border-amber-200 bg-white text-amber-700'
                      : 'border border-slate-200 bg-white text-slate-700',
                )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11px] font-black text-slate-800">{row.line}</p>
                  <p className="truncate text-[10px] font-semibold text-slate-400">{row.model}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
                    <StackedBar
                      scale={maxTopScore}
                      parts={[
                        { key: 'maint', value: row.maintenance, color: COLORS.amber },
                        { key: 'pm', value: row.pm, color: COLORS.rose },
                        { key: 'ng', value: row.ng, color: COLORS.violet },
                      ]}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[17px] font-black leading-none text-slate-900">{row.total}</p>
                  <p className="text-[9px] font-bold text-slate-400">M {row.maintenance} · PM {row.pm} · NG {row.ng}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Priority radar + process load */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Panel eyebrow="Focus" title={t('ต้องโฟกัสตอนนี้', 'Priority radar')} icon={CalendarClock}>
          <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
            {attention.length === 0 ? <EmptyLine>{t('ไม่มีงานที่ต้องทำตอนนี้', 'Nothing to do right now')}</EmptyLine> : null}
            {attention.map((item) => {
              const Icon = item.icon
              const urgent = item.urgency < 0
              return (
                <div key={item.id} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white px-2.5 py-2">
                  <span className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                    urgent ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600',
                  )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] font-black text-slate-800">{item.title}</p>
                    <p className="truncate text-[10px] font-semibold text-slate-400">{item.subtitle || '-'}</p>
                  </div>
                  <span className={cn('shrink-0 text-[10px] font-black', urgent ? 'text-rose-600' : 'text-indigo-600')}>
                    {item.relative}
                  </span>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel eyebrow="Active fleet" title={t('Fixture ที่ใช้งานตาม Process', 'In-use fixtures by process')} icon={Gauge}>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROCESS_TYPES.map((process) => {
              const count = num(activeByProcess[process.value])
              const max = Math.max(1, ...PROCESS_TYPES.map((item) => num(activeByProcess[item.value])))
              return (
                <div key={process.value} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-black text-slate-700">{process.value}</p>
                    <p className="font-mono text-[15px] font-black text-slate-900">{count}</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-indigo-50/70 px-3 py-2.5 text-[10px] font-bold text-indigo-700">
            <Boxes className="h-3.5 w-3.5 shrink-0" />
            {t('รวม Fixture ที่ใช้งาน', 'Total in-use fixtures')}: {summary.inUse.toLocaleString()}
          </div>
        </Panel>
      </div>

      {/* Read-only register */}
      <Panel eyebrow="Register" title={t('คำขอและ Order ล่าสุด', 'Latest requests & orders')} icon={ClipboardList}>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[9px] uppercase tracking-[0.14em] text-slate-400">
                <th className="px-2 pb-2 font-black">{t('คำขอ', 'Request')}</th>
                <th className="px-2 pb-2 font-black">{t('ประเภท / Process', 'Type / Process')}</th>
                <th className="px-2 pb-2 font-black">Model</th>
                <th className="px-2 pb-2 font-black">Line / {t('คิว', 'Queue')}</th>
                <th className="px-2 pb-2 font-black">{t('สถานะ', 'Status')}</th>
                <th className="px-2 pb-2 font-black">{t('วันที่', 'Date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRequests.map((request, index) => (
                <tr key={`${request.request_id || request._id || 'request'}-${index}`} className="align-middle text-[11px]">
                  <td className="px-2 py-2 font-mono font-black text-indigo-600">{request.request_id || '-'}</td>
                  <td className="px-2 py-2 text-slate-600">
                    <span className="block font-bold">{requestType(request.type)}</span>
                    <span className="block text-[10px] text-slate-400">{request.requestType || '-'}</span>
                  </td>
                  <td className="max-w-[180px] truncate px-2 py-2 font-mono text-[10px] text-slate-500" title={modelLabel(request)}>
                    {modelLabel(request)}
                  </td>
                  <td className="px-2 py-2 text-slate-500">
                    <span className="block font-bold text-slate-600">{request.line || '-'}</span>
                    <span className="block text-[10px] text-slate-400">
                      {request.queueSlot ? `${slotLabel(request.queueSlot)} · ${formatDate(request.queueDate)}` : '-'}
                    </span>
                  </td>
                  <td className="px-2 py-2"><RequestStatusBadge status={request.status} /></td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-[10px] text-slate-500">
                    {formatDate(request.requestInfo?.date || request.date)}
                  </td>
                </tr>
              ))}
              {recentRequests.length === 0 ? (
                <tr><td colSpan={6}><EmptyLine>{t('ยังไม่มีคำขอ', 'No requests yet')}</EmptyLine></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
