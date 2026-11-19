import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Info,
  PackagePlus,
  ScanLine,
  Undo2,
  Wrench,
} from 'lucide-react'
import api from '../lib/api'
import OrderScanModal from '../components/OrderScanModal'
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
} from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { Input } from '../components/ui/Field'
import { useToast } from '../components/ui/Toast'
import { formatDateTime } from '../lib/format'
import { useLabels, useServerMessage } from '../lib/i18n'

const STATUS_TONE = {
  Waiting: 'red',
  Progress: 'blue',
  Hold: 'orange',
  Verify: 'emerald',
  Done: 'emerald',
}

const statusTone = (status) => STATUS_TONE[status] || 'blue'

const resolveChangeModel = (request) => {
  if (request?.changeModel) return request.changeModel
  const desc = String(request?.desc || '')
  const index = desc.indexOf('→')
  return index >= 0 ? desc.slice(index + 1).trim() : ''
}

const isChangeModel = (request) => /change\s*model/i.test(String(request?.type || ''))
const isBreakdown = (request) => /breakdown/i.test(String(request?.type || ''))

const isRequestor = (request, user) => {
  const owner = String(request?.requestInfo?.empId || '').toLowerCase()
  const actor = String(user?.userId || user?.empId || '').toLowerCase()
  return Boolean(owner && owner === actor)
}

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

const STATUS_STYLE = {
  Waiting: { bg: 'bg-red-50', badge: 'bg-red-600', label: 'WAITING' },
  Progress: { bg: 'bg-blue-50', badge: 'bg-blue-600', label: 'PROGRESS' },
  Hold: { bg: 'bg-orange-50', badge: 'bg-orange-500', label: 'HOLD' },
  Verify: { bg: 'bg-emerald-50', badge: 'bg-emerald-600', label: 'VERIFY' },
  Done: { bg: 'bg-emerald-50', badge: 'bg-emerald-600', label: 'DONE' },
}

const ChangeGroup = ({ title, tone, items, icon: Icon, t }) => {
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
        <p className="px-3 py-3 text-[11px] font-medium text-slate-400">{t('ไม่มีรายการ', 'No items')}</p>
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

const CompareBlock = ({ loading, error, compare, t }) => {
  const changeGroups = [
    { key: 'issue', title: t('ต้องเตรียม / เบิกใหม่', 'Prepare / Issue new'), tone: 'blue', icon: PackagePlus },
    { key: 'keep', title: t('ใช้ต่อได้', 'Can continue using'), tone: 'emerald', icon: CheckCircle2 },
    { key: 'return', title: t('ต้องคืน', 'Must return'), tone: 'red', icon: Undo2 },
  ]
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white py-8">
        <Spinner label={t('กำลังโหลดข้อมูล…', 'Loading…')} />
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">
        {error}
      </div>
    )
  }
  if (!compare) return null
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {changeGroups.map((group) => (
        <ChangeGroup
          key={group.key}
          title={group.title}
          tone={group.tone}
          icon={group.icon}
          items={compare[group.key] || []}
          t={t}
        />
      ))}
    </div>
  )
}

