import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, ScanLine } from 'lucide-react'
import api from '../lib/api'
import { Card, PageHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Tabs from '../components/ui/Tabs'
import { useToast } from '../components/ui/Toast'
import { useLabels, useServerMessage } from '../lib/i18n'

export default function ReturnPage({ user }) {
  const { t } = useLabels()
  const sm = useServerMessage()
  const toast = useToast()
  const [mode, setMode] = useState('issue')
  const [scan, setScan] = useState('')
  const [scanning, setScanning] = useState(false)
  const scanRef = useRef(null)
  const [issueList, setIssueList] = useState([])
  const [stock, setStock] = useState([])
  const [pm, setPm] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    scanRef.current?.focus()
  }, [mode])

  const handleScan = async (value) => {
    const sn = String(value || '').trim()
    // Clear on every Enter so the next SN can be scanned immediately.
    setScan('')
    if (!sn) return
    setScanning(true)
    try {
      const data = await api.fixture(sn)
      const fixture = data.fixture
      if (mode === 'issue') {
        if (fixture.status !== 'In Stock') {
          toast.error(t(`${fixture.sn} ไม่ได้อยู่ใน Stock`, `${fixture.sn} is not in stock`))
          return
        }
        if (issueList.some((x) => x.sn === fixture.sn)) {
          toast.error(t(`${fixture.sn} อยู่ในลิสแล้ว`, `${fixture.sn} is already in the list`))
          return
        }
        setIssueList((prev) => [
          { sn: fixture.sn, line: fixture.line || '', model: fixture.model || '', type: fixture.type || '' },
          ...prev,
        ])
        return
      }

      if (fixture.status !== 'In Use' && fixture.status !== 'Maintenance') {
        toast.error(t(`${fixture.sn} ไม่ได้อยู่ในสถานะ In Use/Maintenance`, `${fixture.sn} is not in In Use/Maintenance status`))
        return
      }
      if (stock.some((x) => x.sn === fixture.sn) || pm.some((x) => x.sn === fixture.sn)) {
        toast.error(t(`${fixture.sn} อยู่ในลิสแล้ว`, `${fixture.sn} is already in the list`))
        return
      }
      setStock((prev) => [fixture, ...prev])
    } catch (err) {
      toast.error(err.status === 404 ? t(`ไม่พบ ${sn}`, `${sn} not found`) : sm(err.message))
    } finally {
      setScanning(false)
      scanRef.current?.focus()
    }
  }

  const onDragStart = (e, sn, from) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ sn, from }))
  }

  const onDrop = (e, to) => {
    e.preventDefault()
    let payload
    try {
      payload = JSON.parse(e.dataTransfer.getData('text/plain'))
    } catch {
      return
    }
    const { sn, from } = payload
    if (from === to) return
    if (from === 'stock') {
      const item = stock.find((x) => x.sn === sn)
      if (!item) return
      setStock((prev) => prev.filter((x) => x.sn !== sn))
      setPm((prev) => [item, ...prev])
    } else {
      const item = pm.find((x) => x.sn === sn)
      if (!item) return
      setPm((prev) => prev.filter((x) => x.sn !== sn))
      setStock((prev) => [item, ...prev])
    }
  }

  const confirmIssue = async () => {
    if (!issueList.length) return
    setBusy(true)
    try {
      for (const item of issueList) {
        await api.issueFixture({ sn: item.sn, line: item.line, model: item.model, user })
      }
      toast.success(t('จ่าย Fixture สำเร็จ', 'Issue successful'))
      setIssueList([])
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setBusy(false)
      scanRef.current?.focus()
    }
  }

  const confirmReturn = async () => {
    if (!stock.length && !pm.length) return
    setBusy(true)
    try {
      for (const item of stock) {
        await api.returnFixture({ sn: item.sn, target: 'In Stock', user })
      }
      for (const item of pm) {
        await api.returnFixture({ sn: item.sn, target: 'Maintenance', user })
      }
      toast.success(t('รับคืนสำเร็จ', 'Return successful'))
      setStock([])
      setPm([])
    } catch (err) {
      toast.error(sm(err.message))
    } finally {
      setBusy(false)
      scanRef.current?.focus()
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t('การดำเนินงาน', 'Operations')}
        icon={ArrowLeftRight}
        title={t('เบิก / คืน Fixture', 'Issue / Return')}
        description={t(
          'จ่ายและรับคืน Fixture แบบไม่ผ่าน Order — ใช้เป็นทางเลือกสำรองเมื่อไม่มี Order',
          'Issue and return fixtures without an order — a backup flow when no order exists',
        )}
      />

      <Card className="p-4">
        <Tabs
          value={mode}
          onChange={setMode}
          size="sm"
          tabs={[
            { value: 'issue', label: t('จ่าย (Issue)', 'Issue') },
            { value: 'return', label: t('คืน (Return)', 'Return') },
          ]}
        />
        <div className="mt-3 flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-slate-400" />
          <Input
            ref={scanRef}
            className="field-input-sm font-mono"
            placeholder={
              mode === 'issue'
                ? t('สแกน SN จาก Stock…', 'Scan a stock SN…')
                : t('สแกนบาร์โค้ด SN…', 'Scan SN barcode…')
            }
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleScan(scan)
              }
            }}
            disabled={scanning || busy}
          />
        </div>
        <p className="mt-2 text-[10px] font-semibold text-slate-400">
          {mode === 'issue'
            ? t('รับเฉพาะ Fixture ใน Stock · กด Enter ทุกครั้งจะล้างกล่องสแกน', 'Only stock fixtures are accepted · every Enter clears the scan box')
            : t('รับเฉพาะ Fixture ในสถานะ In Use / Maintenance · กด Enter ทุกครั้งจะล้างกล่องสแกน', 'Only In Use / Maintenance fixtures are accepted · every Enter clears the scan box')}
        </p>
      </Card>

      {mode === 'issue' ? (
        <>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
              <p className="text-xs font-black text-slate-800">{t('รายการจ่าย', 'Issue list')}</p>
              <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                {t(`${issueList.length} ตัว`, `${issueList.length} item(s)`)}
              </span>
            </div>
            {issueList.length === 0 ? (
              <p className="px-4 py-8 text-center text-[11px] text-slate-400">
                {t('ยังไม่มี Fixture ที่สแกน', 'No fixture scanned yet')}
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {issueList.map((item, index) => (
                  <div key={item.sn} className="grid gap-2 px-4 py-3 sm:grid-cols-[1.1fr_1fr_1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-black text-slate-800">{item.sn}</p>
                      <p className="truncate text-[10px] text-slate-400">{item.type || '-'}</p>
                    </div>
                    <Input
                      className="field-input-sm"
                      aria-label={t('Line ที่จ่าย', 'Issue line')}
                      placeholder={t('Line', 'Line')}
                      value={item.line}
                      onChange={(e) =>
                        setIssueList((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, line: e.target.value } : row)),
                        )
                      }
                    />
                    <Input
                      className="field-input-sm"
                      aria-label={t('Model ที่จ่าย', 'Issue model')}
                      placeholder={t('Model', 'Model')}
                      value={item.model}
                      onChange={(e) =>
                        setIssueList((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, model: e.target.value } : row)),
                        )
                      }
                    />
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setIssueList((prev) => prev.filter((_, i) => i !== index))}
                    >
                      {t('ลบ', 'Remove')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <div className="flex justify-end">
            <Button onClick={confirmIssue} disabled={busy || issueList.length === 0}>
              {busy ? t('กำลังบันทึก…', 'Saving…') : t('ยืนยันจ่าย', 'Confirm Issue')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('คืนคลัง', 'Return to stock')}</p>
              <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, 'stock')} className="min-h-[200px] space-y-2 rounded-xl border-2 border-dashed border-slate-200 p-2">
                {stock.length === 0 ? <p className="py-6 text-center text-[11px] text-slate-400">{t('ว่าง', 'Empty')}</p> : stock.map((item) => (
                  <div key={item.sn} draggable onDragStart={(e) => onDragStart(e, item.sn, 'stock')} className="cursor-grab rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm active:cursor-grabbing">
                    <span className="font-mono">{item.sn}</span>
                    <span className="ml-2 text-slate-400">{item.line} · {item.model}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('PM และซ่อมบำรุง', 'PM & Maintenance')}</p>
              <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, 'pm')} className="min-h-[200px] space-y-2 rounded-xl border-2 border-dashed border-slate-200 p-2">
                {pm.length === 0 ? <p className="py-6 text-center text-[11px] text-slate-400">{t('ว่าง', 'Empty')}</p> : pm.map((item) => (
                  <div key={item.sn} draggable onDragStart={(e) => onDragStart(e, item.sn, 'pm')} className="cursor-grab rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm active:cursor-grabbing">
                    <span className="font-mono">{item.sn}</span>
                    <span className="ml-2 text-slate-400">{item.line} · {item.model}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="flex justify-end">
            <Button onClick={confirmReturn} disabled={busy || (stock.length === 0 && pm.length === 0)}>
              {busy ? t('กำลังบันทึก…', 'Saving…') : t('ยืนยันรับคืน', 'Confirm Return')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
