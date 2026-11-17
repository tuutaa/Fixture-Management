import mongoose from 'mongoose'

const SOURCE_URL = process.env.LEGACY_MONGO_URL || 'mongodb://10.192.8.238:27017/FixtureManagement'
const TARGET_URL = process.env.MONGO_URL || 'mongodb://10.192.8.238:27017/Fixture_Management'
const keepTransactions = process.argv.includes('--keep-transactions')

const toText = (value) => (typeof value === 'string' ? value.trim() : value == null ? '' : String(value))
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

const isoDate = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  if (year > 2400) date.setFullYear(year - 543)
  return date.toISOString().slice(0, 10)
}

const source = await mongoose.createConnection(SOURCE_URL, { serverSelectionTimeoutMS: 10000 }).asPromise()
const target = await mongoose.createConnection(TARGET_URL, { serverSelectionTimeoutMS: 10000 }).asPromise()
const src = source.db
const dst = target.db

console.log('[migrate] source :', SOURCE_URL)
console.log('[migrate] target :', TARGET_URL)

const fixtures = await src.collection('fixtures').find({}).toArray()
const storages = await src.collection('storages').find({}).toArray()
console.log(`[migrate] read fixtures=${fixtures.length} storages=${storages.length}`)

const detailDocs = []
const groups = new Map() // line\u0000model -> Map of infoKey -> {step,process,position,sn:[]}
let registeredDates = 0
let convertedExpDates = 0
let skipped = 0

for (const old of fixtures) {
  const sn = toText(old.SN)
  if (!sn) { skipped += 1; continue }
  const line = toText(old.Line) || 'N/A'
  const model = toText(old.Model) || 'N/A'
  const exp = isoDate(old.Usage?.ExpiredDate)
  if (exp) convertedExpDates += 1
  const registeredDate = isoDate(old.Registed?.Date)
  if (registeredDate) registeredDates += 1

  const status = /in use|inuse/i.test(toText(old.Status))
    ? 'In Use'
    : /maintenance|pm/i.test(toText(old.Status))
      ? 'Maintenance'
      : 'In Stock'

  detailDocs.push({
    sn,
    status,
    type: toText(old.Type) === 'N/A' ? '' : toText(old.Type),
    usage: {
      current: num(old.Usage?.CurrentUsed),
      max: num(old.Usage?.MaxUsed),
      exp,
      storage: toText(old.StorageLocation),
      currentModel: toText(old.Model),
      changeModel: '',
    },
    registered: {
      empId: toText(old.Registed?.UserID),
      name: toText(old.Registed?.Name),
      lastname: toText(old.Registed?.LastName),
      date: registeredDate ? new Date(registeredDate) : null,
    },
    fixtureBase: toText(old.FixtureBase) || sn.split('-')[0] || '',
    revision: '',
  })

  const step = ''
  const process = toText(old.Name)
  const position = Array.isArray(old.Tag) ? old.Tag.map(toText).filter(Boolean).join(', ') : toText(old.Tag)
  const key = `${line}\u0000${model}`
  if (!groups.has(key)) groups.set(key, new Map())
  const infoMap = groups.get(key)
  const infoKey = `${step}\u0000${process}\u0000${position}`
  if (!infoMap.has(infoKey)) infoMap.set(infoKey, { step, process, position, sn: [] })
  infoMap.get(infoKey).sn.push(sn)
}

const listDocs = []
for (const [key, infoMap] of groups) {
  const [line, model] = key.split('\u0000')
  listDocs.push({
    line,
    model,
    fixtureInfo: [...infoMap.values()].sort((a, b) => String(a.process).localeCompare(String(b.process))),
  })
}

const storageDocs = []
const seenStorage = new Set()
for (const old of storages) {
  const location = toText(old.StorageLocation || old.Storage || old.Location)
  if (!location || seenStorage.has(location)) continue
  seenStorage.add(location)
  storageDocs.push({ location, desc: toText(old.Description) })
}

await dst.collection('fixtureDetail').deleteMany({})
await dst.collection('fixturelist').deleteMany({})
await dst.collection('storages').deleteMany({})
if (!keepTransactions) {
  await dst.collection('request').deleteMany({})
  await dst.collection('history').deleteMany({})
}

if (detailDocs.length > 0) await dst.collection('fixtureDetail').insertMany(detailDocs)
if (listDocs.length > 0) await dst.collection('fixturelist').insertMany(listDocs)
if (storageDocs.length > 0) await dst.collection('storages').insertMany(storageDocs)

console.log('[migrate] fixtureDetail docs :', detailDocs.length)
console.log('[migrate] fixturelist docs  :', listDocs.length)
console.log('[migrate] fixtureInfo entries:', listDocs.reduce((s, d) => s + d.fixtureInfo.length, 0))
console.log('[migrate] storages          :', storageDocs.length)
console.log('[migrate] registered dates  :', registeredDates)
console.log('[migrate] exp dates         :', convertedExpDates)
console.log('[migrate] skipped fixtures  :', skipped)
console.log('[migrate] transactions      :', keepTransactions ? 'kept' : 'cleared request + history')
console.log('[migrate] DONE')

await source.close()
await target.close()