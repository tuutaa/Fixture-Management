import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Boxes,
  PackageCheck,
  RotateCcw,
  Search,
  TriangleAlert,
  Upload,
  Wrench,
} from 'lucide-react'
import api from '../lib/api'
import { buildFixtureListItems } from '../lib/fixtureImport'
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionHeader,
  Spinner,
  StatCard,
} from '../components/ui/Card'
import {
  FIXTURE_STATUS_OPTIONS,
  buildProcessTypeOptions,
  fixtureTone,
  processTypeLabel,
} from '../lib/constants'
import { FormField, Input } from '../components/ui/Field'
import Tabs from '../components/ui/Tabs'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import SearchableSelect from '../components/ui/SearchableSelect'
import { cn } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { useLabels, useServerMessage } from '../lib/i18n'

/* Preferred column order for the fixture-list matrix. */
const POSITION_ORDER = [
  'Stopport Impeller',
  'Permanence yoke',
  'Insert Rot',
  'Stopper Yoke',
  'Stopper Magnet',
  'Pressing magnet',
  'Vibration rotor',
  'Support Apply glue',
  'Outer yoke',
  'Fixture Stick label',
  'Support Apply oil',
  "Ass'y balance rotor",
  'Inspection rotor',
  'Balance rotor',
  'Winding (Arbor)',
  'Winding (Estate shaft )',
  'Winding (Guard)',
  'Winding (Tension)',
  'Dipping',
  'DCR Test',
  'Insert stator with PWB',
  'Inspection wire',
  'Solder stator',
  'Cutting PWB',
  'Cutting Cushion 1',
  'Cutting Cushion 2',
  'Solder FPC',
  'Inspection stator',
  'Solder PVC wire',
  'Base Ultrasonic',
  'Inspecetion PVC wire',
  'Stick Insulator tape',
  'Pressing PWB',
  'Inspection Coating',
  'Solder Wire CU.',
  'Insert Plug',
  'Inspection wire CU',
  'Apply silicone',
  'WIP Silicone',
  'Inspection silicone',
  'Suport Curing UV',
  'Frame Transfer',
  'Stator transfer',
  "Ass'y stator with frame",
  'Laser Frame',
  'Support PAD 1',
  'Support PAD 2',
  'Support washer Peek',
  'Support Washer PA',
  'Base Support Washer Peek & Washer PA',
  'Base inspection washer',
  'Nozzle Washer',
  'Bearing feeder',
  'Press bearing',
  'Fixture support Fastener',
  'Base Fastener Mylar & Waster',
  'Lock fastener',
  'Drop Oil',
  'Inspection oil',
  'Base Sleeve',
  'Pressing Sleeve',
  'Pressing Seanlane',
  'Support sealant',
  'Hotmelt Pillow',
  'Hotmelt frame',
  'Hotmelt FPC',
  'Apply Glue',
  'Insert PWB',
  'Pressing Stator',
  'Solder Pin',
  'Preesing Rotor',
  'Base insert rotor',
  'Vacumm rotor',
  'Inspction rotor high',
  "Ass'y Screw",
  'Auto Label',
  'Touch Glass',
  'Wire test',
  'Inspection Cushion',
  'Test Run/Test Current',
  'Fixture Re-Start test',
  'Fixture Pressing protection Cap',
  'Noise',
  'Function Test',
  'Wire length inspection',
  'Inspection connector',
  'Inspection PWB',
  'Inspection Roll wire (FG)',
  'Inspection PFC',
  'AOI',
  'Vacuum FG',
]

const normPosition = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

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

const valuesFor = (options, key) => (Array.isArray(options?.[key]) ? options[key] : [])

const toOptions = (values, labelFn) =>
  [...new Set((values || []).filter((value) => value !== '' && value !== null && value !== undefined))]
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }))
    .map((value) => ({ value, label: labelFn ? labelFn(value) : String(value) }))

/* Mirrors Edit: Process narrows the Position dropdown. */
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

