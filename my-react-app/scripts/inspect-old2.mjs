import mongoose from 'mongoose'

const conn = await mongoose
  .createConnection('mongodb://10.192.8.238:27017/FixtureManagement', { serverSelectionTimeoutMS: 8000 })
  .asPromise()
const db = conn.db

for (const name of ['lines', 'models', 'fixture-requests', 'ordres', 'issue-drafts', 'fixture_bases']) {
  const col = db.collection(name)
  const count = await col.countDocuments()
  const docs = await col.find({}).limit(2).toArray()
  console.log(`\n===== ${name} (${count}) =====`)
  console.log(JSON.stringify(docs, null, 2).slice(0, 3000))
}

const fixtures = db.collection('fixtures')

const distinct = async (field, limit = 40) => {
  const values = await fixtures.distinct(field)
  return values.slice(0, limit)
}

console.log('\nSTATUSES:', JSON.stringify(await fixtures.distinct('Status')))
console.log('TYPES:', JSON.stringify((await fixtures.distinct('Type')).slice(0, 60)))
console.log('LINES:', JSON.stringify((await fixtures.distinct('Line')).slice(0, 60)))
console.log('MODEL COUNT:', (await fixtures.distinct('Model')).length)
console.log('MODELS SAMPLE:', JSON.stringify((await fixtures.distinct('Model')).slice(0, 30)))

const groups = await fixtures
  .aggregate([{ $group: { _id: { line: '$Line', model: '$Model' }, n: { $sum: 1 } } }, { $sort: { n: -1 } }])
  .toArray()
console.log('\nLINE/MODEL GROUPS:', groups.length)
console.log(JSON.stringify(groups.slice(0, 15)))

const naCount = await fixtures.countDocuments({ Line: 'N/A' })
console.log('N/A line fixtures:', naCount)

console.log('\nUsage sample stats:')
const usage = await fixtures
  .aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        withExp: { $sum: { $cond: [{ $ne: ['$Usage.ExpiredDate', null] }, 1, 0] } },
        withMax: { $sum: { $cond: [{ $ne: ['$Usage.MaxUsed', null] }, 1, 0] } },
        maxExp: { $max: '$Usage.ExpiredDate' },
        minExp: { $min: '$Usage.ExpiredDate' },
      },
    },
  ])
  .toArray()
console.log(JSON.stringify(usage, null, 2))

const withoutBase = await fixtures.countDocuments({ $or: [{ FixtureBase: null }, { FixtureBase: '' }] })
console.log('no fixtureBase:', withoutBase)

const simpleFixtures = await fixtures.countDocuments({ Line: { $not: /^A\d+/ } })
console.log('non A-line fixtures:', simpleFixtures)

const statusByLine = await fixtures
  .aggregate([
    { $group: { _id: { status: '$Status', line: { $cond: [{ $regexMatch: { input: '$Line', regex: /^A\d+/ } }, 'line', 'other'] } }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ])
  .toArray()
console.log('status by line:', JSON.stringify(statusByLine.slice(0, 30)))

await conn.close()
