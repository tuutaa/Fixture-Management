/*
 * Direction contract — Light analytics control center
 * THESIS: a read-only factory operations canvas where the whole state of the
 * factory is legible in a single viewport; no action controls live in the
 * dashboard content.
 * OWN-WORLD: white/slate panels, one indigo signal accent, semantic
 * emerald/amber/rose status color, compact bar graphics, tabular numerals.
 * STORY: total fleet → live utilization → pressure points → ranked breakdown
 * hotspots → the requests behind the numbers.
 * FIRST VIEWPORT: slim header band, eight KPI tiles, then four compact panels
 * covering line utilization, request flow, priority radar and process/latest.
 * FORM: pinned user direction — analytics control center; seed-key: pinned-light-analytics.
 * FINISH: read-only main, all summary panels visible without page scrolling;
 * chart data comes only from /api/dashboard.
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
  <p className="px-1 py-3 text-center text-[10px] font-semibold text-slate-400">{children}</p>
)

const StackedBar = ({ parts = [], scale = 100 }) => (
  <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
    {parts.map((part, index) => (
      <span
        key={`${part.key || index}`}
        className="h-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, (num(part.value) / Math.max(1, scale)) * 100))}%`, backgroundColor: part.color }}
      />
    ))}
  </div>
)

const CompactKpi = ({ label, value, hint, icon: Icon, color, meter = 0 }) => (
  <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_12px_24px_-20px_rgba(15,23,42,0.35)]">
    <div
      className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full opacity-[0.08] blur-xl transition-transform duration-500 group-hover:scale-125"
      style={{ backgroundColor: color }}
    />
    <div className="flex items-start justify-between gap-1">
      <p className="min-w-0 truncate text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">{label}</p>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18`, color }}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
      </span>
    </div>
    <p className="mt-1 text-[21px] font-black leading-none tracking-tight text-slate-900">
      {value.toLocaleString()}
    </p>
    <p className="mt-1 truncate text-[9px] font-semibold text-slate-400">{hint}</p>
    <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, meter))}%`, backgroundColor: color }}
      />
    </div>
  </div>
)

const MiniPanel = ({ eyebrow, title, icon: Icon, children, className, action }) => (
  <Card className={cn('flex min-h-0 min-w-0 flex-col rounded-2xl border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_12px_28px_-24px_rgba(15,23,42,0.4)]', className)}>
    <div className="mb-2 flex shrink-0 items-center gap-2">
      {Icon ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="text-[8px] font-black uppercase tracking-[0.14em] text-indigo-500">{eyebrow}</p> : null}
        <h2 className="truncate text-[11px] font-black text-slate-900">{title}</h2>
      </div>
      {action}
    </div>
    <div className="min-h-0 flex-1">{children}</div>
  </Card>
)

/* --------------------------------- Page -------------------------------- */

