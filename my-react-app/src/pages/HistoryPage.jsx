import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Boxes,
  FileClock,
  History as HistoryIcon,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Wrench,
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
import { HISTORY_SECTION_ACTIONS } from '../lib/constants'

const ACTION_TONE = {
  Register: 'blue',
  Request: 'blue',
  Accept: 'blue',
  Hold: 'amber',
  Reject: 'red',
  Complete: 'emerald',
  Issue: 'amber',
  'Issue (Scan)': 'amber',
  'Issue Spare': 'amber',
  Breakdown: 'orange',
  Verify: 'emerald',
  Return: 'emerald',
  'Return (Verify)': 'emerald',
  Edit: 'slate',
  Delete: 'red',
  Order: 'purple',
  'PM Due': 'orange',
  '4M Document': 'red',
  '4M Approval Request': 'amber',
  '4M Approve': 'purple',
  '4M Assign': 'purple',
  'Plan PM': 'purple',
  'Start PM': 'purple',
  'PM Approve': 'emerald',
  'PM Reject': 'red',
  'PM OK': 'emerald',
  'PM NG': 'red',
}

const FOUR_M_ACTIONS = new Set(['4M Document', '4M Approval Request', '4M Approve', '4M Assign'])
const RUN_ACTIONS = new Set(['Start PM', 'PM Approve', 'PM OK', 'PM NG'])
const DAY_MS = 24 * 60 * 60 * 1000

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

const timeValue = (item) => {
  const value = new Date(item?.date)
  return Number.isNaN(value.getTime()) ? 0 : value.getTime()
}

/* New PM events carry pm_run_id. Older events do not, so the fallback groups
 * them by Line + Model + PM date (or the day the PM was started). */
