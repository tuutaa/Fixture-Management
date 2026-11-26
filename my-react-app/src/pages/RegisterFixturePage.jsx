import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardList, Download, ScanLine, Trash2, Upload, X } from 'lucide-react'
import api from '../lib/api'
import {
  Card,
  ErrorState,
  PageHeader,
  SectionHeader,
  Spinner,
} from '../components/ui/Card'
import { FormField, Input, NativeSelect } from '../components/ui/Field'
import SearchableSelect from '../components/ui/SearchableSelect'
import Button from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { useLabels, useServerMessage } from '../lib/i18n'
import { cn } from '../lib/format'
import { PROCESS_TYPES, processTypeLabel } from '../lib/constants'

const STEP_OPTIONS = ['STEP1', 'STEP2', 'STEP ROTOR', 'STEP WINDING', 'TEST STEP']

const TYPE_OPTIONS = PROCESS_TYPES.map((option) => option.value)

const PROCESS_POSITION = [
  ['Rotor Assy', 'Stopport Impeller'],
  ['Rotor Assy', 'Permanence yoke'],
  ['Rotor Assy', 'Insert Rot'],
  ['Rotor Assy', 'Stopper Yoke'],
  ['Rotor Assy', 'Vibration rotor'],
  ['Rotor Assy', 'Support Apply oil'],
  ['BL Test', 'Balance rotor'],
  ['Winding', 'Winding (Arbor)'],
  ['Winding', 'Winding (Estate shaft )'],
  ['Winding', 'Winding (Guard)'],
  ['Winding', 'Winding (Tension)'],
  ['Dipping', 'Dipping'],
  ['Stator Test', 'DCR Test'],
  ['Solder PWB', 'Insert stator with PWB'],
  ['Solder PWB', 'Inspection wire'],
  ['Solder PWB', 'Solder PWB'],
  ['Cutting PWB', 'Cutting PWB'],
  ['Solder PVC wire', 'Solder PVC wire'],
  ['Apply silicone', 'Apply silicone'],
  ['WIP Silicone', 'WIP Silicone'],
  ['Suport Curing UV', 'Suport Curing UV'],
  ['Frame Transfer', 'Frame Transfer'],
  ['Stator transfer', 'Stator transfer'],
  ["Ass'y stator with frame", "Ass'y stator with frame"],
  ['Laser Frame', 'Laser Frame'],
  ['Washer', 'Base support washer'],
  ['Washer', 'Nozzle Washer'],
  ['Fastener', 'Fastener'],
  ['Drop Oil', 'Drop Oil'],
  ['Sleeve', 'Base Sleeve'],
  ['Sleeve', 'Pressing Sleeve'],
  ['Seanlane', 'Seanlane'],
  ['Hotmelt ', 'Hotmelt '],
  ['Apply Glue', 'Apply Glue'],
  ['Insert PWB', 'Insert PWB'],
  ['Pressing Stator', 'Pressing Stator'],
  ['Solder Pin', 'Solder Pin'],
  ['Preesing Rotor', 'Preesing Rotor'],
  ['Vaccum & Load Rotor', 'Base insert rotor'],
  ['Auto Label', 'Auto Label'],
  ['Touch Glass', 'Touch Glass'],
  ['Wire test', 'Wire test'],
  ['Inspection Cushion ', 'Inspection Cushion '],
  ['Test Run/Test Current', 'Test Run/Test Current'],
  ['Noise', 'Noise'],
  ['Function', 'Function Test'],
  ['Wire length inspection', 'Wire length inspection'],
  ['AOI', 'AOI'],
  ['Vacuum FG', 'Vacuum FG'],
]

const EMPTY_FORM = {
  sn: '',
  line: '',
  model: '',
  step: '',
  process: '',
  position: '',
  type: '',
  storage: '',
  revision: '',
  description: '',
  status: 'In Stock',
  current: 0,
  max: 0,
  exp: '',
}

const normSn = (value) => String(value || '').trim().toUpperCase()
const normValue = (value) => String(value ?? '').trim().toUpperCase()

