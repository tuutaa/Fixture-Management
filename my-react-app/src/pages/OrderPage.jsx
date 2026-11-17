import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  PackagePlus,
  Undo2,
  Wrench,
} from 'lucide-react'
import api from '../lib/api'
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
} from '../components/ui/Card'
import { RequestStatusBadge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { formatDateTime } from '../lib/format'

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'Waiting', label: 'Waiting' },
  { value: 'Issued', label: 'Prepare fixture' },
  { value: 'Done', label: 'Verify' },
]

/* desc ของ Change Model ถูกสร้างเป็น "model เดิม → model ใหม่"
 * (request เก่าที่ยังไม่มี field modelTo ให้แกะจาก desc) */
const resolveModelTo = (request) => {
  if (request?.modelTo) return request.modelTo
  const desc = String(request?.desc || '')
  const index = desc.indexOf('→')
  return index >= 0 ? desc.slice(index + 1).trim() : ''
}

const isChangeModel = (request) => /change\s*model/i.test(String(request?.type || ''))

const personLabel = (person) => {
  if (!person) return '-'
  const name = [person.name, person.lastname].filter(Boolean).join(' ').trim()
  return name || person.empId || '-'
}

const InfoRow = ({ label, children }) => (
  <div>
    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
    <div className="mt-0.5 text-[12px] font-semibold text-slate-700">{children}</div>
  </div>
)

const CHANGE_GROUPS = [
  { key: 'issue', title: 'ต้องเตรียม / เบิกใหม่', tone: 'blue', icon: PackagePlus },
  { key: 'keep', title: 'ใช้ต่อได้', tone: 'emerald', icon: CheckCircle2 },
  { key: 'return', title: 'ต้องคืน', tone: 'red', icon: Undo2 },
]

