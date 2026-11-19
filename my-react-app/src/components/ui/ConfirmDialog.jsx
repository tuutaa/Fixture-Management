import { AlertTriangle } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import Modal from './Modal'
import Button from './Button'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'blue',
  busy = false,
}) {
  const { t } = useLanguage()
  const resolvedTitle = title ?? t('ยืนยันการทำรายการ', 'Confirm action')
  const resolvedConfirmLabel = confirmLabel ?? t('ตกลง', 'Confirm')
  const resolvedCancelLabel = cancelLabel ?? t('ยกเลิก', 'Cancel')

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={resolvedTitle}
      subtitle={t('กรุณายืนยัน', 'Please confirm')}
      icon={AlertTriangle}
      tone={tone}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            {resolvedCancelLabel}
          </Button>
          <Button
            variant={tone === 'red' ? 'danger' : tone === 'orange' ? 'warning' : tone === 'emerald' ? 'success' : 'primary'}
            className="flex-1"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t('กำลังดำเนินการ…', 'Processing…') : resolvedConfirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
    </Modal>
  )
}
