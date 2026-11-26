import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
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
  Wrench,
  XCircle,
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
import { isAdminUser } from '../lib/navigation'

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

const CALENDAR_STATES = ['over-due', 'overdue-remind', 'on-due', 'pre-alert']
const PM_TONE = {
  'over-due': 'red',
  'overdue-remind': 'orange',
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

// PM is counted from usage.inUseAt + 90 days. usage.exp is a separate expiry
// date and must not be used for PM overdue or 4M blocking.
const addDaysInput = (value, days) => {
  const raw = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return ''
  const date = new Date(`${raw.slice(0, 10)}T00:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const pmDueDateOf = (row) => {
  const explicit = String(row?.pmDueDate || '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(explicit)) return explicit.slice(0, 10)
  return addDaysInput(row?.usage?.inUseAt || row?.pmStartDate, 90)
}

// Server exposes pmOverdueDays / needs4M on /api/pm; fall back to the computed
// PM due date so the same guard works if an older payload omits those fields.
const overdueDaysOf = (row) => {
  const explicit = Number(row?.pmOverdueDays)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  const days = daysUntil(pmDueDateOf(row))
  return days === null ? 0 : Math.max(0, -days)
}

// A blank line/model is shown as N/A, but the API still needs the real key.
const groupValueOf = (value) => {
  const raw = String(value ?? '').trim()
  return /^n\/?a$/i.test(raw) ? '' : raw
}

const hasGroupOf = (row) =>
  Boolean(groupValueOf(row?.line)) && Boolean(groupValueOf(row?.model))

// Older records hold a file URL; Doc NO. entries are plain text.
const isDocUrl = (value) => /^(https?:\/\/|\/uploads\/)/i.test(String(value || '').trim())

// Fixtures without Line + Model are not a 4M group and never count as blocked.
const needs4MOf = (row) =>
  hasGroupOf(row) &&
  (row?.needs4M === true ||
    (overdueDaysOf(row) > 3 && !(Array.isArray(row?.pmForms) ? row.pmForms : []).length))

// A fixture only waits for Admin when its requested PM duration is over 7 days.
const needsApprovalOf = (row) =>
  Number(row?.pmRequestedDays) > 7 && row?.pmApproval !== 'Approved'

// "กำลังทำ PM" is allowed when the fixture is in PM, has its 4M (if overdue >3
// days), and is not waiting for Admin approval.
const isPlanDue = (row) =>
  row?.status === 'PM' && !needs4MOf(row) && !needsApprovalOf(row)

const planRowsOf = (list = []) => list.filter((row) => isPlanDue(row))
const blockedRowsOf = (list = []) => list.filter((row) => needs4MOf(row))

const countPmStates = (list = []) => {
  const has = (row, state) => (row.pmStates || []).includes(state)
  return {
    all: list.length,
    preAlert: list.filter((row) => has(row, 'pre-alert')).length,
    onDue: list.filter((row) => has(row, 'on-due')).length,
    overDue: list.filter((row) => has(row, 'over-due') || has(row, 'overdue-remind')).length,
  }
}

export default function PMPage({ user }) {
  const { t, pmState } = useLabels()
  const sm = useServerMessage()
  const toast = useToast()
  const isAdmin = isAdminUser(user)

  /* ---- Page layout ---- */
  const [activeTab, setActiveTab] = useState('pm')
  const [showCalendar, setShowCalendar] = useState(true)

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

  /* ---- Maintenance queue / grouped Verify ---- */
  const [mRows, setMRows] = useState([])
  const [mLoading, setMLoading] = useState(true)
  const [mError, setMError] = useState('')
  const [mQuery, setMQuery] = useState('')
  const [selectedVerify, setSelectedVerify] = useState(() => new Set())

  /* ---- 4M Doc NO. (line-by-line) ---- */
  const [docNo, setDocNo] = useState('')
  const [uploadDays, setUploadDays] = useState(7)
  const [uploadBusy, setUploadBusy] = useState(false)

  /* ---- Modals ---- */
  // target = { type: 'group'|'single', line?, model?, fixture?, rows, blocked }
  const [target, setTarget] = useState(null)
  const [date, setDate] = useState('')
  const [approvalTarget, setApprovalTarget] = useState(null) // { fixture, action }
  const [bulkVerify, setBulkVerify] = useState(null) // { result, rows }
  const [bulkOutcome, setBulkOutcome] = useState('Need Scrape')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [printSticker, setPrintSticker] = useState(true)
  const [sticker, setSticker] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [expandedLines, setExpandedLines] = useState({})
  const [showAllFixtures, setShowAllFixtures] = useState({})
  const [listOpen, setListOpen] = useState(false)
  // uploadGroup = { key, line, model } — inline 4M panel in today's work
  const [uploadGroup, setUploadGroup] = useState(null)

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

  // Drop selections whose fixture has left the maintenance queue.
  useEffect(() => {
    setSelectedVerify((current) => {
      const live = new Set(mRows.map((row) => row.sn))
      const next = new Set([...current].filter((sn) => live.has(sn)))
      return next.size === current.size ? current : next
    })
  }, [mRows])

  const lineOptions = useMemo(
    () => [...new Set(rows.map((row) => row.line).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }),
    ),
    [rows],
  )

  // PM is run per Line + Model — never per individual SN.
  const modelOptions = useMemo(() => {
    const scoped = lineFilter ? rows.filter((row) => groupValueOf(row.line) === groupValueOf(lineFilter)) : rows
    return [...new Set(scoped.map((row) => row.model).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }),
    )
  }, [rows, lineFilter])

  const groupRows = useMemo(
    () => rows.filter((row) =>
      (!lineFilter || groupValueOf(row.line) === groupValueOf(lineFilter)) &&
      (!modelFilter || groupValueOf(row.model) === groupValueOf(modelFilter)),
    ),
    [rows, lineFilter, modelFilter],
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

  // Calendar cells are line-level: one chip per line with its fixture count,
  // then the worklist below expands that line to show individual fixtures.
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
    for (const row of rows) {
      const dueKey = dateKey(pmDueDateOf(row))
      for (const state of (row.pmStates || [])) {
        if (CALENDAR_STATES.includes(state)) add(dueKey, row, state)
      }
      if (row.pmDate) add(dateKey(row.pmDate), row, 'planned')
    }
    return map
  }, [rows])

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

  // PM worklist is line-first: Line → Model → the fixtures actually used there.
  const lineGroups = useMemo(() => {
    const byLine = new Map()
    for (const row of filtered) {
      const line = groupValueOf(row.line) || 'N/A'
      const model = groupValueOf(row.model) || 'N/A'
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
          grouped: hasGroupOf({ line: group.line, model: modelGroup.model }),
          stats: countPmStates(modelGroup.rows),
        }))
        return {
          ...group,
          models,
          stats: countPmStates(group.rows),
          maintenanceCount: mRows.filter((row) => (groupValueOf(row.line) || 'N/A') === group.line).length,
        }
      })
      .sort((a, b) => String(a.line).localeCompare(String(b.line), undefined, { numeric: true, sensitivity: 'base' }))
  }, [filtered, mRows])

  /* Today's work ignores the deep-view filters: it answers "what do I do now". */
  const allModelGroups = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      const line = groupValueOf(row.line) || 'N/A'
      const model = groupValueOf(row.model) || 'N/A'
      const key = `${line}|${model}`
      if (!map.has(key)) map.set(key, { key, line, model, rows: [] })
      map.get(key).rows.push(row)
    }
    return [...map.values()]
      .map((group) => ({
        ...group,
        planRows: planRowsOf(group.rows),
        blockedRows: blockedRowsOf(group.rows),
      }))
      .sort((a, b) => {
        const byLine = String(a.line).localeCompare(String(b.line), undefined, { numeric: true, sensitivity: 'base' })
        return byLine || String(a.model).localeCompare(String(b.model), undefined, { numeric: true, sensitivity: 'base' })
      })
  }, [rows])

  const blockedGroups = useMemo(
    () => allModelGroups.filter((group) => group.blockedRows.length > 0),
    [allModelGroups],
  )
  const planGroups = useMemo(
    () => allModelGroups.filter((group) => group.planRows.length > 0),
    [allModelGroups],
  )
  const pendingGroups = useMemo(
    () => allModelGroups
      .map((group) => ({ ...group, pendingRows: group.rows.filter((row) => row.status === 'PM Pending') }))
      .filter((group) => group.pendingRows.length > 0),
    [allModelGroups],
  )

  const visibleMaintenance = useMemo(() => {
    const needle = mQuery.trim().toLowerCase()
    if (!needle) return mRows
    return mRows.filter((row) => [
      row.sn, row.line, row.model, row.process, row.position,
    ].filter(Boolean).join(' ').toLowerCase().includes(needle))
  }, [mRows, mQuery])

  // Verify queue: Line → Model → fixtures, with multi-select at every level.
  const verifyGroups = useMemo(() => {
    const byLine = new Map()
    for (const row of visibleMaintenance) {
      const line = groupValueOf(row.line) || 'N/A'
      const model = groupValueOf(row.model) || 'N/A'
      if (!byLine.has(line)) byLine.set(line, { line, rows: [], models: new Map() })
      const lineGroup = byLine.get(line)
      lineGroup.rows.push(row)
      if (!lineGroup.models.has(model)) lineGroup.models.set(model, { line, model, rows: [] })
      lineGroup.models.get(model).rows.push(row)
    }
    return [...byLine.values()]
      .map((group) => ({
        ...group,
        models: [...group.models.values()].sort((a, b) =>
          String(a.model).localeCompare(String(b.model), undefined, { numeric: true, sensitivity: 'base' }),
        ),
      }))
      .sort((a, b) => String(a.line).localeCompare(String(b.line), undefined, { numeric: true, sensitivity: 'base' }))
  }, [visibleMaintenance])

  const selectedRows = useMemo(
    () => visibleMaintenance.filter((row) => selectedVerify.has(row.sn)),
    [visibleMaintenance, selectedVerify],
  )

  const kpis = useMemo(() => {
    const blocked = rows.reduce((sum, row) => sum + (needs4MOf(row) ? 1 : 0), 0)
    const pending = rows.filter((row) => row.status === 'PM Pending').length
    const ready = rows.filter(isPlanDue).length
    const overdue = rows.filter((row) => overdueDaysOf(row) > 0).length
    return { blocked, pending, ready, overdue, verify: mRows.length }
  }, [rows, mRows])

  const blockMessage = (row) => {
    const days = overdueDaysOf(row)
    return t(
      `Fixture ${row?.sn || ''} เกินกำหนด PM ${days} วัน — กรุณาใส่ Doc NO. 4M ก่อนแก้ไขข้อมูล`,
      `Fixture ${row?.sn || ''} is ${days} days overdue — enter the 4M Doc NO. before editing`,
    )
  }

  const shiftMonth = (offset) =>
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))

  const goToPmActions = () => {
    setActiveTab('pm')
    window.setTimeout(
      () => document.getElementById('pm-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      80,
    )
  }

  const goToVerify = () => {
    setActiveTab('maintenance')
    window.setTimeout(
      () => document.getElementById('pm-verify')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      80,
    )
  }

  const openGroupPlanFor = (line, model) => {
    const lineKey = groupValueOf(line)
    const modelKey = groupValueOf(model)
    const groupRowsForPlan = rows.filter(
      (row) => groupValueOf(row.line) === lineKey && groupValueOf(row.model) === modelKey,
    )
    const plan = planRowsOf(groupRowsForPlan)
    if (plan.length === 0) return
    setTarget({
      type: 'group',
      line: lineKey || 'N/A',
      model: modelKey || 'N/A',
      rows: plan,
      blocked: blockedRowsOf(groupRowsForPlan),
    })
    setDate(toDateInput(new Date()))
    setPassword('')
    setLineFilter(lineKey)
    setModelFilter(modelKey)
  }

  const openApproval = (fixture, action) => {
    if (!isAdmin || fixture?.status !== 'PM Pending') return
    setApprovalTarget({ fixture, action })
    setPassword('')
  }

  const openUploadGroup = (line, model) => {
    const lineKey = groupValueOf(line)
    const modelKey = groupValueOf(model)
    if (!lineKey || !modelKey) return
    const key = `${lineKey}|${modelKey}`
    setUploadGroup((current) => (current?.key === key ? null : {
      key,
      line: lineKey,
      model: modelKey,
      lineKey,
      modelKey,
    }))
    setDocNo('')
    setUploadDays(7)
    setListOpen(false)
    window.setTimeout(
      () => document.getElementById('pm-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      80,
    )
  }

  const openList = (line = '', model = '') => {
    setLineFilter(groupValueOf(line))
    setModelFilter(groupValueOf(model))
    setQuery('')
    setExpandedLines(groupValueOf(line) ? { [groupValueOf(line)]: true } : {})
    setTarget(null)
    setListOpen(true)
  }

  const focusCalendarLine = (line) => {
    setActiveTab('pm')
    openList(line)
  }

  const toggleLine = (line) =>
    setExpandedLines((current) => ({ ...current, [line]: current[line] === false }))

  const isLineExpanded = (line) => expandedLines[line] !== false

  const toggleVerify = (sn) =>
    setSelectedVerify((current) => {
      const next = new Set(current)
      if (next.has(sn)) next.delete(sn)
      else next.add(sn)
      return next
    })

  const toggleVerifyRows = (list, checked) =>
    setSelectedVerify((current) => {
      const next = new Set(current)
      for (const row of list) {
        if (checked) next.add(row.sn)
        else next.delete(row.sn)
      }
      return next
    })

  const submitGroupDocNo = async () => {
    const value = docNo.trim()
    if (!uploadGroup || !value) {
      toast.error(t('กรุณากรอก Doc NO. 4M', 'Please enter the 4M Doc NO.'))
      return
    }
    const group = uploadGroup
    setUploadBusy(true)
    try {
      const res = await api.pmUploadGroup(group.lineKey, group.modelKey, value, uploadDays, user)
      toast.success(
        res?.message
          ? sm(res.message)
          : t(
              `บันทึก Doc NO. 4M ให้ ${res?.count ?? 0} ตัวใน Line ${group.line} / Model ${group.model} แล้ว`,
              `Saved the 4M Doc NO. for ${res?.count ?? 0} fixture(s) in line ${group.line} / model ${group.model}`,
            ),
      )
      setDocNo('')
      setUploadGroup(null)
      await load()
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setUploadBusy(false)
    }
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
      const res = target.type === 'single'
        ? await api.pmStart(target.fixture.sn, user, date)
        : await api.pmPlan(
            target.line,
            target.model,
            user,
            date,
            t('PM ตาม Line/Model', 'PM by line/model'),
          )
      toast.success(
        res?.message
          ? sm(res.message)
          : target.type === 'single'
            ? t(`${target.fixture.sn} → Maintenance · เริ่มทำ PM ${date}`, `${target.fixture.sn} → Maintenance · PM started ${date}`)
            : t(
                `เริ่ม PM Line ${target.line} / Model ${target.model} ${res?.count ?? target.rows.length} ตัว → Maintenance`,
                `Started PM for ${res?.count ?? target.rows.length} fixture(s) in line ${target.line} / model ${target.model} → Maintenance`,
              ),
      )
      if (res?.skipped?.length) {
        toast.error(
          t(
            `ข้าม ${res.skipped.length} ตัวที่ต้องใส่ Doc NO. 4M ก่อน`,
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

  const confirmApproval = async () => {
    if (!approvalTarget || !isAdmin) return
    if (!(await checkPassword())) return
    setBusy(true)
    try {
      const { fixture, action } = approvalTarget
      const res = await api.pmApprove(fixture.sn, action, user)
      toast.success(
        res?.message
          ? sm(res.message)
          : action === 'approve'
            ? t(`อนุมัติ PM ${fixture.sn} แล้ว`, `Approved PM for ${fixture.sn}`)
            : t(`ปฏิเสธ PM ${fixture.sn} แล้ว`, `Rejected PM for ${fixture.sn}`),
      )
      setApprovalTarget(null)
      await load()
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setBusy(false)
    }
  }

  const openBulkVerify = (result) => {
    if (!selectedRows.length) return
    setBulkVerify({ result, rows: selectedRows })
    setBulkOutcome('Need Scrape')
    setPrintSticker(result === 'OK' && selectedRows.length === 1)
    setPassword('')
  }

  const confirmBulkVerify = async () => {
    if (!bulkVerify) return
    if (!(await checkPassword())) return
    setBulkBusy(true)
    try {
      const { result, rows } = bulkVerify
      const res = await api.maintenanceVerifyBulk({
        sns: rows.map((row) => row.sn),
        result,
        ...(result === 'NG' ? { outcome: bulkOutcome } : { maintenanceDone: true }),
        user,
      })
      toast.success(res?.message ? sm(res.message) : t('บันทึกสำเร็จ', 'Saved successfully'))
      if (res?.skipped?.length) {
        toast.error(
          t(
            `ข้าม ${res.skipped.length} ตัวที่ Verify ไม่ได้ — ${res.skipped[0]?.message || ''}`,
            `Skipped ${res.skipped.length} fixture(s) — ${res.skipped[0]?.message || ''}`,
          ),
        )
      }
      if (result === 'OK' && res?.count === 1 && printSticker) {
        const row = rows.find((item) => item.sn === res.processed?.[0]?.sn) || rows[0]
        setSticker({
          sn: row.sn,
          line: row.line,
          model: row.model,
          process: row.process,
          position: row.position,
          exp: '',
        })
        window.setTimeout(() => window.print(), 80)
      }
      setBulkVerify(null)
      setSelectedVerify(new Set())
      await load()
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setBulkBusy(false)
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
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] font-semibold text-slate-500">
          <span>
            {t('PM Due', 'PM Due')} <b className="font-mono text-blue-700">{formatDate(pmDueDateOf(row))}</b>
          </span>
          <span>
            {t('Exp', 'Exp')} <b className="font-mono text-slate-700">{formatDate(row.usage?.exp)}</b>
            {row.pmDate ? ` · ${row.pmDate}` : ''}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[9px] font-bold text-slate-400">
          {forms.length ? (
            <div className="flex flex-wrap gap-1">
              {forms.map((entry, index) => isDocUrl(entry) ? (
                <a
                  key={`${entry}-${index}`}
                  href={entry}
                  target="_blank"
                  rel="noreferrer"
                  title={t('เปิดเอกสาร 4M', 'Open 4M document')}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-1.5 py-0.5 font-bold text-red-600 hover:bg-red-100 hover:text-red-800"
                >
                  <FileText className="h-3 w-3" /> 4M {index + 1}
                </a>
              ) : (
                <span
                  key={`${entry}-${index}`}
                  title={`${t('Doc NO. 4M', '4M Doc NO.')}: ${entry}`}
                  className="inline-flex max-w-[150px] items-center gap-1 truncate rounded-lg bg-red-50 px-1.5 py-0.5 font-bold text-red-600"
                >
                  <FileText className="h-3 w-3 shrink-0" /> {entry}
                </span>
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
        icon={Wrench}
        title={t('PM และซ่อมบำรุง', 'PM & Maintenance')}
        description={t(
          'แยกงานเป็น 2 ส่วนชัดเจน: PM กับ Maintenance — เลือกแท็บแล้วทำตามลำดับบนลงล่าง',
          'Two clear workspaces: PM and Maintenance — pick a tab, then work top to bottom',
        )}
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={load}>
            {t('รีเฟรช', 'Refresh')}
          </Button>
        }
      />

      {/* ---------- Clear workspace switcher ---------- */}
      <nav
        aria-label={t('เลือกพื้นที่ทำงาน', 'Choose workspace')}
        className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:flex-row"
      >
        <button
          type="button"
          aria-pressed={activeTab === 'pm'}
          onClick={() => setActiveTab('pm')}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all',
            activeTab === 'pm'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
          )}
        >
          <span className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            activeTab === 'pm' ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-600',
          )}>
            <CalendarClock className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black">{t('PM', 'PM')}</span>
            <span className={cn(
              'mt-0.5 block truncate text-[11px] font-semibold',
              activeTab === 'pm' ? 'text-blue-100' : 'text-slate-400',
            )}>
              {t('ใส่ Doc NO. 4M → อนุมัติ → เริ่ม PM', 'Enter 4M Doc NO. → approve → start PM')}
            </span>
          </span>
          <span className={cn(
            'rounded-lg px-2 py-1 font-mono text-[11px] font-black',
            activeTab === 'pm' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600',
          )}>
            {kpis.blocked + kpis.pending + kpis.ready}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={activeTab === 'maintenance'}
          onClick={() => setActiveTab('maintenance')}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all',
            activeTab === 'maintenance'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
          )}
        >
          <span className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            activeTab === 'maintenance' ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-600',
          )}>
            <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black">{t('Maintenance', 'Maintenance')}</span>
            <span className={cn(
              'mt-0.5 block truncate text-[11px] font-semibold',
              activeTab === 'maintenance' ? 'text-emerald-100' : 'text-slate-400',
            )}>
              {t('เลือก Fixture → Done หรือ NG', 'Select fixtures → Done or NG')}
            </span>
          </span>
          <span className={cn(
            'rounded-lg px-2 py-1 font-mono text-[11px] font-black',
            activeTab === 'maintenance' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600',
          )}>
            {kpis.verify}
          </span>
        </button>
      </nav>

      {activeTab === 'pm' ? (
        <>
          {/* ---------- KPI first ---------- */}
          <section aria-label={t('ตัวชี้วัด PM', 'PM KPIs')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t('ติด 4M', 'Blocked by 4M')}
              value={kpis.blocked}
              hint={t('กดเพื่อดูงานที่ต้องทำ', 'Tap to see today’s work')}
              icon={AlertTriangle}
              tone="red"
              onClick={goToPmActions}
            />
            <StatCard
              label={t('รอ Admin อนุมัติ', 'Awaiting Admin')}
              value={kpis.pending}
              hint={t('PM เกิน 7 วัน', 'PM over 7 days')}
              icon={ShieldCheck}
              tone="amber"
              onClick={goToPmActions}
            />
            <StatCard
              label={t('พร้อมเริ่ม PM', 'Ready to start PM')}
              value={kpis.ready}
              hint={t(`${kpis.overdue} ตัวเกินกำหนด PM`, `${kpis.overdue} overdue fixture(s)`)}
              icon={CalendarClock}
              tone="purple"
              onClick={goToPmActions}
            />
            <StatCard
              label={t('รอ Verify', 'Awaiting Verify')}
              value={kpis.verify}
              hint={t('กดไปหน้าตรวจรับ', 'Tap to open verification')}
              icon={ClipboardList}
              tone="emerald"
              onClick={goToVerify}
            />
          </section>

      <div className="grid h-[600px] gap-4 lg:grid-cols-[40%_60%] lg:items-stretch">
        <section id="pm-calendar" className="order-2 flex h-full min-h-0 scroll-mt-4 flex-col">
        <Card className="flex h-full min-h-0 flex-col p-3 sm:p-4">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              <div className="min-w-0">
                <p className="text-[13px] font-black text-slate-800">{t('ปฏิทิน PM', 'PM calendar')}</p>
                <p className="text-[10px] font-semibold text-slate-400">
                  {t('กดวันที่มี Line เพื่อดู Fixture', 'Tap a line chip to inspect its fixtures')}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={ChevronDown}
                onClick={() => setShowCalendar((value) => !value)}
                className={cn(showCalendar && 'rotate-180')}
                aria-label={showCalendar
                  ? t('ซ่อนปฏิทิน', 'Hide calendar')
                  : t('แสดงปฏิทิน', 'Show calendar')}
              />
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
          {showCalendar ? (
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              <div className="mt-2 flex flex-wrap gap-1">
                {[...CALENDAR_STATES, 'planned'].map((state) => (
                  <Badge key={state} tone={PM_TONE[state]} dot>
                    {stateLabel(state)}
                  </Badge>
                ))}
              </div>
              {loading ? (
            <Spinner label={t('กำลังโหลดปฏิทิน…', 'Loading calendar…')} />
          ) : error ? (
            <ErrorState message={sm(error)} onRetry={load} />
          ) : (
            <div className="mt-2 grid grid-cols-7 gap-1">
              {weekdays.map((day, index) => (
                <div
                  key={`${day}-${index}`}
                  className="pb-0.5 text-center text-[9px] font-black uppercase tracking-[0.08em] text-slate-400"
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
                      'min-h-[62px] rounded-lg border p-1 sm:min-h-[68px] sm:p-1.5',
                      key === todayKey ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-white',
                      cell.getMonth() !== viewMonth.getMonth() && 'opacity-40',
                    )}
                  >
                    <p className="text-[10px] font-black text-slate-500">{cell.getDate()}</p>
                    {entries.slice(0, 2).map(({ line, sns, models, states }, entryIndex) => (
                      <button
                        key={`${key}-${line}-${entryIndex}`}
                        type="button"
                        title={`${t('Line', 'Line')} ${line} · ${sns.size} ${t('Fixture', 'fixtures')} · ${[...models].join(', ') || '-'} · ${[...states].map(stateLabel).join(', ')}`}
                        onClick={() => focusCalendarLine(line)}
                        className="mt-0.5 flex w-full items-center gap-1 rounded-md bg-slate-100 px-1 py-0.5 text-left text-[9px] font-black text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                      >
                        <span className="flex shrink-0 gap-0.5">
                          {[...states].map((state) => (
                            <span key={state} className={cn('h-1 w-1 rounded-full', PM_DOT[PM_TONE[state]])} />
                          ))}
                        </span>
                        <span className="truncate font-sans">{line}</span>
                        <span className="ml-auto shrink-0 font-mono text-[8px] font-bold text-blue-700">
                          {sns.size}
                        </span>
                      </button>
                    ))}
                    {entries.length > 2 ? (
                      <p className="mt-0.5 text-[8px] font-bold text-slate-400">+{entries.length - 2}</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
            )}
            </div>
          ) : null}
        </Card>
      </section>

      {/* ---------- Today's work ---------- */}
      <section id="pm-actions" className="order-1 flex h-full min-h-0 scroll-mt-4 flex-col">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <ClipboardList className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-black text-slate-900">{t('งานที่ต้องทำตอนนี้', 'Do this now')}</h2>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                  {t('ทำตามขั้น 1 → 2 → 3 บนลงล่าง (Verify อยู่แท็บอื่น)', 'Work steps 1 → 2 → 3 top to bottom (Verify is in the other tab)')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" icon={ClipboardList} onClick={() => openList()}>
                {t('View list', 'View list')}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold">
              <span className="flex items-center gap-1.5 text-red-600">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {t(`ติด 4M ${kpis.blocked} ตัว`, `${kpis.blocked} blocked by 4M`)}
              </span>
              <span className="flex items-center gap-1.5 text-amber-600">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {t(`รอ Admin ${kpis.pending} ตัว`, `${kpis.pending} awaiting Admin`)}
              </span>
              <span className="flex items-center gap-1.5 text-purple-600">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                {t(`พร้อม PM ${kpis.ready} ตัว`, `${kpis.ready} ready to start PM`)}
              </span>
            </div>
          </div>

          {loading || mLoading ? (
            <Spinner label={t('กำลังโหลดงานวันนี้…', 'Loading today’s work…')} />
          ) : error || mError ? (
            <ErrorState message={sm(error || mError)} onRetry={load} />
          ) : (
            <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {/* 4M comes first because it blocks everything else. */}
              <div className="px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[13px] font-black text-red-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-black text-white">1</span>
                    <AlertTriangle className="h-4 w-4" /> {t('ใส่ Doc NO. 4M ก่อนแตะของ', 'Enter the 4M Doc NO. before editing')}
                  </p>
                  <span className="text-[10px] font-bold text-slate-400">{t('เฉพาะที่มี Line + Model', 'Grouped fixtures only')}</span>
                </div>
                {blockedGroups.length === 0 ? (
                  <p className="mt-2 text-[11px] font-semibold text-slate-400">{t('ไม่มีของติด 4M', 'Nothing is blocked by 4M')}</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {blockedGroups.map((group) => (
                      <div key={group.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50/60 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[12px] font-black text-slate-800">
                            {group.line} / {group.model}
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold text-red-600">
                            {t(
                              `${group.blockedRows.length} ตัวเกิน 3 วัน · แก้หรือเริ่ม PM ไม่ได้จนกว่าใส่ Doc NO. 4M`,
                              `${group.blockedRows.length} fixture(s) over 3 days — edits and PM stay blocked until the 4M Doc NO. is saved`,
                            )}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={ClipboardList}
                          onClick={() => openList(group.line, group.model)}
                        >
                          {t('View list', 'View list')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Modal
                  open={!!uploadGroup}
                  onClose={() => {
                    setUploadGroup(null)
                    setDocNo('')
                  }}
                  title={t('ใส่ Doc NO. 4M ให้ทั้งกลุ่ม', 'Enter the 4M Doc NO. for the whole group')}
                  subtitle={uploadGroup ? `${uploadGroup.line} / ${uploadGroup.model}` : ''}
                  icon={FileText}
                  tone="red"
                  size="md"
                  footer={
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setUploadGroup(null)
                          setDocNo('')
                        }}
                        disabled={uploadBusy}
                      >
                        {t('ปิด', 'Close')}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        icon={FileText}
                        disabled={uploadBusy || !docNo.trim()}
                        onClick={submitGroupDocNo}
                      >
                        {uploadBusy
                          ? t('กำลังบันทึก…', 'Saving…')
                          : t('บันทึกให้ทั้งกลุ่ม', 'Save to group')}
                      </Button>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <p className="text-[12px] font-semibold text-red-700">
                      {t('ใส่ Doc NO. + บอกจำนวนวันที่จะทำ PM ระบบจะใช้กับทุกตัวในกลุ่มนี้', 'Enter the Doc NO. and the PM days — it applies to every fixture in this group')}
                    </p>
                    <label className="flex w-full flex-col gap-1 text-[10px] font-bold text-red-700">
                      {t('Doc NO. 4M', '4M Doc NO.')}
                      <Input
                        value={docNo}
                        disabled={uploadBusy}
                        maxLength={120}
                        placeholder={t('เช่น 4M-2026-001', 'e.g. 4M-2026-001')}
                        onChange={(event) => setDocNo(event.target.value)}
                        className="field-input-sm font-mono"
                      />
                    </label>
                    {docNo.trim() ? (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">
                        Doc NO.: {docNo.trim()}
                      </div>
                    ) : (
                      <p className="text-[11px] font-semibold text-slate-400">
                        {t('ยังไม่ได้กรอก Doc NO.', 'No Doc NO. entered yet')}
                      </p>
                    )}
                    <label className="flex w-full flex-col gap-1 text-[10px] font-bold text-red-700 sm:w-[160px]">
                      {t('PM กี่วัน', 'PM days')}
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={uploadDays}
                        disabled={uploadBusy}
                        onChange={(event) => setUploadDays(Number(event.target.value) || 1)}
                        className="field-input-sm"
                      />
                    </label>
                    <p className={cn(
                      'text-[11px] font-bold',
                      Number(uploadDays) > 7 ? 'text-amber-700' : 'text-slate-500',
                    )}>
                      {Number(uploadDays) > 7
                        ? t('เกิน 7 วัน → ระบบตั้งเป็น PM Pending รอ Admin กด ยืนยัน / Reject ก่อนเข้าซ่อม', 'Over 7 days → PM Pending, waiting for Admin to Approve / Reject before repair')
                        : t('ไม่เกิน 7 วัน → บันทึก Doc NO. แล้วสถานะยังเป็น PM รอกด “กำลังทำ PM”', '7 days or less → Doc NO. saved, status stays PM until “Start PM”')}
                    </p>
                  </div>
                </Modal>
              </div>

              {/* PM over 7 days waits here for Admin before it can enter Maintenance. */}
              {/* PM over 7 days waits here for Admin before it can enter Maintenance. */}
              <div className="px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[13px] font-black text-amber-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-black text-white">2</span>
                    <ShieldCheck className="h-4 w-4" /> {t('รอ Admin อนุมัติ PM เกิน 7 วัน', 'Awaiting Admin approval · PM over 7 days')}
                  </p>
                  <span className="text-[10px] font-bold text-slate-400">
                    {isAdmin
                      ? t('กดยืนยันหรือ Reject (ใส่รหัสผ่าน)', 'Approve or Reject (password required)')
                      : t('เฉพาะ Admin ที่กดได้', 'Admin only')}
                  </span>
                </div>
                {pendingGroups.length === 0 ? (
                  <p className="mt-2 text-[11px] font-semibold text-slate-400">
                    {t('ไม่มี PM ที่รอ Admin ในขณะนี้', 'No PM is waiting for Admin right now')}
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {pendingGroups.map((group) => (
                      <div key={group.key} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                        <p className="font-mono text-[12px] font-black text-slate-800">
                          {group.line} / {group.model}
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {group.pendingRows.map((row) => (
                            <div key={row.sn} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-1.5">
                              <div className="min-w-0 flex-1">
                                <span className="font-mono text-[11px] font-black text-slate-800">{row.sn}</span>
                                <span className="ml-2 text-[10px] font-bold text-amber-700">
                                  {t(`ขอ PM ${row.pmRequestedDays || 0} วัน`, `PM ${row.pmRequestedDays || 0} day(s)`)}
                                </span>
                              </div>
                              {isAdmin ? (
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="success"
                                    icon={CheckCircle2}
                                    disabled={busy}
                                    onClick={() => openApproval(row, 'approve')}
                                  >
                                    {t('ยืนยัน', 'Approve')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    icon={XCircle}
                                    disabled={busy}
                                    onClick={() => openApproval(row, 'reject')}
                                  >
                                    {t('Reject', 'Reject')}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Start PM is one click per Line + Model — no filter dance first. */}
              <div className="px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[13px] font-black text-purple-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[11px] font-black text-white">3</span>
                    <CalendarClock className="h-4 w-4" /> {t('กำลังทำ PM ทั้งกลุ่ม', 'Start PM for whole group')}
                  </p>
                  <span className="text-[10px] font-bold text-slate-400">{t('ใส่รหัสผ่านตอนยืนยัน', 'Password to confirm')}</span>
                </div>
                {planGroups.length === 0 ? (
                  <p className="mt-2 text-[11px] font-semibold text-slate-400">{t('ไม่มีของพร้อมเริ่ม PM', 'Nothing ready to start PM')}</p>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {planGroups.map((group) => (
                      <div key={group.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[12px] font-black text-slate-800">
                            {group.line} / {group.model}
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                            {t(`${group.planRows.length} ตัวพร้อมเริ่ม PM`, `${group.planRows.length} fixture(s) ready to start PM`)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="purple"
                          icon={CalendarClock}
                          disabled={busy}
                          onClick={() => openGroupPlanFor(group.line, group.model)}
                        >
                          {t('กำลังทำ PM', 'Start PM')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </Card>
      </section>
      </div>

      {listOpen ? (
        <Modal
          open={listOpen}
          onClose={() => setListOpen(false)}
          title={t('รายการทั้งหมดตาม Line → Model', 'Full list by line → model')}
          subtitle={t(`${lineGroups.length} Line · ${groupRows.length} Fixture`, `${lineGroups.length} lines · ${groupRows.length} fixtures`)}
          icon={ClipboardList}
          tone="blue"
          size="2xl"
          bodyClassName="p-3 sm:p-4"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
              <select
                aria-label={t('กรองตาม Line', 'Filter by line')}
                className="field-input-sm w-full sm:w-32"
                value={lineFilter}
                onChange={(event) => {
                  setLineFilter(event.target.value)
                  setModelFilter('')
                  setTarget(null)
                }}
              >
                <option value="">{t('ทุก Line', 'All lines')}</option>
                {lineOptions.map((line) => (
                  <option key={line} value={line}>{line}</option>
                ))}
              </select>
              <select
                aria-label={t('กรองตาม Model', 'Filter by model')}
                className="field-input-sm w-full font-mono sm:w-44"
                value={modelFilter}
                onChange={(event) => {
                  setModelFilter(event.target.value)
                  setTarget(null)
                }}
              >
                <option value="">{t('ทุก Model', 'All models')}</option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <div className="w-full sm:w-56">{searchBox(query, setQuery, t('ค้นหา Line / Model / SN…', 'Search line / model / SN…'))}</div>
              <Button size="sm" variant="secondary" onClick={() => {
                setLineFilter('')
                setModelFilter('')
                setQuery('')
                setTarget(null)
              }}>
                {t('ล้างตัวกรอง', 'Clear filters')}
              </Button>
            </div>

            {loading ? (
              <Spinner label={t('กำลังโหลดข้อมูล…', 'Loading…')} />
            ) : error ? (
              <ErrorState message={sm(error)} onRetry={load} />
            ) : lineGroups.length === 0 ? (
              <EmptyState
                icon={Layers3}
                title={t('ไม่มี Line ที่ตรงกับเงื่อนไข', 'No matching line')}
                description={t('ลองเปลี่ยน Line / Model หรือคำค้นหา', 'Try another line, model, or search term')}
              />
            ) : (
              <div className="space-y-2">
                {lineGroups.map((group) => {
                  const open = isLineExpanded(group.line)
                  return (
                    <div key={group.line} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <button
                        type="button"
                        onClick={() => toggleLine(group.line)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <Layers3 className="h-3.5 w-3.5" strokeWidth={2.2} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-black text-slate-900">
                            {t('Line', 'Line')} {group.line}
                          </span>
                          <span className="block text-[9px] font-semibold text-slate-400">
                            {group.models.length} {t('Model', 'models')} · {group.rows.length} {t('Fixture', 'fixtures')}
                            {group.maintenanceCount > 0
                              ? ` · ${group.maintenanceCount} ${t('กำลังซ่อม', 'in maintenance')}`
                              : ''}
                          </span>
                        </span>
                        <span className="ml-auto flex flex-wrap items-center justify-end gap-1">
                          <Badge tone="red">{t('เกินกำหนด', 'Overdue')} {group.stats.overDue}</Badge>
                          <Badge tone="purple">{t('ถึงกำหนด', 'On due')} {group.stats.onDue}</Badge>
                          <Badge tone="orange">{t('แจ้งล่วงหน้า', 'Pre-alert')} {group.stats.preAlert}</Badge>
                        </span>
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform',
                            open && 'rotate-180',
                          )}
                        />
                      </button>

                      {open ? (
                        <div className="space-y-2 border-t border-slate-100 bg-slate-50/50 p-2">
                          {group.models.map((modelGroup) => {
                            const modelKey = `${group.line}|${modelGroup.model}`
                            const limit = showAllFixtures[modelKey] ? modelGroup.rows.length : 12
                            return (
                              <div key={modelKey} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-2 py-1.5">
                                  <div className="min-w-0">
                                    <p className="truncate font-mono text-[11px] font-black text-slate-800">
                                      {modelGroup.model}
                                    </p>
                                    <p className="text-[9px] font-semibold text-slate-400">
                                      {modelGroup.rows.length} {t('Fixture', 'fixtures')} ·{' '}
                                      {t('พร้อมเริ่ม PM', 'ready')} {modelGroup.planRows.length} ·{' '}
                                      {t('ติด 4M', '4M blocked')} {modelGroup.blockedRows.length}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {modelGroup.grouped ? (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        icon={FileText}
                                        onClick={() => openUploadGroup(group.line, modelGroup.model)}
                                      >
                                        {t('ใส่ Doc NO. กลุ่มนี้', 'Enter Doc NO. 4M')}
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="purple"
                                      icon={CalendarClock}
                                      disabled={busy || modelGroup.planRows.length === 0}
                                      onClick={() => {
                                        setListOpen(false)
                                        openGroupPlanFor(group.line, modelGroup.model)
                                      }}
                                    >
                                      {t('กำลังทำ PM กลุ่มนี้', 'Start PM this group')}
                                    </Button>
                                  </div>
                                </div>
                                {modelGroup.blockedRows.length > 0 ? (
                                  <p className="border-b border-red-100 bg-red-50/70 px-2 py-1 text-[9px] font-bold text-red-600">
                                    {t(
                                      `ต้องใส่ Doc NO. 4M ${modelGroup.blockedRows.length} ตัวก่อนเริ่ม PM กลุ่มนี้`,
                                      `${modelGroup.blockedRows.length} fixture(s) need a 4M Doc NO. before starting PM for this group`,
                                    )}
                                  </p>
                                ) : null}
                                <div className="grid gap-1.5 p-2 sm:grid-cols-2 xl:grid-cols-4">
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
                                    className="w-full border-t border-slate-100 py-1.5 text-center text-[9px] font-black text-blue-600 hover:bg-blue-50"
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
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Modal>
      ) : null}
        </>
      ) : (
        <section id="pm-verify" className="scroll-mt-4">
          <Card className="overflow-hidden">
            <div className="border-b border-emerald-100 bg-emerald-50/50 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                    <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-black text-slate-900">{t('Maintenance', 'Maintenance')}</h2>
                    <p className="mt-1 text-[12px] font-semibold text-slate-600">
                      {t('เลือก Fixture ทีละตัวหรือทั้ง Line → กด Maintenance เสร็จ (Done) หรือ NG', 'Tick fixtures or a whole line → press Maintenance done (OK) or NG')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-black">
                  <span className="rounded-xl bg-white px-3 py-2 text-emerald-700 ring-1 ring-emerald-200">
                    {t(`รอตรวจ ${mRows.length} ตัว`, `${mRows.length} awaiting Verify`)}
                  </span>
                  <span className="rounded-xl bg-white px-3 py-2 text-blue-700 ring-1 ring-blue-200">
                    {t(`เลือกแล้ว ${selectedRows.length} ตัว`, `${selectedRows.length} selected`)}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="min-w-[220px] flex-1">
                  {searchBox(mQuery, setMQuery, t('ค้นหา SN / Line / Model…', 'Search SN / line / model…'))}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={CheckCircle2}
                  disabled={visibleMaintenance.length === 0}
                  onClick={() => toggleVerifyRows(visibleMaintenance, true)}
                >
                  {t('เลือกทั้งหมด', 'Select all')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={selectedVerify.size === 0}
                  onClick={() => setSelectedVerify(new Set())}
                >
                  {t('ล้างที่เลือก', 'Clear')}
                </Button>
              </div>
            </div>

            {mLoading ? (
              <Spinner label={t('กำลังโหลดคิวซ่อม…', 'Loading repair queue…')} />
            ) : mError ? (
              <ErrorState message={sm(mError)} onRetry={load} />
            ) : verifyGroups.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title={t('ไม่มีของรอ Verify', 'Nothing awaiting Verify')}
                description={t(
                  'Fixture ที่เข้าซ่อมจะปรากฏที่นี่เมื่อพร้อมตรวจรับ',
                  'Repaired fixtures appear here when they are ready to verify',
                )}
              />
            ) : (
              <>
                <div className="max-h-[62vh] space-y-3 overflow-y-auto p-4 sm:p-5">
                  {verifyGroups.map((lineGroup) => {
                    const lineSelected = lineGroup.rows.every((row) => selectedVerify.has(row.sn))
                    return (
                      <div key={`line-${lineGroup.line}`} className="overflow-hidden rounded-2xl border border-slate-200">
                        <label className="flex items-center gap-2.5 bg-slate-50 px-3.5 py-2.5 text-[12px] font-black text-slate-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-emerald-600"
                            checked={lineSelected}
                            onChange={(event) => toggleVerifyRows(lineGroup.rows, event.target.checked)}
                          />
                          <Layers3 className="h-4 w-4 text-blue-500" />
                          <span>{t('Line', 'Line')} {lineGroup.line}</span>
                          <span className="ml-auto rounded-lg bg-white px-2 py-1 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200">
                            {lineGroup.rows.length}
                          </span>
                        </label>
                        <div className="divide-y divide-slate-100">
                          {lineGroup.models.map((modelGroup) => {
                            const modelSelected = modelGroup.rows.every((row) => selectedVerify.has(row.sn))
                            return (
                              <div key={`${lineGroup.line}-${modelGroup.model}`} className="px-3.5 py-2.5">
                                <label className="flex items-center gap-2.5 text-[11px] font-black text-slate-600">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-emerald-600"
                                    checked={modelSelected}
                                    onChange={(event) => toggleVerifyRows(modelGroup.rows, event.target.checked)}
                                  />
                                  <span className="font-mono uppercase">{modelGroup.model}</span>
                                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                                    {modelGroup.rows.length}
                                  </span>
                                </label>
                                <div className="mt-2 grid gap-1.5 pl-6 sm:grid-cols-2">
                                  {modelGroup.rows.map((row) => {
                                    const due = pmDueDateOf(row)
                                    const days = daysUntil(due)
                                    return (
                                      <label
                                        key={row.sn}
                                        className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-emerald-200 hover:bg-emerald-50/60"
                                      >
                                        <input
                                          type="checkbox"
                                          className="mt-0.5 h-4 w-4 accent-emerald-600"
                                          checked={selectedVerify.has(row.sn)}
                                          onChange={() => toggleVerify(row.sn)}
                                        />
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate font-mono text-[12px] font-black text-slate-800">{row.sn}</span>
                                          <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">
                                            {t('ครบกำหนด PM', 'PM due')}: {formatDate(due)}
                                            {days === null
                                              ? ''
                                              : days < 0
                                                ? ` · ${t(`เกิน ${-days} วัน`, `${-days} days overdue`)}`
                                                : ` · ${t(`อีก ${days} วัน`, `${days} days left`)}`}
                                          </span>
                                        </span>
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
                  <p className="text-[12px] font-black text-emerald-700">
                    {t(`เลือกแล้ว ${selectedRows.length} ตัว`, `${selectedRows.length} selected`)} ·{' '}
                    <span className="font-semibold text-slate-500">
                      {t('Done → In Stock · NG → Order', 'Done → In Stock · NG → Order')}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      icon={CheckCircle2}
                      disabled={selectedRows.length === 0}
                      onClick={() => openBulkVerify('OK')}
                    >
                      {t('Maintenance เสร็จ (Done)', 'Maintenance done (OK)')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={XCircle}
                      disabled={selectedRows.length === 0}
                      onClick={() => openBulkVerify('NG')}
                    >
                      {t('NG', 'NG')}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </section>
      )}

      {/* ---------- Plan PM modal (line + model group, password required) ---------- */}
      <Modal
        open={Boolean(target)}
        onClose={() => (busy ? null : setTarget(null))}
        title={target
          ? target.type === 'single'
            ? t(`กำลังทำ PM · ${target.fixture.sn}`, `Start PM · ${target.fixture.sn}`)
            : t(`กำลังทำ PM · ${target.line} / ${target.model}`, `Start PM · ${target.line} / ${target.model}`)
          : t('กำลังทำ PM', 'Start PM')}
        subtitle={t(
          `เปลี่ยน PM → Maintenance · ${target?.rows.length || 0} ตัว`,
          `Move PM → Maintenance · ${target?.rows.length || 0} fixture(s)`,
        )}
        icon={CalendarClock}
        tone="orange"
        size="md"
        initialFocus="[data-modal-autofocus]"
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
              {busy ? t('กำลังบันทึก…', 'Saving…') : t('กำลังทำ PM', 'Start PM')}
            </Button>
          </div>
        }
      >
        {target ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                {t('Fixture ที่จะเริ่ม PM', 'Fixtures to start')} ({target.rows.length})
              </p>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {target.rows.map((row, index) => (
                  <li key={`${row.sn}-${index}`} className="text-[11px] font-bold text-slate-700">
                    <span className="font-mono">{row.sn}</span>
                    <span className="ml-2 font-medium text-slate-400">
                      {row.model || '-'} · {t('PM due', 'PM due')} {formatDate(pmDueDateOf(row))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {target.blocked?.length ? (
              <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-600">
                  {t('ข้าม — ต้องใส่ Doc NO. 4M ก่อน', 'Skipped — 4M Doc NO. required first')}
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
            <FormField label={t('วันที่เริ่ม PM', 'PM start date')}>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </FormField>
            <FormField label={t('รหัสผ่านเพื่อยืนยัน', 'Password to confirm')}>
              <Input
                data-modal-autofocus
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('รหัสผ่าน', 'Password')}
              />
            </FormField>
          </div>
        ) : null}
      </Modal>

      {/* ---------- Bulk Verify modal (password required) ---------- */}
      <Modal
        open={Boolean(bulkVerify)}
        onClose={() => (bulkBusy ? null : setBulkVerify(null))}
        title={bulkVerify
          ? bulkVerify.result === 'OK'
            ? t(`Done (OK) · ${bulkVerify.rows.length} ตัว`, `Done (OK) · ${bulkVerify.rows.length} fixture(s)`)
            : t(`NG · ${bulkVerify.rows.length} ตัว`, `NG · ${bulkVerify.rows.length} fixture(s)`)
          : t('Maintenance', 'Maintenance')}
        subtitle={t('ยืนยันผล Maintenance ก่อนปิดงาน Order', 'Confirm maintenance result before closing the order')}
        icon={ShieldCheck}
        tone={bulkVerify?.result === 'OK' ? 'emerald' : 'red'}
        size="md"
        initialFocus="[data-modal-autofocus]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBulkVerify(null)} disabled={bulkBusy}>
              {t('ยกเลิก', 'Cancel')}
            </Button>
            <Button
              variant={bulkVerify?.result === 'OK' ? 'success' : 'danger'}
              onClick={confirmBulkVerify}
              disabled={bulkBusy}
            >
              {bulkBusy
                ? t('กำลังบันทึก…', 'Saving…')
                : `${t('ยืนยัน', 'Confirm')} ${bulkVerify?.result || ''}`}
            </Button>
          </div>
        }
      >
        {bulkVerify ? (
          <div className="space-y-3">
            {bulkVerify.result === 'OK' ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11px] font-bold text-emerald-700">
                {t(
                  'Fixture ที่ยืนยัน Maintenance เสร็จจะกลับเข้า In Stock และปิดคำขอ Order ที่รออยู่ให้ด้วย — นาฬิกา PM 90 วันเริ่มตอนจ่ายออกครั้งต่อไป',
                  'Confirmed fixtures return to In Stock and close any linked waiting order — the 90-day PM clock restarts at the next issue',
                )}
              </div>
            ) : (
              <FormField label={t('ผลการตรวจ (NG)', 'Inspection result (NG)')}>
                <select
                  className="field-input-sm w-full"
                  value={bulkOutcome}
                  onChange={(event) => setBulkOutcome(event.target.value)}
                >
                  {OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {outcomeLabel(o.value, t)}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                {t('Fixture ที่เลือก', 'Selected fixtures')} ({bulkVerify.rows.length})
              </p>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                {bulkVerify.rows.map((row) => (
                  <li key={row.sn} className="text-[11px] font-bold text-slate-700">
                    <span className="font-mono">{row.sn}</span>
                    <span className="ml-2 text-[10px] font-medium text-slate-400">
                      {row.line || '-'} · {row.model || '-'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {bulkVerify.result === 'OK' && bulkVerify.rows.length === 1 ? (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11px] font-bold text-emerald-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-600"
                  checked={printSticker}
                  onChange={() => setPrintSticker((v) => !v)}
                />
                <Printer className="h-4 w-4" /> {t('พิมพ์สติกเกอร์อัตโนมัติ', 'Auto Print Sticker')}
              </label>
            ) : null}
            <FormField label={t('รหัสผ่านเพื่อยืนยัน', 'Password to confirm')}>
              <Input
                data-modal-autofocus
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('รหัสผ่าน', 'Password')}
              />
            </FormField>
          </div>
        ) : null}
      </Modal>

      {/* ---------- Admin approve / reject PM > 7 days (password required) ---------- */}
      <Modal
        open={Boolean(approvalTarget)}
        onClose={() => (busy ? null : setApprovalTarget(null))}
        title={approvalTarget?.action === 'approve'
          ? t('ยืนยันให้ PM เกิน 7 วัน', 'Approve PM over 7 days')
          : t('Reject การขอ PM เกิน 7 วัน', 'Reject PM over 7 days')}
        subtitle={approvalTarget?.fixture?.sn || ''}
        icon={approvalTarget?.action === 'approve' ? CheckCircle2 : XCircle}
        tone={approvalTarget?.action === 'approve' ? 'emerald' : 'red'}
        size="sm"
        initialFocus="[data-modal-autofocus]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setApprovalTarget(null)} disabled={busy}>
              {t('ยกเลิก', 'Cancel')}
            </Button>
            <Button
              variant={approvalTarget?.action === 'approve' ? 'success' : 'danger'}
              onClick={confirmApproval}
              disabled={busy || !isAdmin}
            >
              {busy
                ? t('กำลังบันทึก…', 'Saving…')
                : approvalTarget?.action === 'approve'
                  ? t('ยืนยัน', 'Approve')
                  : t('Reject', 'Reject')}
            </Button>
          </div>
        }
      >
        {approvalTarget ? (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500">
              {approvalTarget.fixture.line} · {approvalTarget.fixture.model} ·{' '}
              {t(`ขอทำ PM ${approvalTarget.fixture.pmRequestedDays || 0} วัน`, `PM ${approvalTarget.fixture.pmRequestedDays || 0} day(s)`)}
            </p>
            <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] font-bold text-amber-700">
              {approvalTarget.action === 'approve'
                ? t('ถ้ายืนยัน สถานะจะเปลี่ยนเป็น Maintenance เพื่อเข้าซ่อม', 'Approving moves this fixture to Maintenance')
                : t('ถ้า Reject สถานะจะกลับเป็น PM ให้ขอใหม่ได้', 'Rejecting sends it back to PM so it can be requested again')}
            </p>
            <FormField label={t('รหัสผ่านเพื่อยืนยัน', 'Password to confirm')}>
              <Input
                data-modal-autofocus
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
          {sticker.exp ? <p>{t('PM ถัดไป', 'NEXT PM')}: {formatDate(sticker.exp)}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
