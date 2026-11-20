import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, FilePlus2, Plus, Trash2 } from 'lucide-react'
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

const EMPTY_FORM = {
  type: 'Change Model',
  requestType: 'Mainline',
  line: '',
  currentModel: '',
  changeModel: '',
  desc: '',
  breakdownItems: [{ sn: '', symptom: '' }],
}

export default function RequestPage({ user }) {
  const { t } = useLabels()
  const sm = useServerMessage()
  const toast = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [options, setOptions] = useState({ lines: [], models: [], modelsByLine: {} })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const loadOptions = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.fixtureOptions()
      setOptions({ lines: data.lines || [], models: data.models || [], modelsByLine: data.modelsByLine || {} })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  const lineOptions = useMemo(
    () => [...new Set(options.lines)].map((line) => ({ value: line, label: line })),
    [options.lines],
  )
  const modelOptions = useMemo(() => {
    const byLine = options.modelsByLine || {}
    if (form.line && byLine[form.line]) return byLine[form.line]
    return [...new Set(options.models)]
  }, [options, form.line])
  const isChangeModel = form.type === 'Change Model'
  const isBreakdown = form.type === 'Breakdown'

  const submit = async (event) => {
    event.preventDefault()
    if (!form.line) {
      toast.error(t('กรุณาระบุ Line', 'Please specify a line'))
      return
    }
    if (isChangeModel && (!form.currentModel || !form.changeModel)) {
      toast.error(t('กรุณาระบุ Model', 'Please specify a model'))
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
      if (isBreakdown) {
        payload.breakdownItems = (form.breakdownItems || []).filter((it) => it.sn.trim())
      } else {
        delete payload.breakdownItems
      }
      const result = await api.createRequest(payload)
      toast.success(t(`สร้างคำขอ ${result.request_id} สำเร็จ`, `Request ${result.request_id} created successfully`))
      setForm(EMPTY_FORM)
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
            <div className="grid grid-cols-2 gap-2">
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

          {isChangeModel ? (
            <section className="border-t border-slate-100 pt-5">
              <SectionHeader
                title={t('เปลี่ยนรุ่น Fixture', 'Change fixture model')}
                description={t('ระบุ Model เดิมและ Model ใหม่ที่ต้องการเปรียบเทียบ', 'Specify the current and new models to compare')}
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