function CellWithExisting({ value, existing, mono = false, right = false, truncate = false }) {
  const hasExisting = existing !== undefined && existing !== null && existing !== ''
  const differs = hasExisting && normValue(value) !== normValue(existing)
  return (
    <>
      <span
        className={cn(mono && 'font-mono', truncate && 'block max-w-[180px] truncate')}
        title={String(value ?? '')}
      >
        {value || (value === 0 ? '0' : '-')}
      </span>
      {hasExisting ? (
        <span
          className={cn(
            'mt-0.5 block text-[9px] font-black text-red-600',
            mono && 'font-mono',
            right && 'text-right',
            truncate && 'block max-w-[180px] truncate',
          )}
          title={String(existing)}
        >
          {differs ? '≠ ' : ''}{existing}
        </span>
      ) : null}
    </>
  )
}

export default function RegisterFixturePage({ user }) {
  const { t, fixtureStatus } = useLabels()
  const sm = useServerMessage()
  const toast = useToast()
  const snRef = useRef(null)
  const importInputRef = useRef(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [queue, setQueue] = useState([])
  const [locations, setLocations] = useState([])
  const [models, setModels] = useState([])
  const [storages, setStorages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [focusTick, setFocusTick] = useState(0)

  const loadOptions = useCallback(async () => {
    setLoading(true)
    setError('')
    const [locs, mods, sts] = await Promise.allSettled([
      api.fan2Locations(),
      api.fan2Models(),
      api.storages(),
    ])
    if (locs.status === 'fulfilled' && Array.isArray(locs.value)) setLocations(locs.value)
    if (mods.status === 'fulfilled' && Array.isArray(mods.value)) setModels(mods.value)
    if (sts.status === 'fulfilled' && Array.isArray(sts.value)) setStorages(sts.value)
    const failures = [locs, mods, sts].filter((item) => item.status === 'rejected')
    if (failures.length) {
      setError(
        failures[0].reason?.message
          ? sm(failures[0].reason.message)
          : t('โหลดตัวเลือกไม่สำเร็จ', 'Failed to load options'),
      )
    }
    setLoading(false)
  }, [sm, t])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  useEffect(() => {
    if (!focusTick) return undefined
    const frame = window.requestAnimationFrame(() => {
      snRef.current?.focus({ preventScroll: true })
      snRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusTick])

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  // Fixture base is generated from the serial number: everything before the first "-".
  const fixtureBase = useMemo(() => {
    const sn = form.sn.trim()
    if (!sn) return ''
    return sn.includes('-') ? sn.split('-')[0] : sn
  }, [form.sn])

  const processOptions = useMemo(() => [...new Set(PROCESS_POSITION.map((p) => p[0]))], [])
  const positionOptions = useMemo(
    () => PROCESS_POSITION.filter((p) => p[0] === form.process).map((p) => p[1]),
    [form.process],
  )

  const addToQueue = async (event) => {
    event.preventDefault()
    const sn = normSn(form.sn)
    // Clear on every Enter so the next SN can be scanned immediately,
    // even when validation or the duplicate check fails.
    setForm((current) => ({ ...current, sn: '' }))
    setFocusTick((current) => current + 1)
    if (checking) return
    const line = form.line.trim()
    const model = form.model.trim()
    if (!sn || !line || !model) {
      toast.error(t('กรุณากรอก SN, Line และ Model', 'Please enter SN, line and model'))
      return
    }
    if (queue.some((item) => normSn(item.sn) === sn)) {
      toast.error(t(`SN ${sn} อยู่ในรายการแล้ว`, `SN ${sn} is already in the list`))
      return
    }

    setChecking(true)
    let existing = null
    try {
      const data = await api.fixture(sn)
      existing = data.fixture || null
    } catch (err) {
      if (err?.status !== 404) {
        toast.error(
          err?.message ? sm(err.message) : t('ตรวจสอบ SN ไม่สำเร็จ', 'Could not check the serial number'),
        )
        setChecking(false)
        return
      }
    } finally {
      setChecking(false)
    }

    setQueue((current) => [
      ...current,
      { id: `${sn}-${Date.now()}`, ...form, sn, line, model, fixtureBase, existing },
    ])
    if (existing) {
      toast.error(
        t(`SN ${sn} มีอยู่ในระบบแล้ว — ดูแถวสีแดงในรายการ`, `SN ${sn} already exists — see the red row in the list`),
      )
    } else {
      toast.success(t(`เพิ่ม ${sn} ลงรายการแล้ว`, `Added ${sn} to the list`))
    }
  }

  const removeFromQueue = (id) => {
    setQueue((current) => current.filter((item) => item.id !== id))
  }

  const normalizeHeader = (value) => String(value || '').trim().toLowerCase()

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
      if (!rows.length) throw new Error(t('ไม่พบข้อมูลในไฟล์', 'No data found in file'))

      // Find header row
      let headerIndex = 0
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const row = rows[i] || []
        if (row.some((cell) => /sn|serial/i.test(String(cell)))) {
          headerIndex = i
          break
        }
      }
      const headers = (rows[headerIndex] || []).map(normalizeHeader)
      const colIndex = (names) => {
        for (const name of names) {
          const idx = headers.findIndex((h) => h.includes(name))
          if (idx >= 0) return idx
        }
        return -1
      }
      const snIdx = colIndex(['sn', 'serial'])
      const lineIdx = colIndex(['line'])
      const modelIdx = colIndex(['model'])
      const stepIdx = colIndex(['step'])
      const processIdx = colIndex(['process'])
      const positionIdx = colIndex(['position'])
      const typeIdx = colIndex(['type', 'process type'])
      const storageIdx = colIndex(['storage', 'ตำแหน่งเก็บ'])
      const revisionIdx = colIndex(['revision', 'rev'])
      const statusIdx = colIndex(['status', 'สถานะ'])
      const currentIdx = colIndex(['current', 'usage current'])
      const maxIdx = colIndex(['max', 'usage max'])
      const expIdx = colIndex(['exp', 'due'])
      const descIdx = colIndex(['desc', 'description', 'คำอธิบาย'])

      if (snIdx < 0) throw new Error(t('ไม่พบคอลัมน์ SN ในไฟล์', 'SN column not found in file'))

      const items = []
      for (let i = headerIndex + 1; i < rows.length; i++) {
        const row = rows[i] || []
        const sn = String(row[snIdx] || '').trim()
        if (!sn) continue
        items.push({
          sn,
          line: lineIdx >= 0 ? String(row[lineIdx] || '').trim() : '',
          model: modelIdx >= 0 ? String(row[modelIdx] || '').trim() : '',
          step: stepIdx >= 0 ? String(row[stepIdx] || '').trim() : '',
          process: processIdx >= 0 ? String(row[processIdx] || '').trim() : '',
          position: positionIdx >= 0 ? String(row[positionIdx] || '').trim() : '',
          type: typeIdx >= 0 ? String(row[typeIdx] || '').trim() : '',
          storage: storageIdx >= 0 ? String(row[storageIdx] || '').trim() : '',
          revision: revisionIdx >= 0 ? String(row[revisionIdx] || '').trim() : '',
          status: statusIdx >= 0 ? String(row[statusIdx] || '').trim() || 'In Stock' : 'In Stock',
          current: currentIdx >= 0 ? Number(row[currentIdx]) || 0 : 0,
          max: maxIdx >= 0 ? Number(row[maxIdx]) || 0 : 0,
          exp: expIdx >= 0 ? String(row[expIdx] || '').trim() : '',
          description: descIdx >= 0 ? String(row[descIdx] || '').trim() : '',
        })
      }
      if (!items.length) throw new Error(t('ไม่พบข้อมูล Fixture ในไฟล์', 'No fixture data found in file'))

      // Check duplicates against existing
      const existingSns = new Set(queue.map((q) => normSn(q.sn)))
      let added = 0
      for (const item of items) {
        if (existingSns.has(normSn(item.sn))) continue
        existingSns.add(normSn(item.sn))
        // Check if fixture already exists in DB
        let existing = null
        try {
          const data = await api.fixture(item.sn)
          existing = data?.fixture || null
        } catch (err) {
          if (err?.status !== 404) {
            // ignore other errors, treat as new
          }
        }
        setQueue((current) => [...current, { id: `${normSn(item.sn)}-${Date.now()}-${added}`, ...item, fixtureBase: item.sn.includes('-') ? item.sn.split('-')[0] : item.sn, existing }])
        added++
      }
      toast.success(t(`นำเข้า ${added} รายการจาก Excel`, `Imported ${added} item(s) from Excel`))
    } catch (err) {
      toast.error(err?.message ? sm(err.message) : t('นำเข้าไม่สำเร็จ', 'Import failed'))
    } finally {
      setImporting(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await api.fixtures()
      const rows = Array.isArray(data) ? data : []
      const XLSX = await import('xlsx')
      const header = ['SN', 'Base', 'Line', 'Model', 'Step', 'Process', 'Position', 'Process Type', 'Storage', 'Revision', 'Status', 'Exp', 'Current', 'Max', 'Description']
      const sheetRows = [header]
      for (const f of rows) {
        sheetRows.push([
          f.sn || '',
          f.fixtureBase || (f.sn ? String(f.sn).split('-')[0] : ''),
          f.line || '',
          f.model || '',
          f.step || '',
          f.process || '',
          f.position || '',
          f.type || '',
          f.usage?.storage || f.storage || '',
          f.revision || '',
          f.status || '',
          f.usage?.exp || f.exp || '',
          f.usage?.current ?? f.current ?? 0,
          f.usage?.max ?? f.max ?? 0,
          f.description || '',
        ])
      }
      const ws = XLSX.utils.aoa_to_sheet(sheetRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Fixtures')
      XLSX.writeFile(wb, `fixtures-export-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success(t(`ส่งออก ${rows.length} รายการ`, `Exported ${rows.length} item(s)`))
    } catch (err) {
      toast.error(err?.message ? sm(err.message) : t('ส่งออกไม่สำเร็จ', 'Export failed'))
    } finally {
      setExporting(false)
    }
  }

  const duplicateCount = queue.filter((item) => item.existing).length

  const registerAll = async () => {
    if (!queue.length) {
      toast.error(t('ยังไม่มีรายการที่จะลงทะเบียน', 'No items to register'))
      return
    }
    const duplicates = queue.filter((item) => item.existing)
    if (duplicates.length) {
      toast.error(
        t(
          `มี ${duplicates.length} รายการที่อยู่ในระบบแล้ว กรุณาลบออกก่อน`,
          `${duplicates.length} item(s) already exist in the system — remove them first`,
        ),
      )
      return
    }
    setBusy(true)
    const succeeded = []
    const failed = []
    for (const item of queue) {
      try {
        const { id: _id, existing: _existing, ...payload } = item
        if (item.existing) {
          await api.updateFixture(item.sn, { ...payload, user })
        } else {
          await api.createFixture({ ...payload, user })
        }
        succeeded.push(item.id)
      } catch (err) {
        failed.push({ item, message: err.message })
      }
    }
    setQueue((current) => current.filter((item) => !succeeded.includes(item.id)))
    if (succeeded.length) {
      toast.success(
        t(`ลงทะเบียนสำเร็จ ${succeeded.length} รายการ`, `Registered ${succeeded.length} item(s) successfully`),
      )
    }
    if (failed.length) {
      const reason = sm(failed[0].message)
      toast.error(
        t(`${failed.length} รายการไม่สำเร็จ: ${reason}`, `${failed.length} item(s) failed: ${reason}`),
      )
    }
    setBusy(false)
  }

  if (loading) return <Spinner label={t('กำลังโหลด…', 'Loading…')} />

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t('Fixture', 'Fixture')}
        icon={ScanLine}
        title={t('ลงทะเบียน Fixture', 'Register fixture')}
        actions={
          <>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button variant="secondary" icon={Upload} disabled={importing} onClick={() => importInputRef.current?.click()}>
              {importing ? t('กำลังนำเข้า…', 'Importing…') : t('นำเข้า Excel', 'Import Excel')}
            </Button>
            <Button variant="secondary" icon={Download} disabled={exporting} onClick={handleExport}>
              {exporting ? t('กำลังส่งออก…', 'Exporting…') : t('ส่งออก Excel', 'Export Excel')}
            </Button>
          </>
        }
      />

      {error ? <ErrorState message={error} onRetry={loadOptions} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)] 2xl:grid-cols-[minmax(360px,1fr)_minmax(0,2.4fr)]">
        <Card className="p-5 sm:p-7">
          <SectionHeader title={t('กรอกข้อมูล Fixture', 'Enter fixture information')} className="mb-5" />
          <form onSubmit={addToQueue} className="space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('Line *', 'Line *')}>
                <SearchableSelect value={form.line} onChange={(value) => setField('line', value)} options={locations.map((l) => ({ value: l, label: l }))} placeholder={t('เลือก Line', 'Select line')} clearable />
              </FormField>
              <FormField label={t('Model *', 'Model *')}>
                <SearchableSelect value={form.model} onChange={(value) => setField('model', value)} options={models.map((m) => ({ value: m, label: m }))} placeholder={t('เลือก Model', 'Select model')} clearable />
              </FormField>
              <FormField label={t('Step', 'Step')}>
                <SearchableSelect value={form.step} onChange={(value) => setField('step', value)} options={STEP_OPTIONS.map((x) => ({ value: x, label: x }))} placeholder={t('เลือก Step', 'Select step')} clearable />
              </FormField>
              <FormField label={t('Process', 'Process')}>
                <SearchableSelect
                  value={form.process}
                  onChange={(value) => setForm((c) => ({ ...c, process: value, position: '' }))}
                  options={processOptions.map((x) => ({ value: x, label: x }))}
                  placeholder={t('เลือก Process', 'Select process')}
                  clearable
                />
              </FormField>
              <FormField label={t('Position', 'Position')}>
                <SearchableSelect value={form.position} onChange={(value) => setField('position', value)} options={positionOptions.map((x) => ({ value: x, label: x }))} placeholder={t('เลือก Position', 'Select position')} clearable />
              </FormField>
              <FormField label={t('Process Type', 'Process Type')}>
                <NativeSelect value={form.type} onChange={(event) => setField('type', event.target.value)}>
                  <option value="">{t('เลือก Process Type', 'Select process type')}</option>
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label={t('ตำแหน่งเก็บ', 'Storage')}>
                <SearchableSelect value={form.storage} onChange={(value) => setField('storage', value)} options={storages.map((s) => ({ value: s.location, label: s.location }))} placeholder={t('เลือกตำแหน่งเก็บ', 'Select storage')} clearable />
              </FormField>
              <FormField label={t('Revision', 'Revision')}>
                <Input className="font-mono" value={form.revision} onChange={(event) => setField('revision', event.target.value)} placeholder={t('เช่น REV.01', 'e.g. REV.01')} />
              </FormField>
              <FormField label={t('สถานะ', 'Status')}>
                <NativeSelect value={form.status} onChange={(event) => setField('status', event.target.value)}>
                  <option value="In Stock">{fixtureStatus('In Stock')}</option>
                  <option value="In Use">{fixtureStatus('In Use')}</option>
                  <option value="Maintenance">{fixtureStatus('Maintenance')}</option>
                </NativeSelect>
              </FormField>
              <FormField label={t('Exp (PM Due)', 'Exp (PM Due)')}>
                <Input type="date" value={form.exp} onChange={(event) => setField('exp', event.target.value)} />
              </FormField>
              <FormField label={t('Usage Current', 'Usage Current')}>
                <Input type="number" min="0" value={form.current} onChange={(event) => setField('current', Number(event.target.value))} />
              </FormField>
              <FormField label={t('Usage Max', 'Usage Max')}>
                <Input type="number" min="0" value={form.max} onChange={(event) => setField('max', Number(event.target.value))} />
              </FormField>
              <FormField label={t('คำอธิบาย', 'Description')} className="sm:col-span-2">
                <Input value={form.description} onChange={(event) => setField('description', event.target.value)} placeholder={t('รายละเอียด', 'Description')} />
              </FormField>

              <FormField
                label={t('Serial Number (SN) *', 'Serial Number (SN) *')}
                className="sm:col-span-2"
                hint={checking
                  ? t('กำลังตรวจสอบ SN ในระบบ…', 'Checking the serial number in the system…')
                  : t('สแกนหรือพิมพ์ SN แล้วกด Enter เพื่อเพิ่มลงรายการ (ระบบจะเช็คข้อมูลซ้ำให้)', 'Scan or type the SN then press Enter to add it — duplicates are checked automatically')}
              >
                <div className="flex items-center gap-3 rounded-2xl border-2 border-blue-500 bg-blue-50/50 px-4 shadow-sm shadow-blue-100 transition-shadow focus-within:ring-4 focus-within:ring-blue-500/15">
                  <ScanLine className="h-5 w-5 shrink-0 text-blue-600" />
                  <Input
                    ref={snRef}
                    className="h-14 border-0 bg-transparent px-0 font-mono text-lg font-bold tracking-wide text-slate-900 shadow-none focus:ring-0"
                    value={form.sn}
                    onChange={(event) => setField('sn', event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addToQueue(event)
                      }
                    }}
                    placeholder={t('เช่น TB53AO0007-01', 'e.g. TB53AO0007-01')}
                    aria-busy={checking}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </FormField>
              <FormField label={t('Fixture Base (สร้างอัตโนมัติจาก Serial Number)', 'Fixture base (generated automatically from the serial number)')} className="sm:col-span-2">
                <Input
                  className="cursor-not-allowed bg-slate-100 font-mono text-slate-500"
                  value={fixtureBase}
                  readOnly
                  tabIndex={-1}
                  placeholder="—"
                  aria-readonly="true"
                />
              </FormField>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setForm(EMPTY_FORM)
                  setFocusTick((current) => current + 1)
                }}
                disabled={busy}
              >
                {t('ล้างฟอร์ม', 'Clear form')}
              </Button>
            </div>
          </form>
        </Card>

        <div className="min-w-0 xl:relative xl:h-full">
        <Card className="p-5 xl:absolute xl:inset-0 xl:flex xl:flex-col xl:overflow-hidden">
          <SectionHeader
            icon={ClipboardList}
            title={t('รายการที่กรอก', 'Entered items')}
            description={queue.length
              ? t(`${queue.length} รายการรอลงทะเบียน`, `${queue.length} item(s) awaiting registration`)
              : t('ยังไม่มีรายการ', 'No items yet')}
            className="mb-4 xl:shrink-0"
          />

          <div className="xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
          {queue.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center xl:flex xl:flex-1 xl:flex-col xl:items-center xl:justify-center">
              <p className="text-xs font-semibold text-slate-500">{t('ยังไม่มีรายการ', 'No items yet')}</p>
              <p className="mt-1 text-[11px] text-slate-400">{t('กรอก SN แล้วกด Enter เพื่อเพิ่มลงรายการ', 'Enter an SN and press Enter to add it to the list')}</p>
            </div>
          ) : (
            <>
              <p className="mb-1.5 shrink-0 text-[10px] text-slate-400">{t('เลื่อนแนวนอนเพื่อดูข้อมูลทั้งหมด', 'Scroll horizontally to see all data')}</p>
              <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-200 xl:min-h-0 xl:max-h-none xl:flex-1">
                <table className="w-full min-w-[1280px] border-collapse text-left text-[11px]">
                  <thead className="sticky top-0 z-20 bg-slate-50">
                    <tr className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                      <th className="sticky left-0 z-30 border-b border-slate-200 bg-slate-50 px-3 py-2">{t('SN', 'SN')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Base', 'Base')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Line', 'Line')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Model', 'Model')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Step', 'Step')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Process', 'Process')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Position', 'Position')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Process Type', 'Process Type')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('ตำแหน่งเก็บ', 'Storage')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Rev.', 'Rev.')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('สถานะ', 'Status')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Exp', 'Exp')}</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right">{t('Cur.', 'Cur.')}</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right">{t('Max', 'Max')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('คำอธิบาย', 'Description')}</th>
                      <th className="sticky right-0 z-30 border-b border-slate-200 bg-slate-50 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queue.map((item) => (
                      <tr
                        key={item.id}
                        className={cn(
                          item.existing
                            ? 'bg-red-50/80 text-red-700 hover:bg-red-100/70'
                            : 'bg-white hover:bg-slate-50/70',
                        )}
                      >
                        <td
                          className={
                            item.existing
                              ? 'sticky left-0 z-10 whitespace-nowrap bg-red-50 px-3 py-2 font-mono text-[11px] font-bold text-red-700'
                              : 'sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-mono text-[11px] font-bold text-slate-800'
                          }
                        >
                          {item.sn}
                          {item.existing ? (
                            <span className="mt-0.5 block text-[9px] font-black uppercase tracking-wide">
                              ⚠ {t('มีในระบบแล้ว', 'Already exists')}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          <CellWithExisting
                            value={item.fixtureBase}
                            existing={item.existing
                              ? (item.existing.fixtureBase || normSn(item.existing.sn).split('-')[0])
                              : undefined}
                            mono
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          <CellWithExisting value={item.line} existing={item.existing?.line} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          <CellWithExisting value={item.model} existing={item.existing?.model} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          <CellWithExisting value={item.step} existing={item.existing?.step} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          <CellWithExisting value={item.process} existing={item.existing?.process} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          <CellWithExisting value={item.position} existing={item.existing?.position} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          <CellWithExisting
                            value={processTypeLabel(item.type)}
                            existing={processTypeLabel(item.existing?.type)}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          <CellWithExisting value={item.storage} existing={item.existing?.usage?.storage} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          <CellWithExisting value={item.revision} existing={item.existing?.revision} mono />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          <CellWithExisting
                            value={item.status ? fixtureStatus(item.status) : '-'}
                            existing={item.existing?.status ? fixtureStatus(item.existing.status) : undefined}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          <CellWithExisting value={item.exp} existing={item.existing?.exp} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600">
                          <CellWithExisting value={item.current ?? 0} existing={item.existing?.usage?.current} right />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600">
                          <CellWithExisting value={item.max ?? 0} existing={item.existing?.usage?.max} right />
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          <CellWithExisting value={item.description} existing={item.existing?.description} truncate />
                        </td>
                        <td className={cn(
                          'sticky right-0 z-10 px-2 py-2 text-right',
                          item.existing ? 'bg-red-50' : 'bg-white',
                        )}>
                          <button
                            type="button"
                            onClick={() => removeFromQueue(item.id)}
                            disabled={busy}
                            aria-label={t(`ลบ ${item.sn}`, `Delete ${item.sn}`)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 xl:shrink-0">
            {duplicateCount > 0 ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold leading-snug text-red-700">
                ⚠ {t(
                  `มี ${duplicateCount} รายการที่อยู่ในระบบแล้ว ลงทะเบียนไม่ได้จนกว่าจะลบแถวสีแดงออก`,
                  `${duplicateCount} item(s) already exist in the system — remove the red rows before registering`,
                )}
              </p>
            ) : null}
            <Button
              icon={ScanLine}
              onClick={registerAll}
              disabled={busy || queue.length === 0 || duplicateCount > 0}
            >
              {busy
                ? t('กำลังลงทะเบียน…', 'Registering…')
                : t(`ลงทะเบียนทั้งหมด (${queue.length})`, `Register all (${queue.length})`)}
            </Button>
            <Button
              variant="secondary"
              icon={Trash2}
              onClick={() => setQueue([])}
              disabled={busy || queue.length === 0}
            >
              {t('ล้างรายการ', 'Clear list')}
            </Button>
          </div>
        </Card>
        </div>
      </div>
    </div>
  )
}
