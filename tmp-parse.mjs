import fs from 'fs'
const xml = fs.readFileSync('C:\\Users\\ponboonc\\Downloads\\Fixture MM.drawio', 'utf8')
// crude cell parser
const cellRe = /<mxCell id="([^"]+)"([^>]*)>/g
const cells = []
let m
while ((m = cellRe.exec(xml))) {
  const attrs = m[2]
  const get = (k) => { const mm = new RegExp(k + '="([^"]*)"').exec(attrs); return mm ? mm[1] : null }
  const value = get('value') || ''
  const parent = get('parent')
  const source = get('source') || null
  const target = get('target') || null
  const style = get('style') || ''
  cells.push({ id: m[1], value: value.replace(/&lt;br&gt;/g, ' ').replace(/&lt;[^&]*&gt;/g, '').replace(/&amp;/g, '&').trim(), parent, source, target, style: style.slice(0, 40) })
}
for (const c of cells) {
  if (c.source || c.target) {
    console.log('EDGE', JSON.stringify(c.value), '::', c.source, '->', c.target)
  }
}
