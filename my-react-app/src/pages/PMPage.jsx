import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, RefreshCw, Search } from 'lucide-react'
import api from '../lib/api'
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
} from '../components/ui/Card'
import { FixtureStatusBadge } from '../components/ui/Badge'
import { FormField, Input } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { formatDate } from '../lib/format'

export default function PMPage({ user }) {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState(null)
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await api.pm()
      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      [row.sn, row.line, row.model, row.type, row.step].filter(Boolean).join(' ').toLowerCase().includes(needle),
    )
  }, [rows, query])

  const open = (row) => {
    setTarget(row)
    setDate(row.pmDate || (row.usage?.exp ? String(row.usage.exp).slice(0, 10) : ''))
  }

  const save = async () => {
    if (!target || !date) return
    setBusy(true)
    try {
      await api.pmPlan(target.sn, user, date, '')
      toast.success(`บันทึก PM date ของ ${target.sn}`)
      setTarget(null)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Fixture"
        icon={CalendarClock}
        title="PM"
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={load}>
            รีเฟรช
          </Button>
        }
      />

      <Card className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            className="field-input-sm pl-9"
            placeholder="ค้นหา SN / Line / Model…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Card>

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
          <EmptyState icon={CalendarClock} title="ไม่มี Fixture" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <th className="px-4 py-2.5">Serial Number</th>
                <th className="px-4 py-2.5">Line</th>
                <th className="px-4 py-2.5">Model</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Exp</th>
                <th className="px-4 py-2.5">PM date</th>
                <th className="px-4 py-2.5 text-right">Action</th>
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
                    {formatDate(row.usage?.exp) || '-'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-blue-700">
                    {row.pmDate || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="secondary" onClick={() => open(row)}>
                      ตั้ง PM date
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={Boolean(target)}
        onClose={() => (busy ? null : setTarget(null))}
        title={target ? `PM date · ${target.sn}` : 'PM date'}
        icon={CalendarClock}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTarget(null)} disabled={busy}>
              ยกเลิก
            </Button>
            <Button onClick={save} disabled={busy || !date}>
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </Button>
          </div>
        }
      >
        {target ? (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500">
              {target.line} · {target.model}
            </p>
            <FormField label="PM date">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </FormField>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
