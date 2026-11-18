import fs from 'fs'
const xml = fs.readFileSync('C:\\Users\\ponboonc\\Downloads\\Fixture MM.drawio', 'utf8')
const cellRe = /<mxCell id="([^"]+)"([\s\S]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g
const cells = new Map()
let m
while ((m = cellRe.exec(xml))) {
  const id = m[1]
  const attrs = m[2]
  const body = m[3] || ''
  const get = (k) => { const mm = new RegExp(k + '="([^"]*)"').exec(attrs); return mm ? mm[1] : null }
  const geo = /<mxGeometry[^>]*x="([^"]+)"[^>]*y="([^"]+)"/.exec(body) || /<mxGeometry[^>]*y="([^"]+)"[^>]*x="([^"]+)"/.exec(body)
  const strip = (s) => (s || '').replace(/&lt;br\s*\/?&gt;/g, ' / ').replace(/&lt;[^&]*&gt;/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim()
  cells.set(id, {
    id,
    value: strip(get('value')),
    style: get('style') || '',
    parent: get('parent'),
    source: get('source'),
    target: get('target'),
    x: geo ? Number(geo[1]) : null,
    y: geo ? Number(geo[2]) : null,
  })
}
for (const c of cells.values()) {
  if (c.source || c.target) continue
  if (!c.value) continue
  // only flow-diagram elements (in the flow column) - print all non-table labels
  console.log(`${c.id}\tx=${c.x}\ty=${c.y}\t${c.value}`)
}
