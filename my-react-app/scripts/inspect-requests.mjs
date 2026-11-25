import mongoose from 'mongoose'
const SOURCE_URI = process.env.SOURCE_MONGO_URL || 'mongodb://10.192.8.238:27017/FixtureManagement'
const sourceConn = await mongoose.createConnection(SOURCE_URI, { serverSelectionTimeoutMS: 8000 }).asPromise()
const reqs = await sourceConn.db.collection('fixture-requests').find({}).sort({ RequestTime: 1 }).toArray()
for (const r of reqs) {
  console.log(JSON.stringify({
    OrderNo: r.OrderNo,
    Status: r.Status,
    Type: r.Type,
    Line: r.Line,
    Model: r.Model,
    RequestID: r.RequestID,
    AcceptID: r.AcceptID,
    ReceiveBy: r.ReceiveBy,
    RequestTime: r.RequestTime,
    ReadyTime: r.ReadyTime,
    FinishedTime: r.FinishedTime,
    Fixtures: Array.isArray(r.Fixtures) ? r.Fixtures.map(f => f.SN) : [],
    requested: Array.isArray(r.requested_fixture_list) ? r.requested_fixture_list.map(x => x.fixture_base_name) : []
  }))
}
await sourceConn.close()