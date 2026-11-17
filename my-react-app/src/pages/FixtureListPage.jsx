import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Boxes, PackageCheck, Printer, Search, Upload, Wrench } from 'lucide-react'
import api from '../lib/api'
import { buildFixtureListItems } from '../lib/fixtureImport'
import {
  Card,
  EmptyState,
  ErrorState,
  InfoRow,
  PageHeader,
  Spinner,
  StatCard,
} from '../components/ui/Card'
import { FixtureStatusBadge } from '../components/ui/Badge'
import { Input } from '../components/ui/Field'
import Tabs from '../components/ui/Tabs'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import SearchableSelect from '../components/ui/SearchableSelect'
import { formatDateTime } from '../lib/format'
import { printStickers } from '../lib/print'
import { useToast } from '../components/ui/Toast'

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

export default function FixtureListPage() {
  const [docs, setDocs] = useState([])
  const [flat, setFlat] = useState([])
  const [details, setDetails] = useState([])
  const [stats, setStats] = useState(null)
  const [options, setOptions] = useState({ lines: [], models: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('fixture')
  const [query, setQuery] = useState('')
  const [lineFilter, setLineFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [active, setActive] = useState(null)
  const toast = useToast()
  const importInputRef = useRef(null)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const [rawDocs, flatRows, detailRows, opts, statsResult] = await Promise.all([
        api.fixtureList(),
        api.fixtures(),
        api.fixtureDetails().catch(() => []),
        api.fixtureOptions(),
        api.fixtureStats().catch(() => null),
      ])
      setDocs(Array.isArray(rawDocs) ? rawDocs : [])
      setFlat(Array.isArray(flatRows) ? flatRows : [])
      setDetails(Array.isArray(detailRows) ? detailRows : [])
      setStats(statsResult && typeof statsResult.total === 'number' ? statsResult : null)
      setOptions({ lines: opts.lines || [], models: opts.models || [] })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

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
        throw new Error('ไม่พบ Fixture List ในไฟล์ Excel')
      }
      const res = await api.importFixtureList(items)
      await load()
      toast.success(res?.message || `นำเข้าข้อมูลเรียบร้อย ${items.length} รายการ`)
    } catch (err) {
      toast.error(err?.message || 'Import Fixture List ไม่สำเร็จ')
    } finally {
      setImporting(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  useEffect(() => {
    load()
  }, [load])

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

  const flatFiltered = useMemo(() => {
    return allFixtures.filter((row) => {
      if (lineFilter && row.line !== lineFilter) return false
      if (modelFilter && row.model !== modelFilter) return false
      if (!needle) return true
      return [
        row.sn,
        row.type,
        row.fixtureBase,
        row.usage?.storage,
        row.storage,
        row.model,
        row.line,
        row.process,
        row.position,
        row.revision,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [allFixtures, lineFilter, modelFilter, needle])

  const detailMap = useMemo(() => {
    const map = new Map()
    for (const fixture of allFixtures) {
      if (fixture?.sn) map.set(fixture.sn, fixture)
    }
    return map
  }, [allFixtures])

  const matrix = useMemo(() => {
    const filteredDocs = docs.filter(
      (doc) =>
        (!lineFilter || doc.line === lineFilter) &&
        (!modelFilter || doc.model === modelFilter),
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
        const key = raw ? canonical.get(normPosition(raw)) || raw : 'ไม่ระบุ Position'
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
  }, [docs, lineFilter, modelFilter, needle])

  const openDetail = (sn) => setActive(detailMap.get(sn) || { sn })

  const doPrint = (row) => {
    printStickers(
      [
        {
          SN: row.sn,
          Name: row.type || 'Fixture',
          Model: row.model,
          Line: row.line,
          ExpiredDate: row.usage?.exp,
        },
      ],
      { title: `Fixture ${row.sn}` },
    )
  }

  const flatColumns = [
    {
      key: 'sn',
      header: 'Serial Number',
      render: (row) => (
        <span className="font-mono text-xs font-black text-slate-800">{row.sn}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <span className="text-[11px] text-slate-600">{row.type || '-'}</span>
      ),
    },
    {
      key: 'line',
      header: 'Line',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-700">{row.line || '-'}</span>
      ),
    },
    {
      key: 'model',
      header: 'Model',
      render: (row) => (
        <span className="font-mono text-[10px] text-slate-600">{row.model || '-'}</span>
      ),
    },
    {
      key: 'step',
      header: 'Step',
      render: (row) => (
        <span className="text-xs text-slate-600">{row.step || '-'}</span>
      ),
    },
    {
      key: 'process',
      header: 'Process',
      render: (row) => (
        <span className="text-[11px] text-slate-600">{row.process || '-'}</span>
      ),
    },
    {
      key: 'position',
      header: 'Position',
      render: (row) => <span className="text-[11px] text-slate-600">{row.position || '-'}</span>,
    },
    {
      key: 'storage',
      header: 'Storage',
      render: (row) => (
        <span className="text-[11px] font-medium text-slate-700">{row.usage?.storage || row.storage || '-'}</span>
      ),
    },
    {
      key: 'fixtureBase',
      header: 'Fixture Base',
      render: (row) => (
        <span className="font-mono text-[10px] text-slate-600">{row.fixtureBase || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => <FixtureStatusBadge status={row.status} />,
    },
    {
      key: 'print',
      header: '',
      align: 'right',
      sortable: false,
      render: (row) => (
        <Button size="sm" variant="ghost" icon={Printer} onClick={() => doPrint(row)}>
          Print
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Fixture"
        icon={Boxes}
        title="Fixture List"
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
              {importing ? 'กำลัง Import…' : 'Import Fixture List (Excel)'}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Fixture" value={kpi.total.toLocaleString()} hint="Fixture ทั้งหมดในระบบ" icon={Boxes} tone="blue" />
        <StatCard label="In Use" value={kpi.inUse.toLocaleString()} hint="ติดตั้งใช้งานอยู่ที่ไลน์ผลิต" icon={Activity} tone="red" />
        <StatCard label="In Stock" value={kpi.inStock.toLocaleString()} hint="พร้อมใช้งานในคลัง" icon={PackageCheck} tone="emerald" />
        <StatCard label="PM & Maintenance" value={kpi.maintenance.toLocaleString()} hint="รอ PM / ซ่อมบำรุง" icon={Wrench} tone="orange" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={view}
            onChange={setView}
            size="sm"
            tabs={[
              { value: 'fixture', label: 'Fixture' },
              { value: 'list', label: 'Fixture List' },
            ]}
          />
          <p className="text-[11px] font-semibold text-slate-400">
            {view === 'fixture'
              ? `${flatFiltered.length.toLocaleString()} รายการ`
              : `${matrix.rows.length.toLocaleString()} Model · ${matrix.positions.length.toLocaleString()} Position`}
          </p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="field-label">Line</p>
            <SearchableSelect
              value={lineFilter}
              onChange={setLineFilter}
              options={options.lines.map((line) => ({ value: line, label: line }))}
              placeholder="ทุก Line"
              clearable
            />
          </div>
          <div>
            <p className="field-label">Model</p>
            <SearchableSelect
              value={modelFilter}
              onChange={setModelFilter}
              options={options.models.map((model) => ({ value: model, label: model }))}
              placeholder="ทุก Model"
              clearable
            />
          </div>
          <div>
            <p className="field-label">ค้นหา</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                className="field-input-sm pl-9"
                placeholder="SN / Model / Position..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card>
          <Spinner />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : view === 'fixture' ? (
        <Card className="overflow-hidden">
          <DataTable
            columns={flatColumns}
            rows={flatFiltered}
            rowKey={(row) => row.sn}
            pageSize={50}
            dense
            emptyIcon={Boxes}
            emptyTitle="ไม่พบ Fixture"
            onRowClick={(row) => setActive(row)}
          />
        </Card>
      ) : matrix.rows.length === 0 ? (
        <Card>
          <EmptyState icon={Boxes} title="ไม่พบ Fixture List" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
            <div>
              <p className="text-xs font-black text-slate-800">Fixture List by Model</p>
              <p className="text-[10px] text-slate-400">
                แต่ละคอลัมน์คือ Fixture Position · แถวคือ Line + Model
              </p>
            </div>
            <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
              {matrix.rows.length.toLocaleString()} Model
            </span>
          </div>

          <div className="max-h-[calc(100vh-320px)] overflow-auto">
            <table className="w-max min-w-full border-collapse text-left text-[11px]">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-40 w-[72px] min-w-[72px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Line
                  </th>
                  <th className="sticky left-[72px] top-0 z-40 w-[170px] min-w-[170px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                    Model
                  </th>
                  {matrix.positions.map((position) => {
                    const processes = [...(matrix.processBy.get(position) || [])]
                    const count = matrix.countBy.get(position) || 0
                    const standard = matrix.standardBy.get(position) || 0
                    return (
                      <th
                        key={position}
                        className="sticky top-0 z-20 min-w-[120px] max-w-[140px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 align-top"
                        title={`SN ที่ลงทะเบียน ${count.toLocaleString()} · จำนวนที่ใช้จริงต่อ fixture base ${standard.toLocaleString()}`}
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
                                / ใช้ {standard.toLocaleString()}
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
                                <button
                                  key={sn}
                                  type="button"
                                  onClick={() => openDetail(sn)}
                                  className="block max-w-[130px] truncate font-mono text-[10px] font-semibold text-blue-700 hover:underline"
                                  title={sn}
                                >
                                  {sn}
                                </button>
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
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active ? active.sn : 'Fixture'}
        subtitle={active ? `${active.line || '-'} · ${active.model || '-'}` : ''}
        icon={Boxes}
        size="lg"
      >
        {active ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <FixtureStatusBadge status={active.status} />
            </div>
            <InfoRow label="Line" value={active.line} />
            <InfoRow label="Model" value={active.model} />
            <InfoRow label="Step" value={active.step} />
            <InfoRow label="Process" value={active.process} />
            <InfoRow label="Position" value={active.position} />
            <InfoRow label="Type" value={active.type} />
            <InfoRow label="Storage" value={active.usage?.storage || active.storage} />
            <InfoRow label="Fixture Base" value={active.fixtureBase} mono />
            <InfoRow label="Usage" value={`${active.usage?.current || 0} / ${active.usage?.max || 0}`} />
            <InfoRow label="Exp" value={active.usage?.exp || '-'} />
            <InfoRow label="Revision" value={active.revision} />
            <InfoRow label="Registered Date" value={formatDateTime(active.registered?.date)} />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
