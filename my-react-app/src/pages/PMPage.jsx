import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Layers3,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  Wrench,
} from 'lucide-react'
import api from '../lib/api'
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  StatCard,
} from '../components/ui/Card'
import { Badge, FixtureStatusBadge } from '../components/ui/Badge'
import { FormField, Input } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { cn, daysUntil, formatDate, toDateInput } from '../lib/format'
import { useLabels, useServerMessage } from '../lib/i18n'

const OUTCOMES = [
  { value: 'Need Scrape', label: 'Need Scrape (Red color)' },
  { value: 'Need PR', label: 'Need PR (Red color)' },
  { value: 'Already have PR', label: 'Already have PR (Yellow)' },
  { value: 'New One Replacement', label: 'New One Replacement' },
]

const outcomeLabel = (value, t) => {
  const labels = {
    'Need Scrape': t('ต้อง Scrape (สีแดง)', 'Need Scrape (Red color)'),
    'Need PR': t('ต้อง PR (สีแดง)', 'Need PR (Red color)'),
    'Already have PR': t('มี PR แล้ว (สีเหลือง)', 'Already have PR (Yellow)'),
    'New One Replacement': t('เปลี่ยนตัวใหม่', 'New One Replacement'),
  }
  return labels[value] || value
}

const plusDays = (days) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toDateInput(d)
}

const CALENDAR_STATES = ['over-due', 'overdue-remind', 'on-due', 'usage-remind', 'pre-alert']
const PM_TONE = {
  'over-due': 'red',
  'overdue-remind': 'orange',
  'usage-remind': 'orange',
  'on-due': 'blue',
  'pre-alert': 'amber',
  planned: 'purple',
}
const PM_DOT = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
}
const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const dateKey = (value) => {
  const raw = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  return toDateInput(value)
}

// Server exposes pmOverdueDays / needs4M on /api/pm; fall back to the exp date
// so the same guard works if an older payload omits those fields.
const overdueDaysOf = (row) => {
  const explicit = Number(row?.pmOverdueDays)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  const days = daysUntil(row?.usage?.exp)
  return days === null ? 0 : Math.max(0, -days)
}

const needs4MOf = (row) =>
  row?.needs4M === true ||
  (overdueDaysOf(row) > 7 && !(Array.isArray(row?.pmForms) ? row.pmForms : []).length)

// Only in-use fixtures at or past their PM due date may be planned.
const isPlanDue = (row) => {
  const exp = row?.usage?.exp ? String(row.usage.exp).slice(0, 10) : ''
  return (
    row?.status === 'In Use' &&
    (overdueDaysOf(row) > 0 || (Boolean(exp) && exp <= toDateInput(new Date())))
  )
}

const planRowsOf = (list = []) => list.filter((row) => isPlanDue(row) && !needs4MOf(row))
const blockedRowsOf = (list = []) => list.filter((row) => needs4MOf(row))

const countPmStates = (list = []) => {
  const has = (row, state) => (row.pmStates || []).includes(state)
  return {
    all: list.length,
    preAlert: list.filter((row) => has(row, 'pre-alert') || has(row, 'usage-remind')).length,
    onDue: list.filter((row) => has(row, 'on-due')).length,
    overDue: list.filter((row) => has(row, 'over-due') || has(row, 'overdue-remind')).length,
  }
}

