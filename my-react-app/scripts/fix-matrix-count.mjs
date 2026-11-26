import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let raw = fs.readFileSync(p, 'utf8')
const hadCRLF = raw.includes('\r\n')
let s = raw.replace(/\r\n/g, '\n')

// 1. change cell to also track counts
s = s.replace(
  "      const cell = new Map()\n",
  "      const cell = new Map()\n      const cellCount = new Map()\n",
  1
)

// 2. store count per position
s = s.replace(
  "         /* จำนวนที่ใช้จริงต่อ fixture base (ค่ามาตรฐานจาก Excel) */\n         const standard = Number(info.count) || 0\n         if (standard > (standardBy.get(key) || 0)) standardBy.set(key, standard)\n",
  "         /* จำนวนที่ใช้จริงต่อ fixture base (ค่ามาตรฐานจาก Excel) */\n         const standard = Number(info.count) || 0\n         if (standard > (standardBy.get(key) || 0)) standardBy.set(key, standard)\n         if (standard > 0) cellCount.set(key, Math.max(cellCount.get(key) || 0, standard))\n",
  1
)

// 3. push row with counts
s = s.replace(
  "      if (cell.size) {\n        rows.push({ id: String(doc._id), line: doc.line, model: doc.model, cell })\n      }",
  "      if (cell.size) {\n        rows.push({ id: String(doc._id), line: doc.line, model: doc.model, cell, cellCount })\n      }",
  1
)

// 4. update view to show cellCount instead of sns.length in the matrix cell
// The matrix view renders: <span ...>{sns.length}</span>
// We need to use row.cellCount.get(position) || sns.length
// But the view uses matrix.rows.map and row.cell.get(position). Let me update the cell render.
// Find the matrix cell render:
s = s.replace(
  "                      const sns = row.cell.get(position) || []\n                      if (sns.length === 0) return (\n                        <td key={position} className=\"border-r border-slate-100 px-0 py-1 text-center text-[9px] text-slate-300\">\n                          -\n                        </td>\n                      )\n                      return (\n                        <td key={position} className=\"border-r border-slate-100 px-0 py-1 text-center\" title={sns.join('\\n')}>\n                          <span className=\"inline-flex h-4 min-w-[18px] items-center justify-center rounded bg-blue-100 px-0.5 text-[9px] font-black text-blue-700\">\n                            {sns.length}\n                          </span>\n                        </td>\n                      )",
  "                      const sns = row.cell.get(position) || []\n                      const cnt = row.cellCount?.get(position) || sns.length\n                      if (sns.length === 0 && !cnt) return (\n                        <td key={position} className=\"border-r border-slate-100 px-0 py-1 text-center text-[9px] text-slate-300\">\n                          -\n                        </td>\n                      )\n                      return (\n                        <td key={position} className=\"border-r border-slate-100 px-0 py-1 text-center\" title={sns.length ? sns.join('\\n') : (cnt ? cnt + ' ตัว' : '')}>\n                          <span className=\"inline-flex h-4 min-w-[18px] items-center justify-center rounded bg-blue-100 px-0.5 text-[9px] font-black text-blue-700\">\n                            {cnt || sns.length}\n                          </span>\n                        </td>\n                      )",
  1
)

if (hadCRLF) s = s.replace(/\n/g, '\r\n')
fs.writeFileSync(p, s, 'utf8')
console.log('done')