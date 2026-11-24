import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarClock, FilePlus2, Plus, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { PROCESS_TYPES, REQUEST_TYPES } from '../lib/constants'
import {
  Card,
  PageHeader,
  SectionHeader,
  Spinner,
} from '../components/ui/Card'
import { FormField, Input, InputSm, NativeSelect } from '../components/ui/Field'
import { useToast } from '../components/ui/Toast'
import SearchableSelect from '../components/ui/SearchableSelect'
import Button from '../components/ui/Button'
import { useLabels, useServerMessage } from '../lib/i18n'
import { toDateInput } from '../lib/format'

const slotLabel = (slot) => {
  if (!slot) return ''
  const hour = Number(String(slot).split(':')[0])
  return `${String(hour).padStart(2, '0')}:00–${String(hour + 1).padStart(2, '0')}:00`
}

const EMPTY_FORM = {
  type: 'Change Model',
  requestType: 'Mainline',
  line: '',
  currentModel: '',
  changeModel: '',
  replaceQty: 1,
  slot: '',
  desc: '',
  breakdownItems: [{ sn: '', symptom: '' }],
}

export default function RequestPage({ user }) {
  const { t } = useLabels()
  const sm = useServerMessage()
  const toast = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [options, setOptions] = useState({ lines: [], models: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState('')

  const loadOptions = useCallback(async () => {
    setLoading(true)
    const [locs, mods] = await Promise.allSettled([
      api.fan2Locations(),
      api.fan2Models(),
    ])
    setOptions({
      lines: locs.status === 'fulfilled' && Array.isArray(locs.value) ? locs.value : [],
      models: mods.status === 'fulfilled' && Array.isArray(mods.value) ? mods.value : [],
    })
    const failed = [locs, mods].filter((item) => item.status === 'rejected')
    if (failed.length) {
      toast.error(
        failed[0].reason?.message
          ? sm(failed[0].reason.message)
          : t('โหลด Line/Model จาก FAN2 ไม่สำเร็จ', 'Failed to load FAN2 line/model options'),
      )
    }
    setLoading(false)
  }, [sm, t, toast])

  const loadSlots = useCallback(
    async (date, autoSelect = false) => {
      if (!date) {
        setSlots([])
        return
      }
      setSlotsLoading(true)
      setSlotsError('')
      try {
        const data = await api.changeModelSlots(date)
        const list = Array.isArray(data) ? data : []
        setSlots(list)
        if (autoSelect) {
          setForm((current) => {
            if (current.slot && list.find((item) => item.value === current.slot)?.available) return current
            return { ...current, slot: list.find((item) => item.available)?.value || '' }
          })
        }
      } catch (err) {
        setSlots([])
        setSlotsError(sm(err.message))
      } finally {
        setSlotsLoading(false)
      }
    },
    [sm],
  )

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  const lineOptions = useMemo(
    () => [...new Set(options.lines)].map((line) => ({ value: line, label: line })),
    [options.lines],
  )
  const modelOptions = useMemo(() => [...new Set(options.models)], [options.models])
  const isChangeModel = form.type === 'Change Model'
  const isReplace = form.type === 'Replace'
  const isModelSwap = isChangeModel || isReplace
  const isBreakdown = form.type === 'Breakdown'

  const today = toDateInput(new Date())

  useEffect(() => {
    if (!isChangeModel) {
      setSlots([])
      return
    }
    loadSlots(today, true)
  }, [isChangeModel, loadSlots, today])

  const availableCount = slots.filter((item) => item.available).length

  const submit = async (event) => {
    event.preventDefault()
    if (!form.line) {
      toast.error(t('กรุณาระบุ Line', 'Please specify a line'))
      return
    }
    if (isModelSwap && (!form.currentModel || !form.changeModel)) {
      toast.error(t('กรุณาระบุ Model', 'Please specify a model'))
      return
    }
    if (isReplace && (!Number.isInteger(Number(form.replaceQty)) || Number(form.replaceQty) < 1)) {
      toast.error(t('กรุณาระบุจำนวน Fixture ที่ต้องเปลี่ยน (อย่างน้อย 1)', 'Please specify how many fixtures to replace (at least 1)'))
      return
    }
    if (isChangeModel && !form.slot) {
      toast.error(t('กรุณาเลือกคิว Change Model', 'Please pick a change-model slot'))
      return
    }
    if (isChangeModel && slots.length && !slots.find((item) => item.value === form.slot)?.available) {
      toast.error(
        t(`คิว ${slotLabel(form.slot)} ไม่ว่าง กรุณาเลือกคิวอื่น`, `Slot ${slotLabel(form.slot)} is taken — please pick another`),
      )
      return
    }
    if (isBreakdown) {
      const valid = (form.breakdownItems || []).some((it) => it.sn.trim())
      if (!valid) {
        toast.error(t('กรุณาระบุ Serial Number อย่างน้อย 1 ตัว', 'Please specify at least one serial number'))
        return
      }
    }
    setBusy(true)
    try {
      const payload = { ...form, user }
      delete payload.slot
      if (isChangeModel) {
        payload.queueDate = today
        payload.queueSlot = form.slot
      }
      if (isReplace) payload.replaceQty = Number(form.replaceQty)
      else delete payload.replaceQty
      if (isBreakdown) {
        payload.breakdownItems = (form.breakdownItems || []).filter((it) => it.sn.trim())
      } else {
        delete payload.breakdownItems
      }
      const result = await api.createRequest(payload)
      toast.success(t(`สร้างคำขอ ${result.request_id} สำเร็จ`, `Request ${result.request_id} created successfully`))
      setForm(EMPTY_FORM)
      if (isChangeModel) loadSlots(today, true)
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setBusy(false)
    }
  }

  const updateBreakdownItem = (index, key, value) => {
    setForm((c) => {
      const items = [...(c.breakdownItems || [])]
      items[index] = { ...items[index], [key]: value }
      return { ...c, breakdownItems: items }
    })
  }

  const addBreakdownItem = () => {
    setForm((c) => ({ ...c, breakdownItems: [...(c.breakdownItems || []), { sn: '', symptom: '' }] }))
  }

  const removeBreakdownItem = (index) => {
    setForm((c) => {
      const items = [...(c.breakdownItems || [])]
      items.splice(index, 1)
      if (items.length === 0) items.push({ sn: '', symptom: '' })
      return { ...c, breakdownItems: items }
    })
  }

  if (loading) return <Spinner label={t('กำลังโหลดข้อมูล…', 'Loading…')} />

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t('การดำเนินงาน', 'Operations')} icon={FilePlus2} title={t('คำขอ', 'Request')} />

      <div className="mx-auto w-full max-w-4xl">
      <Card className="p-5 sm:p-6">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <section>
            <SectionHeader
              title={t('ประเภทงาน', 'Job type')}
              description={t('เลือกประเภทงานก่อนกรอกรายละเอียด', 'Choose a job type before filling in the details')}
              className="mb-3"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {REQUEST_TYPES.map((type) => {
                const activeType = form.type === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    aria-pressed={activeType}
                    title={t(type.hint, type.hint)}
                    onClick={() => setForm((c) => ({
                      ...c,
                      type: type.value,
                      currentModel: '',
                      changeModel: '',
                      replaceQty: 1,
                      slot: '',
                      breakdownItems: [{ sn: '', symptom: '' }],
                    }))}
                    className={`flex items-center justify-center rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition-all sm:text-sm ${
                      activeType
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-4 ring-blue-500/10'
                        : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    {t(type.label, type.value)}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="border-t border-slate-100 pt-5">
            <SectionHeader title={t('ข้อมูลคำขอ', 'Request information')} className="mb-3" />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('Line', 'Line')} required>
                <SearchableSelect
                  value={form.line}
                  onChange={(value) => setForm((c) => ({ ...c, line: value, currentModel: '', changeModel: '' }))}
                  options={lineOptions}
                  placeholder={t('เลือก Line', 'Select line')}
                  clearable
                />
              </FormField>
              <FormField label={t('ประเภทกระบวนการ', 'Process type')}>
                <NativeSelect
                  value={form.requestType}
                  onChange={(e) => setForm((c) => ({ ...c, requestType: e.target.value }))}
                >
                  {PROCESS_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>{t(p.label, p.label)}</option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
          </section>

          {isModelSwap ? (
            <section className="border-t border-slate-100 pt-5">
              <SectionHeader
                title={isReplace
                  ? t('เปลี่ยน Fixture (Replace)', 'Replace fixtures')
                  : t('เปลี่ยนรุ่น Fixture', 'Change fixture model')}
                description={isReplace
                  ? t('ระบุ Model เดิม→ใหม่และจำนวน Fixture ที่ต้องเปลี่ยน', 'Specify the model change and how many fixtures to replace')
                  : t('ระบุ Model เดิมและ Model ใหม่ที่ต้องการเปรียบเทียบ', 'Specify the current and new models to compare')}
                className="mb-3"
              />
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                <FormField label={t('Model เดิม', 'Current model')} required>
                  <NativeSelect
                    value={form.currentModel}
                    onChange={(e) => setForm((c) => ({ ...c, currentModel: e.target.value }))}
                  >
                    <option value="">{t('เลือก Model', 'Select model')}</option>
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </NativeSelect>
                </FormField>
                <div className="hidden justify-center pb-2.5 text-slate-300 sm:flex" aria-hidden="true">
                  <ArrowRight className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <FormField label={t('Model ใหม่', 'New model')} required>
                  <NativeSelect
                    value={form.changeModel}
                    onChange={(e) => setForm((c) => ({ ...c, changeModel: e.target.value }))}
                  >
                    <option value="">{t('เลือก Model', 'Select model')}</option>
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>

              {isReplace ? (
                <div className="mt-3 sm:max-w-[200px]">
                  <FormField label={t('จำนวน Fixture ที่ต้องเปลี่ยน', 'Fixtures to replace')} required>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={form.replaceQty}
                      onChange={(e) => setForm((c) => ({ ...c, replaceQty: e.target.value }))}
                    />
                  </FormField>
                </div>
              ) : null}

              {isChangeModel ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                    <CalendarClock className="h-3.5 w-3.5 text-blue-600" strokeWidth={2.2} />
                    {t('คิวเปลี่ยนรุ่น (1 ชม./คิว)', 'Change-model queue (1 hour per slot)')}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400">
                    {t('07:00–16:00 · วันนี้ · รวมทุก Line', '07:00–16:00 · today · all lines')}
                  </p>
                </div>
                <div className="mt-3">
                  <FormField label={t('คิวเวลา', 'Time slot')} required hint={slotsError || undefined}>
                    <NativeSelect
                      value={form.slot}
                      onChange={(event) => setForm((c) => ({ ...c, slot: event.target.value }))}
                      disabled={slotsLoading || !slots.length}
                    >
                      <option value="">
                        {slotsLoading
                          ? t('กำลังเช็คคิว…', 'Checking slots…')
                          : t(`เลือกคิว (${availableCount} คิวเลือกได้)`, `Select slot (${availableCount} available)`)}
                      </option>
                      {slots.map((item) => (
                        <option key={item.value} value={item.value} disabled={!item.available}>
                          {item.label} · {item.available
                            ? t('เลือกได้', 'Selectable')
                            : t(`เต็ม (${item.requestId}) — เลือกไม่ได้`, `Taken (${item.requestId}) — unavailable`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormField>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  {t('คิวที่เต็มจะแสดง REQ... และเลือกไม่ได้ใน dropdown — คิว reset ทุกวัน', 'Taken slots show REQ... and are disabled in the dropdown — queue resets daily')}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {t('ต้องเตรียม Fixture อย่างน้อย 1 ชม. ก่อนเปลี่ยนรุ่น — 1 คิวใช้ได้ 1 คำขอต่อวัน', 'Fixture prep takes at least 1 hour — one request per slot per day')}
                </p>
              </div>
              ) : null}

              <FormField label={t('รายละเอียด', 'Details')} className="mt-4">
                <Input
                  value={form.desc}
                  onChange={(e) => setForm((c) => ({ ...c, desc: e.target.value }))}
                  placeholder={t('หมายเหตุเพิ่มเติม (ไม่บังคับ)', 'Optional note')}
                />
              </FormField>
            </section>
          ) : null}

          {isBreakdown ? (
            <section className="border-t border-slate-100 pt-5">
              <SectionHeader
                title={t('รายการ Fixture ที่เสีย', 'Broken fixture items')}
                description={t('สแกนหรือพิมพ์ Serial Number พร้อมอาการที่พบ', 'Scan or type the serial number and the symptom')}
                actions={(
                  <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addBreakdownItem}>
                    {t('เพิ่ม', 'Add')}
                  </Button>
                )}
                className="mb-3"
              />
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[1fr_1.4fr_36px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  <span>SN</span>
                  <span>{t('อาการที่พบ', 'Symptom')}</span>
                  <span />
                </div>
                <div className="max-h-[240px] divide-y divide-slate-100 overflow-y-auto">
                  {(form.breakdownItems || []).map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1.4fr_36px] gap-2 px-3 py-2">
                      <InputSm
                        value={item.sn}
                        onChange={(e) => updateBreakdownItem(index, 'sn', e.target.value)}
                        placeholder={t('Serial Number', 'Serial Number')}
                        aria-label={t('Serial Number', 'Serial Number')}
                      />
                      <InputSm
                        value={item.symptom}
                        onChange={(e) => updateBreakdownItem(index, 'symptom', e.target.value)}
                        placeholder={t('อาการที่พบ', 'Symptom')}
                        aria-label={t('อาการที่พบ', 'Symptom')}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        icon={Trash2}
                        aria-label={t('ลบรายการ', 'Remove item')}
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => removeBreakdownItem(index)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                {t('เพิ่มได้หลายรายการ รายการที่ไม่มี SN จะไม่ถูกส่ง', 'Add multiple rows; rows without an SN are ignored')}
              </p>
            </section>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-slate-400">
              {t('ตรวจสอบข้อมูลก่อนสร้างคำขอ', 'Review the details before creating the request')}
            </p>
            <Button type="submit" icon={FilePlus2} disabled={busy} className="w-full justify-center sm:w-auto">
              {busy ? t('กำลังสร้าง…', 'Creating…') : t('สร้างคำขอ', 'Create Request')}
            </Button>
          </div>
        </form>
      </Card>
      </div>
    </div>
  )
}
