/**
 * Reset Fixture_Management data.
 *
 * Usage:
 *   npm run reset-db -- --yes          clear transactional data only
 *   npm run reset-db -- --all --yes    clear transactional + master data (incl. users)
 *
 * Collections (Flow Fixture MM):
 *   transactional: fixturelist, request, history
 *   master:        users
 */

import mongoose from 'mongoose'

const MONGO_URL =
  process.env.MONGO_URL || 'mongodb://10.192.8.238:27017/Fixture_Management'

const transactionCollections = ['fixturelist', 'request', 'history']
const masterCollections = ['users']

const confirmed = process.argv.includes('--yes')
const resetAll = process.argv.includes('--all')
const targets = resetAll
  ? [...transactionCollections, ...masterCollections]
  : transactionCollections

async function main() {
  const connection = await mongoose
    .createConnection(MONGO_URL, { serverSelectionTimeoutMS: 8000 })
    .asPromise()

  const names = new Set(
    (await connection.db.listCollections().toArray()).map((item) => item.name),
  )

  console.log(`Database: ${connection.db.databaseName}`)
  console.log(`Mode: ${resetAll ? 'transactional + master data' : 'transactional data only'}`)

  for (const name of targets) {
    const count = names.has(name)
      ? await connection.db.collection(name).countDocuments()
      : 0
    console.log(`  ${name}: ${count} document(s)`)
  }

  if (!confirmed) {
    console.log(
      '\nยังไม่ลบข้อมูลใด ๆ — เติม --yes เพื่อยืนยัน เช่น npm run reset-db -- --yes',
    )
    await connection.close()
    return
  }

  for (const name of targets) {
    if (!names.has(name)) continue
    const result = await connection.db.collection(name).deleteMany({})
    console.log(`  cleared ${name}: ${result.deletedCount} document(s)`)
  }

  if (resetAll) {
    console.log('\nหมายเหตุ: server จะ seed admin/admin ใหม่อัตโนมัติเมื่อเริ่มทำงาน (ถ้า users ว่าง)')
  }

  console.log('\nReset complete.')
  await connection.close()
}

main().catch((error) => {
  console.error('reset-db failed:', error.message)
  process.exitCode = 1
})
