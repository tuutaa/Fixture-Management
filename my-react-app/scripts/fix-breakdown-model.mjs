import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/server.js'
let raw = fs.readFileSync(p, 'utf8')
const hadCRLF = raw.includes('\r\n')
let s = raw.replace(/\r\n/g, '\n')
// make currentModel mutable
s = s.replace("    const currentModel = text(body.currentModel || body.model)\n", "    let currentModel = text(body.currentModel || body.model)\n", 1)
// derive currentModel from first broken fixture for Breakdown (alongside line)
s = s.replace("    if (type === 'Breakdown' && !line && breakdownItems.length) {\n      const firstFixture = await findFixture(breakdownItems[0].sn)\n      if (firstFixture?.line) line = text(firstFixture.line)\n    }",
  "    if (type === 'Breakdown' && breakdownItems.length) {\n      const firstFixture = await findFixture(breakdownItems[0].sn)\n      if (!line && firstFixture?.line) line = text(firstFixture.line)\n      if (!currentModel && (firstFixture?.model || firstFixture?.usage?.model)) currentModel = text(firstFixture.model || firstFixture?.usage?.model)\n    }", 1)
if (hadCRLF) s = s.replace(/\n/g, '\r\n')
fs.writeFileSync(p, s, 'utf8')
console.log('done')