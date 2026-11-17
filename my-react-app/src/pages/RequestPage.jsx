import { useCallback, useEffect, useMemo, useState } from 'react'
import { FilePlus2 } from 'lucide-react'
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

const EMPTY_FORM = {
  type: 'Change Model',
  requestType: 'Mainline',
  line: '',
  model: '',
  modelTo: '',
  step: '',
  dueDate: '',
  desc: '',
}

export default function RequestPage({ user }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [options, setOptions] = useState({ lines: [], models: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const loadOptions = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.fixtureOptions()
      setOptions({ lines: data.lines || [], models: data.models || [] })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  /* SearchableSelect ต้องใช้ { value, label } — model ใช้กับ NativeSelect จึงคงเป็น string */
  const lineOptions = useMemo(
    () => [...new Set(options.lines)].map((line) => ({ value: line, label: line })),
    [options.lines],
  )
  const modelOptions = useMemo(() => [...new Set(options.models)], [options.models])
  const isChangeModel = form.type === 'Change Model'

  const submit = async (event) => {
    event.preventDefault()
    if (!form.line) {
      toast.error('กรุณาระบุ Line')
      return
    }
    if (isChangeModel && (!form.model || !form.modelTo)) {
      toast.error('กรุณาระบุ Model')
      return
    }
    setBusy(true)
    try {
      const result = await api.createRequest({ ...form, user })
      toast.success(`สร้างคำขอ ${result.request_id} สำเร็จ`)
      setForm(EMPTY_FORM)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Operations" icon={FilePlus2} title="Request" />

      <Card className="p-5 sm:p-7">
        <SectionHeader title="สร้างคำขอ" className="mb-5" />
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="grid gap-2 sm:grid-cols-2">
            {REQUEST_TYPES.map((type) => {
              const activeType = form.type === type.value
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm((c) => ({ ...c, type: type.value, model: '', modelTo: '' }))}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-bold ${
                    activeType ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {type.label}
                </button>
              )
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Line *">
              <SearchableSelect
                value={form.line}
                onChange={(value) => setForm((c) => ({ ...c, line: value }))}
                options={lineOptions}
                placeholder="เลือก Line"
                clearable
              />
            </FormField>
            <FormField label="Request type">
              <NativeSelect
                value={form.requestType}
                onChange={(e) => setForm((c) => ({ ...c, requestType: e.target.value }))}
              >
                {PROCESS_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </NativeSelect>
            </FormField>
          </div>

          {isChangeModel ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Model (เดิม)">
                <NativeSelect
                  value={form.model}
                  onChange={(e) => setForm((c) => ({ ...c, model: e.target.value }))}
                >
                  <option value="">เลือก Model</option>
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label="Model (ใหม่)">
                <NativeSelect
                  value={form.modelTo}
                  onChange={(e) => setForm((c) => ({ ...c, modelTo: e.target.value }))}
                >
                  <option value="">เลือก Model</option>
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Step">
              <Input value={form.step} onChange={(e) => setForm((c) => ({ ...c, step: e.target.value }))} />
            </FormField>
            <FormField label="Due date">
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((c) => ({ ...c, dueDate: e.target.value }))} />
            </FormField>
          </div>

          <FormField label="รายละเอียด">
            <Input value={form.desc} onChange={(e) => setForm((c) => ({ ...c, desc: e.target.value }))} />
          </FormField>

          <Button type="submit" icon={FilePlus2} disabled={busy}>
            {busy ? 'กำลังสร้าง…' : 'สร้างคำขอ'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
