import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Boxes,
  FileClock,
  History as HistoryIcon,
  RefreshCw,
  Search,
  Tag,
  X,
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
import { Badge } from '../components/ui/Badge'
import { Input, NativeSelect } from '../components/ui/Field'
import Button from '../components/ui/Button'
import { formatDateTime, formatTime, parseDate } from '../lib/format'
import { useLabels, useServerMessage } from '../lib/i18n'

const ACTION_TONE = {
  Register: 'blue',
  Request: 'blue',
  Accept: 'blue',
  Issue: 'amber',
  'Issue Spare': 'amber',
  Breakdown: 'orange',
  Verify: 'emerald',
  Return: 'emerald',
  Edit: 'slate',
  Delete: 'red',
  'Plan PM': 'orange',
  '4M Approve': 'purple',
  '4M Assign': 'purple',
  'PM OK': 'emerald',
  'PM NG': 'red',
  Order: 'purple',
}

const ACTION_FILTERS = [
  'Register',
  'Request',
  'Accept',
  'Issue',
  'Issue Spare',
  'Breakdown',
  'Verify',
  'Return',
  'Edit',
  'Plan PM',
  '4M Approve',
  '4M Assign',
  'PM OK',
  'PM NG',
  'Order',
  'Delete',
]

const dateKey = (value) => {
  const date = parseDate(value)
  if (!date) return 'unknown'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

const dateLabel = (key, t) => {
  if (key === 'unknown') return t('ไม่ระบุวันที่', 'Unknown date')
  const date = new Date(`${key}T00:00:00`)
  if (Number.isNaN(date.getTime())) return key
  const today = new Date()
  const todayKey = dateKey(today)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === todayKey) return t('วันนี้', 'Today')
  if (key === dateKey(yesterday)) return t('เมื่อวาน', 'Yesterday')
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export default function HistoryPage() {
  const { t } = useLabels()
  const sm = useServerMessage()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [applied, setApplied] = useState({ q: '', action: '' })

  const actionLabel = (value) => {
    const labels = {
      Register: t('ลงทะเบียน', 'Register'),
      Request: t('คำขอ', 'Request'),
      Accept: t('รับงาน', 'Accept'),
      Issue: t('จ่าย', 'Issue'),
      'Issue Spare': t('จ่าย Spare', 'Issue Spare'),
      Breakdown: t('เสีย', 'Breakdown'),
      Verify: t('ตรวจสอบ', 'Verify'),
      Return: t('คืน', 'Return'),
      Edit: t('แก้ไข', 'Edit'),
      'Plan PM': t('วางแผน PM', 'Plan PM'),
      '4M Approve': t('อนุมัติ 4M', '4M Approve'),
      '4M Assign': t('มอบหมาย 4M', '4M Assign'),
      'PM OK': t('PM OK', 'PM OK'),
      'PM NG': t('PM NG', 'PM NG'),
      Order: t('Order', 'Order'),
      Delete: t('ลบ', 'Delete'),
    }
    return labels[value] || value
  }

  const load = useCallback(async (filters) => {
    try {
      setLoading(true)
      setError('')
      const data = await api.history({ limit: 300, q: filters.q, action: filters.action })
      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(applied)
  }, [applied, load])

  const submit = (event) => {
    event.preventDefault()
    setApplied({ q: query.trim(), action })
  }

  const reset = () => {
    setQuery('')
    setAction('')
    setApplied({ q: '', action: '' })
  }

  const filtered = useMemo(() => {
    /* server already filters, this keeps the list stable when typing */
    return rows.filter((row) => (!action || row.action === action))
  }, [rows, action])

  const groups = useMemo(() => {
    const map = new Map()
    for (const item of filtered) {
      const key = dateKey(item.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    return [...map.entries()]
  }, [filtered])

  const stats = useMemo(() => {
    const todayKey = dateKey(new Date())
    const today = filtered.filter((item) => dateKey(item.date) === todayKey).length
    const fixtures = new Set(filtered.map((item) => item.sn).filter(Boolean)).size
    const actions = new Set(filtered.map((item) => item.action).filter(Boolean)).size
    return { today, fixtures, actions }
  }, [filtered])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('บันทึก', 'Records')}
        icon={HistoryIcon}
        title={t('ประวัติ', 'History')}
        
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={() => load(applied)} disabled={loading}>
            {t('รีเฟรช', 'Refresh')}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('รายการที่แสดง', 'Records shown')}
          value={filtered.length}
          hint={t('สูงสุด 300 รายการล่าสุด', 'Latest 300 records max')}
          icon={HistoryIcon}
          tone="blue"
        />
        <StatCard label={t('วันนี้', 'Today')} value={stats.today}  icon={FileClock} tone="emerald" />
        <StatCard label={t('Fixture ที่เกี่ยวข้อง', 'Related Fixtures')} value={stats.fixtures}  icon={Boxes} tone="orange" />
        <StatCard label={t('Action ที่เกิดขึ้น', 'Actions recorded')} value={stats.actions}  icon={Tag} tone="purple" />
      </div>

      <Card className="p-4 sm:p-5">
        <SectionHeader
          icon={HistoryIcon}
          title={applied.q ? t(`ผลการค้นหา “${applied.q}”`, `Search results for “${applied.q}”`) : t('ประวัติการทำรายการ', 'Transaction History')}
          description={
            applied.action
              ? `${t('กรองเฉพาะ action: ', 'Filter action: ')}${actionLabel(applied.action)}`
              : t('ค้นหาได้จาก SN, Request ID, Action, รายละเอียด หรือชื่อผู้ทำรายการ', 'Search by SN, Request ID, Action, details or operator name')
          }
          className="mb-4"
        />
        <form onSubmit={submit} className="grid gap-2.5 lg:grid-cols-[1fr_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10"
              placeholder={t('ค้นหา SN / Request ID / รายละเอียด / ชื่อ…', 'Search SN / Request ID / details / name…')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <NativeSelect value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="">{t('ทุก Action', 'All Actions')}</option>
            {ACTION_FILTERS.map((item) => (
              <option key={item} value={item}>
                {actionLabel(item)}
              </option>
            ))}
          </NativeSelect>
          <div className="flex gap-2">
            <Button type="submit" icon={Search} disabled={loading}>
              {t('ค้นหา', 'Search')}
            </Button>
            {applied.q || applied.action ? (
              <Button type="button" variant="ghost" icon={X} onClick={reset}>
                {t('ล้าง', 'Clear')}
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {loading ? (
        <Card>
          <Spinner label={t('กำลังโหลดประวัติ…', 'Loading history…')} />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={sm(error)} onRetry={() => load(applied)} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Activity}
            title={applied.q || applied.action ? t('ไม่พบประวัติที่ตรงกับเงื่อนไข', 'No matching history found') : t('ยังไม่มีประวัติการทำรายการ', 'No transaction history yet')}
            
            action={
              applied.q || applied.action ? (
                <Button variant="secondary" onClick={reset}>
                  {t('ล้างตัวกรอง', 'Clear filters')}
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([key, items]) => (
            <Card key={key} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {dateLabel(key, t)}
                </p>
                <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                  {items.length} {t('รายการ', 'records')}
                </span>
              </div>
              <ol className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item._id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Activity className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={ACTION_TONE[item.action] || 'slate'}>{item.action ? actionLabel(item.action) : '-'}</Badge>
                        {item.sn ? (
                          <button
                            type="button"
                            onClick={() => {
                              setQuery(item.sn)
                              setApplied({ q: item.sn, action })
                            }}
                            className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                            title={t('กรองเฉพาะ SN นี้', 'Filter by this SN')}
                          >
                            {item.sn}
                          </button>
                        ) : null}
                        {item.request_id ? (
                          <button
                            type="button"
                            onClick={() => {
                              setQuery(item.request_id)
                              setApplied({ q: item.request_id, action })
                            }}
                            className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-700 hover:bg-blue-100"
                            title={t('กรองเฉพาะ Request นี้', 'Filter by this Request')}
                          >
                            {item.request_id}
                          </button>
                        ) : null}
                        {item.line || item.model ? (
                          <span className="text-[10px] font-semibold text-slate-400">
                            {item.line || '-'}
                            {item.model ? ` · ${item.model}` : ''}
                          </span>
                        ) : null}
                        <span className="ml-auto font-mono text-[10px] text-slate-400">
                          {formatTime(item.date)}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{item.detail || '-'}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {[item.name, item.lastname].filter(Boolean).join(' ') || item.empId || '-'}
                        {item.empId && (item.name || item.lastname) ? ` · ${item.empId}` : ''}
                        {' · '}
                        {formatDateTime(item.date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