export default function FixtureListPage() {
  const { t, fixtureStatus } = useLabels()
  const sm = useServerMessage()
  const [docs, setDocs] = useState([])
  const [flat, setFlat] = useState([])
  const [details, setDetails] = useState([])
  const [stats, setStats] = useState(null)
  const [detailOptions, setDetailOptions] = useState({})
  const [storageLocations, setStorageLocations] = useState([])
  const [fixtureRows, setFixtureRows] = useState([])
  const [fixtureLoading, setFixtureLoading] = useState(false)
  const [fixtureError, setFixtureError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('fixture')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS)
  const toast = useToast()
  const importInputRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [pendingImport, setPendingImport] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const [rawDocs, flatRows, detailRows, statsResult, detailOpts, storages] = await Promise.all([
        api.fixtureList(),
        api.fixtures(),
        api.fixtureDetails().catch(() => []),
        api.fixtureStats().catch(() => null),
        api.editFixtureOptions().catch(() => ({})),
        api.storages().catch(() => []),
      ])
      setDocs(Array.isArray(rawDocs) ? rawDocs : [])
      setFlat(Array.isArray(flatRows) ? flatRows : [])
      setDetails(Array.isArray(detailRows) ? detailRows : [])
      setStats(statsResult && typeof statsResult.total === 'number' ? statsResult : null)
      setDetailOptions(detailOpts || {})
      setStorageLocations(Array.isArray(storages) ? storages : [])
    } catch (err) {
      setError(sm(err.message))
    } finally {
      setLoading(false)
    }
  }, [sm])

  const fetchFixtureRows = useCallback(
    async (values = EMPTY_FILTERS) => {
      setFixtureLoading(true)
      setFixtureError('')
      try {
        const data = await api.editFixtures(values)
        setFixtureRows(Array.isArray(data) ? data : [])
      } catch (err) {
        setFixtureRows([])
        setFixtureError(sm(err.message))
      } finally {
        setFixtureLoading(false)
      }
    },
    [sm],
  )

  const setFilter = (key, value) =>
    setFilters((current) => {
      const next = { ...current, [key]: value }
      if (key === 'process' && value !== current.process) next.position = ''
      return next
    })

  const runSearch = () => {
    setAppliedFilters(filters)
    fetchFixtureRows(filters)
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    fetchFixtureRows(EMPTY_FILTERS)
  }

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
      const items = buildFixtureListItems(rows)
      if (!items.length) {
        throw new Error(t('ไม่พบ Fixture List ในไฟล์ Excel', 'No fixture list found in the Excel file'))
      }
      let res
      try {
        res = await api.importFixtureList(items)
      } catch (err) {
        if (err?.payload?.needsConfirm) {
          setPendingImport({ items, issues: err.payload.issues || [], message: err.message })
          return
        }
        throw err
      }
      await load()
      toast.success(
        res?.message
          ? sm(res.message)
          : t(`นำเข้าข้อมูลเรียบร้อย ${items.length} รายการ`, `Imported ${items.length} item(s) successfully`),
      )
    } catch (err) {
      toast.error(
        err?.message ? sm(err.message) : t('นำเข้า Fixture List ไม่สำเร็จ', 'Failed to import the fixture list'),
      )
    } finally {
      setImporting(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const confirmImport = async () => {
    if (!pendingImport) return
    setImporting(true)
    try {
      const res = await api.importFixtureList(pendingImport.items, true)
      setPendingImport(null)
      await load()
      toast.success(
        res?.message
          ? sm(res.message)
          : t('นำเข้าข้อมูลเรียบร้อย', 'Import complete'),
      )
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setImporting(false)
    }
  }

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetchFixtureRows(EMPTY_FILTERS)
  }, [fetchFixtureRows])

  const needle = query.trim().toLowerCase()

  const allFixtures = useMemo(() => {
    if (!details.length) return flat
    const listMap = new Map(flat.map((fixture) => [fixture.sn, fixture]))
    const seen = new Set()
    const rows = []
    for (const detail of details) {
      rows.push(listMap.get(detail.sn) || { ...detail })
      seen.add(detail.sn)
    }
    for (const fixture of flat) {
      if (!seen.has(fixture.sn)) rows.push(fixture)
    }
    return rows
  }, [details, flat])

  const kpi = useMemo(() => {
    if (stats) {
      const counts = stats.counts || {}
      return {
        total: Number(stats.total) || 0,
        inUse: Number(counts['In Use']) || 0,
        inStock: Number(counts['In Stock']) || 0,
        maintenance: Number(counts.Maintenance) || 0,
      }
    }
    const unique = new Map()
    for (const fixture of allFixtures) {
      if (fixture?.sn && !unique.has(fixture.sn)) unique.set(fixture.sn, fixture)
    }
    const rows = [...unique.values()]
    const countStatus = (status) => rows.filter((fixture) => fixture.status === status).length
    return {
      total: rows.length,
      inUse: countStatus('In Use'),
      inStock: countStatus('In Stock'),
      maintenance: countStatus('Maintenance'),
    }
  }, [stats, allFixtures])

  const matrix = useMemo(() => {
    const filteredDocs = docs.filter(
      (doc) =>
        (!appliedFilters.line || doc.line === appliedFilters.line) &&
        (!appliedFilters.model || doc.model === appliedFilters.model),
    )

    const canonical = new Map(POSITION_ORDER.map((position) => [normPosition(position), position]))
    const extras = []
    const processBy = new Map()
    const countBy = new Map()
    const standardBy = new Map()
    const rows = []

    for (const doc of filteredDocs) {
      const lineHit = needle && String(doc.line || '').toLowerCase().includes(needle)
      const modelHit = needle && String(doc.model || '').toLowerCase().includes(needle)
      const includeAll = !needle || lineHit || modelHit
      const cell = new Map()

      for (const info of doc.fixtureInfo || []) {
        const raw = String(info.position || '').trim()
        const key = raw
          ? canonical.get(normPosition(raw)) || raw
          : t('ไม่ระบุ Position', 'Unspecified position')
        if (raw && !canonical.has(normPosition(raw)) && !extras.includes(key)) extras.push(key)

        const process = String(info.process || '').trim()
        if (process) {
          if (!processBy.has(key)) processBy.set(key, new Set())
          processBy.get(key).add(process)
        }

        /* จำนวนที่ใช้จริงต่อ fixture base (ค่ามาตรฐานจาก Excel) */
        const standard = Number(info.count) || 0
        if (standard > (standardBy.get(key) || 0)) standardBy.set(key, standard)

        for (const sn of info.sn || []) {
          if (!sn) continue
          if (!includeAll && !String(sn).toLowerCase().includes(needle)) continue
          if (!cell.has(key)) cell.set(key, [])
          cell.get(key).push(sn)
          countBy.set(key, (countBy.get(key) || 0) + 1)
        }
      }

      if (cell.size) {
        rows.push({ id: String(doc._id), line: doc.line, model: doc.model, cell })
      }
    }

    rows.sort(
      (a, b) =>
        String(a.line || '').localeCompare(String(b.line || '')) ||
        String(a.model || '').localeCompare(String(b.model || '')),
    )

    return { rows, positions: [...POSITION_ORDER, ...extras], processBy, countBy, standardBy }
  }, [docs, appliedFilters.line, appliedFilters.model, needle, t])

  const statusValues = valuesFor(detailOptions, 'statuses').length
    ? valuesFor(detailOptions, 'statuses')
    : FIXTURE_STATUS_OPTIONS.map((option) => option.value)

  const filterFields = useMemo(() => {
    const fields = [
      { key: 'line', label: t('Line', 'Line'), options: toOptions(valuesFor(detailOptions, 'lines')) },
      { key: 'model', label: t('Model', 'Model'), options: toOptions(valuesFor(detailOptions, 'models')) },
      {
        key: 'status',
        label: t('สถานะ', 'Status'),
        options: toOptions(statusValues, (value) => fixtureStatus(value)),
      },
      {
        key: 'type',
        label: t('Process Type', 'Process Type'),
        options: buildProcessTypeOptions(valuesFor(detailOptions, 'types')),
      },
      { key: 'step', label: t('Step', 'Step'), options: toOptions(valuesFor(detailOptions, 'steps')) },
      { key: 'process', label: t('Process', 'Process'), options: toOptions(valuesFor(detailOptions, 'processes')) },
      {
        key: 'position',
        label: t('Position', 'Position'),
        options: toOptions(positionsForProcess(detailOptions, filters.process)),
      },
      {
        key: 'storage',
        label: t('ตำแหน่งเก็บ', 'Storage'),
        options: toOptions([
          ...valuesFor(detailOptions, 'storages'),
          ...storageLocations.map((row) => row.location),
        ]),
      },
      {
        key: 'fixtureBase',
        label: t('Fixture Base', 'Fixture Base'),
        options: toOptions(valuesFor(detailOptions, 'fixtureBases')),
      },
      { key: 'revision', label: t('Revision', 'Revision'), options: toOptions(valuesFor(detailOptions, 'revisions')) },
    ]
    return fields
  }, [detailOptions, fixtureStatus, filters.process, storageLocations, statusValues, t])

  const flatColumns = [
    {
      key: 'sn',
      header: t('Serial Number', 'Serial Number'),
      render: (row) => (
        <span className="font-mono text-xs font-black text-slate-800">{row.sn}</span>
      ),
    },
    {
      key: 'type',
      header: t('Process Type', 'Process Type'),
      render: (row) => (
        <span className="text-[11px] text-slate-600">{processTypeLabel(row.type) || '-'}</span>
      ),
    },
    {
      key: 'line',
      header: t('Line', 'Line'),
      render: (row) => (
        <span className="text-xs font-semibold text-slate-700">{row.line || '-'}</span>
      ),
    },
    {
      key: 'model',
      header: t('Model', 'Model'),
      render: (row) => (
        <span className="font-mono text-[10px] text-slate-600">{row.model || '-'}</span>
      ),
    },
    {
      key: 'step',
      header: t('Step', 'Step'),
      render: (row) => (
        <span className="text-xs text-slate-600">{row.step || '-'}</span>
      ),
    },
    {
      key: 'process',
      header: t('Process', 'Process'),
      render: (row) => (
        <span className="text-[11px] text-slate-600">{row.process || '-'}</span>
      ),
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
        <span className="text-[11px] font-medium text-slate-700">{row.usage?.storage || row.storage || '-'}</span>
      ),
    },
    {
      key: 'fixtureBase',
      header: t('Fixture Base', 'Fixture Base'),
      render: (row) => (
        <span className="font-mono text-[10px] text-slate-600">{row.fixtureBase || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: t('สถานะ', 'Status'),
      align: 'center',
      render: (row) => <StatusBadge status={row.status} label={fixtureStatus(row.status)} />,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t('Fixture', 'Fixture')}
        icon={Boxes}
        title={t('รายการ Fixture', 'Fixture list')}
        actions={
          <>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button
              variant="secondary"
              icon={Upload}
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
            >
              {importing
                ? t('กำลังนำเข้า…', 'Importing…')
                : t('นำเข้ารายการ Fixture (Excel)', 'Import fixture list (Excel)')}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('Fixture', 'Fixture')} value={kpi.total.toLocaleString()} hint={t('Fixture ทั้งหมดในระบบ', 'All fixtures in the system')} icon={Boxes} tone="blue" />
        <StatCard label={fixtureStatus('In Use')} value={kpi.inUse.toLocaleString()} hint={t('ติดตั้งใช้งานอยู่ที่ไลน์ผลิต', 'Installed and in use on the production line')} icon={Activity} tone="red" />
        <StatCard label={fixtureStatus('In Stock')} value={kpi.inStock.toLocaleString()} hint={t('พร้อมใช้งานในคลัง', 'Ready for use in stock')} icon={PackageCheck} tone="emerald" />
        <StatCard label={t('PM และซ่อมบำรุง', 'PM & Maintenance')} value={kpi.maintenance.toLocaleString()} hint={t('รอ PM / ซ่อมบำรุง', 'Awaiting PM / maintenance')} icon={Wrench} tone="orange" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={view}
            onChange={setView}
            size="sm"
            tabs={[
              { value: 'fixture', label: t('Fixture', 'Fixture') },
              { value: 'list', label: t('รายการ Fixture', 'Fixture list') },
            ]}
          />
          <p className="text-[11px] font-semibold text-slate-400">
            {view === 'fixture'
              ? t(`${fixtureRows.length.toLocaleString()} รายการ`, `${fixtureRows.length.toLocaleString()} item(s)`)
              : t(
                  `${matrix.rows.length.toLocaleString()} Model · ${matrix.positions.length.toLocaleString()} Position`,
                  `${matrix.rows.length.toLocaleString()} model(s) · ${matrix.positions.length.toLocaleString()} position(s)`,
                )}
          </p>
        </div>

        <div className="mt-3 border-t border-slate-100 px-3 pt-3">
          <SectionHeader title={t('กรองข้อมูล Fixture', 'Filter fixtures')} className="mb-2" />
          <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-5">
            {filterFields.map((field) => (
              <FormField key={field.key} label={field.label}>
                <SearchableSelect
                  value={filters[field.key]}
                  onChange={(value) => setFilter(field.key, value)}
                  options={field.options}
                  placeholder={t('ทั้งหมด', 'All')}
                  clearable
                />
              </FormField>
            ))}
            {view === 'list' ? (
              <FormField label={t('ค้นหา', 'Search')} className="sm:col-span-2 lg:col-span-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder={t('SN / Model / Position...', 'SN / Model / Position...')}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
              </FormField>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button icon={Search} onClick={runSearch} disabled={fixtureLoading}>
              {fixtureLoading
                ? t('กำลังค้นหา…', 'Searching…')
                : t('Search', 'Search')}
            </Button>
            <Button variant="secondary" icon={RotateCcw} onClick={clearFilters} disabled={fixtureLoading}>
              {t('ล้างตัวกรอง', 'Clear filters')}
            </Button>
          </div>
          {fixtureError ? (
            <p className="mt-2 text-[11px] font-semibold text-red-600">{fixtureError}</p>
          ) : null}
        </div>
      </Card>

      {loading ? (
        <Card>
          <Spinner label={t('กำลังโหลด…', 'Loading…')} />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : view === 'fixture' ? (
        <Card className="overflow-hidden">
          {fixtureLoading ? (
            <Spinner label={t('กำลังโหลดข้อมูล Fixture…', 'Loading fixture data…')} />
          ) : (
            <DataTable
              columns={flatColumns}
              rows={fixtureRows}
              rowKey={(row) => row.sn}
              pageSize={50}
              dense
              emptyIcon={Boxes}
              emptyTitle={t('ไม่พบ Fixture', 'No fixtures found')}
            />
          )}
        </Card>
      ) : matrix.rows.length === 0 ? (
        <Card>
          <EmptyState icon={Boxes} title={t('ไม่พบรายการ Fixture', 'No fixture list found')} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
            <div>
              <p className="text-xs font-black text-slate-800">{t('รายการ Fixture แยกตาม Model', 'Fixture list by model')}</p>
              <p className="text-[10px] text-slate-400">
                {t('แต่ละคอลัมน์คือ Fixture Position · แถวคือ Line + Model', 'Each column is a fixture position · each row is a line + model')}
              </p>
            </div>
            <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
              {t(`${matrix.rows.length.toLocaleString()} Model`, `${matrix.rows.length.toLocaleString()} model(s)`)}
            </span>
          </div>

          <div className="max-h-[calc(100vh-320px)] overflow-auto">
            <table className="w-max min-w-full border-collapse text-left text-[11px]">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-40 w-[72px] min-w-[72px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                    {t('Line', 'Line')}
                  </th>
                  <th className="sticky left-[72px] top-0 z-40 w-[170px] min-w-[170px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                    {t('Model', 'Model')}
                  </th>
                  {matrix.positions.map((position) => {
                    const processes = [...(matrix.processBy.get(position) || [])]
                    const count = matrix.countBy.get(position) || 0
                    const standard = matrix.standardBy.get(position) || 0
                    return (
                      <th
                        key={position}
                        className="sticky top-0 z-20 min-w-[120px] max-w-[140px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 align-top"
                        title={t(
                          `SN ที่ลงทะเบียน ${count.toLocaleString()} · จำนวนที่ใช้จริงต่อ fixture base ${standard.toLocaleString()}`,
                          `Registered SN ${count.toLocaleString()} · actual usage per fixture base ${standard.toLocaleString()}`,
                        )}
                      >
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold leading-tight text-slate-700">{position}</p>
                          <p
                            className="truncate text-[9px] font-medium text-slate-400"
                            title={processes.join(', ')}
                          >
                            {processes.join(', ') || '-'}
                          </p>
                          <p className="flex items-baseline gap-1 text-[9px] font-black">
                            <span className="text-blue-600">{count.toLocaleString()}</span>
                            {standard > 0 ? (
                              <span className="font-semibold text-slate-400">
                                {t(`/ ใช้ ${standard.toLocaleString()}`, `/ used ${standard.toLocaleString()}`)}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="sticky left-0 z-10 w-[72px] min-w-[72px] border-b border-r border-slate-100 bg-white px-2 py-2 text-[11px] font-bold text-slate-700">
                      {row.line || '-'}
                    </td>
                    <td className="sticky left-[72px] z-10 w-[170px] min-w-[170px] border-b border-r border-slate-100 bg-white px-2 py-2 font-mono text-[10px] font-semibold text-slate-600">
                      {row.model || '-'}
                    </td>
                    {matrix.positions.map((position) => {
                      const sns = row.cell.get(position) || []
                      return (
                        <td
                          key={position}
                          className="border-b border-r border-slate-100 px-2 py-2 align-top"
                        >
                          {sns.length === 0 ? (
                            <span className="text-[10px] text-slate-300">-</span>
                          ) : (
                            <div className="space-y-0.5">
                              {sns.map((sn) => (
                                <span
                                  key={sn}
                                  className="block max-w-[130px] truncate font-mono text-[10px] font-semibold text-slate-600"
                                  title={sn}
                                >
                                  {sn}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(pendingImport)}
        onClose={() => (importing ? null : setPendingImport(null))}
        title={t('อัปเดตข้อมูล Fixture ก่อนนำเข้า', 'Update fixtures before import')}
        subtitle={sm(pendingImport?.message || '')}
        icon={TriangleAlert}
        tone="orange"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPendingImport(null)} disabled={importing}>
              {t('ยกเลิก', 'Cancel')}
            </Button>
            <Button variant="warning" icon={Upload} onClick={confirmImport} disabled={importing}>
              {importing
                ? t('กำลังอัปเดต…', 'Updating…')
                : t('อัปเดตและนำเข้า', 'Update and import')}
            </Button>
          </div>
        }
      >
        {pendingImport ? (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-slate-500">
              {t(
                'พบ Fixture ใน Base ที่นำเข้าซึ่งยังไม่มีหรือมี step/process/position ไม่ตรง กดยืนยันเพื่ออัปเดตข้อมูล Fixture เหล่านี้แล้วนำเข้าไฟล์ต่อ',
                'Some fixtures in the imported bases are missing or have different step/process/position. Confirm to update those fixtures, then continue the import.',
              )}
            </p>
            <div className="max-h-[300px] overflow-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-[10px]">
                <thead className="sticky top-0 bg-slate-50 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="px-3 py-2">{t('Base', 'Base')}</th>
                    <th className="px-3 py-2">{t('SN', 'SN')}</th>
                    <th className="px-3 py-2">{t('ข้อมูลปัจจุบัน', 'Current')}</th>
                    <th className="px-3 py-2">{t('ข้อมูลที่จะอัปเดต', 'Update to')}</th>
                    <th className="px-3 py-2">{t('เหตุผล', 'Reason')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingImport.issues.map((issue) => (
                    <tr key={issue.sn}>
                      <td className="px-3 py-2 font-mono font-bold text-slate-600">{issue.base || '-'}</td>
                      <td className="px-3 py-2 font-mono font-bold text-slate-800">{issue.sn}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {[issue.current?.step, issue.current?.process, issue.current?.position].filter(Boolean).join(' · ') || '-'}
                      </td>
                      <td className="px-3 py-2 font-semibold text-blue-700">
                        {[issue.desired?.step, issue.desired?.process, issue.desired?.position].filter(Boolean).join(' · ') || '-'}
                      </td>
                      <td className="px-3 py-2 font-bold text-orange-600">
                        {issue.reason === 'missing'
                          ? t('ยังไม่มีข้อมูล', 'Missing')
                          : issue.reason === 'master'
                            ? t('ไม่ตรง Master', 'Master mismatch')
                            : t('ไม่ตรง Base', 'Base mismatch')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
