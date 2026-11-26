import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/server.js'
let raw = fs.readFileSync(p, 'utf8')
const hadCRLF = raw.includes('\r\n')
let s = raw.replace(/\r\n/g, '\n')
const old = `const compareModels = async (line, from, to) => {
  const [fromDoc, toDoc] = await Promise.all([
    FixtureList.findOne({ line, model: from }).lean(),
    FixtureList.findOne({ line, model: to }).lean(),
  ])

  const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase()

  const collect = (doc) => {
    const map = new Map()
    for (const info of doc?.fixtureInfo || []) {
      const key = norm(info.position)
      if (!key) continue
      if (!map.has(key)) {
        map.set(key, {
          position: String(info.position || '').trim(),
          process: String(info.process || '').trim(),
          count: 0,
          sn: new Set(),
        })
      }
      const bucket = map.get(key)
      if (!bucket.process && info.process) bucket.process = String(info.process).trim()
      const count = Number(info.count) || 0
      if (count > bucket.count) bucket.count = count
      for (const sn of info.sn || []) if (sn) bucket.sn.add(String(sn))
    }
    return map
  }

  const fromMap = collect(fromDoc)
  const toMap = collect(toDoc)`
const neu = `const compareModels = async (line, from, to) => {
  // Use actual "In Use" fixtures (not the base fixture list) so the compare
  // reflects real fixtures installed on the line for each model.
  const [fromDocs, toDocs] = await Promise.all([
    FixtureDetail.find({ line, model: from, status: 'In Use' }).lean(),
    FixtureDetail.find({ line, model: to, status: 'In Use' }).lean(),
  ])

  const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase()

  const collect = (docs) => {
    const map = new Map()
    for (const d of docs || []) {
      const key = norm(d.position)
      if (!key) continue
      if (!map.has(key)) {
        map.set(key, {
          position: String(d.position || '').trim(),
          process: String(d.process || '').trim(),
          count: 0,
          sn: new Set(),
        })
      }
      const bucket = map.get(key)
      if (!bucket.process && d.process) bucket.process = String(d.process).trim()
      if (d.sn) bucket.sn.add(String(d.sn))
      bucket.count = bucket.sn.size
    }
    return map
  }

  const fromMap = collect(fromDocs)
  const toMap = collect(toDocs)`
if (!s.includes(old)) { console.log('old not found'); process.exit(1) }
s = s.replace(old, neu, 1)
if (hadCRLF) s = s.replace(/\n/g, '\r\n')
fs.writeFileSync(p, s, 'utf8')
console.log('done')