/*
 * Dashboard — read-only factory operations overview.
 * All numbers come from the single /api/dashboard response (real API or mock).
 * Expiry uses usage.exp; PM uses pmStartDate/pmDueDate. The two rules stay separate.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Boxes,
  CalendarClock,
  PackageCheck,
  RefreshCw,
  Wrench,
} from 'lucide-react'
import api from '../lib/api'
import { Card, ErrorState, PageHeader, Spinner, StatCard } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { FixtureStatusBadge } from '../components/ui/Badge'
import { cn, formatDate, formatDateTime } from '../lib/format'
import { useLabels, useServerMessage } from '../lib/i18n'
import { setFixtureFocus } from '../lib/navigation'

/* Order-card badge palette: Waiting / Progress / Hold / Verify-Done.
 * Expired → red, In Use → blue, Maintenance → orange, In Stock → emerald. */
const COLORS = {
  red: '#dc2626', // red-600     — Waiting / Expired
  blue: '#2563eb', // blue-600    — Progress / In Use
  orange: '#f97316', // orange-500  — Hold / Maintenance / within 7 days
  emerald: '#059669', // emerald-600 — Verify / Done / In Stock / Normal
  amber: '#f59e0b', // amber-500   — within 3 days
  slate: '#94a3b8', // slate-400   — Other / no data
}

const ACTION_LABELS = {
  Register: ['ลงทะเบียน Fixture', 'Fixture registered'],
  Request: ['สร้างคำขอ', 'Request created'],
  Accept: ['รับงาน', 'Request accepted'],
  Hold: ['พักงาน', 'Request put on hold'],
  Reject: ['ปฏิเสธคำขอ', 'Request rejected'],
  Complete: ['เสร็จคำขอ', 'Request completed'],
  Issue: ['จ่าย Fixture', 'Fixture issued'],
  'Issue (Scan)': ['จ่าย Fixture (สแกน)', 'Fixture issued (scan)'],
  'Issue Spare': ['จ่าย Fixture สำรอง', 'Spare issued'],
  Breakdown: ['แจ้ง Fixture เสีย', 'Breakdown reported'],
  Verify: ['ตรวจสอบ Order', 'Order verified'],
  Return: ['คืน Fixture', 'Fixture returned'],
  'Return (Verify)': ['คืน Fixture (ตรวจสอบ)', 'Fixture returned (verify)'],
  'Maintenance Pending': ['รอ Maintenance', 'Maintenance pending'],
  'Maintenance Done': ['Maintenance เสร็จ', 'Maintenance completed'],
  'Verify (Requester)': ['Verify โดยผู้ขอ', 'Requester verified'],
  'PM Due': ['ครบกำหนด PM', 'PM due'],
  '4M Document': ['แนบเอกสาร 4M', '4M document'],
  '4M Approval Request': ['ขออนุมัติ 4M', '4M approval requested'],
  '4M Approve': ['อนุมัติ 4M', '4M approved'],
  '4M Assign': ['มอบหมาย 4M', '4M assigned'],
  'Plan PM': ['วางแผน PM', 'PM planned'],
  'Start PM': ['เริ่มทำ PM', 'PM started'],
  'PM Approve': ['Admin อนุมัติ PM', 'PM approved'],
  'PM Reject': ['Admin ปฏิเสธ PM', 'PM rejected'],
  'PM OK': ['PM เสร็จ (Verify OK)', 'PM completed'],
  'PM NG': ['PM ไม่ผ่าน (Verify NG)', 'PM failed'],
  Order: ['เปลี่ยนสถานะ Order', 'Order status changed'],
  Edit: ['แก้ไขข้อมูล Fixture', 'Fixture edited'],
  Delete: ['ลบ Fixture', 'Fixture deleted'],
}

const TONE_DOTS = {
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  slate: 'bg-slate-400',
}

