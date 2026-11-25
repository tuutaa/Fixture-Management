/**
 * Copy users from the legacy FixtureManagement DB into the current
 * Fixture_Management DB.
 *
 * Legacy:  { UserID, Password, Name, LastName, Status, Authorization }
 * Current: { empId, pass, name, lastname, dept, status, request_id }
 *
 * Status mapping:
 *   Authorization=admin        -> Admin
 *   Status=signed              -> Signed
 *   Status=unsigned / pending  -> Unsigned
 *
 * Existing target users are updated by empId. `dept` and `request_id` are
 * preserved so operational data (e.g. TE department / active request) is not
 * lost during the merge.
 */
import mongoose from 'mongoose'

const SOURCE_URI = process.env.SOURCE_MONGO_URL
  || 'mongodb://10.192.8.238:27017/FixtureManagement'
const TARGET_URI = process.env.MONGO_URL
  || 'mongodb://10.192.8.238:27017/Fixture_Management'

const text = (value) => String(value ?? '').trim()

const mapStatus = (doc) => {
  if (/^admin$/i.test(text(doc.Authorization))) return 'Admin'
  const raw = text(doc.Status).toLowerCase()
  if (raw === 'signed') return 'Signed'
  if (raw === 'admin') return 'Admin'
  if (raw === 'unsigned' || raw === 'pending' || !raw) return 'Unsigned'
  return 'Unsigned'
}

const sourceConn = await mongoose.createConnection(SOURCE_URI, {
  serverSelectionTimeoutMS: 8000,
}).asPromise()
const targetConn = await mongoose.createConnection(TARGET_URI, {
  serverSelectionTimeoutMS: 8000,
}).asPromise()

const source = sourceConn.db.collection('users')
const target = targetConn.db.collection('users')

const sourceUsers = await source.find({}).sort({ UserID: 1 }).toArray()
let inserted = 0
let updated = 0
let unchanged = 0
let skipped = 0
const warnings = []

for (const doc of sourceUsers) {
  const empId = text(doc.UserID)
  if (!empId || doc.Password == null) {
    skipped += 1
    warnings.push(`Skipped user with missing UserID or Password: ${JSON.stringify(doc)}`)
    continue
  }

  const status = mapStatus(doc)
  const result = await target.updateOne(
    { empId },
    {
      $set: {
        pass: String(doc.Password),
        name: text(doc.Name),
        lastname: text(doc.LastName),
        status,
      },
      // Keep existing operational fields when merging into an existing user.
      $setOnInsert: { dept: '', request_id: '' },
    },
    { upsert: true },
  )

  if (result.upsertedCount) inserted += 1
  else if (result.modifiedCount) updated += 1
  else unchanged += 1
}

const statusCounts = await target.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } },
  { $sort: { _id: 1 } },
]).toArray()
const targetTotal = await target.countDocuments({})

console.log('User migration complete')
console.log(`  source=${SOURCE_URI} users=${sourceUsers.length}`)
console.log(`  target=${TARGET_URI}`)
console.log(`  inserted=${inserted} updated=${updated} unchanged=${unchanged} skipped=${skipped}`)
console.log(`  target users=${targetTotal} statuses=${statusCounts
  .map((row) => `${row._id || '(empty)'}:${row.count}`).join(', ')}`)
for (const warning of warnings) console.warn(`  WARN ${warning}`)

await sourceConn.close()
await targetConn.close()
