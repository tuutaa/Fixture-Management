import mongoose from 'mongoose'

const SOURCE_URI = process.env.SOURCE_MONGO_URL || 'mongodb://10.192.8.238:27017/FixtureManagement'
const TARGET_URI = process.env.MONGO_URL || 'mongodb://10.192.8.238:27017/Fixture_Management'

const sourceConn = await mongoose.createConnection(SOURCE_URI, { serverSelectionTimeoutMS: 8000 }).asPromise()
const targetConn = await mongoose.createConnection(TARGET_URI, { serverSelectionTimeoutMS: 8000 }).asPromise()

console.log('SOURCE DB:', sourceConn.db.databaseName)
const sourceCols = await sourceConn.db.listCollections().toArray()
console.log('source collections:', sourceCols.map(c => c.name).join(', '))
for (const name of ['fixture-requests', 'fixtures', 'fixture-requests-old', 'requests']) {
  try {
    const c = sourceConn.db.collection(name)
    const count = await c.countDocuments({})
    console.log(`source ${name}: ${count}`)
    if (count) console.log(JSON.stringify(await c.findOne({}), null, 2).slice(0, 3000))
  } catch (e) { console.log('source', name, e.message) }
}

console.log('TARGET DB:', targetConn.db.databaseName)
const targetCols = await targetConn.db.listCollections().toArray()
console.log('target collections:', targetCols.map(c => c.name).join(', '))
for (const name of ['request', 'fixtureDetail', 'fixtureDetail-old']) {
  try {
    const c = targetConn.db.collection(name)
    const count = await c.countDocuments({})
    console.log(`target ${name}: ${count}`)
    if (count) console.log(JSON.stringify(await c.findOne({}), null, 2).slice(0, 2000))
  } catch (e) { console.log('target', name, e.message) }
}

await sourceConn.close()
await targetConn.close()