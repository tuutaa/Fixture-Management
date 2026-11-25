import mongoose from 'mongoose'

const SOURCE_URI = process.env.SOURCE_MONGO_URL || 'mongodb://10.192.8.238:27017/FixtureManagement'
const TARGET_URI = process.env.MONGO_URL || 'mongodb://10.192.8.238:27017/Fixture_Management'

const sourceConn = await mongoose.createConnection(SOURCE_URI, { serverSelectionTimeoutMS: 8000 }).asPromise()
const targetConn = await mongoose.createConnection(TARGET_URI, { serverSelectionTimeoutMS: 8000 }).asPromise()

const legacyRequests = await sourceConn.db.collection('fixture-requests').find({}).toArray()
const legacyFixtures = await sourceConn.db.collection('fixtures').find({}).toArray()
const currentRequests = await targetConn.db.collection('request').find({}).toArray()
const currentFixtures = await targetConn.db.collection('fixtureDetail').find({}).toArray()

console.log('legacy requests:', legacyRequests.length)
console.log('legacy request statuses:', [...new Set(legacyRequests.map(d => d.Status))])
console.log('legacy request types:', [...new Set(legacyRequests.map(d => d.Type))])
console.log('legacy request sample statuses:', legacyRequests.slice(0,5).map(d => ({id:d.OrderNo,status:d.Status,type:d.Type,line:d.Line,model:d.Model})))
console.log('legacy fixtures:', legacyFixtures.length)
console.log('legacy fixture statuses:', [...new Set(legacyFixtures.map(d => d.Status))])
console.log('legacy fixture types:', [...new Set(legacyFixtures.map(d => d.Type))])
console.log('current requests:', currentRequests.length)
console.log('current fixtures:', currentFixtures.length)
const legacySn = new Set(legacyFixtures.map(d => d.SN).filter(Boolean))
const currentSn = new Set(currentFixtures.map(d => d.sn).filter(Boolean))
console.log('legacy SNs:', legacySn.size, 'current SNs:', currentSn.size, 'overlap:', [...legacySn].filter(s => currentSn.has(s)).length)
console.log('legacy SN sample not current:', [...legacySn].filter(s => !currentSn.has(s)).slice(0,20))
console.log('current SN sample not legacy:', [...currentSn].filter(s => !legacySn.has(s)).slice(0,20))

await sourceConn.close()
await targetConn.close()