export default function DashboardPage() {
  const { t, ui, fixtureStatus, pmState, requestStatus, requestType } = useLabels()
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
    const expiringSoon = num(data?.expiryStats?.expiringIn3Days)
    const expired = num(data?.expiryStats?.expired)
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
      expiringSoon,
      expired,
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
  const maxProcessCount = Math.max(1, ...summary.processRows.map(([, count]) => count))
  const maxRequestCount = Math.max(1, ...summary.requestRows.map(([, count]) => count))
  const maxTopScore = Math.max(1, ...topBreakdown.map((row) => num(row.total)))
  const trendTotal = trend.reduce((sum, row) => sum + num(row.count), 0)

  const healthSegments = [
    { label: fixtureStatus('In Stock'), value: summary.stock, color: COLORS.emerald },
    { label: fixtureStatus('In Use'), value: summary.inUse, color: COLORS.blue },
    { label: fixtureStatus('Maintenance'), value: summary.maintenance, color: COLORS.amber },
    { label: t('Order / NG', 'Order / NG'), value: summary.ng, color: COLORS.rose },
  ]

  const kpis = [
    {
      label: t('Fixture ทั้งหมด', 'Total fixtures'),
      value: summary.total,
      hint: t('ทุก Line', 'All lines'),
      icon: Boxes,
      color: COLORS.indigo,
      meter: 100,
    },
    {
      label: t('ใช้งานที่ไลน์', 'In use'),
      value: summary.inUse,
      hint: `${summary.utilPercent}% ${t('ของทั้งหมด', 'of fleet')}`,
      icon: Activity,
      color: COLORS.blue,
      meter: summary.utilPercent,
    },
    {
      label: t('พร้อมเบิกจ่าย', 'Ready in stock'),
      value: summary.stock,
      hint: fixtureStatus('In Stock'),
      icon: PackageSearch,
      color: COLORS.emerald,
      meter: summary.total ? (summary.stock / summary.total) * 100 : 0,
    },
    {
      label: t('ซ่อมบำรุง', 'Maintenance'),
      value: summary.maintenance,
      hint: t('อยู่ในคิวซ่อม', 'In repair queue'),
      icon: Wrench,
      color: COLORS.amber,
      meter: summary.total ? (summary.maintenance / summary.total) * 100 : 0,
    },
    {
      label: t('คำขอค้าง', 'Active requests'),
      value: summary.activeRequests,
      hint: `${summary.requestTotal} ${t('คำขอทั้งหมด', 'total requests')}`,
      icon: ClipboardList,
      color: COLORS.violet,
      meter: summary.requestTotal ? (summary.activeRequests / summary.requestTotal) * 100 : 0,
    },
    {
      label: t('PM เกินกำหนด', 'PM overdue'),
      value: summary.pmOverdue,
      hint: t('เกิน 3 วันต้องมี 4M', '4M required after 3 days'),
      icon: AlertTriangle,
      color: COLORS.rose,
      meter: Math.min(100, summary.pmOverdue * 8),
    },
    {
      label: t('หมดอายุใน 3 วัน', 'Expired in 3 day'),
      value: summary.expiringSoon,
      hint: t('จะหมดอายุภายใน 3 วัน', 'Expiring within 3 days'),
      icon: CalendarClock,
      color: COLORS.amber,
      meter: Math.min(100, summary.expiringSoon * 8),
    },
    {
      label: t('หมดอายุแล้ว', 'Expired'),
      value: summary.expired,
      hint: t('หมดอายุแล้ว', 'Already expired'),
      icon: AlertTriangle,
      color: COLORS.rose,
      meter: Math.min(100, summary.expired * 8),
    },
  ]

  return (
    <div className="-mb-16 -mt-6 flex h-[calc(100vh-65px)] flex-col gap-2 overflow-hidden lg:-mt-8 lg:h-screen">
      {/* Slim header band — deliberately read-only. */}
      <div className="relative shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_12px_28px_-24px_rgba(15,23,42,0.4)] sm:px-5">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
        <div className="absolute -right-10 -top-16 h-36 w-36 rounded-full bg-indigo-100/50 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.18em] text-indigo-600">
              <Sparkles className="h-3 w-3" /> {ui('fixtureIntelligence')}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h1 className="truncate text-[19px] font-black tracking-tight text-slate-900 sm:text-[22px]">
                {t('ภาพรวมการดำเนินงาน', 'Operations Overview')}
              </h1>
              <p className="hidden truncate text-[10px] font-medium text-slate-500 md:block">
                {t('สถานะ Fixture, คำขอ และจุดที่ต้องโฟกัสแบบเรียลไทม์', 'Live fixture state, request flow, and the hotspots that need attention')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden w-[220px] shrink-0 sm:block">
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                {healthSegments.map((segment) => (
                  <span
                    key={segment.label}
                    className="h-full"
                    style={{
                      width: `${summary.total ? (num(segment.value) / summary.total) * 100 : 0}%`,
                      backgroundColor: segment.color,
                    }}
                    title={`${segment.label}: ${num(segment.value)}`}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between gap-1 text-[8px] font-bold text-slate-400">
                <span>{ui('inUseShort')} {summary.inUse}</span>
                <span>{ui('stockShort')} {summary.stock}</span>
                <span>{ui('pmShort')} {summary.maintenance}</span>
                <span>{ui('ngShort')} {summary.ng}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">{ui('liveSnapshot')}</p>
                <p className="font-mono text-[10px] font-bold text-slate-700">{formatDate(new Date())}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Eight KPIs in one strip — no page scroll required. */}
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {kpis.map((kpi) => <CompactKpi key={kpi.label} {...kpi} />)}
      </div>

      {/* Four summary panels share the remaining viewport height. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MiniPanel eyebrow={ui('byLine')} title={t('การใช้ Fixture ต่อ Line', 'Line utilization')} icon={Layers3}>
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {lineStats.length === 0 ? <EmptyLine>{t('ยังไม่มีข้อมูล Line', 'No line data yet')}</EmptyLine> : null}
              {lineStats.map((row) => {
                const total = num(row.total)
                const other = num(row.inUse) + num(row.maintenance) + num(row.order) + num(row.pmOverdue)
                const stock = Math.max(0, total - other)
                return (
                  <div key={row.line} className="min-w-0">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[9px]">
                      <span className="truncate font-mono font-black text-slate-700">{row.line}</span>
                      <span className="shrink-0 font-mono font-bold text-slate-400">{total}</span>
                    </div>
                    <StackedBar
                      scale={maxLineTotal}
                      parts={[
                        { key: 'inUse', value: row.inUse, color: COLORS.blue },
                        { key: 'stock', value: stock, color: '#cbd5e1' },
                        { key: 'maint', value: row.maintenance, color: COLORS.amber },
                        { key: 'ng', value: row.order, color: COLORS.violet },
                        { key: 'pm', value: row.pmOverdue, color: COLORS.rose },
                      ]}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex shrink-0 flex-wrap gap-x-2 gap-y-0.5 border-t border-slate-100 pt-1.5 text-[8px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-blue-500" />{ui('inUseShort')}</span>
              <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-slate-300" />{ui('stockShort')}</span>
              <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-amber-500" />{ui('maintShort')}</span>
              <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-violet-500" />{ui('ngShort')}</span>
              <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-rose-500" />{ui('pmShort')}</span>
            </div>
          </div>
        </MiniPanel>

        <MiniPanel
          eyebrow={ui('workflow')}
          title={t('คำขอ / ความกดดัน', 'Requests · flow')}
          icon={TrendingUp}
          action={
            <span className="flex shrink-0 items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[9px] font-black text-indigo-600">
              <ArrowUpRight className="h-3 w-3" /> {trendTotal} · {ui('last7Days')}
            </span>
          }
        >
          <div className="h-full space-y-2 overflow-y-auto pr-1">
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">{ui('status')}</p>
            {summary.requestRows.map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <span className="w-[54px] shrink-0 truncate text-[9px] font-bold text-slate-500">{requestStatus(status)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(count / maxRequestCount) * 100}%`, backgroundColor: STATUS_COLORS[status] || COLORS.slate }}
                  />
                </div>
                <span className="w-5 shrink-0 text-right font-mono text-[9px] font-black tabular-nums text-slate-700">{count}</span>
              </div>
            ))}
            {summary.requestRows.length === 0 ? <EmptyLine>{t('ยังไม่มีคำขอ', 'No requests yet')}</EmptyLine> : null}

            <div className="border-t border-slate-100 pt-2">
              <p className="mb-1 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">{ui('types')}</p>
              <div className="flex flex-wrap gap-1">
                {summary.requestTypeRows.length === 0 ? <EmptyLine>{t('ยังไม่มีคำขอ', 'No requests yet')}</EmptyLine> : null}
                {summary.requestTypeRows.map(([type, count]) => (
                  <span key={type} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                    {requestType(type)} <b className="font-mono text-slate-800">{count}</b>
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2">
              <p className="mb-1 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">{ui('process')}</p>
              <div className="space-y-1.5">
                {summary.processRows.map(([process, count]) => (
                  <div key={process} className="flex items-center gap-2">
                    <span className="w-[58px] shrink-0 truncate text-[9px] font-semibold text-slate-500">{process}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-400" style={{ width: `${(count / maxProcessCount) * 100}%` }} />
                    </div>
                    <span className="w-5 shrink-0 text-right font-mono text-[9px] font-bold text-slate-600">{count}</span>
                  </div>
                ))}
                {summary.processRows.length === 0 ? <EmptyLine>{ui('notAvailable')}</EmptyLine> : null}
              </div>
            </div>
          </div>
        </MiniPanel>

        <MiniPanel eyebrow={ui('focus')} title={t('ต้องโฟกัสตอนนี้', 'Priority radar')} icon={AlertTriangle}>
          <div className="h-full space-y-2 overflow-y-auto pr-1">
            <div>
              <p className="mb-1 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">{ui('dueOverdue')}</p>
              <div className="space-y-1">
                {attention.length === 0 ? <EmptyLine>{t('ไม่มีงานที่ต้องทำตอนนี้', 'Nothing to do right now')}</EmptyLine> : null}
                {attention.slice(0, 5).map((item) => {
                  const Icon = item.icon
                  const urgent = item.urgency < 0
                  return (
                    <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-2 py-1.5">
                      <span className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                        urgent ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600',
                      )}
                      >
                        <Icon className="h-3 w-3" strokeWidth={2.2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[10px] font-black text-slate-800">{item.title}</p>
                        <p className="truncate text-[9px] font-semibold text-slate-400">{item.subtitle || '-'}</p>
                      </div>
                      <span className={cn('shrink-0 text-[9px] font-black', urgent ? 'text-rose-600' : 'text-indigo-600')}>
                        {item.relative}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2">
              <p className="mb-1 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">{ui('topBreakdown')}</p>
              {topBreakdown.length === 0 ? <EmptyLine>{t('ไม่มี Fixture ที่ต้อง breakdown', 'No breakdown hotspots right now')}</EmptyLine> : null}
              <div className="space-y-1.5">
                {topBreakdown.slice(0, 3).map((row, index) => (
                  <div key={row.key} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-mono text-[10px] font-black text-slate-700">
                        <span className="mr-1 text-slate-400">{index + 1}.</span>{row.line}
                      </p>
                      <span className="shrink-0 font-mono text-[10px] font-black text-slate-900">{row.total}</span>
                    </div>
                    <p className="truncate text-[9px] font-semibold text-slate-400">
                      {row.model} · M {row.maintenance} · PM {row.pm} · NG {row.ng}
                    </p>
                    <div className="mt-1">
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
                ))}
              </div>
            </div>
          </div>
        </MiniPanel>

        <MiniPanel eyebrow={ui('activeFleet')} title={t('กระบวนการ & ล่าสุด', 'Process & latest')} icon={Gauge}>
          <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="grid grid-cols-2 gap-1.5">
              {PROCESS_TYPES.map((process) => {
                const count = num(activeByProcess[process.value])
                const max = Math.max(1, ...PROCESS_TYPES.map((item) => num(activeByProcess[item.value])))
                return (
                  <div key={process.value} className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-[9px] font-black text-slate-700">{process.value}</p>
                      <p className="font-mono text-[11px] font-black text-slate-900">{count}</p>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-100 pt-2">
              <p className="mb-1 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">{ui('latestRequests')}</p>
              <div className="space-y-1">
                {recentRequests.length === 0 ? <EmptyLine>{t('ยังไม่มีคำขอ', 'No requests yet')}</EmptyLine> : null}
                {recentRequests.slice(0, 5).map((request, index) => (
                  <div key={`${request.request_id || request._id || 'request'}-${index}`} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[10px] font-black text-indigo-600">{request.request_id || '-'}</p>
                      <p
                        className="truncate text-[9px] font-semibold text-slate-400"
                        title={[requestType(request.type), modelLabel(request), request.line, request.queueSlot ? slotLabel(request.queueSlot) : '', formatDate(request.requestInfo?.date || request.date)].filter(Boolean).join(' · ')}
                      >
                        {[requestType(request.type), modelLabel(request), request.line].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <RequestStatusBadge status={request.status} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-50/70 px-2 py-1.5 text-[9px] font-bold text-indigo-700">
              <Boxes className="h-3 w-3 shrink-0" />
              {t('รวม Fixture ที่ใช้งาน', 'Total in-use fixtures')}: {summary.inUse.toLocaleString()}
            </div>
          </div>
        </MiniPanel>
      </div>
    </div>
  )
}