const ACTION_TONES = {
  Register: 'emerald',
  Issue: 'blue',
  'Issue (Scan)': 'blue',
  'Issue Spare': 'blue',
  Return: 'emerald',
  'Return (Verify)': 'emerald',
  'Maintenance Pending': 'orange',
  'Maintenance Done': 'orange',
  'Verify (Requester)': 'emerald',
  'PM OK': 'emerald',
  'PM Approve': 'emerald',
  'PM NG': 'red',
  'PM Reject': 'red',
}

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const pct = (value, total) => (total > 0 ? Math.round((num(value) / total) * 100) : 0)

const remainingLabel = (days, t, ui) => {
  if (days === null || days === undefined || !Number.isFinite(Number(days))) return ui('noDate')
  const value = Number(days)
  if (value < 0) return t(`เกิน ${Math.abs(value)} วัน`, `${Math.abs(value)} days overdue`)
  if (value === 0) return ui('dueToday')
  return t(`อีก ${value} วัน`, `${value} days left`)
}

const severityLabel = (severity, t, ui, fixtureStatus) => {
  if (severity === 'expired') return ui('expiredKpi')
  if (severity === 'expiring3') return ui('within3Days')
  if (severity === 'pmOverdue') return ui('pmOverdue')
  if (severity === 'maintenance') return fixtureStatus('Maintenance')
  return t('สถานะผิดปกติ', 'Abnormal status')
}

const activityLabel = (action, t) => {
  const pair = ACTION_LABELS[action]
  return pair ? t(pair[0], pair[1]) : action || '-'
}

/* ------------------------------ Small parts ------------------------------ */

const MiniPanel = ({ eyebrow, title, icon: Icon, action, children, className }) => (
  <Card className={cn('flex min-h-0 min-w-0 flex-col rounded-2xl border-slate-200/80 bg-white p-3 shadow-sm', className)}>
    <div className="mb-2 flex shrink-0 items-center gap-2">
      {Icon ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="text-[8px] font-black uppercase tracking-[0.14em] text-blue-600">{eyebrow}</p> : null}
        <h2 className="truncate text-[11px] font-black text-slate-900">{title}</h2>
      </div>
      {action}
    </div>
    <div className="min-h-0 flex-1">{children}</div>
  </Card>
)

