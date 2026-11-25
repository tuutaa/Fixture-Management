import mongoose from 'mongoose'
import fs from 'node:fs'
import path from 'node:path'

const apply = process.argv.includes('--apply')
const backup = process.argv.includes('--backup') || apply
const SOURCE_URI = process.env.SOURCE_MONGO_URL || 'mongodb://10.192.8.238:27017/FixtureManagement'
const TARGET_URI = process.env.MONGO_URL || 'mongodb://10.192.8.238:27017/Fixture_Management'
const VALID_PROCESS_TYPES = new Set(['Mainline', 'Rotor', 'Winding', 'Function'])

const sourceConn = await mongoose.createConnection(SOURCE_URI, { serverSelectionTimeoutMS: 8000 }).asPromise()
const targetConn = await mongoose.createConnection(TARGET_URI, { serverSelectionTimeoutMS: 8000 }).asPromise()

const legacyFixtures = await sourceConn.db.collection('fixtures').find({}).toArray()
const legacyRequests = await sourceConn.db.collection('fixture-requests').find({}).toArray()
const targetFixtures = targetConn.db.collection('fixtureDetail')
const targetRequests = targetConn.db.collection('request')

if (backup && apply) {
  const dir = path.join(process.cwd(), 'backups')
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  fs.writeFileSync(path.join(dir, `fixtureDetail.before-legacy-${stamp}.json`), JSON.stringify(await targetFixtures.find({}).toArray(), null, 2))
  fs.writeFileSync(path.join(dir, `request.before-legacy-${stamp}.json`), JSON.stringify(await targetRequests.find({}).toArray(), null, 2))
  console.log('backup written')
}

const baseSn = (sn) => String(sn || '').trim().split('-')[0] || ''
const validDate = (value) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

let fixtureInserted = 0
let fixtureUpdated = 0
let fixtureSkipped = 0
for (const legacy of legacyFixtures) {
  const sn = String(legacy.SN || '').trim()
  if (!sn) { fixtureSkipped++; continue }
  const status = legacy.Status === 'In Use' ? 'In Use' : 'In Stock'
  const type = VALID_PROCESS_TYPES.has(legacy.Type) ? legacy.Type : ''
  const doc = {
    sn,
    status,
    type,
    line: String(legacy.Line || '').trim(),
    model: String(legacy.Model || '').trim(),
    usage: {
      current: Number(legacy.Usage?.CurrentUsed) || 0,
      max: Number(legacy.Usage?.MaxUsed) || 0,
      exp: legacy.Usage?.ExpiredDate || '',
      storage: legacy.StorageLocation || '',
      currentModel: '',
      changeModel: '',
      usedLine: '',
      inUseAt: '',
    },
    registered: {
      empId: String(legacy.Registed?.UserID || '').trim(),
      name: String(legacy.Registed?.Name || '').trim(),
      lastname: String(legacy.Registed?.LastName || '').trim(),
      date: validDate(legacy.Registed?.Date),
    },
    fixtureBase: legacy.FixtureBase || baseSn(sn),
    revision: '',
  }

  const existing = await targetFixtures.findOne({ sn })
  if (!existing) {
    if (apply) await targetFixtures.insertOne(doc)
    fixtureInserted++
  } else {
    const update = {}
    if (!existing.type && doc.type) update.type = doc.type
    if (!existing.line && doc.line) update.line = doc.line
    if (!existing.model && doc.model) update.model = doc.model
    if ((!existing.usage?.current) && doc.usage.current) update['usage.current'] = doc.usage.current
    if ((!existing.usage?.max) && doc.usage.max) update['usage.max'] = doc.usage.max
    if (!existing.usage?.exp && doc.usage.exp) update['usage.exp'] = doc.usage.exp
    if (!existing.usage?.storage && doc.usage.storage) update['usage.storage'] = doc.usage.storage
    if (!existing.fixtureBase && doc.fixtureBase) update.fixtureBase = doc.fixtureBase
    if (!existing.registered?.empId && doc.registered.empId) update['registered.empId'] = doc.registered.empId
    if (!existing.registered?.name && doc.registered.name) update['registered.name'] = doc.registered.name
    if (!existing.registered?.lastname && doc.registered.lastname) update['registered.lastname'] = doc.registered.lastname
    if (!existing.registered?.date && doc.registered.date) update['registered.date'] = doc.registered.date
    if (Object.keys(update).length) {
      if (apply) await targetFixtures.updateOne({ _id: existing._id }, { $set: update })
      fixtureUpdated++
    } else {
      fixtureSkipped++
    }
  }
}

const statusMap = { Finished: 'Done', Ready: 'Waiting', 'In-progress': 'Progress' }
let requestInserted = 0
let requestSkipped = 0
for (const legacy of legacyRequests) {
  const requestId = String(legacy.OrderNo || '').trim()
  if (!requestId) { requestSkipped++; continue }
  const existing = await targetRequests.findOne({ request_id: requestId })
  if (existing) { requestSkipped++; continue }
  const fixtures = Array.isArray(legacy.Fixtures) ? legacy.Fixtures.map(s => String(s).trim()).filter(Boolean) : []
  const requested = Array.isArray(legacy.requested_fixture_list) ? legacy.requested_fixture_list.map(x => String(x?.fixture_base_name || '').trim()).filter(Boolean) : []
  const doc = {
    request_id: requestId,
    type: String(legacy.Type || '').trim(),
    line: String(legacy.Line || '').trim(),
    currentModel: String(legacy.Model || '').trim(),
    changeModel: '',
    status: statusMap[legacy.Status] || 'Done',
    desc: String(legacy.Description || '').trim() || `${legacy.Type || 'Legacy'} ${legacy.Model || ''}`.trim(),
    requestType: '',
    step: '',
    dueDate: '',
    queueDate: '',
    queueSlot: '',
    replaceQty: 0,
    items: requested,
    action: '',
    breakdownItems: fixtures.map(sn => ({ sn, symptom: '' })),
    requestInfo: {
      empId: String(legacy.RequestID || '').trim(),
      name: '',
      lastname: '',
      date: validDate(legacy.RequestTime),
    },
    acceptInfo: {
      empId: String(legacy.AcceptID || '').trim(),
      name: '',
      lastname: '',
      date: validDate(legacy.ReadyTime),
    },
    issueInfo: { empId: '', name: '', lastname: '', date: null },
    verifyInfo: {
      empId: '',
      name: String(legacy.ReceiveBy || '').trim(),
      lastname: '',
      date: validDate(legacy.FinishedTime),
    },
    issueDone: legacy.Status === 'Finished',
    returnDone: legacy.Status === 'Finished',
    scannedIssue: fixtures,
    returnedItems: legacy.Status === 'Finished' ? fixtures : [],
  }
  if (apply) await targetRequests.insertOne(doc)
  requestInserted++
}

console.log(JSON.stringify({
  mode: apply ? 'APPLY' : 'DRY-RUN',
  fixtures: { source: legacyFixtures.length, inserted: fixtureInserted, updated: fixtureUpdated, skipped: fixtureSkipped },
  requests: { source: legacyRequests.length, inserted: requestInserted, skipped: requestSkipped },
}, null, 2))

await sourceConn.close()
await targetConn.close()