import { useCallback, useEffect, useMemo, useState } from 'react'
import { FilePlus2, Plus, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { PROCESS_TYPES, REQUEST_TYPES } from '../lib/constants'
import {
  Card,
  PageHeader,
  SectionHeader,
  Spinner,
} from '../components/ui/Card'
import { FormField, Input, NativeSelect } from '../components/ui/Field'
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
  const { t, requestType } = useLabels()
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

      <Card className="p-5 sm:p-7">
        <SectionHeader title={t('สร้างคำขอ', 'Create Request')} className="mb-5" />
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="grid gap-2 sm:grid-cols-2">
            {REQUEST_TYPES.map((type) => {
              const activeType = form.type === type.value
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm((c) => ({ ...c, type: type.value, currentModel: '', changeModel: '', breakdownItems: [{ sn: '', symptom: '' }] }))}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-bold ${
                    activeType ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {requestType(type.value)}
                </button>
              )
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('Line *', 'Line *')}>
              <SearchableSelect
                value={form.line}
                onChange={(value) => setForm((c) => ({ ...c, line: value, currentModel: '', changeModel: '' }))}
                options={lineOptions}
                placeholder={t('เลือก Line', 'Select line')}
                clearable
              />
            </FormField>
            <FormField label={t('ประเภทคำขอ', 'Request type')}>
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

          {isChangeModel ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('Model (เดิม)', 'Model (current)')}>
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
              <FormField label={t('Model (ใหม่)', 'Model (new)')}>
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
          ) : null}

          {isBreakdown ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-slate-700">{t('รายการ Fixture ที่เสีย', 'Broken fixture items')}</p>
                <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addBreakdownItem}>
                  {t('เพิ่ม', 'Add')}
                </Button>
              </div>
              {(form.breakdownItems || []).map((item, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <Input
                    value={item.sn}
                    onChange={(e) => updateBreakdownItem(index, 'sn', e.target.value)}
                    placeholder={t('Serial Number', 'Serial Number')}
                  />
                  <Input
                    value={item.symptom}
                    onChange={(e) => updateBreakdownItem(index, 'symptom', e.target.value)}
                    placeholder={t('อาการที่พบ', 'Symptom')}
                  />
                  <Button type="button" size="sm" variant="danger" onClick={() => removeBreakdownItem(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {isBreakdown ? null : (
            <FormField label={t('รายละเอียด', 'Details')}>
              <Input value={form.desc} onChange={(e) => setForm((c) => ({ ...c, desc: e.target.value }))} />
            </FormField>
          )}

          <Button type="submit" icon={FilePlus2} disabled={busy}>
            {busy ? t('กำลังสร้าง…', 'Creating…') : t('สร้างคำขอ', 'Create Request')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
