import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
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

const itemMatched = (item, matches) => matches.some((match) => {
  if (Number.isInteger(match.planIndex) && Number.isInteger(item.planIndex)) {
    return match.planIndex === item.planIndex
  }
  return match.action === item.action
    && (normKey(match.planSn) === normKey(item.sn) || normKey(match.sn) === normKey(item.sn))
})

const isChangeModel = (request) => /change\s*model/i.test(String(request?.type || ''))

const resolveChangeModel = (request) => {
  if (request?.changeModel) return request.changeModel
  const desc = String(request?.desc || '')
  const index = desc.indexOf('→')
  return index >= 0 ? desc.slice(index + 1).trim() : ''
}

const MatchList = ({ title, icon: Icon, items, matches, emptyText }) => {
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
                    <td className="whitespace-nowrap px-1 py-1.5 font-mono text-[11px] font-bold">{item.sn}</td>
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

export default function OrderScanModal({ open, request, user, onClose, onDone }) {
  const toast = useToast()
  const { t, requestType } = useLabels()
  const sm = useServerMessage()
  const snRef = useRef(null)
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
  }, [open, request])

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
        setPlan((data.plan || []).map((item, index) => ({ ...item, planIndex: index })))
        setCurrent((prev) => ({ ...prev, scanMatches: data.matches || [] }))
      })
      .catch(() => { if (!cancelled) setPlan([]) })
      .finally(() => { if (!cancelled) setPlanLoading(false) })
    return () => { cancelled = true }
  }, [open, request])

  const matches = useMemo(() => current?.scanMatches || [], [current])
  const issuePlan = useMemo(() => plan.filter((item) => item.action === 'issue'), [plan])
  const returnPlan = useMemo(() => plan.filter((item) => item.action === 'return'), [plan])
  const isMatched = (item) => itemMatched(item, matches)
  const matchedCount = plan.length > 0
    ? plan.filter(isMatched).length
    : matches.length
  const total = plan.length || matches.length
  const hasBothActions = matches.some((match) => match.action === 'issue')
    && matches.some((match) => match.action === 'return')
  const allMatched = plan.length > 0 ? matchedCount === plan.length : hasBothActions

  const requestor = String(current?.requestInfo?.empId || '').toLowerCase()
  const actor = String(user?.userId || user?.empId || '').toLowerCase()
  const canVerify = Boolean(requestor && requestor === actor)
  const assignee = String(current?.acceptInfo?.empId || '').toLowerCase()
  const canScan = Boolean(assignee && assignee === actor)

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
      const data = await api.scanRequest(current.request_id, value, user)
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
      const data = await api.resetScan(current.request_id, user)
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
    if (!canScan || !allMatched) return
    setConfirming(true)
    setError('')
    try {
      const data = await api.confirmScan(current.request_id, user)
      toast.success(sm(data.message))
      onDone?.()
      onClose?.()
    } catch (err) {
      setError(sm(err.message))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Modal
      open={open && Boolean(current)}
      onClose={() => onClose?.()}
      title={t('Complete · สแกน Fixture', 'Complete · Scan fixtures')}
      subtitle={current
        ? `${current.request_id} · ${current.line || '-'} · ${t('ช่าง', 'Technician')} ${current.acceptInfo?.name || current.acceptInfo?.empId || '-'}`
        : ''}
      icon={ScanLine}
      tone="blue"
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold text-slate-500">
            {!canScan
              ? t('เฉพาะช่างที่รับงานนี้เท่านั้นที่ยืนยันได้', 'Only the assigned technician can confirm')
              : planLoading
                ? t('กำลังคำนวณรายการ Fixture…', 'Calculating fixture list…')
                : allMatched
                  ? canVerify
                    ? t(`✅ ตรงครบ ${matchedCount}/${total} — กดตกลงเพื่ออัปเดตสถานะ`, `✅ All matched ${matchedCount}/${total} — press Confirm to update statuses`)
                    : t('✅ ตรงครบ — กดตกลงเพื่ออัปเดตสถานะ (รอเจ้าของคำขอ Verify)', '✅ All matched — press Confirm to update statuses (waiting for requester to verify)')
                  : t(`สแกนตรงแล้ว ${matchedCount}/${total}`, `Matched ${matchedCount}/${total}`)}
          </div>
          <Button
            variant="success"
            size="sm"
            onClick={confirm}
            disabled={!canScan || !allMatched || planLoading || confirming || resetting}
          >
            {confirming ? t('กำลังอัปเดต…', 'Updating…') : t('ตกลง', 'Confirm')}
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
                isChangeModel(current) ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {isChangeModel(current) ? <ArrowRight className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                {requestType(current.type)}
              </span>
              <span className="text-[11px] font-bold text-slate-500">Line {current.line || '-'}</span>
              {isChangeModel(current) && current.currentModel ? (
                <span className="font-mono text-[10px] font-bold text-slate-500">
                  {current.currentModel} <ArrowRight className="inline h-3 w-3" /> {resolveChangeModel(current) || '-'}
                </span>
              ) : null}
            </div>
            {current.desc ? <p className="mt-2 text-[11px] text-slate-600">“{current.desc}”</p> : null}
          </div>

          {!canScan ? (
            <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="text-[12px] font-black text-blue-800">
                  {t('เฉพาะช่างที่รับงานนี้เท่านั้นที่สแกนได้', 'Only the assigned technician can scan this job')}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-blue-600">
                  {t('ช่างที่รับงาน:', 'Assigned technician:')} {current.acceptInfo?.name
                    ? `${current.acceptInfo.name} ${current.acceptInfo.lastname || ''}`.trim()
                    : current.acceptInfo?.empId || '-'}
                  {current.acceptInfo?.empId ? ` (${current.acceptInfo.empId})` : ''}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Single scanner — system decides issue / return */}
              <div className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-600">
                  {t('สแกน Serial Number ที่มีอยู่ในระบบ (ต้องเป็น SN เต็ม ไม่ใช่แค่ base) — ระบบจะคำนวณเองว่าต้องเบิก / คืน', 'Scan a registered serial number (full SN, not just the base) — the system decides issue / return')}
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

              {/* Expected fixtures: red until scanned & matched, then green */}
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  {t('รายการเบิก / รับคืน', 'Issue / return lists')}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={RotateCcw}
                  onClick={reset}
                  disabled={!matches.length || busy || resetting || planLoading || confirming}
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <MatchList
                    title={t('ต้องเตรียม / เบิกใหม่', 'Prepare / Issue new')}
                    icon={PackagePlus}
                    items={issuePlan}
                    matches={matches}
                    emptyText={t('ไม่มีรายการ', 'No items')}
                  />
                  <MatchList
                    title={t('ต้องคืน', 'Must return')}
                    icon={Undo2}
                    items={returnPlan}
                    matches={matches}
                    emptyText={t('ไม่มีรายการ', 'No items')}
                  />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <MatchList
                    title={t('จ่าย / ใช้ที่ไลน์', 'Issue / used on line')}
                    icon={PackagePlus}
                    items={matches.filter((match) => match.action === 'issue').map((match) => ({ sn: match.sn, position: '', action: 'issue' }))}
                    matches={matches}
                    emptyText={t('ยังไม่มีรายการสแกน', 'No scans yet')}
                  />
                  <MatchList
                    title={t('รับคืนเข้าคลัง', 'Return to stock')}
                    icon={Undo2}
                    items={matches.filter((match) => match.action === 'return').map((match) => ({ sn: match.sn, position: '', action: 'return' }))}
                    matches={matches}
                    emptyText={t('ยังไม่มีรายการสแกน', 'No scans yet')}
                  />
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
