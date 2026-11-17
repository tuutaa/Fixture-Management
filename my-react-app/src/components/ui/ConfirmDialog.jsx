import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'ยืนยันการทำรายการ',
  message,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  tone = 'blue',
  busy = false,
}) {
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      subtitle="Please confirm"
      icon={AlertTriangle}
      tone={tone}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'red' ? 'danger' : tone === 'orange' ? 'warning' : tone === 'emerald' ? 'success' : 'primary'}
            className="flex-1"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'กำลังดำเนินการ…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
    </Modal>
  )
}
