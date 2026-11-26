import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/lib/fixtureImport.js'
let raw = fs.readFileSync(p, 'utf8')
const hadCRLF = raw.includes('\r\n')
let s = raw.replace(/\r\n/g, '\n')
const old = `  const parseCount = (value) => {
    const raw = normalizeCell(value)
    if (!raw) return 0
    const match = raw.match(/^\\d+(\\.\\d+)?$/)
    return match ? Number(raw) : 0
  }`
const neu = `  const parseCount = (value) => {
    const raw = normalizeCell(value)
    if (!raw) return 0
    const matches = raw.match(/\\d+(\\.\\d+)?/g)
    if (matches && matches.length) {
      return matches.reduce((sum, n) => sum + Number(n), 0)
    }
    return 0
  }`
if (!s.includes(old)) { console.log('old not found'); process.exit(1) }
s = s.replace(old, neu, 1)
if (hadCRLF) s = s.replace(/\n/g, '\r\n')
fs.writeFileSync(p, s, 'utf8')
console.log('done')