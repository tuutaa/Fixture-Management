/* Parse the "Fixture List" Excel layout into fixturelist import items.
 *
 * Layout (rows as arrays, cell values already string-trimmed):
 *   Line | Process | Model | <position>...
 *   (optional count row, e.g. "Auto = 8, Manual = 1" + per-position counts)
 *   <blank> | <blank> | <blank> | <process per position>...
 *   <LINE> | <Auto|Manual> | <MODEL> | <SNs per position>...   <- data rows
 *
 * Cells use "-" or blank for empty positions; multi-SN cells are split on
 * newlines and commas.
 */

const normalizeCell = (value) => {
  if (value == null) return ''
  return String(value).trim()
}

const splitSns = (value) => {
  if (!value) return []
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s && s !== '-' && s !== '–')
}

export const buildFixtureListItems = (rows) => {
  const items = []
  if (!Array.isArray(rows) || !rows.length) return items

  // Header row = first row with position names (non-empty cells after col 2)
  let headerIdx = 0
  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] || []).map(normalizeCell)
    if (cells.slice(3).some((cell) => cell && cell !== '-')) {
      headerIdx = i
      break
    }
  }
  const headers = (rows[headerIdx] || []).map(normalizeCell)

  // Data start = first row after header with Line/Model and at least one SN cell
  let dataStart = headerIdx + 1
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = (rows[i] || []).map(normalizeCell)
    if (cells[0] && cells[2] && cells.slice(3).some((cell) => splitSns(cell).length)) {
      dataStart = i
      break
    }
  }

  const processRow = (rows[dataStart - 1] || []).map(normalizeCell)

  /* Count row = row directly above the process row (when present). Each number
   * is the quantity actually used for that fixture base; the registered SNs
   * may exceed it. Non-numeric cells (e.g. "Auto = 8, Manual = 1") are ignored. */
  const parseCount = (value) => {
    const raw = normalizeCell(value)
    if (!raw) return 0
    const match = raw.match(/^\d+(\.\d+)?$/)
    return match ? Number(raw) : 0
  }
  const hasCountRow = dataStart - 2 > headerIdx
  const countRow = hasCountRow ? (rows[dataStart - 2] || []).map(normalizeCell) : []

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

  return items
}