/* หนึ่งกล่อง = หนึ่งสถานะ ลิส SN เรียงลงมาทีละบรรทัด */
const ChangeGroup = ({ title, tone, items, icon: Icon }) => {
  const tones = {
    blue: 'border-blue-200 bg-blue-50/50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
    red: 'border-red-200 bg-red-50/50 text-red-700',
  }
  const [border, bg, text] = tones[tone].split(' ')
  return (
    <div className={`overflow-hidden rounded-2xl border ${border} ${bg}`}>
      <div className="flex items-center justify-between gap-2 border-b border-white/70 px-3 py-2">
        <p className={`flex items-center gap-1.5 text-[11px] font-black ${text}`}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
          {title}
        </p>
        <span className="rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-black text-slate-600">
          {items.length.toLocaleString()}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-3 text-[11px] font-medium text-slate-400">ไม่มีรายการ</p>
      ) : (
        <div className="max-h-64 overflow-auto bg-white/85">
          <table className="w-full border-collapse text-left">
            <tbody>
              {items.map((item, index) => (
                <tr key={item.sn} className="border-b border-slate-100 last:border-0">
                  <td className="w-10 px-3 py-1.5 text-[10px] font-bold text-slate-400">
                    {index + 1}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] font-bold text-slate-800">
                    {item.sn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function OrderPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [active, setActive] = useState(null)
  const [compare, setCompare] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await api.requests({ status: filter || undefined })
      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    if (!filter) return rows
    return rows.filter((r) => r.status === filter)
  }, [rows, filter])

  const openRequest = (request) => {
    setActive(request)
    setCompare(null)
    setCompareError('')
  }

  const closeRequest = () => {
    setActive(null)
    setCompare(null)
    setCompareError('')
    setCompareLoading(false)
  }

  /* โหลดข้อมูลเปรียบเทียบ fixture เมื่อเปิด request ประเภท Change Model */
  useEffect(() => {
    if (!active) return undefined
    const from = String(active.model || '').trim()
    const to = resolveModelTo(active)
    const line = String(active.line || '').trim()
    if (!isChangeModel(active) || !line || !from || !to) {
      setCompare(null)
      return undefined
    }

    let cancelled = false
    setCompareLoading(true)
    setCompareError('')
    api
      .compareFixtureList({ line, from, to })
      .then((data) => {
        if (!cancelled) setCompare(data)
      })
      .catch((err) => {
        if (!cancelled) setCompareError(err.message)
      })
      .finally(() => {
        if (!cancelled) setCompareLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [active])

  const activeModelTo = active ? resolveModelTo(active) : ''
  const showCompare = active && isChangeModel(active) && active.line && active.model && activeModelTo

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Operations" icon={ClipboardList} title="Order" />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <Card>
          <Spinner />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState title="ไม่มี Request" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const modelTo = resolveModelTo(r)
            return (
              <button
                key={r.request_id}
                type="button"
                onClick={() => openRequest(r)}
                className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/60 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/15"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-blue-700">{r.request_id}</span>
                  <RequestStatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-[12px] font-semibold text-slate-700">{r.type}</p>
                <p className="text-[11px] text-slate-500">
                  {r.line} · {r.model || '-'}
                  {modelTo ? (
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <ArrowRight className="h-3 w-3" /> {modelTo}
                    </span>
                  ) : null}
                </p>
                {r.desc ? <p className="mt-1 text-[10px] text-slate-400">{r.desc}</p> : null}
                <p className="mt-2 text-[10px] font-bold text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                  ดูรายละเอียด →
                </p>
              </button>
            )
          })}
        </div>
      )}

      <Modal
        open={Boolean(active)}
        onClose={closeRequest}
        size="xl"
        icon={ClipboardList}
        title={active?.request_id || 'Request'}
        subtitle={active ? `${active.type || '-'} · ${active.status || '-'}` : ''}
        tone="blue"
      >
        {active ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-3">
              <InfoRow label="Line">{active.line || '-'}</InfoRow>
              <InfoRow label="Model">
                <span className="font-mono text-[11px]">{active.model || '-'}</span>
              </InfoRow>
              <InfoRow label="Model ใหม่">
                <span className="font-mono text-[11px]">{activeModelTo || '-'}</span>
              </InfoRow>
              <InfoRow label="Request type">{active.type || '-'}</InfoRow>
              <InfoRow label="ผู้ขอ">
                {personLabel(active.requestInfo)} · {formatDateTime(active.requestInfo?.date || active.requestTime)}
              </InfoRow>
              <InfoRow label="รายละเอียด">{active.desc || '-'}</InfoRow>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Accept', person: active.acceptInfo },
                { label: 'Prepare fixture', person: active.issueInfo },
                { label: 'Verify', person: active.verifyInfo },
              ].map((stage) => (
                <div
                  key={stage.label}
                  className="rounded-2xl border border-slate-200 bg-white p-3"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                    {stage.label}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-700">
                    {stage.person ? personLabel(stage.person) : 'ยังไม่ดำเนินการ'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {stage.person?.date ? formatDateTime(stage.person.date) : '-'}
                  </p>
                </div>
              ))}
            </div>

            {showCompare ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[12px] font-black text-slate-800">
                    <Wrench className="h-4 w-4 text-blue-600" />
                    Fixture ที่ต้องเปลี่ยน (ตาม Fixture List)
                  </p>
                  <p className="flex items-center gap-1 font-mono text-[10px] font-bold text-slate-500">
                    {active.model} <ArrowRight className="h-3 w-3" /> {activeModelTo}
                  </p>
                </div>

                {compareLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-white py-8">
                    <Spinner />
                  </div>
                ) : compareError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">
                    {compareError}
                  </div>
                ) : compare ? (
                  <>
                    {compare.missing?.from || compare.missing?.to ? (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
                        {compare.missing?.from
                          ? `ไม่พบ Fixture List ของ model ${active.model} ใน line ${active.line}`
                          : `ไม่พบ Fixture List ของ model ${activeModelTo} ใน line ${active.line}`}
                      </p>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-3">
                      {CHANGE_GROUPS.map((group) => (
                        <ChangeGroup
                          key={group.key}
                          title={group.title}
                          tone={group.tone}
                          icon={group.icon}
                          items={compare[group.key] || []}
                        />
                      ))}
                    </div>

                    <p className="text-[10px] font-medium text-slate-400">
                      รวม{' '}
                      {(
                        (compare.total?.issue || 0) +
                        (compare.total?.return || 0) +
                        (compare.total?.keep || 0)
                      ).toLocaleString()}{' '}
                      รายการ · ต้องเปลี่ยน{' '}
                      {((compare.total?.issue || 0) + (compare.total?.return || 0)).toLocaleString()} ตัว
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-400">ไม่มีข้อมูลเปรียบเทียบ</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
