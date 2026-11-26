import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/server.js'
let raw = fs.readFileSync(p, 'utf8')
const hadCRLF = raw.includes('\r\n')
let s = raw.replace(/\r\n/g, '\n')
// 1. make line mutable
s = s.replace("    const line = text(body.line)\n", "    let line = text(body.line)\n", 1)
// 2. relax validation for Breakdown
s = s.replace("    if (!type || !line) {\n      return res.status(400).json({ success: false, message: 'กรุณาระบุประเภทคำขอและ Line' })\n    }",
  "    if (!type) {\n      return res.status(400).json({ success: false, message: 'กรุณาระบุประเภทคำขอ' })\n    }\n    if (type !== 'Breakdown' && !line) {\n      return res.status(400).json({ success: false, message: 'กรุณาระบุ Line' })\n    }", 1)
// 3. derive line from first broken fixture for Breakdown
s = s.replace("      : []\n\n    /* Block duplicate requests.",
  "      : []\n\n    if (type === 'Breakdown' && !line && breakdownItems.length) {\n      const firstFixture = await findFixture(breakdownItems[0].sn)\n      if (firstFixture?.line) line = text(firstFixture.line)\n    }\n    if (type === 'Breakdown' && !line) {\n      return res.status(400).json({ success: false, message: 'กรุณาระบุ SN ที่มี Line ในระบบ' })\n    }\n\n    /* Block duplicate requests.", 1)
if (hadCRLF) s = s.replace(/\n/g, '\r\n')
fs.writeFileSync(p, s, 'utf8')
console.log('done')