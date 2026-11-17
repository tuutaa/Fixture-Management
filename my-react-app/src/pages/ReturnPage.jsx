import { useEffect, useRef, useState } from 'react'
import { ScanLine, Undo2 } from 'lucide-react'
import api from '../lib/api'
import {
  Card,
  PageHeader,
} from '../components/ui/Card'
import { Input } from '../components/ui/Field'
import Button from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'

export default function ReturnPage({ user }) {
  const toast = useToast()
  const [scan, setScan] = useState('')
  const [scanning, setScanning] = useState(false)
  const scanRef = useRef(null)
  const [stock, setStock] = useState([])
  const [pm, setPm] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    scanRef.current?.focus()
  }, [])

  const handleScan = async (value) => {
    const sn = String(value || '').trim()
    if (!sn) return
    setScanning(true)
    try {
      const data = await api.fixture(sn)
      const fixture = data.fixture
      if (fixture.status !== 'In Use' && fixture.status !== 'Maintenance') {
        toast.error(`${sn} ไม่ได้อยู่ในสถานะ In Use/Maintenance`)
        return
      }
      if (stock.some((x) => x.sn === sn) || pm.some((x) => x.sn === sn)) {
        toast.error(`${sn} อยู่ในลิสแล้ว`)
        return
      }
      setStock((prev) => [fixture, ...prev])
      setScan('')
    } catch (err) {
      toast.error(err.status === 404 ? `ไม่พบ ${sn}` : err.message)
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

  const confirm = async () => {
    if (stock.length === 0 && pm.length === 0) return
    setBusy(true)
    try {
      for (const item of stock) {
        await api.returnFixture({ sn: item.sn, target: 'In Stock', user })
      }
      for (const item of pm) {
        await api.returnFixture({ sn: item.sn, target: 'Maintenance', user })
      }
      toast.success('รับคืนสำเร็จ')
      setStock([])
      setPm([])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Operations" icon={Undo2} title="Return" />

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-slate-400" />
          <Input
            ref={scanRef}
            className="field-input-sm font-mono"
            placeholder="สแกนบาร์โค้ด SN…"
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleScan(scan)
              }
            }}
            disabled={scanning}
          />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">คืนคลัง</p>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, 'stock')} className="min-h-[200px] space-y-2 rounded-xl border-2 border-dashed border-slate-200 p-2">
            {stock.length === 0 ? <p className="py-6 text-center text-[11px] text-slate-400">ว่าง</p> : stock.map((item) => (
              <div key={item.sn} draggable onDragStart={(e) => onDragStart(e, item.sn, 'stock')} className="cursor-grab rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm active:cursor-grabbing">
                <span className="font-mono">{item.sn}</span>
                <span className="ml-2 text-slate-400">{item.line} · {item.model}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">PM & maintenance</p>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, 'pm')} className="min-h-[200px] space-y-2 rounded-xl border-2 border-dashed border-slate-200 p-2">
            {pm.length === 0 ? <p className="py-6 text-center text-[11px] text-slate-400">ว่าง</p> : pm.map((item) => (
              <div key={item.sn} draggable onDragStart={(e) => onDragStart(e, item.sn, 'pm')} className="cursor-grab rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm active:cursor-grabbing">
                <span className="font-mono">{item.sn}</span>
                <span className="ml-2 text-slate-400">{item.line} · {item.model}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={confirm} disabled={busy || (stock.length === 0 && pm.length === 0)}>
          {busy ? 'กำลังบันทึก…' : 'ยืนยันรับคืน'}
        </Button>
      </div>
    </div>
  )
}
