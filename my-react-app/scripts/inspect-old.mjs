import mongoose from 'mongoose'

const URL = 'mongodb://10.192.8.238:27017/FixtureManagement'
const conn = await mongoose.createConnection(URL, { serverSelectionTimeoutMS: 8000 }).asPromise()
const db = conn.db

const collections = await db.listCollections().toArray()
console.log('COLLECTIONS:', collections.map((c) => c.name).join(', '))

for (const name of ['fixtures', 'storages']) {
  const col = db.collection(name)
  const count = await col.countDocuments()
  const docs = await col.find({}).limit(3).toArray()
  const sample = await col.find({}).limit(300).toArray()
  const keys = new Map()
  for (const doc of sample) {
    for (const key of Object.keys(doc)) keys.set(key, (keys.get(key) || 0) + 1)
  }
  console.log(`\n===== ${name} (${count} docs) =====`)
  console.log('KEYS:', JSON.stringify([...keys.entries()], null, 0))
  console.log('SAMPLE:', JSON.stringify(docs, null, 2).slice(0, 6000))
}

await conn.close()
