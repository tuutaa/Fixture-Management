import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Boxes,
  CalendarClock,
  ClipboardList,
  Factory,
  FilePlus2,
  LayoutDashboard,
  PackageCheck,
  ShoppingCart,
  Timer,
  Wrench,
} from 'lucide-react'
import api from '../lib/api'
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionHeader,
  Spinner,
  StatCard,
} from '../components/ui/Card'
import { Badge, RequestStatusBadge } from '../components/ui/Badge'
import { formatDateTime } from '../lib/format'
import { useLabels, useServerMessage } from '../lib/i18n'

const PM_TONE = {
  tracked: 'slate',
  'pre-alert': 'amber',
  'overdue-remind': 'orange',
  'usage-remind': 'orange',
  'on-due': 'blue',
  'over-due': 'red',
}

const STATUS_CARDS = [
  { key: 'In Stock', label: 'In Stock', icon: PackageCheck, tone: 'emerald' },
  { key: 'In Use', label: 'In Use', icon: Activity, tone: 'blue' },
  { key: 'Maintenance', label: 'Maintenance', icon: Wrench, tone: 'orange' },
  { key: 'Scrape', label: 'Need Scrape', icon: Boxes, tone: 'red' },
  { key: 'PR', label: 'Need PR', icon: ShoppingCart, tone: 'red' },
  { key: 'PR Ready', label: 'PR Ready', icon: ShoppingCart, tone: 'amber' },
  { key: 'Replaced', label: 'Replaced', icon: Boxes, tone: 'purple' },
]

