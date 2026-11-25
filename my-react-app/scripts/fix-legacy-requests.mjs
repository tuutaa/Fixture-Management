import mongoose from 'mongoose'
const SOURCE_URI = process.env.SOURCE_MONGO_URL || 'mongodb://10.192.8.238:27017/FixtureManagement'
const TARGET_URI = process.env.MONGO_URL || 'mongodb://10.192.8.238:27017/Fixture_Management'
const sourceConn = await mongoose.createConnection(SOURCE_URI, { serverSelectionTimeoutMS: 8000 }).asPromise()
const targetConn = await mongoose.createConnection(TARGET_URI, { serverSelectionTimeoutMS: 8000 }).asPromise()
const legacy = await sourceConn.db.collection('fixture-requests').find({}).toArray()
const target = targetConn.db.collection('request')
let fixed = 0
for (const r of legacy) {
  const id = String(r.OrderNo || '').trim()
  const fixtures = Array.isArray(r.Fixtures) ? r.Fixtures.map(f => (typeof f === 'string' ? f : f?.SN)).map(s => String(s || '').trim()).filter(Boolean) : []
  const res = await target.updateOne({ request_id: id }, { $set: { breakdownItems: fixtures.map(sn => ({ sn, symptom: '' })), scannedIssue: fixtures, returnedItems: r.Status === 'Finished' ? fixtures : [] } })
  if (res.modifiedCount) fixed++
}
console.log('fixed requests:', fixed, 'of', legacy.length)
await sourceConn.close()
await targetConn.close()