export default function OrderPage({ user }) {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [detail, setDetail] = useState(null)
  const [acceptModal, setAcceptModal] = useState(null)
  const [acceptPassword, setAcceptPassword] = useState('')
  const [acceptBusy, setAcceptBusy] = useState(false)
  const [actionModal, setActionModal] = useState(null)
  const [actionPassword, setActionPassword] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [scanRequest, setScanRequest] = useState(null)
  const [compare, setCompare] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState('')
  const [busyId, setBusyId] = useState('')
  const { t, requestStatus, requestType } = useLabels()
  const sm = useServerMessage()

  const FILTERS = [
    { value: '', label: t('ทั้งหมด', 'All'), variant: 'slate' },
    { value: 'Waiting', label: requestStatus('Waiting'), variant: 'danger' },
    { value: 'Progress', label: requestStatus('Progress'), variant: 'primary' },
    { value: 'Hold', label: requestStatus('Hold'), variant: 'warning' },
    { value: 'Verify', label: requestStatus('Verify'), variant: 'success' },
  ]

  const ACTION_META = {
    hold: { label: t('พักงาน', 'Hold'), hint: t('ยืนยันการพักงาน (Hold)', 'Confirm hold (Hold)') },
    reject: { label: t('ปฏิเสธ', 'Reject'), hint: t('ยืนยันการปฏิเสธงาน (Reject)', 'Confirm reject (Reject)') },
    verify: { label: t('ตรวจสอบ', 'Verify'), hint: t('ยืนยันผลงาน (Verify)', 'Confirm verify (Verify)') },
  }

  const ACTION_PEOPLE = [
    { key: 'requestInfo', label: t('ผู้ขอ (Request)', 'Requester'), dot: 'bg-slate-400' },
    { key: 'acceptInfo', label: t('ผู้รับงาน (Accept)', 'Assignee (Accept)'), dot: 'bg-blue-500' },
    { key: 'issueInfo', label: t('ผู้ดำเนินการ (Tech)', 'Technician (Tech)'), dot: 'bg-purple-500' },
    { key: 'verifyInfo', label: t('ผู้ตรวจสอบ (Verify)', 'Verifier (Verify)'), dot: 'bg-emerald-500' },
  ]

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await api.requests()
      const list = Array.isArray(data) ? data : []
      setRows(list.filter((r) => r.status !== 'Done' && r.status !== 'Rejected'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const reloadRows = useCallback(async () => {
    try {
      const data = await api.requests()
      const list = Array.isArray(data) ? data : []
      setRows(list.filter((r) => r.status !== 'Done' && r.status !== 'Rejected'))
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const filtered = useMemo(() => {
    if (!filter) return rows
    return rows.filter((r) => r.status === filter)
  }, [rows, filter])

  const closeDetail = () => setDetail(null)

  const openAcceptModal = (request) => {
    setAcceptModal(request)
    setAcceptPassword('')
  }
  const closeAcceptModal = () => {
    setAcceptModal(null)
    setAcceptPassword('')
  }

  const openActionModal = (request, action) => {
    setActionModal({ request, action })
    setActionPassword('')
  }
  const closeActionModal = () => {
    setActionModal(null)
    setActionPassword('')
  }

  const handleAccept = async (request) => {
    if (!acceptPassword) {
      toast.error(t('กรุณากรอกรหัสผ่าน', 'Please enter the password'))
      return
    }
    setAcceptBusy(true)
    try {
      const loginRes = await api.login({ empId: user?.userId || user?.empId, pass: acceptPassword })
      if (!loginRes?.success) {
        toast.error(t('รหัสผ่านไม่ถูกต้อง', 'Incorrect password'))
        return
      }
      await api.acceptRequest(request.request_id, user)
      toast.success(t('รับงานสำเร็จ', 'Accepted successfully'))
      closeAcceptModal()
      await reloadRows()
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setAcceptBusy(false)
    }
  }

  const handleHold = async (request) => {
    setBusyId(request.request_id)
    try {
      await api.holdRequest(request.request_id, user)
      toast.success(t('Hold สำเร็จ', 'Hold successful'))
      await reloadRows()
      return true
    } catch (err) {
      toast.error(sm(err.message))
      return false
    } finally {
      setBusyId('')
    }
  }

  const handleReject = async (request) => {
    setBusyId(request.request_id)
    try {
      await api.rejectRequest(request.request_id, user)
      toast.success(t('Reject สำเร็จ', 'Reject successful'))
      await reloadRows()
      return true
    } catch (err) {
      toast.error(sm(err.message))
      return false
    } finally {
      setBusyId('')
    }
  }

  const handleVerify = async (request) => {
    setBusyId(request.request_id)
    try {
      await api.verifyRequest(request.request_id, user)
      toast.success(t('Verify สำเร็จ', 'Verify successful'))
      await reloadRows()
      return true
    } catch (err) {
      toast.error(sm(err.message))
      return false
    } finally {
      setBusyId('')
    }
  }

  const confirmAction = async () => {
    if (!actionModal) return
    if (!actionPassword) {
      toast.error(t('กรุณากรอกรหัสผ่าน', 'Please enter the password'))
      return
    }
    setActionBusy(true)
    try {
      const loginRes = await api.login({ empId: user?.userId || user?.empId, pass: actionPassword })
      if (!loginRes?.success) {
        toast.error(t('รหัสผ่านไม่ถูกต้อง', 'Incorrect password'))
        return
      }
      const runners = {
        hold: handleHold,
        reject: handleReject,
        verify: handleVerify,
      }
      const runner = runners[actionModal.action]
      if (!runner) return
      const ok = await runner(actionModal.request)
      if (ok) closeActionModal()
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setActionBusy(false)
    }
  }

  const compareSource = detail || acceptModal

  useEffect(() => {
    if (!compareSource) {
      setCompare(null)
      return undefined
    }
    const from = String(compareSource.currentModel || '').trim()
    const to = resolveChangeModel(compareSource)
    const line = String(compareSource.line || '').trim()
    if (!isChangeModel(compareSource) || !line || !from || !to) {
      setCompare(null)
      return undefined
    }
    let cancelled = false
    setCompareLoading(true)
    setCompareError('')
    api.compareFixtureList({ line, from, to })
      .then((data) => { if (!cancelled) setCompare(data) })
      .catch((err) => { if (!cancelled) setCompareError(err.message) })
      .finally(() => { if (!cancelled) setCompareLoading(false) })
    return () => { cancelled = true }
  }, [compareSource])

  const acceptModelTo = acceptModal ? resolveChangeModel(acceptModal) : ''

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t('การดำเนินงาน', 'Operations')} icon={ClipboardList} title={t('ออเดอร์', 'Order')} />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? f.variant : 'secondary'}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <Card>
          <Spinner label={t('กำลังโหลดข้อมูล…', 'Loading…')} />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={sm(error)} onRetry={load} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState title={t('ไม่มีคำขอ', 'No requests')} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((r) => {
            const busy = busyId === r.request_id
            const status = r.status
            const style = STATUS_STYLE[status] || { bg: 'bg-white', badge: 'bg-slate-600', label: status || 'Unknown' }
            const statusLabel = STATUS_STYLE[status]
              ? requestStatus(status)
              : (status || t('ไม่ทราบ', 'Unknown'))
            const changeModel = resolveChangeModel(r)
            return (
              <div
                key={r.request_id}
                className={`rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[300px] hover:shadow-md transition-all text-xs ${style.bg}`}
              >
                {/* Header */}
                <div className="p-4 border-b border-slate-50 bg-slate-50/30">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-md ${style.badge} text-white`}>
                      {statusLabel}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">{r.request_id}</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-800 leading-tight break-words">
                    {requestType(r.type)}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 leading-tight min-w-0">
                    <p className="text-lg font-extrabold text-slate-900 break-words">{r.line}</p>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 flex-1 flex flex-col justify-start space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                      isChangeModel(r) ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {isChangeModel(r) ? <ArrowRight className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                      {requestType(isChangeModel(r) ? 'Change Model' : 'Breakdown')}
                    </span>
                    <span className="request-type-badge text-[10px] font-bold text-slate-400 uppercase">
                      {r.requestType ? requestType(r.requestType) : ''}
                    </span>
                  </div>

                  <div className={`p-3 rounded-xl border flex-1 min-h-[60px] shadow-inner transition-colors ${style.bg}`}>
                    <p className="text-slate-500 font-bold uppercase mb-1 tracking-tighter text-[11px]">{t('คำอธิบาย', 'Description')}</p>
                    {isBreakdown(r) && Array.isArray(r.breakdownItems) && r.breakdownItems.length > 0 ? (
                      <div className="space-y-1">
                        {r.breakdownItems.map((it, i) => (
                          <p key={i} className="text-sm text-slate-700 break-words">
                            {it.sn || '-'} · {it.symptom || '-'}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700 break-words whitespace-pre-wrap">
                        "{r.desc || '-'}"
                      </p>
                    )}
                    {isChangeModel(r) && changeModel ? (
                      <p className="mt-1 text-[10px] text-slate-500">
                        {r.currentModel || '-'} <ArrowRight className="inline h-3 w-3" /> {changeModel}
                      </p>
                    ) : null}
                  </div>

                  {status === 'Progress' || status === 'Verify' ? (
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                      <span className={`rounded-lg px-2 py-1 ${r.issueDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.issueDone ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : null}
                        {t('จ่าย', 'Issue')} {Array.isArray(r.scannedIssue) ? r.scannedIssue.length : 0}
                      </span>
                      <span className={`rounded-lg px-2 py-1 ${r.returnDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.returnDone ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : null}
                        {t('รับคืน', 'Return')} {Array.isArray(r.returnedItems) ? r.returnedItems.length : 0}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex justify-between items-center text-[11px]">
                    <div>
                      <p className="text-slate-400 font-bold uppercase text-[9px]">{t('ผู้ขอ', 'Requester')}</p>
                      <p className="font-semibold text-slate-700">{personLabel(r.requestInfo)}</p>
                    </div>
                    {(r.acceptInfo || r.issueInfo) ? (
                      <div>
                        <p className="text-slate-400 font-bold uppercase text-[9px]">{t('ช่างที่รับงาน', 'Assignee')}</p>
                        <p className="font-semibold text-slate-700">
                          {personLabel(r.issueInfo || r.acceptInfo)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="p-4 border-t border-slate-50 bg-slate-50/30 space-y-2">
                  <div className="flex">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-9 w-full"
                      onClick={() => setDetail(r)}
                    >
                      <Info className="h-3.5 w-3.5" /> {t('รายละเอียด', 'Information')}
                    </Button>
                  </div>

                  <div className="flex gap-2">
                  {status === 'Waiting' || status === 'Hold' ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-9 flex-[3] border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                        disabled={busy}
                        onClick={() => openActionModal(r, 'reject')}
                      >
                        {t('ปฏิเสธ', 'Reject')}
                      </Button>
                      <Button
                        size="sm"
                        variant={status === 'Hold' ? 'warning' : 'danger'}
                        className="h-9 flex-[7]"
                        disabled={busy}
                        onClick={() => openAcceptModal(r)}
                      >
                        {t('รับงาน', 'Accept')}
                      </Button>
                    </>
                  ) : null}

                  {status === 'Progress' ? (
                    <>
                      <Button
                        size="sm"
                        variant="warning"
                        className="h-9 flex-[3]"
                        disabled={busy}
                        onClick={() => openActionModal(r, 'hold')}
                      >
                        {t('พักงาน', 'Hold')}
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        className="h-9 flex-[7]"
                        disabled={busy}
                        icon={ScanLine}
                        onClick={() => setScanRequest(r)}
                      >
                        {t('เสร็จงาน / สแกน', 'Complete / Scan')}
                      </Button>
                    </>
                  ) : null}

                  {status === 'Verify' ? (
                    isRequestor(r, user) ? (
                      <Button
                        size="sm"
                        variant="success"
                        className="h-9 flex-1"
                        disabled={busy}
                        onClick={() => openActionModal(r, 'verify')}
                      >
                        {t('ตรวจสอบ', 'Verify')}
                      </Button>
                    ) : (
                      <div className="flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-[10px] font-bold text-slate-400">
                        {t('รอเจ้าของคำขอ Verify', 'Waiting for requester to verify')}
                      </div>
                    )
                  ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Modal (read-only) */}
      <Modal
        open={Boolean(detail)}
        onClose={closeDetail}
        size="xl"
        icon={ClipboardList}
        title={detail?.request_id || t('คำขอ', 'Request')}
        subtitle={detail ? `${requestType(detail.type)} · ${requestStatus(detail.status)}` : ''}
        tone={statusTone(detail?.status)}
      >
        {detail ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-3">
              <InfoRow label={t('Line', 'Line')}>{detail.line || '-'}</InfoRow>
              <InfoRow label={t('Model', 'Model')}>
                <span className="font-mono text-[11px]">{detail.currentModel || '-'}</span>
              </InfoRow>
              <InfoRow label={t('รุ่นใหม่', 'New Model')}>
                <span className="font-mono text-[11px]">{resolveChangeModel(detail) || '-'}</span>
              </InfoRow>
              <InfoRow label={t('ประเภทคำขอ', 'Request type')}>{requestType(detail.type)}</InfoRow>
              <InfoRow label={t('ผู้ขอ', 'Requester')}>
                {personLabel(detail.requestInfo)} · {formatDateTime(detail.requestInfo?.date)}
              </InfoRow>
              <InfoRow label={t('รายละเอียด', 'Details')}>{detail.desc || '-'}</InfoRow>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                {t('ผู้ดำเนินการ (Action users)', 'Action users')}
              </p>
              <div className="divide-y divide-slate-100">
                {ACTION_PEOPLE.map(({ key, label, dot }) => {
                  const person = detail[key]
                  return (
                    <div key={key} className="flex items-center gap-3 py-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${person ? dot : 'bg-slate-200'}`} />
                      <p className="w-44 shrink-0 text-[10px] font-black uppercase tracking-wide text-slate-400">
                        {label}
                      </p>
                      <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-700">
                        {personLabel(person)}
                        {person?.empId ? (
                          <span className="ml-1 font-mono text-[10px] font-bold text-slate-400">
                            ({person.empId})
                          </span>
                        ) : null}
                      </p>
                      <p className="shrink-0 text-[10px] font-medium text-slate-400">
                        {person?.date ? formatDateTime(person.date) : '-'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
            {isBreakdown(detail) && Array.isArray(detail.breakdownItems) && detail.breakdownItems.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
                <p className="text-[11px] font-black text-orange-800">{requestType('Breakdown')} — {t('รายการ Fixture ที่เสีย', 'Broken fixture items')}</p>
                {detail.breakdownItems.map((it, i) => (
                  <div key={i} className="rounded-xl border border-orange-100 bg-white px-3 py-2 text-[11px]">
                    <span className="font-mono font-bold text-slate-800">{it.sn || '-'}</span>
                    <span className="ml-2 text-slate-500">{it.symptom || '-'}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {isChangeModel(detail) ? (
              <CompareBlock loading={compareLoading} error={sm(compareError)} compare={compare} t={t} />
            ) : null}
          </div>
        ) : null}
      </Modal>
      <Modal
        open={Boolean(acceptModal)}
        onClose={closeAcceptModal}
        size="xl"
        icon={ClipboardList}
        title={acceptModal?.request_id || t('คำขอ', 'Request')}
        subtitle={acceptModal ? `${requestType(acceptModal.type)} · ${requestStatus(acceptModal.status)}` : ''}
        tone={statusTone(acceptModal?.status)}
      >
        {acceptModal ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-3">
              <InfoRow label={t('Line', 'Line')}>{acceptModal.line || '-'}</InfoRow>
              <InfoRow label={t('Model', 'Model')}>
                <span className="font-mono text-[11px]">{acceptModal.currentModel || '-'}</span>
              </InfoRow>
              <InfoRow label={t('รุ่นใหม่', 'New Model')}>
                <span className="font-mono text-[11px]">{acceptModelTo || '-'}</span>
              </InfoRow>
              <InfoRow label={t('ประเภทคำขอ', 'Request type')}>{requestType(acceptModal.type)}</InfoRow>
              <InfoRow label={t('ผู้ขอ', 'Requester')}>
                {personLabel(acceptModal.requestInfo)} · {formatDateTime(acceptModal.requestInfo?.date)}
              </InfoRow>
              <InfoRow label={t('รายละเอียด', 'Details')}>{acceptModal.desc || '-'}</InfoRow>
            </div>

            {isBreakdown(acceptModal) && Array.isArray(acceptModal.breakdownItems) && acceptModal.breakdownItems.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
                <p className="text-[11px] font-black text-orange-800">{requestType('Breakdown')} — {t('รายการ Fixture ที่เสีย', 'Broken fixture items')}</p>
                {acceptModal.breakdownItems.map((it, i) => (
                  <div key={i} className="rounded-xl border border-orange-100 bg-white px-3 py-2 text-[11px]">
                    <span className="font-mono font-bold text-slate-800">{it.sn || '-'}</span>
                    <span className="ml-2 text-slate-500">{it.symptom || '-'}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {isChangeModel(acceptModal) ? (
              <CompareBlock loading={compareLoading} error={sm(compareError)} compare={compare} t={t} />
            ) : null}

            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{t('รหัสผ่านเพื่อยืนยันรับงาน', 'Password to confirm acceptance')}</p>
              <Input
                type="password"
                value={acceptPassword}
                onChange={(e) => setAcceptPassword(e.target.value)}
                placeholder={t('รหัสผ่าน', 'Password')}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={closeAcceptModal}>
                {t('ยกเลิก', 'Cancel')}
              </Button>
              <Button variant="danger" size="sm" disabled={acceptBusy} onClick={() => handleAccept(acceptModal)}>
                {acceptBusy ? t('กำลังรับงาน…', 'Accepting…') : t('ยืนยันรับงาน', 'Confirm acceptance')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Action confirm modal (password required) */}
      <Modal
        open={Boolean(actionModal)}
        onClose={closeActionModal}
        size="sm"
        icon={ClipboardList}
        title={actionModal ? ACTION_META[actionModal.action]?.hint : ''}
        subtitle={actionModal?.request?.request_id || ''}
        tone={statusTone(actionModal?.request?.status)}
      >
        {actionModal ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <InfoRow label={t('Line', 'Line')}>{actionModal.request?.line || '-'}</InfoRow>
              <InfoRow label={t('ประเภทคำขอ', 'Request type')}>{requestType(actionModal.request?.type)}</InfoRow>
              <InfoRow label={t('สถานะ', 'Status')}>
                {actionModal.request?.status ? requestStatus(actionModal.request.status) : '-'} → {ACTION_META[actionModal.action]?.label}
              </InfoRow>
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{t('รหัสผ่านเพื่อยืนยัน', 'Password to confirm')}</p>
              <Input
                type="password"
                value={actionPassword}
                onChange={(e) => setActionPassword(e.target.value)}
                placeholder={t('รหัสผ่าน', 'Password')}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={closeActionModal}>
                {t('ยกเลิก', 'Cancel')}
              </Button>
              <Button
                variant={actionModal.action === 'hold' ? 'warning' : actionModal.action === 'verify' ? 'success' : 'primary'}
                size="sm"
                disabled={actionBusy}
                onClick={confirmAction}
              >
                {actionBusy ? t('กำลังดำเนินการ…', 'Processing…') : t('ยืนยัน', 'Confirm')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <OrderScanModal
        open={Boolean(scanRequest)}
        request={scanRequest}
        user={user}
        onClose={() => setScanRequest(null)}
        onDone={reloadRows}
      />
    </div>
  )
}