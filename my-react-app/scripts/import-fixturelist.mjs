import fs from 'node:fs'
import XLSX from 'xlsx'

const API_BASE = 'http://localhost:3000/api'
const FILE_PATH = 'C:/Users/ponboonc/Downloads/FixtureDataBase (2) 16 - Copy.xlsx'

// Replicate buildFixtureListItems logic
const normalizeCell = (v) => (v == null ? '' : String(v).trim())
const splitSns = (v) => {
  if (!v) return []
  return String(v).split(/[\\n,]/).map((s) => s.trim()).filter((s) => s && s !== '-' && s !== '–')
}
const parseCount = (v) => {
  const raw = normalizeCell(v)
  if (!raw) return 0
  const matches = raw.match(/\d+(\.\d+)?/g)
  if (matches && matches.length) return matches.reduce((sum, n) => sum + Number(n), 0)
  return 0
}

const buf = fs.readFileSync(FILE_PATH)
const wb = XLSX.read(buf, { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
console.log('total rows:', rows.length)

// header
let headerIdx = 0
for (let i = 0; i < rows.length; i++) {
  const cells = (rows[i] || []).map(normalizeCell)
  if (cells.slice(3).some((c) => c && c !== '-')) { headerIdx = i; break }
}
const headers = (rows[headerIdx] || []).map(normalizeCell)

let dataStart = headerIdx + 1
for (let i = headerIdx + 1; i < rows.length; i++) {
  const cells = (rows[i] || []).map(normalizeCell)
  if (cells[0] && cells[2] && cells.slice(3).some((c) => splitSns(c).length)) { dataStart = i; break }
}
const processRow = (rows[dataStart - 1] || []).map(normalizeCell)
const hasCountRow = dataStart - 2 > headerIdx
const countRow = hasCountRow ? (rows[dataStart - 2] || []).map(normalizeCell) : []

const items = []
for (let i = dataStart; i < rows.length; i++) {
  const cells = (rows[i] || []).map(normalizeCell)
  const line = cells[0]
  const model = cells[2]
  if (!line || !model) continue
  const fixtureInfo = []
  for (let j = 3; j < headers.length; j++) {
    const position = headers[j]
    if (!position) continue
    const sns = splitSns(cells[j])
    if (!sns.length) continue
    fixtureInfo.push({
      step: '',
      process: processRow[j] || '',
      position,
      count: parseCount(countRow[j]),
      sn: sns,
    })
  }
  if (fixtureInfo.length) items.push({ line, model, fixtureInfo })
}
console.log('items:', items.length)

// call import API
const res = await fetch(`${API_BASE}/fixturelist/import`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items, confirm: true }),
})
const json = await res.json()
console.log('status:', res.status)
console.log('result:', JSON.stringify(json, null, 2).slice(0, 1000))