const DonutChart = ({ segments, total, centerLabel }) => {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const lengthOf = (segment) => (total > 0 ? (num(segment.value) / total) * circumference : 0)

  return (
    <div className="relative h-[142px] w-[142px] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={centerLabel}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="11" />
        {segments.map((segment, index) => {
          const length = lengthOf(segment)
          const dash = `${length} ${circumference - length}`
          const offset = -segments.slice(0, index).reduce((sum, item) => sum + lengthOf(item), 0)
          return (
            <circle
              key={segment.key}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="11"
              strokeDasharray={dash}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
            />
          )
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[19px] font-black leading-none text-slate-900">
          {total.toLocaleString()}
        </span>
        <span className="mt-0.5 max-w-[92px] text-center text-[8px] font-bold uppercase leading-tight text-slate-400">
          {centerLabel}
        </span>
      </div>
    </div>
  )
}

const EmptyLine = ({ children }) => (
  <p className="px-2 py-6 text-center text-[10px] font-semibold text-slate-400">{children}</p>
)

/* --------------------------------- Page -------------------------------- */

export default function DashboardPage({ onNavigate }) {
  const { t, ui, fixtureStatus, pmState } = useLabels()
  const sm = useServerMessage()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (initial = false) => {
    try {
      if (initial) setLoading(true)
      else setRefreshing(true)
      setError('')
      setData(await api.dashboard())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(true)
  }, [load])

  const openFixtures = useCallback(
    (focus = {}) => {
      setFixtureFocus(focus)
      onNavigate?.('fixtures')
    },
    [onNavigate],
  )

  const summary = useMemo(() => {
    const counts = data?.counts || {}
    const total = num(data?.total)
    const expired = num(data?.expiryStats?.expired)
    const pmAlerts = data?.pmAlerts || []
    const pmStateCounts = data?.pmStateCounts || {}
    return {
      total,
      inUse: num(counts['In Use']),
      stock: num(counts['In Stock']),
      maintenance: num(counts.Maintenance),
      expiringSoon: num(data?.expiryStats?.expiringIn3Days),
      expired,
      attentionCount: num(data?.attentionCount),
      pmOverdue: pmAlerts.filter(
        (row) => num(row.pmOverdueDays) > 0 || (row.pmStates || []).some((state) => state === 'over-due' || state === 'overdue-remind'),
      ).length,
      pmOnDue: num(pmStateCounts['on-due']),
      pmPreAlert: num(pmStateCounts['pre-alert']),
    }
  }, [data])

  const statusSegments = useMemo(() => {
    const source = data?.statusOverview || {}
    return [
      { key: 'expired', label: ui('expiredKpi'), value: num(source.expired), color: COLORS.red, focus: { expiry: 'expired' } },
      { key: 'inUse', label: fixtureStatus('In Use'), value: num(source.inUse), color: COLORS.blue, focus: { status: 'In Use' } },
      { key: 'inStock', label: fixtureStatus('In Stock'), value: num(source.inStock), color: COLORS.emerald, focus: { status: 'In Stock' } },
      { key: 'maintenance', label: fixtureStatus('Maintenance'), value: num(source.maintenance), color: COLORS.orange, focus: { status: 'Maintenance' } },
      { key: 'other', label: t('อื่นๆ', 'Other'), value: num(source.other), color: COLORS.slate, focus: {} },
    ]
  }, [data, fixtureStatus, t, ui])

  const expiryRows = useMemo(() => {
    const source = data?.expiryOverview || {}
    return [
      { key: 'expired', label: ui('expiredKpi'), value: num(source.expired), color: COLORS.red, focus: { expiry: 'expired' } },
      { key: 'within3', label: ui('within3Days'), value: num(source.within3), color: COLORS.amber, focus: { expiry: 'expiring3' } },
      { key: 'within7', label: ui('within7Days'), value: num(source.within7), color: COLORS.orange, focus: { expiry: 'expiring7' } },
      { key: 'normal', label: ui('normal'), value: num(source.normal), color: COLORS.emerald, focus: {} },
    ]
  }, [data, ui])

  const attentionRows = useMemo(() => (data?.attentionFixtures || []).slice(0, 8), [data])
  const activities = useMemo(
    () =>
      (data?.recentHistory || []).slice(0, 8).map((item, index) => ({
        id: `${item._id || item.sn || item.action || 'activity'}-${index}`,
        time: formatDateTime(item.date),
        sn: item.sn || '-',
        action: activityLabel(item.action, t),
        tone: ACTION_TONES[item.action] || 'slate',
        detail: item.detail || '',
        user: [item.name, item.lastname].filter(Boolean).join(' ') || item.empId || '-',
        ref: item.request_id || item.pm_run_id || '-',
      })),
    [data, t],
  )

  if (loading) return <Spinner label={t('กำลังโหลดข้อมูล…', 'Loading…')} />
  if (error) return <ErrorState message={sm(error)} onRetry={() => load(false)} />
  if (!data) return null

  const kpis = [
    { label: ui('totalFixtures'), value: summary.total, hint: ui('allLines'), icon: Boxes, tone: 'blue', focus: {} },
    { label: ui('inUseKpi'), value: summary.inUse, hint: t(`${pct(summary.inUse, summary.total)}% ของทั้งหมด`, `${pct(summary.inUse, summary.total)}% of fleet`), icon: Activity, tone: 'blue', focus: { status: 'In Use' } },
    { label: ui('inStockKpi'), value: summary.stock, hint: ui('readyToIssue'), icon: PackageCheck, tone: 'emerald', focus: { status: 'In Stock' } },
    { label: ui('maintenanceKpi'), value: summary.maintenance, hint: ui('inRepairQueue'), icon: Wrench, tone: 'orange', focus: { status: 'Maintenance' } },
    { label: ui('expired3Kpi'), value: summary.expiringSoon, hint: ui('expiringSoonHint'), icon: CalendarClock, tone: 'amber', focus: { expiry: 'expiring3' } },
    { label: ui('expiredKpi'), value: summary.expired, hint: ui('alreadyExpiredHint'), icon: AlertTriangle, tone: 'red', focus: { expiry: 'expired' } },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={ui('dashboard')}
        icon={Boxes}
        title={t('ภาพรวมการดำเนินงาน Fixture', 'Fixture operations overview')}
        description={t(
          'สถานะ Fixture, กำหนด PM/หมดอายุ และงานที่ต้องโฟกัสแบบเรียลไทม์',
          'Live fixture status, PM/expiry dates, and the work that needs attention',
        )}
        actions={
          <Button variant="secondary" icon={RefreshCw} disabled={refreshing} onClick={() => load(false)}>
            {ui('refresh')}
          </Button>
        }
      />

      {/* 6 KPI cards */}
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value.toLocaleString()}
            hint={kpi.hint}
            icon={kpi.icon}
            tone={kpi.tone}
            onClick={() => openFixtures(kpi.focus)}
            className="p-3 sm:p-3.5"
          />
        ))}
      </div>

      {/* Status donut + expiration / PM overview */}
      <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <MiniPanel eyebrow={ui('status')} title={ui('statusOverview')} icon={Boxes} className="min-h-[210px]">
          <div className="flex h-full flex-col items-center gap-4 sm:flex-row">
            <DonutChart segments={statusSegments} total={summary.total} centerLabel={ui('totalFixtures')} />
            <div className="grid w-full flex-1 grid-cols-1 gap-1.5">
              {statusSegments.map((segment) => (
                <button
                  key={segment.key}
                  type="button"
                  onClick={() => openFixtures(segment.focus)}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-100 bg-white px-2 py-1.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/70"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-600">{segment.label}</span>
                  <span className="font-mono text-[10px] font-black text-slate-900">{segment.value.toLocaleString()}</span>
                  <span className="w-8 text-right text-[9px] font-bold text-slate-400">{pct(segment.value, summary.total)}%</span>
                </button>
              ))}
            </div>
          </div>
        </MiniPanel>

        <MiniPanel eyebrow={ui('expiryPmOverview')} title={ui('expiryPmOverview')} icon={CalendarClock} className="min-h-[210px]">
          <div className="flex h-full flex-col">
            <div className="space-y-2">
              {expiryRows.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => openFixtures(row.focus)}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-slate-50"
                >
                  <span className="w-[104px] shrink-0 truncate text-[10px] font-bold text-slate-600 sm:w-[126px]">{row.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pct(row.value, summary.total)}%`, backgroundColor: row.color }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right font-mono text-[10px] font-black text-slate-800">
                    {row.value.toLocaleString()}
                  </span>
                  <span className="w-7 shrink-0 text-right text-[9px] font-bold text-slate-400">{pct(row.value, summary.total)}%</span>
                </button>
              ))}
            </div>
            <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[9px] font-semibold text-slate-500">
              <span>{ui('pmOverdue')}: <b className="font-mono text-rose-600">{summary.pmOverdue}</b></span>
              <span>{pmState('on-due')}: <b className="font-mono text-amber-600">{summary.pmOnDue}</b></span>
              <span>{pmState('pre-alert')}: <b className="font-mono text-indigo-600">{summary.pmPreAlert}</b></span>
            </div>
          </div>
        </MiniPanel>
      </div>

      {/* Attention + recent activity */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
        <MiniPanel
          eyebrow={t('ความเร่งด่วน', 'Priority')}
          title={ui('attentionRequired')}
          icon={AlertTriangle}
          className="min-h-[260px]"
          action={
            <button
              type="button"
              onClick={() => openFixtures({ sns: attentionRows.map((row) => row.sn) })}
              className="shrink-0 rounded-lg px-2 py-1 text-[9px] font-black text-blue-600 hover:bg-blue-50"
            >
              {ui('viewAll')}
            </button>
          }
        >
          <div className="h-full overflow-auto rounded-lg border border-slate-100">
            {attentionRows.length === 0 ? (
              <EmptyLine>{ui('noAttention')}</EmptyLine>
            ) : (
              <table className="w-full border-collapse text-left text-[10px]">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">
                  <tr>
                    <th className="px-2 py-1.5">{ui('fixtureId')}</th>
                    <th className="px-2 py-1.5">{ui('line')}</th>
                    <th className="px-2 py-1.5">{ui('model')}</th>
                    <th className="px-2 py-1.5">{ui('currentStatus')}</th>
                    <th className="px-2 py-1.5">{ui('pmExpDate')}</th>
                    <th className="px-2 py-1.5">{ui('remainingDays')}</th>
                    <th className="px-2 py-1.5">{ui('action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attentionRows.map((row) => (
                    <tr key={`${row.sn}-${row.severity}`} className="hover:bg-slate-50/70">
                      <td className="px-2 py-1.5">
                        <p className="font-mono font-black text-slate-800">{row.sn}</p>
                        <p className="truncate text-[8px] font-bold text-slate-400">
                          {severityLabel(row.severity, t, ui, fixtureStatus)}
                        </p>
                      </td>
                      <td className="max-w-[72px] truncate px-2 py-1.5 font-mono text-slate-600" title={row.line}>{row.line || '-'}</td>
                      <td className="max-w-[88px] truncate px-2 py-1.5 font-mono text-slate-600" title={row.model}>{row.model || '-'}</td>
                      <td className="px-2 py-1.5">
                        <FixtureStatusBadge status={row.status} className="px-1.5 py-0.5 text-[8px]" />
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-slate-600">
                        {formatDate(row.date)}
                        <span className="ml-1 text-[8px] font-bold text-slate-400">{row.dateType === 'pm' ? 'PM' : 'Exp'}</span>
                      </td>
                      <td className={cn(
                        'whitespace-nowrap px-2 py-1.5 font-mono font-black',
                        num(row.daysLeft) < 0 ? 'text-rose-600' : num(row.daysLeft) <= 3 ? 'text-amber-600' : 'text-slate-600',
                      )}
                      >
                        {remainingLabel(row.daysLeft, t, ui)}
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => openFixtures({ sn: row.sn })}
                          className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-blue-600 hover:border-blue-200 hover:bg-blue-50"
                        >
                          {ui('view')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </MiniPanel>

        <MiniPanel
          eyebrow={t('ประวัติการใช้งาน', 'Audit trail')}
          title={ui('recentActivity')}
          icon={Activity}
          className="min-h-[260px]"
          action={
            <button
              type="button"
              onClick={() => onNavigate?.('history')}
              className="shrink-0 rounded-lg px-2 py-1 text-[9px] font-black text-blue-600 hover:bg-blue-50"
            >
              {ui('viewAll')}
            </button>
          }
        >
          <div className="h-full overflow-auto rounded-lg border border-slate-100">
            {activities.length === 0 ? (
              <EmptyLine>
                {ui('noActivity')} · {num(data.historyCount)} {t('รายการในระบบ', 'records in system')}
              </EmptyLine>
            ) : (
              <table className="w-full border-collapse text-left text-[10px]">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">
                  <tr>
                    <th className="px-2 py-1.5">{ui('timestamp')}</th>
                    <th className="px-2 py-1.5">{ui('fixtureId')}</th>
                    <th className="px-2 py-1.5">{ui('recentActivity')}</th>
                    <th className="px-2 py-1.5">{ui('user')}</th>
                    <th className="px-2 py-1.5">{ui('requestOrder')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activities.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[9px] text-slate-500">{item.time}</td>
                      <td className="px-2 py-1.5 font-mono font-black text-slate-800">{item.sn}</td>
                      <td className="max-w-[180px] px-2 py-1.5">
                        <span className="font-bold text-slate-700">
                          <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle', TONE_DOTS[item.tone] || TONE_DOTS.slate)} />
                          {item.action}
                        </span>
                        {item.detail ? (
                          <p className="truncate text-[8px] text-slate-400" title={item.detail}>{item.detail}</p>
                        ) : null}
                      </td>
                      <td className="max-w-[92px] truncate px-2 py-1.5 text-slate-600" title={item.user}>{item.user}</td>
                      <td className="max-w-[110px] truncate px-2 py-1.5 font-mono text-[9px] text-blue-600" title={item.ref}>{item.ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </MiniPanel>
      </div>
    </div>
  )
}