export default function DashboardPage() {
  const { t, fixtureStatus, pmState, requestType } = useLabels()
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

  useEffect(() => {
    load()
  }, [load])

  const lineRows = useMemo(() => {
    const lines = Object.entries(data?.lines || {})
    const max = Math.max(1, ...lines.map(([, count]) => count))
    return lines.sort((a, b) => b[1] - a[1]).map(([line, count]) => ({ line, count, max, inUse: data?.activeByLine?.[line] || 0 }))
  }, [data])

  if (loading) return <Spinner label={t('กำลังโหลดข้อมูล…', 'Loading…')} />
  if (error) return <ErrorState message={sm(error)} onRetry={load} />
  if (!data) return null

  const counts = data.counts || {}
  const orderCount = data.orderCount || 0

  return (
    <div className="space-y-2">
      <PageHeader eyebrow={t('ภาพรวม', 'Overview')} icon={LayoutDashboard} title={t('แดชบอร์ด', 'Dashboard')} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('Fixture ทั้งหมด', 'Total Fixtures')} value={Number(data.total || 0).toLocaleString()} hint={`${Object.keys(data.lines || {}).length} ${t('Line', 'Line')}`} icon={Boxes} tone="blue" />
        <StatCard label={fixtureStatus('In Use')} value={Number(counts['In Use'] || 0).toLocaleString()} hint={t('ติดตั้งใช้งานอยู่ที่ไลน์ผลิต', 'Installed and in use on the production line')} icon={Activity} tone="red" />
        <StatCard label={t('PM และซ่อมบำรุง', 'PM & Maintenance')} value={Number(counts.Maintenance || 0).toLocaleString()} hint={t('รอ Verify + Record', 'Awaiting Verify + Record')} icon={Wrench} tone="amber" />
        <StatCard label={t('Order ค้าง', 'Pending Orders')} value={orderCount.toLocaleString()} hint={t('ต้อง Scrape · PR · เปลี่ยนรุ่น', 'Need Scrape · PR · Replacement')} icon={ShoppingCart} tone="purple" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {STATUS_CARDS.map((item) => (
          <div key={item.key} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">{fixtureStatus(item.key)}</span>
            <span className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-slate-900">{Number(counts[item.key] || 0).toLocaleString()}</span>
              <item.icon className="h-4 w-4 text-slate-300" />
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-3 sm:p-4">
          <SectionHeader icon={ClipboardList} title={t('คำขอตาม Line / Model / Process', 'Requests by Line / Model / Process')} className="mb-2" />
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { title: t('ตาม Line', 'By Line'), data: data.byLine },
              { title: t('ตาม Model', 'By Model'), data: data.byModel },
              { title: t('ตาม Process', 'By Process'), data: data.byProcess },
            ].map((group) => {
              const rows = Object.entries(group.data || {}).sort((a, b) => b[1] - a[1]).slice(0, 6)
              const max = Math.max(1, ...rows.map(([, count]) => count))
              return (
                <div key={group.title}>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.title}</p>
                  {rows.length === 0 ? (
                    <p className="text-[11px] text-slate-400">{t('ยังไม่มีข้อมูล', 'No data yet')}</p>
                  ) : (
                    <div className="space-y-2">
                      {rows.map(([label, count]) => (
                        <div key={label}>
                          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                            <span className="truncate font-semibold text-slate-600">{label}</span>
                            <span className="font-mono text-slate-400">{count}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(8, (count / max) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <SectionHeader icon={CalendarClock} title={t('วันครบกำหนด', 'Due date')} className="mb-2" />
          {(data.dueRequests || []).length === 0 ? (
            <span className="text-[11px] text-slate-400">{t('ไม่มีวันครบกำหนด', 'No due date')}</span>
          ) : (
            <div className="space-y-2">
              {data.dueRequests.map((request) => (
                <div key={request.request_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-700">{request.request_id} · {request.line || '-'}</p>
                    <p className="truncate text-[10px] text-slate-400">{requestType(request.type)} · {request.currentModel || '-'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[11px] font-bold text-slate-700">{request.dueDate}</p>
                    <p className={`text-[10px] font-semibold ${request.daysLeft < 0 ? 'text-red-600' : request.daysLeft <= 3 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {request.daysLeft < 0
                        ? t(`เกิน ${Math.abs(request.daysLeft)} วัน`, `${Math.abs(request.daysLeft)} days overdue`)
                        : t(`อีก ${request.daysLeft} วัน`, `${request.daysLeft} days left`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-3 sm:p-4">
        <SectionHeader icon={Factory} title={t('Fixture ที่ใช้งานจริงในไลน์ผลิต', 'Actual fixtures in production line')} className="mb-2" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: t('Line', 'Line'), data: data.activeByLine },
            { title: t('Model', 'Model'), data: data.activeByModel },
            { title: t('Process', 'Process'), data: data.activeByProcess },
          ].map((group) => {
            const rows = Object.entries(group.data || {}).sort((a, b) => b[1] - a[1]).slice(0, 6)
            const total = Object.values(group.data || {}).reduce((sum, value) => sum + value, 0)
            return (
              <div key={group.title}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.title}</p>
                  <Badge tone="blue">{total} {fixtureStatus('In Use')}</Badge>
                </div>
                {rows.length === 0 ? (
                  <p className="text-[11px] text-slate-400">{t('ไม่มี Fixture ที่ใช้งาน', 'No fixtures in use')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {rows.map(([label, count]) => (
                      <div key={label} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate font-medium text-slate-600">{label}</span>
                        <span className="font-mono font-bold text-slate-500">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-3 sm:p-4">
          <SectionHeader icon={Boxes} title={t('Fixture ตาม Line', 'Fixtures by Line')} className="mb-2" />
          {lineRows.length === 0 ? (
            <EmptyState icon={Boxes} title={t('ยังไม่มี Fixture', 'No fixtures yet')} />
          ) : (
            <div className="space-y-2">
              {lineRows.map((row) => (
                <div key={row.line}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700">{row.line}</span>
                    <span className="font-mono text-slate-400">{row.count} {t('ทั้งหมด', 'total')} · <span className="text-blue-600">{row.inUse} {fixtureStatus('In Use')}</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(6, (row.count / row.max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-3 sm:p-4">
          <SectionHeader icon={ClipboardList} title={t('คำขอล่าสุด', 'Recent Requests')} className="mb-2" />
          {data.recentRequests.length === 0 ? (
            <EmptyState icon={FilePlus2} title={t('ยังไม่มีคำขอ', 'No requests yet')} />
          ) : (
            <div className="space-y-1.5">
              {data.recentRequests.map((request) => (
                <div key={request.request_id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-black text-blue-700">{request.request_id}</p>
                    <p className="truncate text-[11px] font-semibold text-slate-600">{requestType(request.type)}{request.currentModel ? ` · ${request.currentModel}` : ''}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{request.line || '-'} · {formatDateTime(request.requestInfo?.date)}</p>
                  </div>
                  <RequestStatusBadge status={request.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-3 sm:p-4">
          <SectionHeader icon={Timer} title={t('รายการตรวจ PM', 'PM Checklist')} className="mb-2" />
          {data.pmAlerts.length === 0 ? (
            <EmptyState icon={Timer} title={t('ไม่มีแจ้งเตือน PM', 'No PM alerts')} />
          ) : (
            <div className="space-y-1.5">
              {data.pmAlerts.map((fixture) => (
                <div key={fixture.sn} className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-black text-slate-800">{fixture.sn}</p>
                      <p className="truncate text-[11px] text-slate-500">{fixture.line} · {fixture.model} · {fixture.type || '-'}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {fixture.pmStates.map((state) => (
                        <Badge key={state} tone={PM_TONE[state] || 'slate'}>{pmState(state)}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-3 sm:p-4">
          <SectionHeader icon={ClipboardList} title={t('ประวัติการบันทึกล่าสุด', 'Recent Record History')} className="mb-2" />
          {data.recentHistory.length === 0 ? (
            <EmptyState icon={Activity} title={t('ยังไม่มีประวัติ', 'No history yet')} />
          ) : (
            <ol className="relative ml-2 space-y-2 border-l border-slate-200 pl-5">
              {data.recentHistory.map((item) => (
                <li key={item._id} className="relative">
                  <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 ring-1 ring-blue-100" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">{item.action}</Badge>
                    {item.sn ? <span className="font-mono text-[11px] font-bold text-slate-700">{item.sn}</span> : null}
                    <span className="ml-auto text-[10px] text-slate-400">{formatDateTime(item.date)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{item.detail || '-'}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  )
}
