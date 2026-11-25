import mongoose from 'mongoose'
const FAN2_URI = process.env.FAN2_MONGO_URL || 'mongodb://10.192.8.238:27017/FAN2'
const conn = await mongoose.createConnection(FAN2_URI, { serverSelectionTimeoutMS: 8000 }).asPromise()
const cols = await conn.db.listCollections().toArray()
console.log('collections:', cols.map(c=>c.name).join(', '))
const col = conn.db.collection('MachineNew')
console.log('count:', await col.countDocuments({}))
console.log(JSON.stringify(await col.findOne({}), null, 2))
await conn.close()