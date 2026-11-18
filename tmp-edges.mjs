import fs from 'fs'
const xml = fs.readFileSync('C:\\Users\\ponboonc\\Downloads\\Fixture MM.drawio', 'utf8')
const cellRe = /<mxCell id="([^"]+)"([\s\S]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g
const cells = new Map()
let m
while ((m = cellRe.exec(xml))) {
  const id = m[1]; const attrs = m[2]
  const get = (k) => { const mm = new RegExp(k + '="([^"]*)"').exec(attrs); return mm ? mm[1] : null }
  const strip = (s) => (s || '').replace(/&lt;br\s*\/?&gt;/g, ' / ').replace(/&lt;[^&]*&gt;/g, '').replace(/&amp;/g, '&').trim()
  cells.set(id, { value: strip(get('value')), source: get('source'), target: get('target') })
}
const name = (id) => (cells.get(id)?.value || '?').slice(0, 60)
for (const [id, c] of cells) {
  if (!c.source && !c.target) continue
  if (!c.value && c.target) continue // skip unlabeled
  console.log(`${name(c.source)}  --[${c.value || ''}]-->  ${name(c.target)}`)
}
