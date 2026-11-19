import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  ClipboardList,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import api from '../lib/api'
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  StatCard,
} from '../components/ui/Card'
import { FixtureStatusBadge } from '../components/ui/Badge'
import { FormField, Input } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { daysUntil, formatDate, toDateInput } from '../lib/format'
import { useLabels, useServerMessage } from '../lib/i18n'

const OUTCOMES = [
  { value: 'Need Scrape', label: 'Need Scrape (Red color)' },
  { value: 'Need PR', label: 'Need PR (Red color)' },
  { value: 'Already have PR', label: 'Already have PR (Yellow)' },
  { value: 'New One Replacement', label: 'New One Replacement' },
]

const outcomeLabel = (value, t) => {
  const labels = {
    'Need Scrape': t('ต้อง Scrape (สีแดง)', 'Need Scrape (Red color)'),
    'Need PR': t('ต้อง PR (สีแดง)', 'Need PR (Red color)'),
    'Already have PR': t('มี PR แล้ว (สีเหลือง)', 'Already have PR (Yellow)'),
    'New One Replacement': t('เปลี่ยนตัวใหม่', 'New One Replacement'),
  }
  return labels[value] || value
}

const plusDays = (days) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toDateInput(d)
}

export default function PMPage({ user }) {
  const { t } = useLabels()
  const sm = useServerMessage()
  const toast = useToast()

  /* ---- PM worklist ---- */
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  /* ---- Maintenance queue ---- */
  const [mRows, setMRows] = useState([])
  const [mLoading, setMLoading] = useState(true)
  const [mError, setMError] = useState('')
  const [mQuery, setMQuery] = useState('')

  /* ---- Modals ---- */
  const [target, setTarget] = useState(null)
  const [date, setDate] = useState('')
  const [verify, setVerify] = useState(null) // { fixture, result }
  const [newExp, setNewExp] = useState(() => plusDays(90))
  const [outcome, setOutcome] = useState('Need Scrape')
  const [printSticker, setPrintSticker] = useState(true)
  const [sticker, setSticker] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    api.pm()
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))

    setMLoading(true)
    setMError('')
    api.maintenance()
      .then((data) => setMRows(Array.isArray(data) ? data : []))
      .catch((err) => setMError(err.message))
      .finally(() => setMLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      [row.sn, row.line, row.model, row.type, row.step]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [rows, query])

  const maintenance = useMemo(() => {
    const needle = mQuery.trim().toLowerCase()
    if (!needle) return mRows
    return mRows.filter((row) =>
      [row.sn, row.line, row.model, row.process, row.position]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [mRows, mQuery])

  const counts = useMemo(() => {
    const has = (row, state) => (row.pmStates || []).includes(state)
    return {
      all: rows.length,
      preAlert: rows.filter((r) => has(r, 'pre-alert') || has(r, 'usage-remind')).length,
      onDue: rows.filter((r) => has(r, 'on-due')).length,
      overDue: rows.filter((r) => has(r, 'over-due') || has(r, 'overdue-remind')).length,
      maintenance: mRows.length,
    }
  }, [rows, mRows])

  const openPlan = (row) => {
    setTarget(row)
    setDate(row.pmDate || (row.usage?.exp ? String(row.usage.exp).slice(0, 10) : '') || toDateInput(new Date()))
    setPassword('')
  }

  const openVerify = (fixture, result) => {
    setVerify({ fixture, result })
    setNewExp(plusDays(90))
    setOutcome('Need Scrape')
    setPrintSticker(true)
    setPassword('')
  }

  const checkPassword = async () => {
    if (!password) {
      toast.error(t('กรุณากรอกรหัสผ่าน', 'Please enter your password'))
      return false
    }
    const login = await api.login({ empId: user?.userId || user?.empId, pass: password })
    if (!login?.success) {
      toast.error(t('รหัสผ่านไม่ถูกต้อง', 'Incorrect password'))
      return false
    }
    return true
  }

  const savePlan = async () => {
    if (!target || !date) return
    if (!(await checkPassword())) return
    setBusy(true)
    try {
      await api.pmPlan(target.sn, user, date, '')
      toast.success(t(`Plan PM ${target.sn} → PM & Maintenance`, `Planned PM for ${target.sn} → PM & Maintenance`))
      setTarget(null)
      await load()
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setBusy(false)
    }
  }

  const confirmVerify = async () => {
    if (!verify) return
    if (!(await checkPassword())) return
    setBusy(true)
    try {
      const { fixture, result } = verify
      const res = await api.maintenanceVerify(
        result === 'OK'
          ? { sn: fixture.sn, result: 'OK', newExp, user }
          : { sn: fixture.sn, result: 'NG', outcome, user },
      )
      toast.success(res?.message ? sm(res.message) : t('บันทึกสำเร็จ', 'Saved successfully'))
      if (result === 'OK' && printSticker) {
        setSticker({
          sn: fixture.sn,
          line: fixture.line,
          model: fixture.model,
          process: fixture.process,
          position: fixture.position,
          exp: newExp,
        })
        window.setTimeout(() => window.print(), 80)
      }
      setVerify(null)
      await load()
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setBusy(false)
    }
  }

  const searchBox = (value, onChange, placeholder) => (
    <Card className="p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          className="field-input-sm pl-9"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </Card>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('ซ่อมบำรุง', 'Maintenance')}
        icon={Wrench}
        title={t('PM และซ่อมบำรุง', 'PM & Maintenance')}
        description={t('Pre-Alert / 80% → Plan PM → PM On Due / Over Due → PM & Maintenance → Verify + Record (OK / NG)', 'Pre-Alert / 80% → Plan PM → PM On Due / Over Due → PM & Maintenance → Verify + Record (OK / NG)')}
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={load}>
            {t('รีเฟรช', 'Refresh')}
          </Button>
        }
      />

      {/* ---------- PM worklist ---------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-blue-500" />
          <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">{t('รายงาน PM', 'PM Worklist')}</h2>
          <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-700">{rows.length}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard label={t('ทั้งหมด', 'All')} value={counts.all} tone="blue" icon={ClipboardList} />
          <StatCard label={t('แจ้งล่วงหน้า / 80%', 'Pre-Alert / 80%')} value={counts.preAlert} tone="orange" icon={BellRing} />
          <StatCard label={t('PM ถึงกำหนด', 'PM On Due')} value={counts.onDue} tone="purple" icon={CalendarClock} />
          <StatCard label={t('PM เกินกำหนด', 'PM Over Due')} value={counts.overDue} tone="red" icon={AlertTriangle} />
          <StatCard label={t('กำลังซ่อม', 'In Maintenance')} value={counts.maintenance} tone="orange" icon={Wrench} />
        </div>

        {searchBox(query, setQuery, t('ค้นหา SN / Line / Model…', 'Search SN / Line / Model…'))}

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
            <EmptyState icon={CalendarClock} title={t('ไม่มี Fixture', 'No fixtures')} />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    <th className="px-4 py-2.5">{t('Serial Number', 'Serial Number')}</th>
                    <th className="px-4 py-2.5">{t('Line', 'Line')}</th>
                    <th className="px-4 py-2.5">{t('Model', 'Model')}</th>
                    <th className="px-4 py-2.5">{t('สถานะ', 'Status')}</th>
                    <th className="px-4 py-2.5">{t('Exp', 'Exp')}</th>
                    <th className="px-4 py-2.5">{t('PM date', 'PM date')}</th>
                    <th className="px-4 py-2.5 text-right">{t('การดำเนินการ', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((row) => (
                    <tr key={row.sn} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-slate-700">{row.sn}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-600">{row.line || '-'}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-600">{row.model || '-'}</td>
                      <td className="px-4 py-2.5">
                        <FixtureStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                        {formatDate(row.usage?.exp)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-blue-700">
                        {row.pmDate || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="warning"
                          disabled={row.status === 'Maintenance'}
                          onClick={() => openPlan(row)}
                        >
                          {row.status === 'Maintenance' ? t('อยู่ในคิวซ่อม', 'In repair queue') : t('วางแผน PM', 'Plan PM')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {/* ---------- Maintenance queue ---------- */}
      <section className="space-y-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-orange-500" />
          <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">
            {t('กำลังซ่อม · Verify + Record', 'In Maintenance · Verify + Record')}
          </h2>
          <span className="rounded-lg bg-orange-100 px-2 py-0.5 text-[11px] font-black text-orange-700">
            {mRows.length}
          </span>
        </div>

        {searchBox(mQuery, setMQuery, t('ค้นหา SN / Line / Model / Position…', 'Search SN / Line / Model / Position…'))}

        {mLoading ? (
          <Card>
            <Spinner label={t('กำลังโหลดข้อมูล…', 'Loading…')} />
          </Card>
        ) : mError ? (
          <Card>
            <ErrorState message={sm(mError)} onRetry={load} />
          </Card>
        ) : maintenance.length === 0 ? (
          <Card>
            <EmptyState
              icon={Wrench}
              title={t('ไม่มี fixture ในคิว PM & Maintenance', 'No fixtures in the PM & Maintenance queue')}
              description={t('Plan PM / Breakdown จะแสดงที่นี่หลังส่งเข้าซ่อม', 'Plan PM / Breakdown items appear here after being sent for maintenance')}
            />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {maintenance.map((row) => {
              const days = daysUntil(row.usage?.exp)
              return (
                <Card key={row.sn} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-800">{row.sn}</span>
                        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {row.line || '-'}
                        </span>
                        <span className="rounded-lg bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase text-orange-600">
                          {t('ซ่อมบำรุง', 'Maintenance')}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[11px] font-semibold text-slate-500">{row.model}</p>
                      <p className="text-[10px] text-slate-400">
                        {[row.process, row.position].filter(Boolean).join(' · ') || '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-slate-600">{t('กำหนด PM', 'PM Due')}: {formatDate(row.usage?.exp)}</p>
                      <p className={`text-[10px] font-black ${days !== null && days < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {days === null ? '-' : days < 0 ? t(`เกินกำหนด ${-days} วัน`, `${-days} days overdue`) : t(`อีก ${days} วัน`, `${days} days left`)}
                      </p>
                      {row.pmDate ? (
                        <p className="text-[10px] font-semibold text-blue-600">{t('วางแผน', 'Plan')}: {row.pmDate}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-slate-400">
                      {t('การใช้งาน', 'Usage')} {Number(row.usage?.current) || 0}/{Number(row.usage?.max) || 0}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="success" onClick={() => openVerify(row, 'OK')}>
                        {t('ตรวจสอบ OK', 'Verify OK')}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => openVerify(row, 'NG')}>
                        {t('NG', 'NG')}
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ---------- Plan PM modal (password required) ---------- */}
      <Modal
        open={Boolean(target)}
        onClose={() => (busy ? null : setTarget(null))}
        title={target ? t(`วางแผน PM · ${target.sn}`, `Plan PM · ${target.sn}`) : t('วางแผน PM', 'Plan PM')}
        subtitle={t('ส่งเข้า PM & Maintenance', 'Sent to PM & Maintenance')}
        icon={CalendarClock}
        tone="orange"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTarget(null)} disabled={busy}>
              {t('ยกเลิก', 'Cancel')}
            </Button>
            <Button variant="warning" onClick={savePlan} disabled={busy || !date}>
              {busy ? t('กำลังบันทึก…', 'Saving…') : t('วางแผน PM', 'Plan PM')}
            </Button>
          </div>
        }
      >
        {target ? (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500">
              {target.line} · {target.model}
            </p>
            <FormField label={t('วันที่ PM', 'PM date')}>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </FormField>
            <FormField label={t('รหัสผ่านเพื่อยืนยัน', 'Password to confirm')}>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('รหัสผ่าน', 'Password')}
              />
            </FormField>
          </div>
        ) : null}
      </Modal>

      {/* ---------- Verify + Record modal (password required) ---------- */}
      <Modal
        open={Boolean(verify)}
        onClose={() => (busy ? null : setVerify(null))}
        title={verify?.result === 'OK' ? t('Verify + Record — OK', 'Verify + Record — OK') : t('Verify + Record — NG', 'Verify + Record — NG')}
        subtitle={verify?.fixture?.sn || ''}
        icon={ShieldCheck}
        tone={verify?.result === 'OK' ? 'emerald' : 'red'}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setVerify(null)} disabled={busy}>
              {t('ยกเลิก', 'Cancel')}
            </Button>
            <Button
              variant={verify?.result === 'OK' ? 'success' : 'danger'}
              onClick={confirmVerify}
              disabled={busy || (verify?.result === 'OK' && !newExp)}
            >
              {busy ? t('กำลังบันทึก…', 'Saving…') : `${t('ยืนยัน', 'Confirm')} ${verify?.result || ''}`}
            </Button>
          </div>
        }
      >
        {verify ? (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500">
              {verify.fixture.line} · {verify.fixture.model}
            </p>
            {verify.result === 'OK' ? (
              <>
                <FormField label={t('Reset Due (วัน PM ถัดไป)', 'Reset Due (next PM date)')}>
                  <Input type="date" value={newExp} onChange={(event) => setNewExp(event.target.value)} />
                </FormField>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11px] font-bold text-emerald-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-600"
                    checked={printSticker}
                    onChange={() => setPrintSticker((v) => !v)}
                  />
                  <Printer className="h-4 w-4" /> {t('พิมพ์สติกเกอร์อัตโนมัติ', 'Auto Print Sticker')}
                </label>
              </>
            ) : (
              <FormField label={t('ผลการตรวจ (NG)', 'Inspection result (NG)')}>
                <select
                  className="field-input-sm w-full"
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value)}
                >
                  {OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {outcomeLabel(o.value, t)}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField label={t('รหัสผ่านเพื่อยืนยัน', 'Password to confirm')}>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('รหัสผ่าน', 'Password')}
              />
            </FormField>
          </div>
        ) : null}
      </Modal>

      {sticker ? (
        <div className="pm-sticker" aria-hidden="true">
          <p className="pm-sticker-sn">{sticker.sn}</p>
          <p>{sticker.line} · {sticker.model}</p>
          <p>{[sticker.process, sticker.position].filter(Boolean).join(' · ')}</p>
          <p>{t('PM ถัดไป', 'NEXT PM')}: {formatDate(sticker.exp)}</p>
        </div>
      ) : null}
    </div>
  )
}
