import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  PackagePlus,
  RotateCcw,
  ScanLine,
  Undo2,
  Wrench,
} from 'lucide-react'
import api from '../lib/api'
import Button from './ui/Button'
import Modal from './ui/Modal'
import { Input } from './ui/Field'
import { useToast } from './ui/Toast'
import { useLabels, useServerMessage } from '../lib/i18n'

const normKey = (value) => String(value || '').trim().toUpperCase()

const matchForItem = (item, matches) => matches.find((match) => {
  if (Number.isInteger(match.planIndex) && Number.isInteger(item.planIndex)) {
    return match.planIndex === item.planIndex
  }
  return match.action === item.action
    && (normKey(match.planSn) === normKey(item.sn) || normKey(match.sn) === normKey(item.sn))
})

const itemMatched = (item, matches) => Boolean(matchForItem(item, matches))

const isModelSwap = (request) => /change\s*model|replace/i.test(String(request?.type || ''))
const isReplace = (request) => /replace/i.test(String(request?.type || ''))
const isBreakdown = (request) => /breakdown/i.test(String(request?.type || ''))

const replaceQtyLabel = (request, t) => {
  const qty = Number(request?.replaceQty)
  const count = Number.isInteger(qty) && qty >= 1 ? qty : 0
  return count ? `${t('Replace', 'Replace')} ${count} ${t('ตัว', 'pcs')}` : t('Replace', 'Replace')
}

const resolveChangeModel = (request) => {
  if (request?.changeModel) return request.changeModel
  const desc = String(request?.desc || '')
  const index = desc.indexOf('→')
  return index >= 0 ? desc.slice(index + 1).trim() : ''
}

