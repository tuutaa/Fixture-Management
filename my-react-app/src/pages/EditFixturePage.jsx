import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Boxes,
  Database,
  Info,
  Lock,
  PencilLine,
  Plus,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import api from '../lib/api'
import {
  FIXTURE_STATUS_OPTIONS,
  buildProcessTypeOptions,
  fixtureTone,
  processTypeLabel,
} from '../lib/constants'
import {
  Card,
  EmptyState,
  InfoRow,
  PageHeader,
  SectionHeader,
  Spinner,
} from '../components/ui/Card'
import { FormField, Input, InputSm } from '../components/ui/Field'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import SearchableSelect from '../components/ui/SearchableSelect'
import Tabs from '../components/ui/Tabs'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { cn, formatDate, formatDateTime, toDateInput } from '../lib/format'
import { useLabels, useServerMessage } from '../lib/i18n'

const EMPTY_FILTERS = {
  line: '',
  model: '',
  status: '',
  type: '',
  step: '',
  process: '',
  position: '',
  storage: '',
  fixtureBase: '',
  revision: '',
}

const FIELD_LABELS = {
  line: ['Line', 'Line'],
  model: ['Model', 'Model'],
  type: ['Process Type', 'Process Type'],
  step: ['Step', 'Step'],
  process: ['Process', 'Process'],
  position: ['Position', 'Position'],
  usageStorage: ['ตำแหน่งเก็บ', 'Storage'],
  fixtureBase: ['Fixture Base', 'Fixture Base'],
  revision: ['Revision', 'Revision'],
  current: ['การใช้งานปัจจุบัน', 'Usage current'],
  max: ['การใช้งานสูงสุด', 'Usage max'],
  exp: ['Exp (PM Due)', 'Exp (PM Due)'],
  registeredDate: ['วันที่ลงทะเบียน', 'Registered date'],
  desc: ['รายละเอียด', 'Description'],
}

const emptyForm = {
  line: '',
  model: '',
  type: '',
  fixtureBase: '',
  revision: '',
  step: '',
  process: '',
  position: '',
  current: 0,
  max: 0,
  exp: '',
  usageStorage: '',
  desc: '',
  registeredDate: '',
}

const formFromFixture = (fixture) => ({
  line: fixture?.line || '',
  model: fixture?.model || '',
  type: processTypeLabel(fixture?.type),
  fixtureBase: fixture?.fixtureBase || '',
  revision: fixture?.revision || '',
  step: fixture?.step || '',
  process: fixture?.process || '',
  position: fixture?.position || '',
  current: Number(fixture?.usage?.current) || 0,
  max: Number(fixture?.usage?.max) || 0,
  exp: toDateInput(fixture?.usage?.exp),
  usageStorage: fixture?.usage?.storage || fixture?.storage || '',
  desc: fixture?.desc || '',
  registeredDate: toDateInput(fixture?.registered?.date),
})

const sortValues = (values) =>
  [...new Set((values || []).filter((value) => value !== '' && value !== null && value !== undefined))].sort(
    (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }),
  )

const toOptions = (values, labelFn) =>
  sortValues(values).map((value) => ({ value, label: labelFn ? labelFn(value) : String(value) }))

const valuesFor = (options, key) => (Array.isArray(options?.[key]) ? options[key] : [])

/* Mirrors Register: once Process is chosen, Position offers only its positions. */
const positionsForProcess = (options, processValue) => {
  const byProcess = options?.positionByProcess
  if (processValue && byProcess && Array.isArray(byProcess[processValue])) return byProcess[processValue]
  return valuesFor(options, 'positions')
}

/* Mirrors the shared status chip markup, with a translated label. */
const StatusBadge = ({ status, label }) => {
  const tone = fixtureTone(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset',
        tone.chip,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
      {label}
    </span>
  )
}