const pmRunStartDate = (item) => {
  if (String(item?.action) === 'Start PM') {
    const match = String(item?.detail || '').match(/เริ่มทำ PM\s+(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
  }
  return dateKey(item?.date)
}

const pmRunKeyOf = (item) => {
  const line = String(item?.line ?? '').trim() || 'N/A'
  const model = String(item?.model ?? '').trim() || 'N/A'
  return `${line}|${model}|${pmRunStartDate(item)}`
}

const sameLineModel = (item, example) =>
  String(item?.line ?? '').trim() === String(example?.line ?? '').trim() &&
  String(item?.model ?? '').trim() === String(example?.model ?? '').trim()

export default function HistoryPage() {
  const { t } = useLabels()
  const sm = useServerMessage()
  const [section, setSection] = useState('order')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [applied, setApplied] = useState({ q: '', action: '', section: 'order' })

  const actionOptions = HISTORY_SECTION_ACTIONS[section] || []

  const actionLabel = (value) => {
    const labels = {
      Register: t('ลงทะเบียน', 'Register'),
      Request: t('สร้างคำขอ', 'Request'),
      Accept: t('รับงาน', 'Accept'),
      Hold: t('พักงาน', 'Hold'),
      Reject: t('ปฏิเสธ', 'Reject'),
      Complete: t('เสร็จคำขอ', 'Complete'),
      Issue: t('จ่าย', 'Issue'),
      'Issue (Scan)': t('จ่าย (สแกน)', 'Issue (Scan)'),
      'Issue Spare': t('จ่าย Spare', 'Issue Spare'),
      Breakdown: t('แจ้งเสีย', 'Breakdown'),
      Verify: t('ตรวจสอบ Order', 'Order Verify'),
      Return: t('คืน', 'Return'),
      'Return (Verify)': t('คืน (ตรวจสอบ)', 'Return (Verify)'),
      Edit: t('แก้ไข', 'Edit'),
      Delete: t('ลบ', 'Delete'),
      Order: t('ปิด Order', 'Order'),
      'PM Due': t('ครบกำหนด PM', 'PM Due'),
      '4M Document': t('แนบเอกสาร 4M', '4M Document'),
      '4M Approval Request': t('ขออนุมัติ 4M', '4M Approval Request'),
      '4M Approve': t('อนุมัติ 4M', '4M Approve'),
      '4M Assign': t('มอบหมาย 4M', '4M Assign'),
      'Plan PM': t('วางแผน PM', 'Plan PM'),
      'Start PM': t('เริ่มทำ PM', 'Start PM'),
      'PM Approve': t('Admin อนุมัติ PM', 'PM Approve'),
      'PM Reject': t('Admin ปฏิเสธ PM', 'PM Reject'),
      'PM OK': t('Verify OK', 'PM OK'),
      'PM NG': t('Verify NG', 'PM NG'),
    }
    return labels[value] || value
  }

  const load = useCallback(async (filters) => {
    try {
      setLoading(true)
      setError('')
      const data = await api.history({
        limit: 1000,
        q: filters.q,
        action: filters.action,
        section: filters.section,
      })
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

  const switchSection = (next) => {
    if (next === section) return
    setSection(next)
    setAction('')
    setQuery('')
    setApplied({ q: '', action: '', section: next })
  }

  const submit = (event) => {
    event.preventDefault()
    setApplied({ q: query.trim(), action, section })
  }

  const reset = () => {
    setQuery('')
    setAction('')
    setApplied({ q: '', action: '', section })
  }

  const filterByText = (value) => {
    setQuery(value)
    setApplied({ q: value, action, section })
  }

  /* Order: one card = one request, from Request through closing. */
  const requestGroups = useMemo(() => {
    const map = new Map()
    for (const item of rows) {
      const requestId = String(item.request_id || '').trim()
      if (!requestId) continue
      if (!map.has(requestId)) map.set(requestId, [])
      map.get(requestId).push(item)
    }
    return [...map.entries()]
      .map(([requestId, events]) => {
        const sorted = [...events].sort((a, b) => timeValue(a) - timeValue(b))
        const first = sorted[0] || {}
        const latest = sorted[sorted.length - 1] || {}
        return {
          requestId,
          events: sorted,
          first,
          latest,
          line: first.line || latest.line || '',
          model: first.model || latest.model || '',
          sns: [...new Set(sorted.map((item) => item.sn).filter(Boolean))],
          completed: sorted.some((item) => item.action === 'Order' || item.action === 'Complete'),
        }
      })
      .sort((a, b) => timeValue(b.latest) - timeValue(a.latest))
  }, [rows])

  /* Non-request activity (register/edit/delete) stays grouped by day. */
  const looseDateGroups = useMemo(() => {
    const map = new Map()
    for (const item of rows) {
      if (item.request_id) continue
      const key = dateKey(item.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    return [...map.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0])))
  }, [rows])

  /* PM: one card = one Line + Model PM run, from start/approval through OK/NG.
   * New rows use pm_run_id; old rows fall back to the start date. */
  const pmRunGroups = useMemo(() => {
    const groups = new Map()
    const anchorsBySn = new Map()
    const sortedRows = [...rows].sort((a, b) => timeValue(a) - timeValue(b))

    const ensure = (key, seed = {}) => {
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          runId: seed.runId || '',
          line: seed.line || '',
          model: seed.model || '',
          events: [],
          starts: new Set(),
          oks: new Set(),
          ngs: new Set(),
          approved: false,
        })
      }
      return groups.get(key)
    }

    const addEvent = (group, item) => {
      if (!group.events.includes(item)) group.events.push(item)
    }

    for (const item of sortedRows) {
      if (!['Start PM', 'PM Approve'].includes(item.action)) continue
      const runId = String(item.pm_run_id || '').trim()
      const key = runId ? `id:${runId}` : `legacy:${pmRunKeyOf(item)}`
      const group = ensure(key, { runId, line: item.line, model: item.model })
      group.runId ||= runId
      group.line ||= item.line || ''
      group.model ||= item.model || ''
      addEvent(group, item)
      if (item.sn) group.starts.add(item.sn)
      if (item.action === 'PM Approve') group.approved = true
      if (item.sn) {
        if (!anchorsBySn.has(item.sn)) anchorsBySn.set(item.sn, [])
        anchorsBySn.get(item.sn).push({ key, time: timeValue(item) })
      }
    }

    for (const item of sortedRows) {
      if (!['PM OK', 'PM NG'].includes(item.action)) continue
      const runId = String(item.pm_run_id || '').trim()
      let key = runId ? `id:${runId}` : ''
      if (!key && item.sn) {
        const anchors = (anchorsBySn.get(item.sn) || []).filter((anchor) => anchor.time <= timeValue(item))
        key = anchors.length ? anchors[anchors.length - 1].key : `legacy:${pmRunKeyOf(item)}`
      }
      if (!key) key = `legacy:${pmRunKeyOf(item)}`
      const group = ensure(key, { runId, line: item.line, model: item.model })
      group.runId ||= runId
      group.line ||= item.line || ''
      group.model ||= item.model || ''
      addEvent(group, item)
      if (item.sn) {
        if (item.action === 'PM OK') group.oks.add(item.sn)
        else group.ngs.add(item.sn)
      }
    }

    const support = rows.filter((item) => !RUN_ACTIONS.has(item.action))
    return [...groups.values()]
      .map((group) => {
        const events = [...group.events].sort((a, b) => timeValue(a) - timeValue(b))
        const first = events[0] || {}
        const latest = events[events.length - 1] || {}
        const oks = [...group.oks]
        const ngs = [...group.ngs]
        // Old rows may have no Start PM event in the 1,000-row window. In that
        // case treat the verified fixtures as the run members so the card does
        // not misleadingly say "0 started".
        const started = group.starts.size
          ? [...group.starts]
          : [...new Set([...oks, ...ngs].filter(Boolean))]
        const pending = started.filter(
          (sn) => sn && !group.oks.has(sn) && !group.ngs.has(sn),
        )
        const has4M = support.some(
          (item) =>
            FOUR_M_ACTIONS.has(item.action) &&
            sameLineModel(item, first) &&
            timeValue(item) <= timeValue(first) &&
            timeValue(item) >= timeValue(first) - 30 * DAY_MS,
        )
        return {
          ...group,
          events,
          first,
          latest,
          starts: started,
          oks,
          ngs,
          pending,
          has4M,
          status: group.ngs.size ? 'ng' : pending.length ? 'active' : 'done',
        }
      })
      .sort((a, b) => timeValue(b.latest) - timeValue(a.latest))
  }, [rows])

  /* 4M / alerts / rejected approvals are not part of a PM run, so they get
   * their own compact section instead of being mixed into the run document. */
  const pmSupportGroups = useMemo(() => {
    const map = new Map()
    for (const item of rows) {
      if (RUN_ACTIONS.has(item.action)) continue
      const key = `${String(item.line ?? '').trim() || 'N/A'}|${String(item.model ?? '').trim() || 'N/A'}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    return [...map.entries()]
      .map(([key, events]) => {
        const sorted = [...events].sort((a, b) => timeValue(a) - timeValue(b))
        return {
          key,
          line: sorted[0]?.line || '',
          model: sorted[0]?.model || '',
          events: sorted,
          latest: sorted[sorted.length - 1] || {},
        }
      })
      .sort((a, b) => timeValue(b.latest) - timeValue(a.latest))
  }, [rows])

  const stats = useMemo(() => {
    const todayKey = dateKey(new Date())
    const today = rows.filter((item) => dateKey(item.date) === todayKey).length
    const fixtures = new Set(rows.map((item) => item.sn).filter(Boolean)).size
    const actions = new Set(rows.map((item) => item.action).filter(Boolean)).size
    const fourM = rows.filter((item) => FOUR_M_ACTIONS.has(item.action)).length
    const ok = rows.filter((item) => item.action === 'PM OK').length
    const ng = rows.filter((item) => item.action === 'PM NG').length
    return {
      today,
      fixtures,
      actions,
      fourM,
      ok,
      ng,
      requests: requestGroups.length,
      pmRuns: pmRunGroups.length,
    }
  }, [pmRunGroups.length, requestGroups.length, rows])

  const isPm = section === 'pm'
  const eventCountLabel = (count) => t(`${count} เหตุการณ์`, `${count} event(s)`)
  const snCountLabel = (count) => t(`${count} SN`, `${count} SN`)

  const renderTimeline = (events, renderItem) => {
    const list = <ol className="divide-y divide-slate-100">{events.map(renderItem)}</ol>
    if (events.length <= 20) return list
    return (
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3 text-[11px] font-bold text-slate-500 hover:bg-slate-50">
          <span>{t(`แสดงไทม์ไลน์ทั้งหมด ${events.length} รายการ`, `Show all ${events.length} events`)}</span>
          <span className="text-[10px] font-semibold text-slate-400 group-open:hidden">
            {t('คลิกเพื่อเปิด', 'Click to expand')}
          </span>
        </summary>
        {list}
      </details>
    )
  }

  const renderPmEvent = (item, index) => (
    <li
      key={`${item._id || `${item.action}-${index}`}`}
      className="grid gap-2 px-4 py-3 sm:grid-cols-[110px_140px_1fr] sm:gap-4"
    >
      <div className="text-[10px] font-bold text-slate-400">
        <p>{formatDateTime(item.date)}</p>
        <p className="font-mono text-slate-500">{formatTime(item.date)}</p>
      </div>
      <div>
        <Badge tone={ACTION_TONE[item.action] || 'slate'}>
          {item.action ? actionLabel(item.action) : '-'}
        </Badge>
      </div>
      <div className="min-w-0">
        <p className="text-[12px] leading-relaxed text-slate-700">{item.detail ? sm(item.detail) : '-'}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
          {item.sn ? (
            <button
              type="button"
              onClick={() => filterByText(item.sn)}
              className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 hover:bg-purple-50 hover:text-purple-700"
              title={t('กรองเฉพาะ SN นี้', 'Filter by this SN')}
            >
              {item.sn}
            </button>
          ) : null}
          <span>
            {[item.name, item.lastname].filter(Boolean).join(' ') || item.empId || '-'}
            {item.empId && (item.name || item.lastname) ? ` · ${item.empId}` : ''}
          </span>
        </p>
      </div>
    </li>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('บันทึก', 'Records')}
        icon={HistoryIcon}
        title={t('ประวัติ', 'History')}
        description={t(
          'ดูประวัติเป็นเอกสารรายงาน — 1 คำขอ 1 ใบ และ 1 รอบ PM ของ Line/Model 1 ใบ',
          'History as documents — one request per card and one PM run per line/model card',
        )}
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={() => load(applied)} disabled={loading}>
            {t('รีเฟรช', 'Refresh')}
          </Button>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2" role="tablist" aria-label={t('ส่วนของประวัติ', 'History sections')}>
        <button
          type="button"
          role="tab"
          aria-selected={!isPm}
          onClick={() => switchSection('order')}
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
            isPm
              ? 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600'
              : 'border-blue-300 bg-blue-50/70 text-blue-700 ring-4 ring-blue-500/10'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Boxes className="h-5 w-5" />
            <span>
              <span className="block text-[13px] font-black">{t('Order', 'Order')}</span>
              <span className="block text-[10px] font-semibold opacity-70">
                {t('1 คำขอ · ตั้งแต่สร้างจนปิดงาน', 'One request · creation to closing')}
              </span>
            </span>
          </span>
          {!isPm ? <Badge tone="blue">{requestGroups.length}</Badge> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isPm}
          onClick={() => switchSection('pm')}
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
            isPm
              ? 'border-purple-300 bg-purple-50/70 text-purple-700 ring-4 ring-purple-500/10'
              : 'border-slate-200 bg-white text-slate-500 hover:border-purple-200 hover:text-purple-600'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Wrench className="h-5 w-5" />
            <span>
              <span className="block text-[13px] font-black">{t('PM และซ่อมบำรุง', 'PM & maintenance')}</span>
              <span className="block text-[10px] font-semibold opacity-70">
                {t('1 รอบ PM · Line/Model ตั้งแต่เริ่มจน Verify', 'One PM run · line/model start to verify')}
              </span>
            </span>
          </span>
          {isPm ? <Badge tone="purple">{pmRunGroups.length + pmSupportGroups.length}</Badge> : null}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={isPm ? t('รอบ PM', 'PM runs') : t('คำขอ', 'Requests')}
          value={isPm ? stats.pmRuns : stats.requests}
          hint={eventCountLabel(rows.length)}
          icon={isPm ? Wrench : HistoryIcon}
          tone={isPm ? 'purple' : 'blue'}
        />
        <StatCard
          label={t('Fixture ที่เกี่ยวข้อง', 'Related fixtures')}
          value={stats.fixtures}
          hint={t('นับจาก SN ในผลลัพธ์', 'Distinct SNs in this result')}
          icon={Boxes}
          tone="orange"
        />
        {isPm ? (
          <>
            <StatCard
              label={t('เหตุการณ์ 4M', '4M events')}
              value={stats.fourM}
              hint={t('แนบ / ขออนุมัติ / อนุมัติ / มอบหมาย', 'Attach / request / approve / assign')}
              icon={FileClock}
              tone="red"
            />
            <StatCard
              label={t('Verify OK / NG', 'Verify OK / NG')}
              value={`${stats.ok} / ${stats.ng}`}
              hint={t('ผลตรวจรับหลังซ่อม', 'Repair verification results')}
              icon={ShieldCheck}
              tone="emerald"
            />
          </>
        ) : (
          <>
            <StatCard
              label={t('วันนี้', 'Today')}
              value={stats.today}
              hint={t('รายการที่บันทึกวันนี้', 'Records logged today')}
              icon={FileClock}
              tone="emerald"
            />
            <StatCard
              label={t('Action ที่เกิดขึ้น', 'Actions recorded')}
              value={stats.actions}
              hint={t('ประเภทเหตุการณ์ไม่ซ้ำ', 'Distinct event types')}
              icon={Tag}
              tone="purple"
            />
          </>
        )}
      </div>

      <Card className="p-4 sm:p-5">
        <SectionHeader
          icon={isPm ? Wrench : HistoryIcon}
          title={applied.q
            ? t(`ผลการค้นหา “${applied.q}”`, `Search results for “${applied.q}”`)
            : isPm
              ? t('เอกสาร PM และซ่อมบำรุง', 'PM & maintenance documents')
              : t('เอกสารคำขอ', 'Request documents')}
          description={
            applied.action
              ? `${t('กรองเฉพาะ action: ', 'Filter action: ')}${actionLabel(applied.action)}`
              : isPm
                ? t('1 ใบ = 1 รอบ PM ของ Line/Model — เริ่มทำจน Verify OK/NG', 'One card = one line/model PM run — from start through verify')
                : t('1 ใบ = 1 คำขอ — ตั้งแต่สร้างคำขอจนปิดงาน', 'One card = one request — from creation through closing')
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
            {actionOptions.map((item) => (
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
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={isPm ? Wrench : Activity}
            title={applied.q || applied.action
              ? t('ไม่พบประวัติที่ตรงกับเงื่อนไข', 'No matching history found')
              : isPm
                ? t('ยังไม่มีประวัติ PM และซ่อมบำรุง', 'No PM or maintenance history yet')
                : t('ยังไม่มีประวัติคำขอ', 'No request history yet')}
            description={isPm
              ? t('เหตุการณ์ PM จะถูกบันทึกเมื่อเริ่ม PM และ Verify OK/NG', 'PM events are logged when a PM run starts and when it is verified')
              : t('เหตุการณ์คำขอจะถูกบันทึกตั้งแต่สร้างคำขอจนปิดงาน', 'Request events are logged from creation through closing')}
            action={
              applied.q || applied.action ? (
                <Button variant="secondary" onClick={reset}>
                  {t('ล้างตัวกรอง', 'Clear filters')}
                </Button>
              ) : null
            }
          />
        </Card>
      ) : isPm ? (
        <div className="space-y-3">
          {pmRunGroups.map((group) => (
            <Card key={group.key} className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-[13px] font-black text-slate-800">
                      {group.line || 'N/A'} / {group.model || 'N/A'}
                    </p>
                    <Badge tone="purple">
                      {t(`เริ่ม ${group.starts.length} ตัว`, `${group.starts.length} started`)}
                    </Badge>
                    <Badge tone="emerald">OK {group.oks.length}</Badge>
                    {group.ngs.length ? <Badge tone="red">NG {group.ngs.length}</Badge> : null}
                    {group.pending.length ? (
                      <Badge tone="amber">
                        {t(`ค้าง ${group.pending.length}`, `${group.pending.length} pending`)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">
                    {eventCountLabel(group.events.length)}
                    {' · '}
                    {formatDateTime(group.first?.date)}
                    {' → '}
                    {group.pending.length ? t('กำลังทำ', 'In progress') : formatDateTime(group.latest?.date)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {group.has4M ? <Badge tone="red">{t('มี 4M', '4M attached')}</Badge> : null}
                  {group.approved ? <Badge tone="purple">{t('อนุมัติแล้ว', 'Approved')}</Badge> : null}
                  {group.status === 'done' ? <Badge tone="emerald">{t('เสร็จแล้ว', 'Done')}</Badge> : null}
                  {group.status === 'active' ? <Badge tone="amber">{t('กำลังทำ', 'In progress')}</Badge> : null}
                  {group.status === 'ng' ? <Badge tone="red">{t('มี NG', 'Has NG')}</Badge> : null}
                </div>
              </div>
              {renderTimeline(group.events, renderPmEvent)}
            </Card>
          ))}

          {pmSupportGroups.length ? (
            <div className="space-y-3 pt-2">
              <SectionHeader
                icon={FileClock}
                title={t('4M / แจ้งเตือน / อนุมัติ', '4M / alerts / approvals')}
                description={t('เหตุการณ์ก่อนเริ่ม PM หรือคำขอที่ถูกปฏิเสธ', 'Events before a PM run starts, or a rejected PM request')}
              />
              {pmSupportGroups.map((group) => (
                <Card key={group.key} className="overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                    <div>
                      <p className="font-mono text-[12px] font-black text-slate-800">
                        {group.line || 'N/A'} / {group.model || 'N/A'}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-slate-400">
                        {eventCountLabel(group.events.length)} · {formatDateTime(group.latest?.date)}
                      </p>
                    </div>
                    <Badge tone="slate">{t('ก่อนเริ่ม PM', 'Pre-PM')}</Badge>
                  </div>
                  {renderTimeline(group.events, renderPmEvent)}
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {requestGroups.map((group) => (
            <Card key={group.requestId} className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => filterByText(group.requestId)}
                      className="rounded-lg bg-white px-2 py-0.5 font-mono text-[12px] font-black text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50"
                      title={t('กรองเฉพาะ Request นี้', 'Filter by this Request')}
                    >
                      {group.requestId}
                    </button>
                    <Badge tone={ACTION_TONE[group.latest.action] || 'slate'}>
                      {group.latest.action ? actionLabel(group.latest.action) : '-'}
                    </Badge>
                    {group.completed ? <Badge tone="emerald">{t('ปิดงานแล้ว', 'Closed')}</Badge> : null}
                    {group.line || group.model ? (
                      <span className="text-[10px] font-semibold text-slate-400">
                        {group.line || '-'}{group.model ? ` · ${group.model}` : ''}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">
                    {eventCountLabel(group.events.length)}
                    {' · '}
                    {snCountLabel(group.sns.length)}
                    {' · '}
                    {formatDateTime(group.first?.date)}
                    {' → '}
                    {formatDateTime(group.latest?.date)}
                  </p>
                </div>
              </div>
              <ol className="divide-y divide-slate-100">
                {group.events.map((item, index) => (
                  <li
                    key={`${item._id || `${item.action}-${index}`}`}
                    className="grid gap-2 px-4 py-3 sm:grid-cols-[110px_140px_1fr] sm:gap-4"
                  >
                    <div className="text-[10px] font-bold text-slate-400">
                      <p>{formatDateTime(item.date)}</p>
                      <p className="font-mono text-slate-500">{formatTime(item.date)}</p>
                    </div>
                    <div>
                      <Badge tone={ACTION_TONE[item.action] || 'slate'}>
                        {item.action ? actionLabel(item.action) : '-'}
                      </Badge>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] leading-relaxed text-slate-700">{item.detail ? sm(item.detail) : '-'}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                        {item.sn ? (
                          <button
                            type="button"
                            onClick={() => filterByText(item.sn)}
                            className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                            title={t('กรองเฉพาะ SN นี้', 'Filter by this SN')}
                          >
                            {item.sn}
                          </button>
                        ) : null}
                        <span>
                          {[item.name, item.lastname].filter(Boolean).join(' ') || item.empId || '-'}
                          {item.empId && (item.name || item.lastname) ? ` · ${item.empId}` : ''}
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          ))}

          {looseDateGroups.length ? (
            <div className="space-y-3 pt-2">
              <SectionHeader
                icon={Layers3}
                title={t('งานทั่วไป (ไม่มีคำขอ)', 'General activity (no request)')}
                description={t('ลงทะเบียน / แก้ไข / ลบ Fixture — แยกตามวัน', 'Register / edit / delete fixture — grouped by day')}
              />
              {looseDateGroups.map(([key, items]) => (
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
                          <Layers3 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={ACTION_TONE[item.action] || 'slate'}>
                              {item.action ? actionLabel(item.action) : '-'}
                            </Badge>
                            {item.sn ? (
                              <button
                                type="button"
                                onClick={() => filterByText(item.sn)}
                                className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                                title={t('กรองเฉพาะ SN นี้', 'Filter by this SN')}
                              >
                                {item.sn}
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
                          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{item.detail ? sm(item.detail) : '-'}</p>
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
          ) : null}
        </div>
      )}
    </div>
  )
}