export default function PMPage({ user }) {
  const { t, pmState } = useLabels()
  const sm = useServerMessage()
  const toast = useToast()

  /* ---- PM worklist ---- */
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [lineFilter, setLineFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  /* ---- Maintenance queue ---- */
  const [mRows, setMRows] = useState([])
  const [mLoading, setMLoading] = useState(true)
  const [mError, setMError] = useState('')
  const [mQuery, setMQuery] = useState('')

  /* ---- 4M document upload (line-by-line) ---- */
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadBusy, setUploadBusy] = useState(false)

  /* ---- Modals ---- */
  // target = { type: 'group', line, model, rows, blocked }
  const [target, setTarget] = useState(null)
  const [date, setDate] = useState('')
  const [verify, setVerify] = useState(null) // { fixture, result }
  const [newExp, setNewExp] = useState(() => plusDays(90))
  const [outcome, setOutcome] = useState('Need Scrape')
  const [printSticker, setPrintSticker] = useState(true)
  const [sticker, setSticker] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [expandedLines, setExpandedLines] = useState({})
  const [showAllFixtures, setShowAllFixtures] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    api.pm()
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))

    setMLoading(true)
    setMError('')
    api.maintenance()
      .then((data) => setMRows(Array.isArray(data) ? data : []))
      .catch((err) => setMError(err.message))
      .finally(() => setMLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const lineOptions = useMemo(
    () => [...new Set(rows.map((row) => row.line).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }),
    ),
    [rows],
  )

  // PM is run per Line + Model — never per individual SN.
  const modelOptions = useMemo(() => {
    const scoped = lineFilter ? rows.filter((row) => row.line === lineFilter) : rows
    return [...new Set(scoped.map((row) => row.model).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }),
    )
  }, [rows, lineFilter])

  const groupRows = useMemo(
    () => rows.filter((row) =>
      (!lineFilter || row.line === lineFilter) &&
      (!modelFilter || row.model === modelFilter),
    ),
    [rows, lineFilter, modelFilter],
  )
  const groupMRows = useMemo(
    () => mRows.filter((row) =>
      (!lineFilter || row.line === lineFilter) &&
      (!modelFilter || row.model === modelFilter),
    ),
    [mRows, lineFilter, modelFilter],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return groupRows
    return groupRows.filter((row) =>
      [row.sn, row.line, row.model, row.type, row.step]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [groupRows, query])

  const maintenance = useMemo(() => {
    const needle = mQuery.trim().toLowerCase()
    if (!needle) return groupMRows
    return groupMRows.filter((row) =>
      [row.sn, row.line, row.model, row.process, row.position]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [groupMRows, mQuery])

  const counts = useMemo(() => {
    const has = (row, state) => (row.pmStates || []).includes(state)
    return {
      all: groupRows.length,
      preAlert: groupRows.filter((r) => has(r, 'pre-alert') || has(r, 'usage-remind')).length,
      onDue: groupRows.filter((r) => has(r, 'on-due')).length,
      overDue: groupRows.filter((r) => has(r, 'over-due') || has(r, 'overdue-remind')).length,
      maintenance: groupMRows.length,
    }
  }, [groupRows, groupMRows])

  // Calendar cells are line-level too: one chip per line with its fixture count,
  // then the worklist below expands that line to show the individual fixtures.
  const calendarByDate = useMemo(() => {
    const map = new Map()
    const add = (key, row, state) => {
      if (!key) return
      if (!map.has(key)) map.set(key, new Map())
      const byLine = map.get(key)
      const line = row.line || 'N/A'
      if (!byLine.has(line)) {
        byLine.set(line, { line, sns: new Set(), models: new Set(), states: new Set() })
      }
      const entry = byLine.get(line)
      entry.sns.add(row.sn)
      if (row.model) entry.models.add(row.model)
      entry.states.add(state)
    }
    for (const row of groupRows) {
      const expKey = dateKey(row.usage?.exp)
      for (const state of (row.pmStates || [])) {
        if (CALENDAR_STATES.includes(state)) add(expKey, row, state)
      }
      if (row.pmDate) add(dateKey(row.pmDate), row, 'planned')
    }
    return map
  }, [groupRows])

  const monthCells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay())
    return Array.from({ length: 42 }, (_, index) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
    )
  }, [viewMonth])

  const compactMonthLabel = `${t(MONTHS_TH[viewMonth.getMonth()], MONTHS_EN[viewMonth.getMonth()]).slice(0, 3)} ${viewMonth.getFullYear()}`
  const weekdays = t(WEEKDAYS_TH.join(' '), WEEKDAYS_EN.join(' ')).split(' ')
  const stateLabel = (state) =>
    state === 'planned' ? t('วางแผนแล้ว', 'Planned') : pmState(state)
  const todayKey = toDateInput(new Date())

  const planRows = useMemo(() => planRowsOf(groupRows), [groupRows])
  const blockedRows = useMemo(() => blockedRowsOf(groupRows), [groupRows])

  // PM worklist is line-first: Line → Model → the fixtures actually used there.
  const lineGroups = useMemo(() => {
    const byLine = new Map()
    for (const row of filtered) {
      const line = row.line || 'N/A'
      const model = row.model || 'N/A'
      let lineGroup = byLine.get(line)
      if (!lineGroup) {
        lineGroup = { line, rows: [], models: new Map() }
        byLine.set(line, lineGroup)
      }
      lineGroup.rows.push(row)
      let modelGroup = lineGroup.models.get(model)
      if (!modelGroup) {
        modelGroup = { line, model, rows: [] }
        lineGroup.models.set(model, modelGroup)
      }
      modelGroup.rows.push(row)
    }

    return [...byLine.values()]
      .map((group) => {
        const models = [...group.models.values()].map((modelGroup) => ({
          ...modelGroup,
          planRows: planRowsOf(modelGroup.rows),
          blockedRows: blockedRowsOf(modelGroup.rows),
          stats: countPmStates(modelGroup.rows),
        }))
        return {
          ...group,
          models,
          stats: countPmStates(group.rows),
          maintenanceCount: groupMRows.filter((row) => (row.line || 'N/A') === group.line).length,
        }
      })
      .sort((a, b) => String(a.line).localeCompare(String(b.line), undefined, { numeric: true, sensitivity: 'base' }))
  }, [filtered, groupMRows])

  const blockMessage = (row) => {
    const days = overdueDaysOf(row)
    return t(
      `Fixture ${row?.sn || ''} เกินกำหนด PM ${days} วัน — กรุณาแนบเอกสาร 4M ก่อนแก้ไขข้อมูล`,
      `Fixture ${row?.sn || ''} is ${days} days overdue — attach the 4M document before editing`,
    )
  }

  const shiftMonth = (offset) =>
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))

  const openGroupPlanFor = (line, model) => {
    const groupRowsForPlan = rows.filter((row) => row.line === line && row.model === model)
    const plan = planRowsOf(groupRowsForPlan)
    if (!line || !model || plan.length === 0) return
    setTarget({
      type: 'group',
      line,
      model,
      rows: plan,
      blocked: blockedRowsOf(groupRowsForPlan),
    })
    setDate(toDateInput(new Date()))
    setPassword('')
    setLineFilter(line)
    setModelFilter(model)
  }

  const focusGroup = (line, model) => {
    setLineFilter(line)
    setModelFilter(model)
    setTarget(null)
  }

  const focusCalendarLine = (line) => {
    setLineFilter(line)
    setModelFilter('')
    setQuery('')
    setTarget(null)
    setExpandedLines((current) => ({ ...current, [line]: true }))
    document.getElementById('pm-worklist')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const toggleLine = (line) =>
    setExpandedLines((current) => ({ ...current, [line]: current[line] === false }))

  const isLineExpanded = (line) => expandedLines[line] !== false

  const uploadGroupForms = async () => {
    if (!lineFilter || !modelFilter || !uploadFile) return
    setUploadBusy(true)
    try {
      const res = await api.pmUploadGroup(lineFilter, modelFilter, uploadFile, user)
      toast.success(
        res?.message
          ? sm(res.message)
          : t(
              `แนบเอกสาร 4M ให้ ${res?.count ?? 0} ตัวใน Line ${lineFilter} / Model ${modelFilter} แล้ว`,
              `Attached the 4M document to ${res?.count ?? 0} fixture(s) in line ${lineFilter} / model ${modelFilter}`,
            ),
      )
      setUploadFile(null)
      await load()
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setUploadBusy(false)
    }
  }

  const openVerify = (fixture, result) => {
    setVerify({ fixture, result })
    setNewExp(plusDays(90))
    setOutcome('Need Scrape')
    setPrintSticker(true)
    setPassword('')
  }

  const checkPassword = async () => {
    if (!password) {
      toast.error(t('กรุณากรอกรหัสผ่าน', 'Please enter your password'))
      return false
    }
    const login = await api.login({ empId: user?.userId || user?.empId, pass: password })
    if (!login?.success) {
      toast.error(t('รหัสผ่านไม่ถูกต้อง', 'Incorrect password'))
      return false
    }
    return true
  }

  const savePlan = async () => {
    if (!target || !date || target.rows.length === 0) return
    if (!(await checkPassword())) return
    setBusy(true)
    try {
      const res = await api.pmPlan(
        target.line,
        target.model,
        user,
        date,
        t('PM ตาม Line/Model', 'PM by line/model'),
      )
      toast.success(
        res?.message
          ? sm(res.message)
          : t(
              `วางแผน PM Line ${target.line} / Model ${target.model} ${res?.count ?? target.rows.length} ตัว → PM & Maintenance`,
              `Planned PM for ${res?.count ?? target.rows.length} fixture(s) in line ${target.line} / model ${target.model} → PM & Maintenance`,
            ),
      )
      if (res?.skipped?.length) {
        toast.error(
          t(
            `ข้าม ${res.skipped.length} ตัวที่ต้องแนบ 4M ก่อน`,
            `Skipped ${res.skipped.length} fixture(s) that need 4M first`,
          ),
        )
      }
      setTarget(null)
      await load()
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setBusy(false)
    }
  }

  const confirmVerify = async () => {
    if (!verify) return
    if (!(await checkPassword())) return
    setBusy(true)
    try {
      const { fixture, result } = verify
      const res = await api.maintenanceVerify(
        result === 'OK'
          ? { sn: fixture.sn, result: 'OK', newExp, user }
          : { sn: fixture.sn, result: 'NG', outcome, user },
      )
      toast.success(res?.message ? sm(res.message) : t('บันทึกสำเร็จ', 'Saved successfully'))
      if (result === 'OK' && printSticker) {
        setSticker({
          sn: fixture.sn,
          line: fixture.line,
          model: fixture.model,
          process: fixture.process,
          position: fixture.position,
          exp: newExp,
        })
        window.setTimeout(() => window.print(), 80)
      }
      setVerify(null)
      await load()
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setBusy(false)
    }
  }

  const searchBox = (value, onChange, placeholder) => (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <Input
        className="field-input-sm pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )

  const renderFixtureCard = (row) => {
    const states = (row.pmStates || []).filter((state) => CALENDAR_STATES.includes(state))
    const forms = Array.isArray(row.pmForms) ? row.pmForms : []
    const percent = Math.min(100, Number(row.usagePercent) || 0)
    return (
      <div key={row.sn} className="rounded-xl border border-slate-200 bg-white p-2.5">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-[11px] font-black text-slate-800">{row.sn}</span>
          <FixtureStatusBadge status={row.status} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {states.slice(0, 3).map((state) => (
            <Badge key={state} tone={PM_TONE[state]} dot>
              {stateLabel(state)}
            </Badge>
          ))}
          {states.length > 3 ? (
            <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
              +{states.length - 3}
            </span>
          ) : null}
          {states.length === 0 ? <span className="text-[10px] text-slate-400">-</span> : null}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-500">
          <span>
            {t('Exp', 'Exp')} <b className="font-mono text-slate-700">{formatDate(row.usage?.exp)}</b>
          </span>
          <span>
            PM <b className="font-mono text-blue-700">{row.pmDate || '-'}</b>
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn('h-full rounded-full', percent >= 80 ? 'bg-orange-500' : 'bg-blue-500')}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[9px] font-bold text-slate-400">
          <span>
            {Number(row.usage?.current) || 0}/{Number(row.usage?.max) || 0} · {percent}%
          </span>
          {forms.length ? (
            <div className="flex flex-wrap gap-1">
              {forms.map((url, index) => (
                <a
                  key={`${url}-${index}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  title={t('เปิดเอกสาร 4M', 'Open 4M document')}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-1.5 py-0.5 font-bold text-red-600 hover:bg-red-100 hover:text-red-800"
                >
                  <FileText className="h-3 w-3" /> 4M {index + 1}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('ซ่อมบำรุง', 'Maintenance')}
        icon={Wrench}
        title={t('PM และซ่อมบำรุง', 'PM & Maintenance')}
        description={t('ดูภาพรวมราย Line → Model → Fixture ที่ใช้งานจริง พร้อมวางแผน PM เป็นกลุ่มและจัดการคิวซ่อมในหน้าเดียว', 'Review lines, their models, and the fixtures in use — plan PM by group and manage the repair queue in one place')}
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={load}>
            {t('รีเฟรช', 'Refresh')}
          </Button>
        }
      />

      {/* ---------- PM worklist ---------- */}
      <section id="pm-worklist" className="scroll-mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-500" />
            <h2 className="text-[13px] font-bold text-slate-800">{t('รายงาน PM', 'PM Worklist')}</h2>
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              {lineGroups.length} {t('Line', 'lines')} · {groupRows.length} {t('Fixture', 'fixtures')}
            </span>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <select
              aria-label={t('กรองตาม Line', 'Filter by line')}
              className="field-input-sm w-full sm:w-40"
              value={lineFilter}
              onChange={(event) => {
                setLineFilter(event.target.value)
                setModelFilter('')
                setTarget(null)
              }}
            >
              <option value="">{t('ทุก Line', 'All lines')}</option>
              {lineOptions.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
            <select
              aria-label={t('กรองตาม Model', 'Filter by model')}
              className="field-input-sm w-full font-mono sm:w-52"
              value={modelFilter}
              onChange={(event) => {
                setModelFilter(event.target.value)
                setTarget(null)
              }}
            >
              <option value="">{t('ทุก Model', 'All models')}</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <div className="w-full sm:w-64">{searchBox(query, setQuery, t('ค้นหา Line / Model / SN…', 'Search line / model / SN…'))}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Button
            size="sm"
            variant="purple"
            icon={CalendarClock}
            disabled={busy || !lineFilter || !modelFilter || planRows.length === 0}
            onClick={() => openGroupPlanFor(lineFilter, modelFilter)}
          >
            {t('PM ตาม Line/Model', 'PM by line/model')}
          </Button>
          <span className="text-[10px] font-semibold text-slate-500">
            {!lineFilter
              ? t('เลือก Line และ Model ก่อนวางแผน PM', 'Select a line and model before planning PM')
              : !modelFilter
                ? t(`Line ${lineFilter} · เลือก Model ก่อนวางแผน PM`, `Line ${lineFilter} · select a model before planning PM`)
                : planRows.length === 0
                  ? t(`Line ${lineFilter} / ${modelFilter} ไม่มี Fixture ที่ถึงกำหนด PM`, `No due fixture in ${lineFilter} / ${modelFilter} to plan`)
                  : t(`Line ${lineFilter} / ${modelFilter} · พร้อมวางแผน ${planRows.length} ตัว`, `${lineFilter} / ${modelFilter} · ${planRows.length} fixture(s) ready to plan`)}
          </span>
          {lineFilter && modelFilter && blockedRows.length > 0 ? (
            <span className="ml-auto text-[10px] font-bold text-red-600">
              {t(`ต้องแนบ 4M ${blockedRows.length} ตัวก่อน`, `${blockedRows.length} fixture(s) need 4M first`)}
            </span>
          ) : null}
        </div>

        {lineFilter && modelFilter && blockedRows.length > 0 ? (
          <Card className="border-red-200 bg-red-50/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-[13px] font-black text-red-700">
                  <FileText className="h-4 w-4" />
                  {t(`เอกสาร 4M ที่ขาด · ${lineFilter} / ${modelFilter}`, `Missing 4M document · ${lineFilter} / ${modelFilter}`)}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-red-600">
                  {t(
                    'Fixture เกินกำหนด PM มากกว่า 7 วันโดยไม่มีเอกสาร 4M — การแก้ไขและวางแผน PM ถูกบล็อก',
                    'Fixtures over 7 days PM overdue without a 4M document — edits and PM planning are blocked',
                  )}
                </p>
              </div>
              <Badge tone="red">
                {t(`ต้องแนบ ${blockedRows.length} ตัว`, `${blockedRows.length} to attach`)}
              </Badge>
            </div>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {blockedRows.map((row, index) => (
                <li key={`${row.sn}-${index}`} className="text-[10px] font-semibold leading-snug text-red-600">
                  • {blockMessage(row)}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-red-200 pt-3">
              <label className="flex flex-col gap-1 text-[10px] font-bold text-red-700">
                {t('ไฟล์เอกสาร 4M (PDF / รูปภาพ)', '4M document file (PDF / image)')}
                <input
                  type="file"
                  accept=".pdf,image/*"
                  disabled={uploadBusy}
                  onChange={(event) => {
                    setUploadFile(event.target.files?.[0] || null)
                    event.target.value = ''
                  }}
                  className="block w-full max-w-xs text-[11px] font-medium text-slate-600"
                />
              </label>
              <Button
                size="sm"
                variant="danger"
                icon={Upload}
                disabled={uploadBusy || !uploadFile}
                onClick={uploadGroupForms}
              >
                {uploadBusy
                  ? t('กำลังแนบเอกสาร…', 'Uploading…')
                  : t('แนบ 4M ทั้งกลุ่ม', 'Attach 4M for whole group')}
              </Button>
              {uploadFile ? (
                <span className="max-w-[240px] truncate font-mono text-[10px] text-slate-500">
                  {uploadFile.name}
                </span>
              ) : null}
            </div>
          </Card>
        ) : (!lineFilter || !modelFilter) && blockedRows.length > 0 ? (
          <Card className="border-amber-200 bg-amber-50/50 p-3">
            <p className="flex items-center gap-2 text-[11px] font-bold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {t(
                `มี ${blockedRows.length} ตัวที่ต้องแนบเอกสาร 4M — เลือก Line และ Model ก่อนแนบ`,
                `${blockedRows.length} fixture(s) need a 4M document — select a line and model before uploading`,
              )}
            </p>
          </Card>
        ) : null}

        {/* KPI first, calendar below it — full width so scanning is uninterrupted. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard label={t('ทั้งหมด', 'All')} value={counts.all} tone="blue" icon={ClipboardList} />
          <StatCard label={t('แจ้งล่วงหน้า / 80%', 'Pre-Alert / 80%')} value={counts.preAlert} tone="orange" icon={BellRing} />
          <StatCard label={t('PM ถึงกำหนด', 'PM On Due')} value={counts.onDue} tone="purple" icon={CalendarClock} />
          <StatCard label={t('PM เกินกำหนด', 'PM Over Due')} value={counts.overDue} tone="red" icon={AlertTriangle} />
          <StatCard label={t('กำลังซ่อม', 'In Maintenance')} value={counts.maintenance} tone="orange" icon={Wrench} />
        </div>

        {!loading && !error ? (
          <Card className="w-full p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-black text-slate-800">{t('ปฏิทิน PM', 'PM calendar')}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={ChevronLeft}
                  onClick={() => shiftMonth(-1)}
                  aria-label={t('เดือนก่อนหน้า', 'Previous month')}
                />
                <span className="min-w-[92px] text-center text-xs font-black text-slate-700">
                  {compactMonthLabel}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={ChevronRight}
                  onClick={() => shiftMonth(1)}
                  aria-label={t('เดือนถัดไป', 'Next month')}
                />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {[...CALENDAR_STATES, 'planned'].map((state) => (
                <Badge key={state} tone={PM_TONE[state]} dot>
                  {stateLabel(state)}
                </Badge>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {weekdays.map((day, index) => (
                <div
                  key={`${day}-${index}`}
                  className="pb-0.5 text-center text-[10px] font-black uppercase tracking-[0.08em] text-slate-400"
                >
                  {day}
                </div>
              ))}
              {monthCells.map((cell, index) => {
                const key = toDateInput(cell)
                const entries = [...(calendarByDate.get(key)?.values() || [])]
                return (
                  <div
                    key={`${key}-${index}`}
                    className={cn(
                      'min-h-[86px] rounded-xl border p-1.5 sm:p-2',
                      key === todayKey ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-white',
                      cell.getMonth() !== viewMonth.getMonth() && 'opacity-40',
                    )}
                  >
                    <p className="text-[11px] font-black text-slate-500">{cell.getDate()}</p>
                    {entries.slice(0, 3).map(({ line, sns, models, states }, entryIndex) => (
                      <button
                        key={`${key}-${line}-${entryIndex}`}
                        type="button"
                        title={`${t('Line', 'Line')} ${line} · ${sns.size} ${t('Fixture', 'fixtures')} · ${[...models].join(', ') || '-'} · ${[...states].map(stateLabel).join(', ')}`}
                        onClick={() => focusCalendarLine(line)}
                        className="mt-1 flex w-full items-center gap-1 rounded-md bg-slate-100 px-1.5 py-1 text-left text-[10px] font-black text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                      >
                        <span className="flex shrink-0 gap-0.5">
                          {[...states].map((state) => (
                            <span key={state} className={cn('h-1.5 w-1.5 rounded-full', PM_DOT[PM_TONE[state]])} />
                          ))}
                        </span>
                        <span className="truncate font-sans">{line}</span>
                        <span className="ml-auto shrink-0 font-mono text-[9px] font-bold text-blue-700">
                          {sns.size}
                        </span>
                      </button>
                    ))}
                    {entries.length > 3 ? (
                      <p className="mt-1 text-[9px] font-bold text-slate-400">+{entries.length - 3}</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <Spinner label={t('กำลังโหลดข้อมูล…', 'Loading…')} />
          </Card>
        ) : error ? (
          <Card>
            <ErrorState message={sm(error)} onRetry={load} />
          </Card>
        ) : lineGroups.length === 0 ? (
          <Card>
            <EmptyState
              icon={Layers3}
              title={t('ไม่มี Line ที่ตรงกับเงื่อนไข', 'No matching line')}
              description={t('ลองเปลี่ยน Line / Model หรือคำค้นหา', 'Try another line, model, or search term')}
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {lineGroups.map((group) => {
              const open = isLineExpanded(group.line)
              return (
                <Card key={group.line} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleLine(group.line)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Layers3 className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-black text-slate-900">
                        {t('Line', 'Line')} {group.line}
                      </span>
                      <span className="block text-[10px] font-semibold text-slate-400">
                        {group.models.length} {t('Model', 'models')} · {group.rows.length} {t('Fixture', 'fixtures')}
                        {group.maintenanceCount > 0
                          ? ` · ${group.maintenanceCount} ${t('กำลังซ่อม', 'in maintenance')}`
                          : ''}
                      </span>
                    </span>
                    <span className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                      <Badge tone="red">{t('เกินกำหนด', 'Overdue')} {group.stats.overDue}</Badge>
                      <Badge tone="purple">{t('ถึงกำหนด', 'On due')} {group.stats.onDue}</Badge>
                      <Badge tone="orange">{t('แจ้งล่วงหน้า', 'Pre-alert')} {group.stats.preAlert}</Badge>
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                        open && 'rotate-180',
                      )}
                    />
                  </button>

                  {open ? (
                    <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 p-3 sm:p-4">
                      {group.models.map((modelGroup) => {
                        const modelKey = `${group.line}|${modelGroup.model}`
                        const limit = showAllFixtures[modelKey] ? modelGroup.rows.length : 12
                        return (
                          <div key={modelKey} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="truncate font-mono text-[12px] font-black text-slate-800">
                                  {modelGroup.model}
                                </p>
                                <p className="text-[10px] font-semibold text-slate-400">
                                  {modelGroup.rows.length} {t('Fixture', 'fixtures')} ·{' '}
                                  {t('พร้อม PM', 'ready')} {modelGroup.planRows.length} ·{' '}
                                  {t('ติด 4M', '4M blocked')} {modelGroup.blockedRows.length}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => focusGroup(group.line, modelGroup.model)}
                                >
                                  {t('เลือกกลุ่มนี้', 'Select group')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="purple"
                                  icon={CalendarClock}
                                  disabled={busy || modelGroup.planRows.length === 0}
                                  onClick={() => openGroupPlanFor(group.line, modelGroup.model)}
                                >
                                  {t('PM กลุ่มนี้', 'PM this group')}
                                </Button>
                              </div>
                            </div>
                            {modelGroup.blockedRows.length > 0 ? (
                              <p className="border-b border-red-100 bg-red-50/70 px-3 py-1.5 text-[10px] font-bold text-red-600">
                                {t(
                                  `ต้องแนบ 4M ${modelGroup.blockedRows.length} ตัวก่อนวางแผนกลุ่มนี้`,
                                  `${modelGroup.blockedRows.length} fixture(s) need 4M before planning this group`,
                                )}
                              </p>
                            ) : null}
                            <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                              {modelGroup.rows.slice(0, limit).map(renderFixtureCard)}
                            </div>
                            {modelGroup.rows.length > 12 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowAllFixtures((current) => ({
                                    ...current,
                                    [modelKey]: !current[modelKey],
                                  }))
                                }
                                className="w-full border-t border-slate-100 py-2 text-center text-[10px] font-black text-blue-600 hover:bg-blue-50"
                              >
                                {showAllFixtures[modelKey]
                                  ? t('แสดงน้อยลง', 'Show less')
                                  : t(
                                      `แสดง Fixture ทั้งหมด ${modelGroup.rows.length} ตัว`,
                                      `Show all ${modelGroup.rows.length} fixtures`,
                                    )}
                              </button>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ---------- Maintenance queue ---------- */}
      <section id="pm-maintenance" className="scroll-mt-4 space-y-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" />
            <h2 className="text-[13px] font-bold text-slate-800">
              {t('กำลังซ่อม · Verify + Record', 'In Maintenance · Verify + Record')}
            </h2>
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              {maintenance.length}
            </span>
          </div>
          <div className="w-full sm:w-72">
            {searchBox(mQuery, setMQuery, t('ค้นหา SN / Line / Model / Position…', 'Search SN / Line / Model / Position…'))}
          </div>
        </div>

        {mLoading ? (
          <Card>
            <Spinner label={t('กำลังโหลดข้อมูล…', 'Loading…')} />
          </Card>
        ) : mError ? (
          <Card>
            <ErrorState message={sm(mError)} onRetry={load} />
          </Card>
        ) : maintenance.length === 0 ? (
          <Card>
            <EmptyState
              icon={Wrench}
              title={t('ไม่มี fixture ในคิว PM & Maintenance', 'No fixtures in the PM & Maintenance queue')}
              description={t('Plan PM / Breakdown จะแสดงที่นี่หลังส่งเข้าซ่อม', 'Plan PM / Breakdown items appear here after being sent for maintenance')}
            />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {maintenance.map((row, index) => {
              const days = daysUntil(row.usage?.exp)
              return (
                <Card key={`${row.sn}-${index}`} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-800">{row.sn}</span>
                        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {row.line || '-'}
                        </span>
                        <span className="rounded-lg bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase text-orange-600">
                          {t('ซ่อมบำรุง', 'Maintenance')}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[11px] font-semibold text-slate-500">{row.model}</p>
                      <p className="text-[10px] text-slate-400">
                        {[row.process, row.position].filter(Boolean).join(' · ') || '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-slate-600">{t('กำหนด PM', 'PM Due')}: {formatDate(row.usage?.exp)}</p>
                      <p className={`text-[10px] font-black ${days !== null && days < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {days === null ? '-' : days < 0 ? t(`เกินกำหนด ${-days} วัน`, `${-days} days overdue`) : t(`อีก ${days} วัน`, `${days} days left`)}
                      </p>
                      {row.pmDate ? (
                        <p className="text-[10px] font-semibold text-blue-600">{t('วางแผน', 'Plan')}: {row.pmDate}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        (Number(row.usage?.max) || 0) > 0 &&
                          (Number(row.usage?.current) || 0) / Number(row.usage.max) >= 0.8
                          ? 'bg-orange-500'
                          : 'bg-blue-500',
                      )}
                      style={{
                        width: `${Math.min(
                          100,
                          (Number(row.usage?.max) || 0) > 0
                            ? Math.round(((Number(row.usage?.current) || 0) / Number(row.usage.max)) * 100)
                            : 0,
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-slate-500">
                      {t('การใช้งาน', 'Usage')} {Number(row.usage?.current) || 0}/{Number(row.usage?.max) || 0}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="success" onClick={() => openVerify(row, 'OK')}>
                        {t('ตรวจสอบ OK', 'Verify OK')}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => openVerify(row, 'NG')}>
                        {t('NG', 'NG')}
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ---------- Plan PM modal (line + model group, password required) ---------- */}
      <Modal
        open={Boolean(target)}
        onClose={() => (busy ? null : setTarget(null))}
        title={target
          ? t(`วางแผน PM · ${target.line} / ${target.model}`, `Plan PM · ${target.line} / ${target.model}`)
          : t('วางแผน PM', 'Plan PM')}
        subtitle={t(
          `ส่งเข้า PM & Maintenance · ${target?.rows.length || 0} ตัว`,
          `Sent to PM & Maintenance · ${target?.rows.length || 0} fixture(s)`,
        )}
        icon={CalendarClock}
        tone="orange"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTarget(null)} disabled={busy}>
              {t('ยกเลิก', 'Cancel')}
            </Button>
            <Button
              variant="warning"
              onClick={savePlan}
              disabled={busy || !date || !target?.rows.length}
            >
              {busy ? t('กำลังบันทึก…', 'Saving…') : t('วางแผน PM', 'Plan PM')}
            </Button>
          </div>
        }
      >
        {target ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                {t('Fixture ที่จะวางแผน', 'Fixtures to plan')} ({target.rows.length})
              </p>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {target.rows.map((row, index) => (
                  <li key={`${row.sn}-${index}`} className="text-[11px] font-bold text-slate-700">
                    <span className="font-mono">{row.sn}</span>
                    <span className="ml-2 font-medium text-slate-400">
                      {row.model || '-'} · {formatDate(row.usage?.exp)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {target.blocked?.length ? (
              <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-600">
                  {t('ข้าม — ต้องแนบเอกสาร 4M ก่อน', 'Skipped — 4M document required first')}
                </p>
                <ul className="mt-2 space-y-1">
                  {target.blocked.map((row, index) => (
                    <li key={`${row.sn}-${index}`} className="text-[10px] font-semibold leading-snug text-red-600">
                      {blockMessage(row)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <FormField label={t('วันที่ PM', 'PM date')}>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </FormField>
            <FormField label={t('รหัสผ่านเพื่อยืนยัน', 'Password to confirm')}>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('รหัสผ่าน', 'Password')}
              />
            </FormField>
          </div>
        ) : null}
      </Modal>

      {/* ---------- Verify + Record modal (password required) ---------- */}
      <Modal
        open={Boolean(verify)}
        onClose={() => (busy ? null : setVerify(null))}
        title={verify?.result === 'OK' ? t('Verify + Record — OK', 'Verify + Record — OK') : t('Verify + Record — NG', 'Verify + Record — NG')}
        subtitle={verify?.fixture?.sn || ''}
        icon={ShieldCheck}
        tone={verify?.result === 'OK' ? 'emerald' : 'red'}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setVerify(null)} disabled={busy}>
              {t('ยกเลิก', 'Cancel')}
            </Button>
            <Button
              variant={verify?.result === 'OK' ? 'success' : 'danger'}
              onClick={confirmVerify}
              disabled={busy || (verify?.result === 'OK' && !newExp)}
            >
              {busy ? t('กำลังบันทึก…', 'Saving…') : `${t('ยืนยัน', 'Confirm')} ${verify?.result || ''}`}
            </Button>
          </div>
        }
      >
        {verify ? (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500">
              {verify.fixture.line} · {verify.fixture.model}
            </p>
            {verify.result === 'OK' ? (
              <>
                <FormField label={t('Reset Due (วัน PM ถัดไป)', 'Reset Due (next PM date)')}>
                  <Input type="date" value={newExp} onChange={(event) => setNewExp(event.target.value)} />
                </FormField>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11px] font-bold text-emerald-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-600"
                    checked={printSticker}
                    onChange={() => setPrintSticker((v) => !v)}
                  />
                  <Printer className="h-4 w-4" /> {t('พิมพ์สติกเกอร์อัตโนมัติ', 'Auto Print Sticker')}
                </label>
              </>
            ) : (
              <FormField label={t('ผลการตรวจ (NG)', 'Inspection result (NG)')}>
                <select
                  className="field-input-sm w-full"
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value)}
                >
                  {OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {outcomeLabel(o.value, t)}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField label={t('รหัสผ่านเพื่อยืนยัน', 'Password to confirm')}>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('รหัสผ่าน', 'Password')}
              />
            </FormField>
          </div>
        ) : null}
      </Modal>

      {sticker ? (
        <div className="pm-sticker" aria-hidden="true">
          <p className="pm-sticker-sn">{sticker.sn}</p>
          <p>{sticker.line} · {sticker.model}</p>
          <p>{[sticker.process, sticker.position].filter(Boolean).join(' · ')}</p>
          <p>{t('PM ถัดไป', 'NEXT PM')}: {formatDate(sticker.exp)}</p>
        </div>
      ) : null}
    </div>
  )
}