const MatchList = ({ title, icon: Icon, items, matches, emptyText, t }) => {
  const matchedCount = items.filter((item) => itemMatched(item, matches)).length
  const allGreen = items.length > 0 && matchedCount === items.length

  return (
    <div className={`min-w-0 overflow-hidden rounded-2xl border ${allGreen ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'}`}>
      <div className="flex items-center justify-between gap-2 border-b border-white/70 px-3 py-2">
        <p className={`flex items-center gap-1.5 text-[11px] font-black ${allGreen ? 'text-emerald-700' : 'text-red-700'}`}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
          {title}
        </p>
        <span className="rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-black text-slate-600">
          {matchedCount}/{items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-3 text-[11px] font-medium text-slate-400">{emptyText}</p>
      ) : (
        <div className="max-h-56 overflow-auto bg-white/85">
          <table className="w-full border-collapse text-left">
            <tbody>
              {items.map((item, index) => {
                const matched = itemMatched(item, matches)
                const match = matchForItem(item, matches)
                const scannedSn = match?.sn && normKey(match.sn) !== normKey(item.sn) ? match.sn : ''
                return (
                  <tr
                    key={`${item.action}-${item.sn}-${index}`}
                    className={`border-b border-slate-100 last:border-0 ${matched ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
                  >
                    <td className="w-8 px-2 py-1.5 text-center">
                      {matched
                        ? <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-600" />
                        : <span className="mx-auto block h-2 w-2 rounded-full bg-red-500" />}
                    </td>
                    <td className="w-8 px-1 py-1.5 text-[10px] font-bold opacity-60">{index + 1}</td>
                    <td className="whitespace-nowrap px-1 py-1.5 font-mono text-[11px] font-bold">
                      {item.sn}
                      {scannedSn ? (
                        <span className="mt-0.5 block font-sans text-[9px] font-bold opacity-70">
                          {t('สแกน', 'scanned')}: {scannedSn}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] font-semibold opacity-70">{item.position || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const ApprovalRow = ({ done, title, caption }) => (
  <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${done ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-white/70'}`}>
    {done
      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      : <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />}
    <div className="min-w-0">
      <p className={`text-[11px] font-black ${done ? 'text-emerald-700' : 'text-slate-600'}`}>{title}</p>
      <p className="truncate text-[10px] font-semibold text-slate-400">{caption}</p>
    </div>
  </div>
)

export default function OrderScanModal({ open, request, user, phase = 'issue', onClose, onDone, onVerify }) {
  const toast = useToast()
  const { t, requestType } = useLabels()
  const sm = useServerMessage()
  const snRef = useRef(null)
  const isReturn = phase === 'return'
  const action = isReturn ? 'return' : 'issue'
  const [current, setCurrent] = useState(request)
  const [plan, setPlan] = useState([])
  const [planLoading, setPlanLoading] = useState(false)
  const [sn, setSn] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    if (!open || !request) return
    setCurrent(request)
    setSn('')
    setError('')
    setLastResult(null)
    setResetting(false)
    setPlan([])
  }, [open, request, phase])

  useEffect(() => {
    if (!open || sn || busy || resetting) return undefined
    const frame = window.requestAnimationFrame(() => {
      snRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, sn, busy, resetting])

  useEffect(() => {
    if (!open || !request) return undefined
    let cancelled = false
    setPlanLoading(true)
    api.scanPlan(request.request_id)
      .then((data) => {
        if (cancelled) return
        /* Keep the original plan index (server uses it for duplicate bases),
         * but show/collect the active phase only. */
        setPlan((data.plan || [])
          .map((item, index) => ({ ...item, planIndex: index }))
          .filter((item) => item.action === action))
        setCurrent((prev) => ({
          ...prev,
          scanMatches: (data.matches || []).filter((match) => match.action === action),
        }))
      })
      .catch(() => { if (!cancelled) setPlan([]) })
      .finally(() => { if (!cancelled) setPlanLoading(false) })
    return () => { cancelled = true }
  }, [open, request, action])

  const matches = useMemo(
    () => (current?.scanMatches || []).filter((match) => match.action === action),
    [current, action],
  )
  const hasFallback = plan.some((item) => item.fallback)
  const isMatched = (item) => itemMatched(item, matches)
  const matchedCount = plan.length > 0
    ? plan.filter(isMatched).length
    : matches.length
  const total = plan.length || matches.length
  const allMatched = plan.length > 0 ? matchedCount === plan.length : matches.length > 0

  const actor = String(user?.userId || user?.empId || '').toLowerCase()
  const requestorId = String(current?.requestInfo?.empId || '').toLowerCase()
  const techId = String(current?.acceptInfo?.empId || current?.issueInfo?.empId || '').toLowerCase()
  const isRequester = Boolean(requestorId && requestorId === actor)
  const isAssignee = Boolean(techId && techId === actor)
  // All barcode scanning in Order (issue and return) belongs to the assigned technician.
  const canScan = isAssignee
  const canConfirm = isReturn ? (isRequester || isAssignee) : isAssignee

  const approvals = current?.returnApprovals || []
  const hasApproval = (role) => approvals.some((item) => item.role === role)
  const allApproved = hasApproval('requester') && hasApproval('assignee')
  const myRole = isReturn ? (isRequester ? 'requester' : isAssignee ? 'assignee' : null) : null
  const alreadyApproved = Boolean(myRole && hasApproval(myRole))
  const pendingCount = (hasApproval('requester') ? 0 : 1) + (hasApproval('assignee') ? 0 : 1)

  const scan = async () => {
    const value = sn.trim().toUpperCase()
    // Clear on every Enter so the next scan can be typed immediately.
    setSn('')
    if (!canScan) {
      setError(t('เฉพาะช่างที่รับงานนี้เท่านั้นที่สแกนได้', 'Only the assigned technician can scan this job'))
      return
    }
    if (!value) {
      setError(t('กรุณาสแกน Serial Number', 'Please scan a serial number'))
      return
    }
    setBusy(true)
    setError('')
    setLastResult(null)
    try {
      const data = await api.scanRequest(current.request_id, value, user, action)
      setCurrent(data.request)
      setLastResult({ sn: value, message: data.message })
      toast.success(sm(data.message))
    } catch (err) {
      setError(sm(err.message))
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    if (!canScan || matches.length === 0) {
      setError(t('ยังไม่มีรายการสแกนที่ต้องรีเซ็ต', 'There are no scans to reset'))
      return
    }
    setResetting(true)
    setError('')
    setLastResult(null)
    try {
      const data = await api.resetScan(current.request_id, user, action)
      setCurrent(data.request)
      setSn('')
      toast.success(sm(data.message))
    } catch (err) {
      setError(sm(err.message))
    } finally {
      setResetting(false)
    }
  }

  const confirm = async () => {
    if (!canConfirm || !allMatched || alreadyApproved) return
    setConfirming(true)
    setError('')
    try {
      if (isReturn) {
        const payload = onVerify
          ? await onVerify(current)
          : await api.verifyRequest(current.request_id, user)
        if (payload === false) return
        if (payload?.request) setCurrent(payload.request)
        toast.success(sm(payload?.message || t('บันทึกการยืนยันแล้ว', 'Confirmation recorded')))
      } else {
        const data = await api.confirmScan(current.request_id, user)
        toast.success(sm(data.message))
        onDone?.()
      }
      onClose?.()
    } catch (err) {
      setError(sm(err.message))
    } finally {
      setConfirming(false)
    }
  }

  const actorLabel = personLabel(current?.acceptInfo || current?.issueInfo)

  const footerText = () => {
    if (!canConfirm) {
      return isReturn
        ? t('เฉพาะผู้ขอหรือช่างที่รับงานเท่านั้นที่ยืนยันได้', 'Only the requester or assignee can confirm')
        : t('เฉพาะช่างที่รับงานนี้เท่านั้นที่ยืนยันได้', 'Only the assigned technician can confirm')
    }
    if (planLoading) return t('กำลังคำนวณรายการ Fixture…', 'Calculating fixture list…')
    if (!allMatched) {
      return isReturn && isRequester
        ? t(`รอช่างสแกนคืน — ตรงแล้ว ${matchedCount}/${total}`, `Waiting for technician return scan — ${matchedCount}/${total} matched`)
        : t(`สแกนตรงแล้ว ${matchedCount}/${total}`, `Matched ${matchedCount}/${total}`)
    }
    if (!isReturn) {
      return t('✅ ตรงครบ — กดตกลงเพื่ออัปเดตสถานะ (รอเจ้าของคำขอ Verify)', '✅ All matched — press Confirm to update statuses (waiting for requester to verify)')
    }
    if (allApproved) return t('✅ ยืนยันครบ 2 คน', '✅ Both confirmations recorded')
    if (alreadyApproved) return t('✅ ยืนยันของคุณแล้ว — รออีก 1 คน', '✅ Your confirmation is recorded — waiting for the other person')
    return isRequester
      ? t(`✅ ช่างสแกนคืนครบ ${matchedCount}/${total} — กรุณายืนยัน`, `✅ Technician scanned all ${matchedCount}/${total} — please confirm`)
      : t(`✅ สแกนคืนครบ ${matchedCount}/${total} — รอยืนยันอีก ${pendingCount} คน`, `✅ All ${matchedCount}/${total} returned — waiting for ${pendingCount} confirmation(s)`)
  }

  return (
    <Modal
      open={open && Boolean(current)}
      onClose={() => onClose?.()}
      title={isReturn
        ? t('Verify · สแกน Fixture คืน', 'Verify · Scan returned fixtures')
        : t('Complete · สแกน Fixture', 'Complete · Scan fixtures')}
      subtitle={current
        ? `${current.request_id} · ${current.line || '-'} · ${t('ช่าง', 'Technician')} ${actorLabel}`
        : ''}
      icon={isReturn ? Undo2 : ScanLine}
      tone={isReturn ? 'emerald' : 'blue'}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold text-slate-500">{footerText()}</div>
          <Button
            variant="success"
            size="sm"
            onClick={confirm}
            disabled={!canConfirm || !allMatched || planLoading || confirming || resetting || (isReturn && alreadyApproved)}
          >
            {confirming
              ? t('กำลังอัปเดต…', 'Updating…')
              : isReturn
                ? myRole === 'requester'
                  ? t('ยืนยัน (ผู้ขอ)', 'Confirm (requester)')
                  : t('ยืนยันรับคืน', 'Confirm return')
                : t('ตกลง', 'Confirm')}
          </Button>
        </div>
      }
    >
      {current ? (
        <div className="space-y-4">
          {/* Job summary */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                isModelSwap(current) ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {isModelSwap(current) ? <ArrowRight className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                {requestType(current.type)}
              </span>
              {isReplace(current) ? (
                <span className="rounded-lg bg-violet-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700">
                  {replaceQtyLabel(current, t)}
                </span>
              ) : null}
              <span className="text-[11px] font-bold text-slate-500">Line {current.line || '-'}</span>
              {isModelSwap(current) && current.currentModel ? (
                <span className="font-mono text-[10px] font-bold text-slate-500">
                  {current.currentModel} <ArrowRight className="inline h-3 w-3" /> {resolveChangeModel(current) || '-'}
                </span>
              ) : null}
            </div>
            {current.desc ? <p className="mt-2 text-[11px] text-slate-600">“{current.desc}”</p> : null}
          </div>

          {isBreakdown(current) ? (
            <p className={`rounded-xl border px-3 py-2 text-[11px] font-semibold ${
              isReturn
                ? 'border-orange-200 bg-orange-50 text-orange-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}
            >
              {isReturn
                ? t('กฎ Breakdown (รับคืน): สแกนเฉพาะ SN ตัวเสียที่ระบุในคำขอ ห้ามใช้สแปร์แทน', 'Breakdown rule (return): scan only the broken SN listed in this request — no spare substitution')
                : t('กฎ Breakdown (จ่าย): สแปร์ต้องมี base เดียวกับตัวเสียและมีอยู่ในระบบ (In Stock)', 'Breakdown rule (issue): the spare must share the broken fixture’s base and exist in the system (In Stock)')}
            </p>
          ) : null}

          {hasFallback ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
              {t('Compare ไม่พบรายการ — ระบบใช้รุ่นปลายทางเป็นรายการจ่าย และคืน fixture ของรุ่นเดิมทั้งหมด', 'Compare returned no items — issuing the target model and returning every fixture of the current model')}
            </p>
          ) : null}

          {!canScan ? (
            <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="text-[12px] font-black text-blue-800">
                  {isReturn
                    ? isRequester
                      ? t('เฉพาะช่างที่รับงานนี้เท่านั้นที่สแกนคืนได้ — คุณยืนยันได้เมื่อสแกนครบ', 'Only the assigned technician can scan returns — you can confirm once the scan is complete')
                      : t('เฉพาะผู้ขอหรือช่างที่รับงานเท่านั้นที่ยืนยันได้', 'Only the requester or assignee can confirm')
                    : t('เฉพาะช่างที่รับงานนี้เท่านั้นที่สแกนได้', 'Only the assigned technician can scan this job')}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-blue-600">
                  {t('ช่างที่รับงาน:', 'Assigned technician:')} {actorLabel}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-600">
                {isReturn
                  ? isBreakdown(current)
                    ? t('Breakdown — สแกน SN ตัวเสียที่ระบุในคำขอเท่านั้น (SN เต็ม)', 'Breakdown — scan only the broken SN listed in this request (full SN)')
                    : t('สแกน Serial Number ที่มีอยู่ในระบบ (ต้องเป็น SN เต็ม) — เฉพาะรายการที่ต้องคืน (ช่างที่รับงานเท่านั้น)', 'Scan a registered serial number (full SN) — return items only (assigned technician only)')
                  : isBreakdown(current)
                    ? t('Breakdown — สแกนสแปร์ตัวใดก็ได้ที่มี base เดียวกับ SN ที่แจ้งเสีย (ต้องอยู่ In Stock)', 'Breakdown — scan any In Stock spare with the same base as the reported SN')
                    : t('สแกน Serial Number ที่มีอยู่ในระบบ (ต้องเป็น SN เต็ม ไม่ใช่แค่ base) — เฉพาะรายการที่ต้องจ่าย', 'Scan a registered serial number (full SN, not just the base) — issue items only')}
              </p>
              <div className="flex gap-2">
                <Input
                  ref={snRef}
                  className="font-mono"
                  value={sn}
                  onChange={(event) => setSn(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !busy) scan() }}
                  placeholder={t('สแกน / พิมพ์ Serial Number แล้วกด Enter', 'Scan / type the serial number then press Enter')}
                  autoFocus
                />
                <Button size="sm" variant="primary" onClick={scan} disabled={busy || resetting}>
                  {busy ? '…' : t('สแกน', 'Scan')}
                </Button>
              </div>
              {error ? (
                <p className="flex items-center gap-1.5 rounded-xl bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                </p>
              ) : null}
              {lastResult ? (
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {lastResult.sn} — {sm(lastResult.message)}
                </p>
              ) : null}
            </div>
          )}

          {/* Expected fixtures: red until scanned & matched, then green */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              {isReturn ? t('รายการที่ต้องคืน', 'Return list') : t('รายการที่ต้องจ่าย', 'Issue list')}
            </p>
            <Button
              size="sm"
              variant="secondary"
              icon={RotateCcw}
              onClick={reset}
              disabled={!canScan || !matches.length || busy || resetting || planLoading || confirming}
              title={t('รีเซ็ตรายการสแกนที่บันทึกไว้ทั้งหมด', 'Reset all recorded scans')}
            >
              {resetting ? '…' : t('รีเซ็ตลิสต์', 'Reset lists')}
            </Button>
          </div>
          {planLoading ? (
            <p className="py-6 text-center text-[11px] font-semibold text-slate-400">
              {t('กำลังคำนวณรายการ Fixture…', 'Calculating fixture list…')}
            </p>
          ) : plan.length > 0 ? (
            <MatchList
              title={isReturn ? t('ต้องคืน', 'Must return') : t('ต้องเตรียม / เบิกใหม่', 'Prepare / Issue new')}
              icon={isReturn ? Undo2 : PackagePlus}
              items={plan}
              matches={matches}
              emptyText={t('ไม่มีรายการ', 'No items')}
              t={t}
            />
          ) : (
            <MatchList
              title={isReturn ? t('คืน / รับเข้า Stock', 'Return / back to stock') : t('จ่าย / ใช้ที่ไลน์', 'Issue / used on line')}
              icon={isReturn ? Undo2 : PackagePlus}
              items={matches.map((match) => ({
                sn: match.sn,
                position: match.position || '',
                action,
                planIndex: match.planIndex,
              }))}
              matches={matches}
              emptyText={t('ยังไม่มีรายการสแกน', 'No scans yet')}
              t={t}
            />
          )}

          {isReturn ? (
            <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                {t('ตรวจสอบรับคืน 2 คน — ช่างสแกน / ผู้ขอยืนยัน (ไม่ต้องใช้รหัสผ่าน)', 'Two-person return check — technician scans / requester confirms (no password)')}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <ApprovalRow
                  done={hasApproval('requester')}
                  title={t('ผู้ขอ (Request)', 'Requester')}
                  caption={`${t('ยืนยัน', 'Confirm')} · ${personLabel(current?.requestInfo)}`}
                />
                <ApprovalRow
                  done={hasApproval('assignee')}
                  title={t('ช่างที่รับงาน (Assignee)', 'Assignee')}
                  caption={`${t('สแกน + ยืนยัน', 'Scan + confirm')} · ${personLabel(current?.acceptInfo || current?.issueInfo)}`}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}

const personLabel = (person) => {
  if (!person) return '-'
  const name = [person.name, person.lastname || person.lastName].filter(Boolean).join(' ').trim()
  return name || person.empId || '-'
}
