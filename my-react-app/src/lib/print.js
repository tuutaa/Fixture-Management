import QRCode from 'qrcode'
import { formatDate } from './format'

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * Opens a print-ready sticker sheet (36 × 11 mm labels).
 * QR payload is the Serial Number so the floor can scan the sticker.
 */
export async function printStickers(items = [], { title = 'Fixture stickers' } = {}) {
  if (!Array.isArray(items) || items.length === 0) return

  const cards = await Promise.all(
    items.map(async (item) => {
      const sn = typeof item === 'string' ? item : item.SN
      let qr
      try {
        qr = await QRCode.toDataURL(String(sn || ''), {
          margin: 0,
          width: 160,
          color: { dark: '#0f172a', light: '#ffffff' },
        })
      } catch {
        qr = ''
      }

      const expiry = item?.ExpiredDate || item?.Usage?.ExpiredDate
      const model = item?.Model || '-'
      const line = item?.Line || '-'

      return `
        <div class="sticker">
          ${qr ? `<img class="qr" src="${qr}" alt="" />` : ''}
          <div class="body">
            <div class="sn">${escapeHtml(sn || '-')}</div>
            <div class="name">${escapeHtml(item?.Name || 'Fixture')}</div>
            <div class="meta">${escapeHtml(model)} · ${escapeHtml(line)}${expiry ? ` · EXP ${escapeHtml(formatDate(expiry))}` : ''}</div>
          </div>
        </div>`
    }),
  )

  const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, "Segoe UI", "Noto Sans Thai", sans-serif; color: #0f172a; }
  .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4mm; }
  .head h1 { font-size: 11pt; margin: 0; }
  .head p { font-size: 8pt; color: #64748b; margin: 0; }
  .sheet { display: flex; flex-wrap: wrap; gap: 2mm; align-content: flex-start; }
  .sticker {
    width: 36mm; height: 11mm; padding: 1mm; display: flex; align-items: center; gap: 1.4mm;
    border: 0.2mm dashed #cbd5e1; border-radius: 1.2mm; overflow: hidden;
    page-break-inside: avoid; break-inside: avoid;
  }
  .qr { width: 8.4mm; height: 8.4mm; flex: 0 0 8.4mm; }
  .body { min-width: 0; line-height: 1.15; }
  .sn { font-size: 6.6pt; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .name { font-size: 5.4pt; font-weight: 600; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta { font-size: 4.6pt; color: #64748b; font-family: ui-monospace, Menlo, Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  @media print { .head { opacity: 0.85; } }
</style>
</head>
<body>
  <div class="head">
    <h1>Fixture Management · FAN2</h1>
    <p>${escapeHtml(title)} · ${items.length} sticker${items.length === 1 ? '' : 's'} · ${escapeHtml(formatDate(new Date()))}</p>
  </div>
  <div class="sheet">${cards.join('')}</div>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 180); });</script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=920,height=720')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  return true
}

export default printStickers
