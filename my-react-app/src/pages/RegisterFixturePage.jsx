import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardList, ScanLine, Trash2, X } from 'lucide-react'
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

const STEP_OPTIONS = ['STEP1', 'STEP2', 'STEP ROTOR', 'STEP WINDING', 'TEST STEP']

const TYPE_OPTIONS = ['mainline', 'winding', 'rotor', 'function']

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

export default function RegisterFixturePage({ user }) {
  const { t, fixtureStatus } = useLabels()
  const sm = useServerMessage()
  const toast = useToast()
  const snRef = useRef(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [queue, setQueue] = useState([])
  const [locations, setLocations] = useState([])
  const [models, setModels] = useState([])
  const [storages, setStorages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  const addToQueue = (event) => {
    event.preventDefault()
    const sn = form.sn.trim()
    const line = form.line.trim()
    const model = form.model.trim()
    if (!sn || !line || !model) {
      toast.error(t('กรุณากรอก SN, Line และ Model', 'Please enter SN, line and model'))
      return
    }
    if (queue.some((item) => item.sn === sn)) {
      toast.error(t(`SN ${sn} อยู่ในรายการแล้ว`, `SN ${sn} is already in the list`))
      return
    }
    setQueue((current) => [
      ...current,
      { id: `${sn}-${Date.now()}`, ...form, sn, line, model, fixtureBase },
    ])
    // Keep the shared fields so the next SN can be added quickly.
    setForm((current) => ({ ...current, sn: '' }))
    snRef.current?.focus()
    toast.success(t(`เพิ่ม ${sn} ลงรายการแล้ว`, `Added ${sn} to the list`))
  }

  const removeFromQueue = (id) => {
    setQueue((current) => current.filter((item) => item.id !== id))
  }

  const registerAll = async () => {
    if (!queue.length) {
      toast.error(t('ยังไม่มีรายการที่จะลงทะเบียน', 'No items to register'))
      return
    }
    setBusy(true)
    const succeeded = []
    const failed = []
    for (const item of queue) {
      try {
        const { id: _id, ...payload } = item
        await api.createFixture({ ...payload, user })
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
      <PageHeader eyebrow={t('Fixture', 'Fixture')} icon={ScanLine} title={t('ลงทะเบียน Fixture', 'Register fixture')} />

      {error ? <ErrorState message={error} onRetry={loadOptions} /> : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_480px] 2xl:grid-cols-[minmax(0,1fr)_680px]">
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
              <FormField label={t('Type', 'Type')}>
                <NativeSelect value={form.type} onChange={(event) => setField('type', event.target.value)}>
                  <option value="">{t('เลือก Type', 'Select type')}</option>
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
                hint={t('สแกนหรือพิมพ์ SN แล้วกด Enter เพื่อเพิ่มลงรายการ', 'Scan or type the SN then press Enter to add it to the list')}
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
                  snRef.current?.focus()
                }}
                disabled={busy}
              >
                {t('ล้างฟอร์ม', 'Clear form')}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5 xl:sticky xl:top-4">
          <SectionHeader
            icon={ClipboardList}
            title={t('รายการที่กรอก', 'Entered items')}
            description={queue.length
              ? t(`${queue.length} รายการรอลงทะเบียน`, `${queue.length} item(s) awaiting registration`)
              : t('ยังไม่มีรายการ', 'No items yet')}
            className="mb-4"
          />

          {queue.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
              <p className="text-xs font-semibold text-slate-500">{t('ยังไม่มีรายการ', 'No items yet')}</p>
              <p className="mt-1 text-[11px] text-slate-400">{t('กรอก SN แล้วกด Enter เพื่อเพิ่มลงรายการ', 'Enter an SN and press Enter to add it to the list')}</p>
            </div>
          ) : (
            <>
              <p className="mb-1.5 text-[10px] text-slate-400">{t('เลื่อนแนวนอนเพื่อดูข้อมูลทั้งหมด', 'Scroll horizontally to see all data')}</p>
              <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[1120px] border-collapse text-left text-[11px]">
                  <thead className="sticky top-0 z-20 bg-slate-50">
                    <tr className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                      <th className="sticky left-0 z-30 border-b border-slate-200 bg-slate-50 px-3 py-2">{t('SN', 'SN')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Base', 'Base')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Line', 'Line')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Model', 'Model')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Step', 'Step')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Process', 'Process')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Position', 'Position')}</th>
                      <th className="border-b border-slate-200 px-3 py-2">{t('Type', 'Type')}</th>
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
                      <tr key={item.id} className="bg-white hover:bg-slate-50/70">
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-mono text-[11px] font-bold text-slate-800">
                          {item.sn}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600">{item.fixtureBase || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.line || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.model || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.step || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.process || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.position || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.type || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.storage || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.revision || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.status ? fixtureStatus(item.status) : '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.exp || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600">{item.current ?? 0}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600">{item.max ?? 0}</td>
                        <td className="px-3 py-2 text-slate-600">
                          <span className="block max-w-[180px] truncate" title={item.description || ''}>
                            {item.description || '-'}
                          </span>
                        </td>
                        <td className="sticky right-0 z-10 bg-white px-2 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeFromQueue(item.id)}
                            disabled={busy}
                            aria-label={t(`ลบ ${item.sn}`, `Delete ${item.sn}`)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
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

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4">
            <Button icon={ScanLine} onClick={registerAll} disabled={busy || queue.length === 0}>
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
  )
}
