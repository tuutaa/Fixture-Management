/**
 * Rebuild src/lib/data/fixtureMaster.json from the supplied Excel master.
 * Run from my-react-app: node scripts/build-fixture-master.cjs
 *
 * Sheet layout:
 *   row 0 = position / fixture names
 *   row 1 = required count per position (may be "Auto = 8, Manual = 1")
 *   row 2 = process name per position (Rotor Assy, Winding, Solder PWB, ...)
 *   row 3+ = Line / Process / Model + FixtureBase per position
 */
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const root = path.resolve(__dirname, '..')
const workbook = XLSX.readFile(path.join(root, 'FixtureDataBase (2) 16 - Copy.xlsx'))
const matrix = XLSX.utils.sheet_to_json(workbook.Sheets['Fixture Lists Detail'], {
  header: 1,
  defval: null,
  raw: false,
})
const standard = XLSX.utils.sheet_to_json(workbook.Sheets['standardTime'], { defval: null })

const headerRow = matrix[0] || []
const countRow = matrix[1] || []
const processRow = matrix[2] || []
const dataRows = matrix.slice(3).filter((row) => row[0] && row[2])

const norm = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const stepByProcess = {}
for (const [key, value] of Object.entries(standard[0] || {})) {
  if (!key.startsWith('STEP') || typeof value !== 'string') continue
  const step = key.replace(/_\d+$/, '').trim()
  stepByProcess[norm(value)] = step
}

const inferType = (process, position) => {
  const value = `${norm(process)} ${norm(position)}`
  if (/rotor|balance|impeller|yoke/.test(value)) return 'Rotor'
  if (/winding|dipping|stator test|dcr/.test(value)) return 'Winding'
  if (/test|inspection|function|noise|on off|aoi|barcode/.test(value)) return 'Function'
  return 'Mainline'
}

const inferStep = (position, process, type) => {
  const p = norm(process)
  const n = norm(position)
  if (stepByProcess[p]) return stepByProcess[p]
  if (/rotor|balance|impeller|yoke/.test(n) || /rotor|balance/.test(p)) return 'STEP ROTOR'
  if (/winding|dipping|stator test|dcr/.test(n) || /winding|dipping/.test(p)) return 'STEP WINDING'
  if (/test|inspection|function/.test(n) || /test|inspection|function/.test(p)) return 'TEST STEP'
  if (type === 'Rotor') return 'STEP ROTOR'
  if (type === 'Winding') return 'STEP WINDING'
  if (type === 'Function') return 'TEST STEP'
  return 'STEP1'
}

const splitBases = (value) =>
  [
    ...new Set(
      String(value ?? '')
        .replace(/^'/, '')
        .split(/[\s,;\r\n]+/)
        .map((item) => item.trim().match(/^[A-Za-z0-9-]+/)?.[0] || '')
        .filter((item) => /^[A-Za-z0-9-]{3,}$/.test(item)),
    ),
  ]

const countFrom = (raw, mode, process) => {
  const text = String(raw ?? '').trim()
  if (!text) return 0
  const auto = text.match(/Auto\s*=\s*(\d+)/i)
  const manual = text.match(/Manual\s*=\s*(\d+)/i)
  if (auto && manual) {
    const isAuto = /auto/i.test(mode) && !/manual/i.test(mode)
    const isManual = /manual/i.test(mode) && !/auto/i.test(mode)
    if (isAuto) return Number(auto[1])
    if (isManual) return Number(manual[1])
    return /rotor/i.test(process) ? Number(auto[1]) : Number(manual[1])
  }
  const first = text.match(/\d+/)
  return first ? Number(first[0]) : 0
}

const columns = new Map()
for (let index = 3; index < headerRow.length; index += 1) {
  const position = String(headerRow[index] ?? '').trim()
  if (!position) continue
  const countText = String(countRow[index] ?? '').trim()
  const process = String(processRow[index] ?? '').trim()
  const type = inferType(process, position)
  const meta = {
    position,
    countText,
    process,
    step: inferStep(position, process, type),
    type,
    scope: 'common',
  }
  columns.set(index, meta)
}

const positions = [...columns.values()]
const modelProcess = {}
const fixtureLists = dataRows.map((row, index) => {
  const line = String(row[0]).trim()
  const model = String(row[2]).trim()
  const mode = String(row[1] ?? '').trim() || 'N/A'
  modelProcess[`${line}|${model}`] = mode

  const items = []
  for (const [columnIndex, meta] of columns) {
    const value = String(row[columnIndex] ?? '').trim()
    if (!value || value === '-') continue
    const fixtureBases = splitBases(value)
    if (!fixtureBases.length) continue
    items.push({
      position: meta.position,
      process: meta.process,
      step: meta.step,
      type: meta.type,
      count: countFrom(meta.countText, mode, meta.process),
      countText: meta.countText,
      fixtureBases,
    })
  }

  return {
    _id: `fl-xlsx-${index + 1}`,
    line,
    model,
    process: mode,
    items,
  }
})

const output = { stepByProcess, modelProcess, positions, fixtureLists }
const target = path.join(root, 'src', 'lib', 'data', 'fixtureMaster.json')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, JSON.stringify(output, null, 2))
console.log(
  `Wrote ${target} — ${positions.length} positions, ${fixtureLists.length} line/model rows, ${fixtureLists.reduce(
    (sum, row) => sum + row.items.length,
    0,
  )} fixture-list items`,
)
