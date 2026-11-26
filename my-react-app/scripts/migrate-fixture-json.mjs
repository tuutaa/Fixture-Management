import mongoose from 'mongoose'
import fs from 'node:fs'

const MONGO_URI = process.env.MONGO_URL || 'mongodb://10.192.8.238:27017/Fixture_Management'
const JSON_PATH = 'C:/Users/ponboonc/Downloads/FixtureManagement.fixtures.json'

const fixtureDetailSchema = new mongoose.Schema({
  sn: { type: String, required: true, unique: true, index: true },
  line: { type: String, default: '' },
  model: { type: String, default: '' },
  status: { type: String, default: 'In Stock', index: true },
  type: String,
  step: { type: String, default: '' },
  process: { type: String, default: '' },
  position: { type: String, default: '' },
  usage: {
    current: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    exp: String,
    storage: String,
    usedLine: String,
    inUseAt: String,
    currentModel: String,
    changeModel: String,
  },
  registered: {
    empId: String,
    name: String,
    lastname: String,
    date: Date,
  },
  fixtureBase: String,
  revision: { type: String, default: '' },
  pmDate: { type: String, default: '' },
  pmForms: { type: [String], default: [] },
  pmRequestedDays: { type: Number, default: 0 },
  pmApproval: { type: String, default: '' },
  pmApprovedBy: { type: String, default: '' },
  pmApprovedAt: { type: String, default: '' },
  pmRunId: { type: String, default: '' },
}, { versionKey: false })

const FixtureDetail = mongoose.model('FixtureDetail', fixtureDetailSchema, 'fixtureDetail')

const norm = (v) => {
  const s = String(v ?? '').trim()
  return /^n\/?a$/i.test(s) ? '' : s
}
const canonicalProcessType = (v) => {
  const s = String(v || '').trim()
  const valid = ['Mainline', 'Rotor', 'Winding', 'Function']
  return valid.includes(s) ? s : ''
}

const run = async () => {
  console.log('Connecting to', MONGO_URI)
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))
  console.log('Loaded', data.length, 'records')

  const ops = []
  let skipped = 0
  for (const rec of data) {
    const sn = String(rec.SN || '').trim()
    if (!sn) { skipped++; continue }
    const doc = {
      sn,
      line: norm(rec.Line),
      model: norm(rec.Model),
      status: String(rec.Status || 'In Stock').trim() || 'In Stock',
      type: canonicalProcessType(rec.Type),
      usage: {
        current: Number(rec.Usage?.CurrentUsed) || 0,
        max: Number(rec.Usage?.MaxUsed) || 0,
        exp: rec.Usage?.ExpiredDate || '',
        storage: String(rec.StorageLocation || '').trim(),
      },
      registered: {
        empId: String(rec.Registed?.UserID || '').trim(),
        name: String(rec.Registed?.Name || '').trim(),
        lastname: String(rec.Registed?.LastName || '').trim(),
        date: rec.Registed?.Date ? new Date(rec.Registed.Date) : null,
      },
      fixtureBase: String(rec.FixtureBase || '').trim() || sn.split('-')[0],
    }
    ops.push({
      updateOne: {
        filter: { sn },
        update: { $set: doc },
        upsert: true,
      },
    })
  }
  console.log('Prepared', ops.length, 'ops, skipped', skipped)

  const batchSize = 500
  let inserted = 0, updated = 0
  for (let i = 0; i < ops.length; i += batchSize) {
    const batch = ops.slice(i, i + batchSize)
    const res = await FixtureDetail.bulkWrite(batch, { ordered: false })
    inserted += res.upsertedCount || 0
    updated += res.modifiedCount || 0
    console.log(`Batch ${Math.floor(i/batchSize)+1}: upserted ${res.upsertedCount}, modified ${res.modifiedCount}`)
  }
  console.log('Done. Total inserted:', inserted, 'updated:', updated)
  await mongoose.disconnect()
}

run().catch((e) => { console.error(e); process.exit(1) })