export default function EditFixturePage({ user }) {
  const { t, fixtureStatus } = useLabels()
  const sm = useServerMessage()
  const toast = useToast()
  const editorRef = useRef(null)
  const scrollToEditorRef = useRef(false)

  const [activeTab, setActiveTab] = useState('fixture')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [results, setResults] = useState([])
  const [resultsLoading, setResultsLoading] = useState(true)
  const [resultsError, setResultsError] = useState('')
  const [fieldOptions, setFieldOptions] = useState({})
  const [fixture, setFixture] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [originalForm, setOriginalForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [fixtureHistory, setFixtureHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Storage management state
  const [storages, setStorages] = useState([])
  const [storageLoading, setStorageLoading] = useState(false)
  const [storageSearch, setStorageSearch] = useState('')
  const [storageModal, setStorageModal] = useState(null) // null | { mode: 'create' | 'edit', data?: object }
  const [storageForm, setStorageForm] = useState({ location: '', desc: '' })
  const [storageBusy, setStorageBusy] = useState(false)

  const loadStorages = useCallback(async () => {
    try {
      setStorageLoading(true)
      const data = await api.storages()
      setStorages(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(
        err.message ? sm(err.message) : t('โหลดตำแหน่งเก็บไม่สำเร็จ', 'Failed to load storage locations'),
      )
    } finally {
      setStorageLoading(false)
    }
  }, [sm, t, toast])

  const loadFieldOptions = useCallback(async () => {
    try {
      const data = await api.editFixtureOptions()
      setFieldOptions(data || {})
    } catch {
      // Filter dropdowns still work from the values already present in results.
      setFieldOptions((current) => current || {})
    }
  }, [])

  const fetchFixtures = useCallback(
    async (values = EMPTY_FILTERS) => {
      setResultsLoading(true)
      setResultsError('')
      try {
        const data = await api.editFixtures(values)
        setResults(Array.isArray(data) ? data : [])
      } catch (err) {
        setResults([])
        setResultsError(sm(err.message))
      } finally {
        setResultsLoading(false)
      }
    },
    [sm],
  )

  useEffect(() => {
    fetchFixtures(EMPTY_FILTERS)
    loadFieldOptions()
    loadStorages()
  }, [fetchFixtures, loadFieldOptions, loadStorages])

  // After choosing a row, bring the editor into view without manual scrolling.
  useEffect(() => {
    if (!scrollToEditorRef.current || loading || !fixture) return
    scrollToEditorRef.current = false
    const frame = requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [fixture, loading])

  const setFilter = (key, value) =>
    setFilters((current) => {
      const next = { ...current, [key]: value }
      if (key === 'process' && value !== current.process) next.position = ''
      return next
    })
  const runSearch = () => fetchFixtures(filters)
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    fetchFixtures(EMPTY_FILTERS)
  }

  const loadSelected = useCallback(
    async (sn) => {
      const value = String(sn || '').trim()
      if (!value) return
      setLoading(true)
      try {
        const data = await api.fixture(value)
        const nextForm = formFromFixture(data.fixture)
        scrollToEditorRef.current = true
        setFixture(data.fixture)
        setForm(nextForm)
        setOriginalForm(nextForm)
        setHistoryLoading(true)
        api.history({ sn: data.fixture?.sn || value, limit: 50 })
          .then((events) => setFixtureHistory(Array.isArray(events) ? events : []))
          .catch(() => setFixtureHistory([]))
          .finally(() => setHistoryLoading(false))
      } catch (err) {
        scrollToEditorRef.current = false
        setFixture(null)
        toast.error(
          err.status === 404
            ? t(`ไม่พบ ${value}`, `${value} not found`)
            : sm(err.message),
        )
      } finally {
        setLoading(false)
      }
    },
    [sm, t, toast],
  )

  const clearSelection = () => {
    setFixture(null)
    setForm(emptyForm)
    setOriginalForm(emptyForm)
    setFixtureHistory([])
  }

  const setField = (key, value) =>
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'process' && value !== current.process) next.position = ''
      return next
    })

  const statusValues = valuesFor(fieldOptions, 'statuses').length
    ? valuesFor(fieldOptions, 'statuses')
    : FIXTURE_STATUS_OPTIONS.map((option) => option.value)

  // Every filter is a populated dropdown — no free-text fields in the filter zone.
  const lineFilterOptions = useMemo(() => toOptions(valuesFor(fieldOptions, 'lines')), [fieldOptions])
  const modelFilterOptions = useMemo(() => toOptions(valuesFor(fieldOptions, 'models')), [fieldOptions])
  const processTypeFilterOptions = useMemo(
    () => buildProcessTypeOptions(valuesFor(fieldOptions, 'types')),
    [fieldOptions],
  )
  const stepFilterOptions = useMemo(() => toOptions(valuesFor(fieldOptions, 'steps')), [fieldOptions])
  const processFilterOptions = useMemo(() => toOptions(valuesFor(fieldOptions, 'processes')), [fieldOptions])
  const positionFilterOptions = useMemo(
    () => toOptions(positionsForProcess(fieldOptions, filters.process)),
    [fieldOptions, filters.process],
  )
  const storageFilterOptions = useMemo(
    () => toOptions([...valuesFor(fieldOptions, 'storages'), ...storages.map((row) => row.location)]),
    [fieldOptions, storages],
  )
  const fixtureBaseFilterOptions = useMemo(
    () => toOptions(valuesFor(fieldOptions, 'fixtureBases')),
    [fieldOptions],
  )
  const revisionFilterOptions = useMemo(
    () => toOptions(valuesFor(fieldOptions, 'revisions')),
    [fieldOptions],
  )
  const statusFilterOptions = useMemo(
    () => toOptions(statusValues, (value) => fixtureStatus(value)),
    [fixtureStatus, statusValues],
  )

  // Edit fields keep the register-style Process → Position dependency.
  // Status is read-only here; Line/Model are editable. The `type` field is a process type.
  const lineOptions = useMemo(
    () => toOptions([...valuesFor(fieldOptions, 'lines'), form.line]),
    [fieldOptions, form.line],
  )
  const modelOptions = useMemo(
    () => toOptions([...valuesFor(fieldOptions, 'models'), form.model]),
    [fieldOptions, form.model],
  )
  const processTypeOptions = useMemo(
    () => buildProcessTypeOptions([...valuesFor(fieldOptions, 'types'), form.type]),
    [fieldOptions, form.type],
  )
  const stepOptions = useMemo(
    () => toOptions([...valuesFor(fieldOptions, 'steps'), form.step]),
    [fieldOptions, form.step],
  )
  const processOptions = useMemo(
    () => toOptions([...valuesFor(fieldOptions, 'processes'), form.process]),
    [fieldOptions, form.process],
  )
  const positionOptions = useMemo(
    () => toOptions([...positionsForProcess(fieldOptions, form.process), form.position]),
    [fieldOptions, form.position, form.process],
  )
  const storageOptions = useMemo(
    () => toOptions([...valuesFor(fieldOptions, 'storages'), ...storages.map((row) => row.location), form.usageStorage]),
    [fieldOptions, storages, form.usageStorage],
  )

  const filterFields = useMemo(
    () => [
      { key: 'line', label: t('Line', 'Line'), options: lineFilterOptions },
      { key: 'model', label: t('Model', 'Model'), options: modelFilterOptions },
      { key: 'status', label: t('สถานะ', 'Status'), options: statusFilterOptions },
      { key: 'type', label: t('Process Type', 'Process Type'), options: processTypeFilterOptions },
      { key: 'step', label: t('Step', 'Step'), options: stepFilterOptions },
      { key: 'process', label: t('Process', 'Process'), options: processFilterOptions },
      { key: 'position', label: t('Position', 'Position'), options: positionFilterOptions },
      { key: 'storage', label: t('ตำแหน่งเก็บ', 'Storage'), options: storageFilterOptions },
      { key: 'fixtureBase', label: t('Fixture Base', 'Fixture Base'), options: fixtureBaseFilterOptions },
      { key: 'revision', label: t('Revision', 'Revision'), options: revisionFilterOptions },
    ],
    [
      t,
      lineFilterOptions,
      modelFilterOptions,
      statusFilterOptions,
      processTypeFilterOptions,
      stepFilterOptions,
      processFilterOptions,
      positionFilterOptions,
      storageFilterOptions,
      fixtureBaseFilterOptions,
      revisionFilterOptions,
    ],
  )

  const dirtyFields = useMemo(() => {
    const keys = Object.keys(emptyForm)
    return new Set(keys.filter((key) => String(form[key] ?? '') !== String(originalForm[key] ?? '')))
  }, [form, originalForm])

  const changedSummary = useMemo(
    () =>
      [...dirtyFields].map((key) => {
        const [th, en] = FIELD_LABELS[key] || [key, key]
        return t(th, en)
      }),
    [dirtyFields, t],
  )

  const dirtyClass = (key) =>
    dirtyFields.has(key) ? 'border-amber-300 bg-amber-50/70 ring-2 ring-amber-400' : ''

  // Mirror FixtureListPage "Fixture" view exactly — flat table only, no action column.
  const resultColumns = useMemo(
    () => [
      {
        key: 'sn',
        header: t('Serial Number', 'Serial Number'),
        render: (row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              loadSelected(row.sn)
            }}
            className="font-mono text-xs font-black text-slate-800 hover:text-blue-700 hover:underline"
          >
            {row.sn}
          </button>
        ),
      },
      {
        key: 'type',
        header: t('Process Type', 'Process Type'),
        render: (row) => <span className="text-[11px] text-slate-600">{processTypeLabel(row.type) || '-'}</span>,
      },
      {
        key: 'line',
        header: t('Line', 'Line'),
        render: (row) => <span className="text-xs font-semibold text-slate-700">{row.line || '-'}</span>,
      },
      {
        key: 'model',
        header: t('Model', 'Model'),
        render: (row) => <span className="font-mono text-[10px] text-slate-600">{row.model || '-'}</span>,
      },
      {
        key: 'step',
        header: t('Step', 'Step'),
        render: (row) => <span className="text-xs text-slate-600">{row.step || '-'}</span>,
      },
      {
        key: 'process',
        header: t('Process', 'Process'),
        render: (row) => <span className="text-[11px] text-slate-600">{row.process || '-'}</span>,
      },
      {
        key: 'position',
        header: t('Position', 'Position'),
        render: (row) => <span className="text-[11px] text-slate-600">{row.position || '-'}</span>,
      },
      {
        key: 'storage',
        header: t('ตำแหน่งเก็บ', 'Storage'),
        render: (row) => (
          <span className="text-[11px] font-medium text-slate-700">
            {row.usage?.storage || row.storage || '-'}
          </span>
        ),
      },
      {
        key: 'fixtureBase',
        header: t('Fixture Base', 'Fixture Base'),
        render: (row) => <span className="font-mono text-[10px] text-slate-600">{row.fixtureBase || '-'}</span>,
      },
      {
        key: 'status',
        header: t('สถานะ', 'Status'),
        align: 'center',
        render: (row) => <StatusBadge status={row.status} label={fixtureStatus(row.status)} />,
      },
    ],
    [fixtureStatus, loadSelected, t],
  )

  const save = async (event) => {
    event.preventDefault()
    if (!fixture) return
    setBusy(true)
    try {
      const payload = {
        line: form.line,
        model: form.model,
        type: form.type,
        fixtureBase: form.fixtureBase,
        revision: form.revision,
        step: form.step,
        process: form.process,
        position: form.position,
        desc: form.desc,
        registeredDate: form.registeredDate || null,
        usage: {
          current: Number(form.current) || 0,
          max: Number(form.max) || 0,
          exp: form.exp,
          storage: form.usageStorage,
        },
        user,
      }
      const data = await api.updateFixture(fixture.sn, payload)
      const savedForm = formFromFixture(data.fixture)
      setFixture(data.fixture)
      setForm(savedForm)
      setOriginalForm(savedForm)
      toast.success(
        t(`บันทึก ${fixture.sn} สำเร็จ`, `Saved ${fixture.sn} successfully`),
        { title: t('บันทึกการแก้ไขแล้ว', 'Edit saved') },
      )
      await Promise.all([fetchFixtures(filters), loadFieldOptions()])
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setBusy(false)
    }
  }

  const askDelete = () => {
    if (!fixture) return
    setConfirm({
      title: t(`ลบ ${fixture.sn}`, `Delete ${fixture.sn}`),
      message: t(
        `ต้องการลบ Fixture ${fixture.sn} ออกจากระบบหรือไม่ — การลบจะถูกบันทึกใน History`,
        `Delete fixture ${fixture.sn} from the system? — the deletion will be recorded in history`,
      ),
      tone: 'red',
      confirmLabel: t('ลบ Fixture', 'Delete fixture'),
      onConfirm: async () => {
        setBusy(true)
        try {
          await api.deleteFixture(fixture.sn, user)
          toast.success(t(`ลบ ${fixture.sn} แล้ว`, `Deleted ${fixture.sn}`))
          setConfirm(null)
          clearSelection()
          await Promise.all([fetchFixtures(filters), loadFieldOptions()])
        } catch (err) {
          toast.error(sm(err.message))
        } finally {
          setBusy(false)
        }
      },
    })
  }

  // Storage actions
  const openCreateStorage = () => {
    setStorageForm({ location: '', desc: '' })
    setStorageModal({ mode: 'create' })
  }

  const openEditStorage = (item) => {
    setStorageForm({ location: item.location || '', desc: item.desc || '' })
    setStorageModal({ mode: 'edit', data: item })
  }

  const saveStorage = async (e) => {
    e?.preventDefault?.()
    const location = storageForm.location.trim()
    if (!location) {
      toast.error(t('กรุณาระบุตำแหน่งเก็บ', 'Please specify a storage location'))
      return
    }
    setStorageBusy(true)
    try {
      if (storageModal?.mode === 'create') {
        await api.createStorage({ location, desc: storageForm.desc })
        toast.success(t(`เพิ่มตำแหน่งเก็บ ${location} เรียบร้อยแล้ว`, `Added storage ${location} successfully`))
      } else if (storageModal?.mode === 'edit' && storageModal.data?._id) {
        await api.updateStorage(storageModal.data._id, { location, desc: storageForm.desc })
        toast.success(t(`แก้ไขตำแหน่งเก็บ ${location} เรียบร้อยแล้ว`, `Updated storage ${location} successfully`))
      }
      setStorageModal(null)
      await Promise.all([loadStorages(), loadFieldOptions()])
    } catch (err) {
      toast.error(
        err.message
          ? sm(err.message)
          : t('บันทึกตำแหน่งเก็บไม่สำเร็จ', 'Failed to save storage location'),
      )
    } finally {
      setStorageBusy(false)
    }
  }

  const askDeleteStorage = (item) => {
    setConfirm({
      title: t(`ลบตำแหน่งเก็บ ${item.location}`, `Delete storage ${item.location}`),
      message: t(
        `ต้องการลบตำแหน่งเก็บ "${item.location}" หรือไม่?`,
        `Delete storage location "${item.location}"?`,
      ),
      tone: 'red',
      confirmLabel: t('ลบตำแหน่งเก็บ', 'Delete storage'),
      onConfirm: async () => {
        setStorageBusy(true)
        try {
          await api.deleteStorage(item._id)
          toast.success(t(`ลบตำแหน่งเก็บ ${item.location} เรียบร้อยแล้ว`, `Deleted storage ${item.location} successfully`))
          setConfirm(null)
          await Promise.all([loadStorages(), loadFieldOptions()])
        } catch (err) {
          toast.error(
            err.message
              ? sm(err.message)
              : t('ลบตำแหน่งเก็บไม่สำเร็จ', 'Failed to delete storage location'),
          )
        } finally {
          setStorageBusy(false)
        }
      },
    })
  }

  const filteredStorages = useMemo(() => {
    const q = storageSearch.trim().toLowerCase()
    if (!q) return storages
    return storages.filter(
      (s) =>
        (s.location && s.location.toLowerCase().includes(q)) ||
        (s.desc && s.desc.toLowerCase().includes(q)),
    )
  }, [storages, storageSearch])

  const storageColumns = [
    {
      key: 'location',
      header: t('ตำแหน่งเก็บ', 'Storage location'),
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-800">{row.location}</span>
      ),
    },
    {
      key: 'desc',
      header: t('คำอธิบาย', 'Description'),
      render: (row) => (
        <span className="text-xs text-slate-600">{row.desc || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: t('จัดการ', 'Actions'),
      align: 'right',
      sortable: false,
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon={PencilLine}
            onClick={() => openEditStorage(row)}
          >
            {t('แก้ไข', 'Edit')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            onClick={() => askDeleteStorage(row)}
          >
            {t('ลบ', 'Delete')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('Fixture', 'Fixture')}
        icon={PencilLine}
        title={t('แก้ไข', 'Edit')}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          size="sm"
          tabs={[
            { value: 'fixture', label: t('Fixture', 'Fixture'), icon: Boxes },
            { value: 'storage', label: t('ตำแหน่งเก็บ', 'Storage'), icon: Database },
          ]}
        />
        <span className="text-[11px] font-semibold text-slate-400">
          {activeTab === 'fixture'
            ? t(`${results.length.toLocaleString()} Fixture`, `${results.length.toLocaleString()} fixtures`)
            : t(`${storages.length.toLocaleString()} ตำแหน่งเก็บ`, `${storages.length.toLocaleString()} storage locations`)}
        </span>
      </div>

      {activeTab === 'fixture' ? (
        <div className="space-y-5">
          {/* 1 + 2. Filter zone and Fixture List-style result table sit side by side */}
          <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
            {/* 1. Filter zone — same fixed height as the result zone */}
            <Card className="p-4 sm:p-5 lg:h-[500px]">
              <SectionHeader
                icon={SlidersHorizontal}
                title={t('กรองข้อมูล Fixture', 'Filter fixtures')}
                desc={t('ทุกช่องเป็น dropdown ที่มีข้อมูลจาก fixtureDetail — SN ค้นหาได้จากตาราง', 'Every field is a populated dropdown — find SN in the result table')}
                className="mb-4"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {filterFields.map((field) => (
                  <FormField key={field.key} label={field.label}>
                    <SearchableSelect
                      size="sm"
                      value={filters[field.key]}
                      onChange={(value) => setFilter(field.key, value)}
                      options={field.options}
                      placeholder={t('ทั้งหมด', 'All')}
                      clearable
                    />
                  </FormField>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button icon={Search} onClick={runSearch} disabled={resultsLoading}>
                    {resultsLoading ? t('กำลังค้นหา…', 'Searching…') : t('Search', 'Search')}
                  </Button>
                  <Button variant="secondary" icon={RotateCcw} onClick={clearFilters} disabled={resultsLoading}>
                    {t('ล้างตัวกรอง', 'Clear filters')}
                  </Button>
                </div>
                <p className="text-[10px] font-semibold text-slate-400">
                  {t('อ้างอิง fixtureDetail (Line/Model รวม FAN2)', 'Sourced from fixtureDetail (Line/Model include FAN2)')}
                </p>
              </div>
              {resultsError ? (
                <p className="mt-3 text-[11px] font-semibold text-red-600">{resultsError}</p>
              ) : null}
            </Card>

            {/* 2. Result table only — same flat columns as Fixture List > Fixture, capped to filter height */}
            <Card className="flex min-w-0 flex-col overflow-hidden lg:h-[500px]">
              <div className="min-h-0 flex-1 overflow-y-auto">
                {resultsLoading ? (
                  <Spinner label={t('กำลังโหลดข้อมูล Fixture…', 'Loading fixture data…')} />
                ) : (
                  <DataTable
                    columns={resultColumns}
                    rows={results}
                    rowKey={(row) => row.sn}
                    onRowClick={(row) => loadSelected(row.sn)}
                    selectedKey={fixture?.sn}
                    pageSize={50}
                    dense
                    embedded
                    emptyIcon={Boxes}
                    emptyTitle={t('ไม่พบ Fixture ตามเงื่อนไข', 'No fixtures match the filters')}
                    emptyDescription={t('ลองปรับตัวกรองแล้วกด Search อีกครั้ง', 'Try adjusting the filters and search again')}
                  />
                )}
              </div>
            </Card>
          </div>

          {/* 3. Editor — only after a row is selected */}
          {loading ? (
            <Card>
              <Spinner label={t('กำลังโหลดข้อมูล Fixture…', 'Loading fixture data…')} />
            </Card>
          ) : !fixture ? (
            <Card>
              <EmptyState
                icon={PencilLine}
                title={t('เลือก Fixture จากตารางผลลัพธ์เพื่อเริ่มแก้ไข', 'Select a fixture from the result table to start editing')}
              />
            </Card>
          ) : (
            <div ref={editorRef} className="grid gap-5 scroll-mt-6 xl:grid-cols-[1fr_1.6fr]">
              <Card className="p-5 sm:p-6">
                <SectionHeader
                  icon={Info}
                  title={fixture.sn}
                  desc={`${fixture.line || '-'} · ${fixture.model || '-'}`}
                  className="mb-3"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={fixture.status} label={fixtureStatus(fixture.status)} />
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                    {processTypeLabel(fixture.type) || '-'}
                  </span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                    {t('Rev', 'Rev')} {fixture.revision || '-'}
                  </span>
                </div>
                <div className="mt-3 divide-y divide-slate-100">
                  <InfoRow label={t('Line', 'Line')} value={fixture.line} />
                  <InfoRow label={t('Model', 'Model')} value={fixture.model} />
                  <InfoRow label={t('Step', 'Step')} value={fixture.step} />
                  <InfoRow label={t('Process', 'Process')} value={fixture.process} />
                  <InfoRow label={t('Position', 'Position')} value={fixture.position} />
                  <InfoRow label={t('ตำแหน่งเก็บ', 'Storage')} value={fixture.usage?.storage || fixture.storage} />
                  <InfoRow label={t('Fixture Base', 'Fixture Base')} value={fixture.fixtureBase} mono />
                  <InfoRow label={t('Usage', 'Usage')} value={`${fixture.usage?.current || 0} / ${fixture.usage?.max || 0}`} />
                  <InfoRow label={t('Exp', 'Exp')} value={formatDate(fixture.usage?.exp)} />
                  <InfoRow
                    label={t('ลงทะเบียนโดย', 'Registered by')}
                    value={[fixture.registered?.name, fixture.registered?.lastname].filter(Boolean).join(' ') || '-'}
                  />
                  <InfoRow label={t('วันที่ลงทะเบียน', 'Registered date')} value={formatDateTime(fixture.registered?.date)} />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {t('ประวัติของ Fixture นี้', 'History of this fixture')}
                  </p>
                  {historyLoading ? (
                    <p className="text-[11px] text-slate-400">{t('กำลังโหลด…', 'Loading…')}</p>
                  ) : fixtureHistory.length === 0 ? (
                    <p className="text-[11px] text-slate-400">{t('ยังไม่มีประวัติ', 'No history yet')}</p>
                  ) : (
                    <ol className="space-y-2">
                      {fixtureHistory.map((item) => (
                        <li key={item._id} className="border-l-2 border-blue-200 pl-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-700">{item.action}</span>
                            <span className="ml-auto text-[10px] text-slate-400">
                              {formatDateTime(item.date)}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500">{item.detail || '-'}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/50 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-black text-red-700">
                    <TriangleAlert className="h-3.5 w-3.5" /> {t('โซนอันตราย', 'Danger zone')}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-red-600">
                    {t('ลบ Fixture ออกจากระบบ (บันทึก History) — ไม่สามารถย้อนกลับได้', 'Delete the fixture from the system (recorded in history) — this cannot be undone')}
                  </p>
                  <Button variant="danger" size="sm" icon={Trash2} className="mt-3" onClick={askDelete} disabled={busy}>
                    {t('ลบ Fixture นี้', 'Delete this fixture')}
                  </Button>
                </div>
              </Card>

              <Card className="flex flex-col p-5 sm:p-7">
                <SectionHeader
                  icon={PencilLine}
                  title={t('แก้ไขข้อมูล Fixture', 'Edit fixture info')}
                  desc={t('ช่องที่เปลี่ยนจะถูกไฮไลต์สีเหลืองก่อนบันทึก', 'Changed fields are highlighted in yellow before saving')}
                  className="mb-4"
                />

                {dirtyFields.size > 0 ? (
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] font-bold text-amber-800">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                    <span>{t('มีการแก้ไขก่อนบันทึก:', 'Unsaved changes:')}</span>
                    <span className="font-mono">{changedSummary.join(' · ')}</span>
                  </div>
                ) : null}

                <form onSubmit={save} className="flex flex-1 flex-col space-y-5" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label={t('Line', 'Line')}>
                      <SearchableSelect
                        id="edit-line"
                        value={form.line}
                        onChange={(value) => setField('line', value)}
                        options={lineOptions}
                        placeholder={t('เลือก Line', 'Select line')}
                        className={dirtyClass('line')}
                        searchPlaceholder={t('ค้นหา Line…', 'Search line…')}
                        clearable
                      />
                    </FormField>
                    <FormField label={t('Model', 'Model')}>
                      <SearchableSelect
                        id="edit-model"
                        value={form.model}
                        onChange={(value) => setField('model', value)}
                        options={modelOptions}
                        placeholder={t('เลือก Model', 'Select model')}
                        className={dirtyClass('model')}
                        searchPlaceholder={t('ค้นหา Model…', 'Search model…')}
                        clearable
                      />
                    </FormField>
                    <FormField label={t('Process Type', 'Process Type')}>
                      <SearchableSelect
                        id="edit-type"
                        value={form.type}
                        onChange={(value) => setField('type', value)}
                        options={processTypeOptions}
                        placeholder={t('เลือก Process Type', 'Select process type')}
                        className={dirtyClass('type')}
                        searchPlaceholder={t('ค้นหา Process Type…', 'Search process type…')}
                        clearable
                      />
                    </FormField>
                    <FormField label={t('Step', 'Step')}>
                      <SearchableSelect
                        id="edit-step"
                        value={form.step}
                        onChange={(value) => setField('step', value)}
                        options={stepOptions}
                        placeholder={t('เลือก Step', 'Select step')}
                        className={dirtyClass('step')}
                        searchPlaceholder={t('ค้นหา Step…', 'Search step…')}
                        clearable
                      />
                    </FormField>
                    <FormField label={t('Process', 'Process')}>
                      <SearchableSelect
                        id="edit-process"
                        value={form.process}
                        onChange={(value) => setField('process', value)}
                        options={processOptions}
                        placeholder={t('เลือก Process', 'Select process')}
                        className={dirtyClass('process')}
                        searchPlaceholder={t('ค้นหา Process…', 'Search process…')}
                        clearable
                      />
                    </FormField>
                    <FormField label={t('Position', 'Position')}>
                      <SearchableSelect
                        id="edit-position"
                        value={form.position}
                        onChange={(value) => setField('position', value)}
                        options={positionOptions}
                        placeholder={t('เลือก Position', 'Select position')}
                        className={dirtyClass('position')}
                        searchPlaceholder={t('ค้นหา Position…', 'Search position…')}
                        clearable
                      />
                    </FormField>
                    <FormField
                      label={t('ตำแหน่งเก็บ (Usage Storage)', 'Storage (usage storage)')}
                    >
                      <SearchableSelect
                        id="edit-storage"
                        value={form.usageStorage}
                        onChange={(value) => setField('usageStorage', value)}
                        options={storageOptions}
                        placeholder={t('เลือกตำแหน่งเก็บ', 'Select storage')}
                        className={dirtyClass('usageStorage')}
                        searchPlaceholder={t('ค้นหาตำแหน่งเก็บ…', 'Search storage…')}
                        clearable
                      />
                    </FormField>
                    <FormField
                      label={t('Fixture Base', 'Fixture Base')}
                      hint={t('ข้อมูลนี้ถูกล็อก ไม่สามารถแก้ไขได้', 'This value is locked and cannot be edited')}
                    >
                      <div className="relative">
                        <Input
                          className={cn('cursor-not-allowed bg-slate-100 pr-9 font-mono', dirtyClass('fixtureBase'))}
                          value={form.fixtureBase}
                          readOnly
                          disabled
                        />
                        <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      </div>
                    </FormField>
                    <FormField label={t('Revision', 'Revision')}>
                      <Input
                        className={cn('font-mono', dirtyClass('revision'))}
                        value={form.revision}
                        onChange={(event) => setField('revision', event.target.value)}
                      />
                    </FormField>
                    <FormField label={t('การใช้งานปัจจุบัน', 'Usage Current')}>
                      <Input
                        className={dirtyClass('current')}
                        type="number"
                        min="0"
                        value={form.current}
                        onChange={(event) => setField('current', event.target.value)}
                      />
                    </FormField>
                    <FormField label={t('การใช้งานสูงสุด', 'Usage Max')}>
                      <Input
                        className={dirtyClass('max')}
                        type="number"
                        min="0"
                        value={form.max}
                        onChange={(event) => setField('max', event.target.value)}
                      />
                    </FormField>
                    <FormField label={t('Exp (PM Due)', 'Exp (PM Due)')}>
                      <Input
                        className={dirtyClass('exp')}
                        type="date"
                        value={form.exp}
                        onChange={(event) => setField('exp', event.target.value)}
                      />
                    </FormField>
                    <FormField label={t('Registered Date', 'Registered date')}>
                      <Input
                        className={dirtyClass('registeredDate')}
                        type="date"
                        value={form.registeredDate}
                        onChange={(event) => setField('registeredDate', event.target.value)}
                      />
                    </FormField>
                    <FormField label={t('รายละเอียด', 'Description')} className="sm:col-span-2">
                      <Input
                        className={dirtyClass('desc')}
                        value={form.desc}
                        onChange={(event) => setField('desc', event.target.value)}
                        placeholder={t('รายละเอียดเพิ่มเติม', 'Additional details')}
                      />
                    </FormField>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2.5 border-t border-slate-100 pt-5">
                    <Button type="submit" icon={Save} disabled={busy || dirtyFields.size === 0}>
                      {busy ? t('กำลังบันทึก…', 'Saving…') : t('บันทึกการเปลี่ยนแปลง', 'Save changes')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      icon={RotateCcw}
                      onClick={() => setForm(originalForm)}
                      disabled={busy || dirtyFields.size === 0}
                    >
                      {t('ย้อนกลับ', 'Reset')}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[240px] flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <InputSm
                  className="pl-9"
                  placeholder={t('ค้นหาตำแหน่งเก็บ / คำอธิบาย...', 'Search storage / description...')}
                  value={storageSearch}
                  onChange={(e) => setStorageSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadStorages}
                  disabled={storageLoading}
                >
                  {t('รีเฟรช', 'Refresh')}
                </Button>
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={openCreateStorage}
                >
                  {t('เพิ่มตำแหน่งเก็บ', 'Add storage')}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {storageLoading ? (
              <Spinner label={t('กำลังโหลดตำแหน่งเก็บ…', 'Loading storage locations…')} />
            ) : (
              <DataTable
                columns={storageColumns}
                rows={filteredStorages}
                rowKey={(row) => row._id}
                pageSize={20}
                dense
                embedded
                emptyIcon={Database}
                emptyTitle={t('ไม่พบตำแหน่งเก็บ', 'No storage locations found')}
                emptyDescription={t('ยังไม่มีตำแหน่งเก็บ หรือไม่พบตามคำค้นหา', 'No storage locations yet or none match the search')}
                emptyAction={
                  <Button size="sm" icon={Plus} onClick={openCreateStorage}>
                    {t('เพิ่มตำแหน่งเก็บแรก', 'Add the first storage location')}
                  </Button>
                }
              />
            )}
          </Card>
        </div>
      )}

      {/* Storage Create/Edit Modal */}
      <Modal
        open={Boolean(storageModal)}
        onClose={() => (storageBusy ? null : setStorageModal(null))}
        title={storageModal?.mode === 'create' ? t('เพิ่มตำแหน่งเก็บ', 'Add storage') : t('แก้ไขตำแหน่งเก็บ', 'Edit storage')}
        subtitle={storageModal?.mode === 'create'
          ? t('เพิ่มตำแหน่งจัดเก็บใหม่', 'Add a new storage location')
          : t(`แก้ไขตำแหน่ง ${storageModal?.data?.location || ''}`, `Edit location ${storageModal?.data?.location || ''}`)}
        icon={Database}
        size="md"
      >
        <form onSubmit={saveStorage} className="space-y-4 pt-2">
          <FormField label={t('ตำแหน่งเก็บ', 'Storage location')} required>
            <Input
              value={storageForm.location}
              onChange={(e) => setStorageForm((c) => ({ ...c, location: e.target.value }))}
              placeholder={t('เช่น A-01-01 หรือ Rack A', 'e.g. A-01-01 or Rack A')}
              autoFocus
              required
            />
          </FormField>
          <FormField label={t('คำอธิบาย', 'Description')}>
            <Input
              value={storageForm.desc}
              onChange={(e) => setStorageForm((c) => ({ ...c, desc: e.target.value }))}
              placeholder={t('รายละเอียดตำแหน่ง (ไม่บังคับ)', 'Location details (optional)')}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStorageModal(null)}
              disabled={storageBusy}
            >
              {t('ยกเลิก', 'Cancel')}
            </Button>
            <Button
              type="submit"
              icon={Save}
              disabled={storageBusy}
            >
              {storageBusy ? t('กำลังบันทึก…', 'Saving…') : t('บันทึกตำแหน่งเก็บ', 'Save storage')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => (busy ? null : setConfirm(null))}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone || 'red'}
        busy={busy}
      />
    </div>
  )
}
