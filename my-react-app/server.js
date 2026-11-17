/**
 * Fixture Management MM — API server
 * ------------------------------------------------------------
 * Source of truth: Fixture MM.drawio (flow + schema)
 *
 * Flow:
 *   Register -> Input Fixture Information -> If Exist / Not Exist
 *   Request (Change Model | Breakdown) -> MainLine / Rotor -> Line / Model / Step / Fixture List
 *     -> Compare Model A->B -> Summary Issue/Return
 *     -> Fixture Room Prepare Fixture -> ME/TE confirm recieved -> Record History -> Done
 *     -> ME/TE Return Fixture -> Fixture confirm returned -> Record History
 *     -> Breakdown -> Verify / Issue Spare -> Fixture Room Prepare / Record Breakdown
 *   PM Checklist Phase 2: Pre-Alert -> Overdue 3 day remind / Current reach 80% remind
 *     -> Plan PM -> PM On Due / PM Over Due -> 4M (Not Over 7 Day) / Over 7 Day
 *     -> Management Approve / 4M +XX Days Management Assign
 *     -> PM & Maintenance -> Verify + Record
 *        OK -> Reset Due (Red) -> Auto Print Sticker -> Record History -> Done
 *        NG -> Need Scrape (Red) -> Need PR (Red) -> Already have PR (Yellow) -> New One Replacement
 *
 * Collections (drawio data model):
 *   users        { empId, pass, name, lastname, dept, status, request_id }
 *   fixturelist  { line, model, fixtureInfo[ { step, process, position,
 *                  sn { sn, status, type, storage,
 *                    usage{ current, max, exp, storage, currentModel, changeModel },
 *                    registered{ empId, name, lastname, date },
 *                    fixtureBase, revision } } ] }
 *   request      { request_id, line, model, type, status, desc,
 *                  requestInfo{}, acceptInfo{}, issueInfo{}, verifyInfo{} }
 *   history      { sn, request_id, action, detail, ...person, date }
 */

import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const PORT = Number(process.env.PORT || 3000)
const MONGO_URL =
  process.env.MONGO_URL || 'mongodb://10.192.8.238:27017/Fixture_Management'

let fan2DbPromise = null
const getFan2Db = async () => {
  if (!fan2DbPromise) {
    fan2DbPromise = mongoose.createConnection(process.env.FAN2_MONGO_URL || 'mongodb://10.192.8.238:27017/FAN2', { serverSelectionTimeoutMS: 8000 }).asPromise().then((conn) => conn.db)
  }
  return fan2DbPromise
}

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '25mb' }))
app.use(cors())

/* Uploaded 4M / PM documents */
const uploadsDir = path.join(__dirname, 'uploads')
const pmUploadsDir = path.join(uploadsDir, 'pm')
fs.mkdirSync(pmUploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, pmUploadsDir),
    filename: (_req, file, cb) => {
      const safe = path.basename(file.originalname || 'document').replace(/[^\w.-]+/g, '_')
      cb(null, `${Date.now()}-${safe}`)
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
})

/* ------------------------------------------------------------------ */
/* Mongo connection                                                    */
/* ------------------------------------------------------------------ */

mongoose
  .connect(MONGO_URL, { serverSelectionTimeoutMS: 8000 })
  .then(async () => {
    console.log('[mongo] Fixture_Management connected')
    await seedAdmin()
  })
  .catch((err) => console.error('[mongo] Fixture_Management error:', err.message))

/* ------------------------------------------------------------------ */
/* Schemas & models (field names exactly per drawio schema)            */
/* ------------------------------------------------------------------ */

const personSchema = {
  empId: String,
  name: String,
  lastname: String,
  date: Date,
}

/* users { empId, pass, name, lastname, dept:string, status:string, request_id:string } */
const userSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, index: true },
    pass: { type: String, required: true },
    name: String,
    lastname: String,
    dept: { type: String, default: '' },
    status: { type: String, default: 'Pending', index: true },
    request_id: { type: String, default: '' },
  },
  { versionKey: false },
)
const User = mongoose.model('User', userSchema, 'users')

/* fixtureDetail { sn, status, type, usage, registered, fixtureBase, revision } */
const fixtureDetailSchema = new mongoose.Schema(
  {
    sn: { type: String, required: true, unique: true, index: true },
    status: { type: String, default: 'In Stock', index: true },
    type: String,
    usage: {
      current: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      exp: String,
      storage: String,
      currentModel: String,
      changeModel: String,
    },
    registered: personSchema,
    fixtureBase: String,
    revision: { type: String, default: '' },
    pmDate: { type: String, default: '' },
  },
  { versionKey: false },
)
const FixtureDetail = mongoose.model('FixtureDetail', fixtureDetailSchema, 'fixtureDetail')

/* fixtureList { line, model, fixtureInfo[ { step, process, position, count, sn: [String] } ] }
 * count = จำนวนที่ใช้จริงต่อ fixture base (ค่ามาตรฐานจาก Excel)
 *         SN ที่ลงทะเบียนจริงอาจมีมากกว่าค่านี้ */
const fixtureListSchema = new mongoose.Schema(
  {
    line: { type: String, index: true, required: true },
    model: { type: String, index: true, required: true },
    fixtureInfo: {
      type: [
        new mongoose.Schema(
          {
            step: String,
            process: String,
            position: String,
            count: { type: Number, default: 0 },
            sn: { type: [String], default: [] },
          },
          { _id: false, versionKey: false },
        ),
      ],
      default: [],
    },
  },
  { versionKey: false },
)
const FixtureList = mongoose.model('FixtureList', fixtureListSchema, 'fixtureList')

/* storages { location, desc } */
const storageSchema = new mongoose.Schema(
  {
    location: { type: String, required: true, index: true },
    desc: { type: String, default: '' },
  },
  { versionKey: false },
)
const Storage = mongoose.model('Storage', storageSchema, 'storages')

/* request { request_id, line, model, type, status, desc, requestInfo, acceptInfo, issueInfo, verifyInfo } */
const requestSchema = new mongoose.Schema(
  {
    request_id: { type: String, index: true, unique: true, required: true },
    line: { type: String, index: true },
    model: String,
    modelTo: String,
    type: { type: String, index: true },
    status: { type: String, default: 'Waiting', index: true },
    desc: { type: String, default: '' },
    requestInfo: personSchema,
    acceptInfo: personSchema,
    issueInfo: personSchema,
    verifyInfo: personSchema,
    requestTime: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
)
const Request = mongoose.model('Request', requestSchema, 'request')

/* History — "Record History" step of every branch */
const historySchema = new mongoose.Schema(
  {
    sn: { type: String, index: true, default: '' },
    request_id: { type: String, index: true, default: '' },
    action: { type: String, index: true },
    detail: { type: String, default: '' },
    line: String,
    model: String,
    empId: String,
    name: String,
    lastname: String,
    date: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
)
const History = mongoose.model('History', historySchema, 'history')

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const text = (value) => (typeof value === 'string' ? value.trim() : value)

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next)

const todayStamp = () => {
  const now = new Date()
  const y = String(now.getFullYear()).slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

const daysUntil = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

const personFrom = (user) => ({
  empId: user?.userId || user?.empId || '',
  name: user?.name || '',
  lastname: user?.lastName || user?.lastname || '',
  date: new Date(),
})

const recordHistory = (entry, user, extra = {}) =>
  History.create({
    sn: entry.sn || '',
    request_id: entry.request_id || '',
    action: entry.action,
    detail: entry.detail || '',
    line: entry.line || '',
    model: entry.model || '',
    empId: user?.userId || user?.empId || '',
    name: user?.name || '',
    lastname: user?.lastName || user?.lastname || '',
    ...extra,
  })

const findFixture = async (sn) => {
  const detail = await FixtureDetail.findOne({ sn }).lean()
  if (!detail) return null
  const doc = await FixtureList.findOne({ 'fixtureInfo.sn': sn }).lean()
  let step = ''
  let process = ''
  let position = ''
  if (doc) {
    const info = (doc.fixtureInfo || []).find((item) => (item.sn || []).includes(sn))
    if (info) {
      step = info.step || ''
      process = info.process || ''
      position = info.position || ''
    }
  }
  return {
    ...detail,
    line: doc?.line || '',
    model: doc?.model || '',
    step,
    process,
    position,
  }
}

const updateFixtureBySn = async (sn, set) => {
  if (!set || Object.keys(set).length === 0) return false
  const result = await FixtureDetail.updateOne({ sn }, { $set: set })
  return result.matchedCount > 0
}

const updateFixtureInfoBySn = async (sn, set) => {
  if (!set || Object.keys(set).length === 0) return false
  const doc = await FixtureList.findOne({ 'fixtureInfo.sn': sn })
  if (!doc) return false
  const index = (doc.fixtureInfo || []).findIndex((item) => (item.sn || []).includes(sn))
  if (index < 0) return false
  const update = {}
  for (const [key, value] of Object.entries(set)) {
    update[`fixtureInfo.${index}.${key}`] = value
  }
  const result = await FixtureList.updateOne({ _id: doc._id }, { $set: update })
  return result.matchedCount > 0
}

const flattenFixtures = async ({ line, model, status } = {}) => {
  const match = {}
  if (line) match.line = line
  if (model) match.model = model
  const lists = await FixtureList.find(match).lean()
  const snSet = new Set()
  for (const doc of lists) {
    for (const info of doc.fixtureInfo || []) {
      for (const s of info.sn || []) snSet.add(s)
    }
  }
  const details = await FixtureDetail.find({ sn: { $in: [...snSet] } }).lean()
  const detailMap = new Map(details.map((d) => [d.sn, d]))
  const result = []
  for (const doc of lists) {
    for (const info of doc.fixtureInfo || []) {
      for (const s of info.sn || []) {
        const detail = detailMap.get(s)
        if (!detail) continue
        if (status && !String(status).split(',').includes(detail.status)) continue
        result.push({
          ...detail,
          line: doc.line,
          model: doc.model,
          step: info.step || '',
          process: info.process || '',
          position: info.position || '',
        })
      }
    }
  }
  return result
}


/* PM Checklist Phase 2 state machine (per flow diagram) */
const pmStateOf = (fixture) => {
  const usage = fixture.usage || {}
  const days = daysUntil(usage.exp)
  const max = Number(usage.max) || 0
  const current = Number(usage.current) || 0
  const ratio = max > 0 ? current / max : null

  const states = []
  if (days !== null) {
    if (days > 7) states.push('tracked')
    else if (days > 0) states.push('pre-alert')
    else if (days === 0) states.push('on-due')
    else if (days >= -3) states.push('overdue-remind')
    else states.push('over-due')
  }
  if (ratio !== null && ratio >= 0.8) states.push('usage-remind')
  if (states.length === 0) states.push('tracked')
  return states
}

const statusOfUser = (user) => String(user?.status || '')
const isApproved = (user) => /approved|admin/i.test(statusOfUser(user))
const isAdmin = (user) => /admin/i.test(statusOfUser(user))

async function seedAdmin() {
  const count = await User.countDocuments()
  if (count > 0) return
  await User.create({
    empId: 'admin',
    pass: 'admin',
    name: 'Administrator',
    lastname: '',
    dept: 'System',
    status: 'Admin',
    request_id: '',
  })
  console.log('[seed] default admin created (admin / admin)')
}

/* ------------------------------------------------------------------ */
/* Auth + users                                                        */
/* ------------------------------------------------------------------ */

app.post(
  '/api/login',
  asyncRoute(async (req, res) => {
    const empId = text(req.body?.empId ?? req.body?.username)
    const pass = req.body?.pass ?? req.body?.password

    if (!empId || !pass) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก Emp ID และ Password' })
    }

    const user = await User.findOne({ $or: [{ empId }, { username: empId }], pass }).lean()
    if (!user) {
      return res.status(401).json({ success: false, message: 'Emp ID หรือ Password ไม่ถูกต้อง' })
    }
    if (!isApproved(user)) {
      return res.status(403).json({
        success: false,
        message: 'บัญชีของคุณยังไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ',
      })
    }

    return res.json({
      success: true,
      name: user.name || '',
      userId: user.empId,
      lastName: user.lastname || '',
      dept: user.dept || '',
      status: user.status || '',
      requestId: user.request_id || '',
      role: isAdmin(user) ? 'admin' : '',
    })
  }),
)

app.post(
  '/api/register',
  asyncRoute(async (req, res) => {
    const empId = text(req.body?.empId)
    const username = text(req.body?.username || req.body?.user)
    const pass = req.body?.pass
    const name = text(req.body?.name)
    const lastname = text(req.body?.lastname)
    const dept = text(req.body?.dept ?? req.body?.department)

    if (!empId || !pass || !name) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก Emp ID, ชื่อ และ Password' })
    }

    const exists = await User.findOne({ empId }).lean()
    if (exists) {
      return res.status(409).json({ success: false, message: 'Emp ID นี้ถูกใช้งานแล้ว' })
    }
    if (username) {
      const taken = await User.findOne({ username }).lean()
      if (taken) {
        return res.status(409).json({ success: false, message: 'Username นี้ถูกใช้งานแล้ว' })
      }
    }

    await User.create({
      empId,
      username: username || '',
      pass,
      name,
      lastname: lastname || '',
      dept: dept || '',
      status: 'Pending',
      request_id: '',
    })

    return res.json({ success: true, message: 'Register Success! รอผู้ดูแลระบบอนุมัติ' })
  }),
)

app.get(
  '/api/me',
  asyncRoute(async (req, res) => {
    const empId = text(req.query.empId ?? req.query.userId)
    if (!empId) return res.status(400).json({ success: false, message: 'Missing empId' })
    const user = await User.findOne({ empId }).lean()
    if (!user) return res.status(404).json({ success: false, message: 'User not found' })
    return res.json({
      success: true,
      user: {
        empId: user.empId,
        name: user.name,
        lastname: user.lastname,
        dept: user.dept,
        status: user.status,
        request_id: user.request_id,
      },
    })
  }),
)

app.get(
  '/api/users',
  asyncRoute(async (_req, res) => {
    const users = await User.find({}, '-pass').sort({ empId: 1 }).lean()
    res.json(users)
  }),
)

app.put(
  '/api/users/:id',
  asyncRoute(async (req, res) => {
    const { status, dept } = req.body || {}
    const set = {}
    if (status !== undefined) set.status = text(status)
    if (dept !== undefined) set.dept = text(dept)
    if (Object.keys(set).length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลที่ต้องการแก้ไข' })
    }
    const user = await User.findByIdAndUpdate(req.params.id, { $set: set }, { returnDocument: 'after' }).lean()
    if (!user) return res.status(404).json({ success: false, message: 'User not found' })
    res.json({ success: true, user })
  }),
)

app.delete(
  '/api/users/:id',
  asyncRoute(async (req, res) => {
    const user = await User.findByIdAndDelete(req.params.id).lean()
    if (!user) return res.status(404).json({ success: false, message: 'User not found' })
    res.json({ success: true })
  }),
)

/* ------------------------------------------------------------------ */
/* Fixture list / fixtures                                             */
/* ------------------------------------------------------------------ */

app.get(
  '/api/fixturelist/options',
  asyncRoute(async (_req, res) => {
    const docs = await FixtureList.find({}, 'line model').lean()
    const lines = [...new Set(docs.map((doc) => doc.line).filter(Boolean))].sort()
    const models = [...new Set(docs.map((doc) => doc.model).filter(Boolean))].sort()
    res.json({ lines, models })
  }),
)

/* Raw fixturelist documents (nested fixtureInfo) for the Fixture List page */
app.get(
  '/api/fixturelist',
  asyncRoute(async (req, res) => {
    const filter = {}
    if (req.query.line) filter.line = text(req.query.line)
    if (req.query.model) filter.model = text(req.query.model)
    const docs = await FixtureList.find(filter).sort({ line: 1, model: 1 }).lean()
    res.json(docs)
  }),
)

/* Batch import / update fixturelist from Excel rows */
app.post(
  '/api/fixturelist/import',
  asyncRoute(async (req, res) => {
    const list = Array.isArray(req.body?.items) ? req.body.items : []
    if (!list.length) {
      return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลสำหรับ Import' })
    }

    let inserted = 0
    let updated = 0

    for (const item of list) {
      const line = text(item.line)
      const model = text(item.model)
      if (!line || !model) continue

      const fixtureInfo = (Array.isArray(item.fixtureInfo) ? item.fixtureInfo : [])
        .map((info) => {
          const count = Number(info?.count)
          return {
            step: text(info?.step) || '',
            process: text(info?.process) || '',
            position: text(info?.position) || '',
            count: Number.isFinite(count) && count > 0 ? count : 0,
            sn: (Array.isArray(info?.sn) ? info.sn : [])
              .map((sn) => text(sn))
              .filter(Boolean),
          }
        })
        .filter((info) => info.position)
      const existing = await FixtureList.findOne({ line, model })

      if (existing) {
        existing.fixtureInfo = fixtureInfo
        await existing.save()
        updated++
      } else {
        await FixtureList.create({ line, model, fixtureInfo })
        inserted++
      }
    }

    res.json({
      success: true,
      message: `นำเข้าข้อมูลเรียบร้อย: เพิ่มใหม่ ${inserted} รายการ, อัปเดต ${updated} รายการ`,
      inserted,
      updated,
    })
  }),
)

/* ------------------------------------------------------------------ */
/* Storages (Edit page — manage storage locations)                     */
/* ------------------------------------------------------------------ */

app.get(
  '/api/storages',
  asyncRoute(async (_req, res) => {
    const data = await Storage.find({}).sort({ location: 1 }).lean()
    res.json(data)
  }),
)

app.post(
  '/api/storages',
  asyncRoute(async (req, res) => {
    const location = text(req.body?.location ?? req.body?.storageLocation ?? req.body?.storage)
    const desc = text(req.body?.desc ?? req.body?.description) || ''
    if (!location) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ Storage Location' })
    }
    const exists = await Storage.findOne({ location }).lean()
    if (exists) {
      return res.status(409).json({ success: false, message: 'Storage นี้มีอยู่แล้ว', storage: exists })
    }
    const storage = await Storage.create({ location, desc })
    res.json({ success: true, storage })
  }),
)

app.put(
  '/api/storages/:id',
  asyncRoute(async (req, res) => {
    const set = {}
    if (req.body?.location !== undefined || req.body?.storageLocation !== undefined) set.location = text(req.body.location ?? req.body.storageLocation)
    if (req.body?.desc !== undefined || req.body?.description !== undefined) set.desc = text(req.body.desc ?? req.body.description)
    if (Object.keys(set).length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลที่ต้องการแก้ไข' })
    }
    const storage = await Storage.findByIdAndUpdate(req.params.id, { $set: set }, { returnDocument: 'after' }).lean()
    if (!storage) return res.status(404).json({ success: false, message: 'Storage not found' })
    res.json({ success: true, storage })
  }),
)

app.delete(
  '/api/storages/:id',
  asyncRoute(async (req, res) => {
    const storage = await Storage.findByIdAndDelete(req.params.id).lean()
    if (!storage) return res.status(404).json({ success: false, message: 'Storage not found' })
    res.json({ success: true })
  }),
)

/* FAN2 external data (Location / ModelNEW) for Register dropdowns */
app.get(
  '/api/fan2/locations',
  asyncRoute(async (_req, res) => {
    const db = await getFan2Db()
    const docs = await db.collection('Location').find({}, { projection: { location: 1 } }).toArray()
    const locations = [...new Set(docs.map((d) => text(d.location)).filter(Boolean))].sort()
    res.json(locations)
  }),
)

app.get(
  '/api/fan2/models',
  asyncRoute(async (_req, res) => {
    const db = await getFan2Db()
    const docs = await db.collection('ModelNEW').find({}, { projection: { model: 1 } }).toArray()
    const models = [...new Set(docs.map((d) => text(d.model)).filter(Boolean))].sort()
    res.json(models)
  }),
)

/* Fixture KPI counts (source of truth: fixtureDetail) */
app.get(
  '/api/fixture-stats',
  asyncRoute(async (_req, res) => {
    const [total, grouped] = await Promise.all([
      FixtureDetail.countDocuments({}),
      FixtureDetail.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ])
    const counts = {}
    for (const row of grouped) {
      counts[row._id || 'Unknown'] = row.count
    }
    res.json({ total, counts })
  }),
)

/* All fixture details (fixtureDetail is the source of truth for every fixture) */
app.get(
  '/api/fixture-details',
  asyncRoute(async (_req, res) => {
    const rows = await FixtureDetail.find({}).lean()
    res.json(rows)
  }),
)

app.get(
  '/api/fixtures',
  asyncRoute(async (req, res) => {
    const { line, model, status, q } = req.query
    let data = await flattenFixtures({ line, model, status })
    if (q) {
      const needle = String(q).toLowerCase()
      data = data.filter((item) =>
        [item.sn, item.type, item.fixtureBase, item.usage?.storage, item.storage, item.model, item.line, item.process, item.position, item.revision, item.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle)),
      )
    }
    res.json(data)
  }),
)

app.get(
  '/api/fixtures/:sn',
  asyncRoute(async (req, res) => {
    const fixture = await findFixture(text(req.params.sn))
    if (!fixture) {
      return res.status(404).json({ success: false, message: 'ไม่พบ Serial Number นี้ในระบบ' })
    }
    res.json({ success: true, fixture })
  }),
)

/* Register -> Input Fixture Information -> If Exist / Not Exist */
app.post(
  '/api/fixtures',
  asyncRoute(async (req, res) => {
    const body = req.body || {}
    const sn = text(body.sn)
    const line = text(body.line)
    const model = text(body.model)

    if (!sn || !line || !model) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก SN, Line และ Model' })
    }

    // If Exist
    const exists = await findFixture(sn)
    if (exists) {
      return res.status(409).json({
        success: false,
        message: `Serial Number ${sn} มีในระบบแล้ว (If Exist)`,
        fixture: exists,
      })
    }

    // Not Exist -> create fixtureDetail + add sn to fixtureList
    await FixtureDetail.create({
      sn,
      status: text(body.status) || 'In Stock',
      type: text(body.type) || '',
      usage: {
        current: Number(body.current) || 0,
        max: Number(body.max) || 0,
        exp: body.exp || '',
        storage: text(body.usageStorage || body.storage) || '',
        currentModel: text(body.currentModel) || model,
        changeModel: text(body.changeModel) || '',
      },
      registered: personFrom(body.user || {}),
      fixtureBase: text(body.fixtureBase) || sn.split('-')[0] || '',
      revision: text(body.revision) || '',
      pmDate: text(body.pmDate) || '',
    })

    const step = text(body.step) || ''
    const process = text(body.process) || ''
    const position = text(body.position) || ''

    const doc = await FixtureList.findOne({ line, model })
    if (doc) {
      const info = (doc.fixtureInfo || []).find(
        (item) => item.step === step && item.process === process && item.position === position,
      )
      if (info) {
        if (!info.sn.includes(sn)) info.sn.push(sn)
      } else {
        doc.fixtureInfo.push({ step, process, position, sn: [sn] })
      }
      await doc.save()
    } else {
      await FixtureList.create({ line, model, fixtureInfo: [{ step, process, position, sn: [sn] }] })
    }

    await recordHistory(
      { sn, action: 'Register', detail: `ลงทะเบียนใหม่ ${line} · ${model}`, line, model },
      body.user,
    )
    return res.json({ success: true, message: `ลงทะเบียน ${sn} สำเร็จ (Not Exist)`, sn })
  }),
)

/* Edit page — update fixtureInfo + sn fields */
app.put(
  '/api/fixtures/:sn',
  asyncRoute(async (req, res) => {
    const sn = text(req.params.sn)
    const body = req.body || {}
    const fixture = await findFixture(sn)
    if (!fixture) {
      return res.status(404).json({ success: false, message: 'ไม่พบ Serial Number นี้ในระบบ' })
    }

    const set = {}
    for (const key of ['status', 'type', 'fixtureBase', 'revision', 'pmDate']) {
      if (body[key] !== undefined) set[key] = body[key]
    }
    if (body.storage !== undefined && body.usage?.storage === undefined) {
      set['usage.storage'] = body.storage
    }
    if (body.registeredDate !== undefined) {
      set['registered.date'] = body.registeredDate ? new Date(body.registeredDate) : null
    }
    if (body.registered && typeof body.registered === 'object') {
      for (const key of ['empId', 'name', 'lastname']) {
        if (body.registered[key] !== undefined) set[`registered.${key}`] = body.registered[key]
      }
      if (body.registered.date !== undefined) {
        set['registered.date'] = body.registered.date ? new Date(body.registered.date) : null
      }
    }
    if (body.usage && typeof body.usage === 'object') {
      for (const key of ['current', 'max', 'exp', 'storage', 'currentModel', 'changeModel']) {
        if (body.usage[key] !== undefined) set[`usage.${key}`] = body.usage[key]
      }
    }

    const infoSet = {}
    for (const key of ['step', 'process', 'position']) {
      if (body[key] !== undefined) infoSet[key] = body[key]
    }

    await updateFixtureBySn(sn, set)
    await updateFixtureInfoBySn(sn, infoSet)

    await recordHistory(
      {
        sn,
        action: 'Edit',
        detail: 'แก้ไขข้อมูล Fixture',
        line: fixture.line,
        model: fixture.model,
      },
      body.user,
    )

    const updated = await findFixture(sn)
    return res.json({ success: true, fixture: updated })
  }),
)

app.delete(
  '/api/fixtures/:sn',
  asyncRoute(async (req, res) => {
    const sn = text(req.params.sn)
    const fixture = await findFixture(sn)
    if (!fixture) {
      return res.status(404).json({ success: false, message: 'ไม่พบ Serial Number นี้ในระบบ' })
    }
    await FixtureDetail.deleteOne({ sn })
      await FixtureList.updateMany({ 'fixtureInfo.sn': sn }, { $pull: { 'fixtureInfo.$[].sn': sn } })
      await FixtureList.updateMany({}, { $pull: { fixtureInfo: { sn: { $size: 0 } } } })
      await FixtureList.deleteMany({ fixtureInfo: { $size: 0 } })
    await recordHistory(
      { sn, action: 'Delete', detail: 'ลบ Fixture ออกจากระบบ', line: fixture.line, model: fixture.model },
      req.body?.user,
    )
    return res.json({ success: true })
  }),
)

/* Compare Model A -> B (Change Model)
 * เทียบ fixturelist ของ model เดิมกับ model ใหม่ทีละ position
 * issue  = SN ที่มีใน model ใหม่ แต่ยังไม่มีใน model เดิม -> ต้องเตรียม/เบิก
 * return = SN ที่มีใน model เดิม แต่ไม่ใช้ใน model ใหม่ -> ต้องคืน
 * keep   = SN ที่ใช้ร่วมกันทั้งสอง model -> ใช้ต่อได้
 */
app.get(
  '/api/fixturelist/compare',
  asyncRoute(async (req, res) => {
    const line = text(req.query.line)
    const from = text(req.query.from)
    const to = text(req.query.to)
    if (!line || !from || !to) {
      return res.status(400).json({ success: false, message: 'ต้องระบุ line, from และ to' })
    }

    const [fromDoc, toDoc] = await Promise.all([
      FixtureList.findOne({ line, model: from }).lean(),
      FixtureList.findOne({ line, model: to }).lean(),
    ])

    const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()

    const collect = (doc) => {
      const map = new Map()
      for (const info of doc?.fixtureInfo || []) {
        const key = norm(info.position)
        if (!key) continue
        if (!map.has(key)) {
          map.set(key, {
            position: String(info.position || '').trim(),
            process: String(info.process || '').trim(),
            count: 0,
            sn: new Set(),
          })
        }
        const bucket = map.get(key)
        if (!bucket.process && info.process) bucket.process = String(info.process).trim()
        const count = Number(info.count) || 0
        if (count > bucket.count) bucket.count = count
        for (const sn of info.sn || []) if (sn) bucket.sn.add(String(sn))
      }
      return map
    }

    const fromMap = collect(fromDoc)
    const toMap = collect(toDoc)

    const flattenSn = (map) => {
      const out = []
      for (const bucket of map.values()) {
        for (const sn of bucket.sn) {
          out.push({ sn, position: bucket.position, process: bucket.process, count: bucket.count })
        }
      }
      return out
    }

    const fromItems = flattenSn(fromMap)
    const toItems = flattenSn(toMap)
    const fromSns = new Set(fromItems.map((item) => item.sn))
    const toSns = new Set(toItems.map((item) => item.sn))

    const byPosition = (a, b) =>
      a.position.localeCompare(b.position, 'en') || a.sn.localeCompare(b.sn, 'en')

    const issue = toItems.filter((item) => !fromSns.has(item.sn)).sort(byPosition)
    const returnList = fromItems.filter((item) => !toSns.has(item.sn)).sort(byPosition)
    const keep = toItems.filter((item) => fromSns.has(item.sn)).sort(byPosition)

    res.json({
      success: true,
      line,
      from,
      to,
      issue,
      return: returnList,
      keep,
      total: { issue: issue.length, return: returnList.length, keep: keep.length },
      missing: { from: !fromDoc, to: !toDoc },
    })
  }),
)

/* ------------------------------------------------------------------ */
/* Request / Order pipeline                                            */
/* ------------------------------------------------------------------ */

app.get(
  '/api/requests',
  asyncRoute(async (req, res) => {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.type) filter.type = req.query.type
    if (req.query.empId) filter['requestInfo.empId'] = req.query.empId
    const data = await Request.find(filter).sort({ requestTime: -1 }).lean()
    res.json(data)
  }),
)

app.get(
  '/api/requests/:requestId',
  asyncRoute(async (req, res) => {
    const request = await Request.findOne({ request_id: text(req.params.requestId) }).lean()
    if (!request) return res.status(404).json({ success: false, message: 'ไม่พบคำขอนี้' })
    res.json({ success: true, request })
  }),
)

app.post(
  '/api/requests',
  asyncRoute(async (req, res) => {
    const body = req.body || {}
    const type = text(body.type)
    const line = text(body.line)
    const model = text(body.model)

    if (!type || !line) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุประเภทคำขอและ Line' })
    }

    const stamp = todayStamp()
    const todayCount = await Request.countDocuments({
      request_id: new RegExp(`^REQ${stamp}`),
    })
    const request_id = `REQ${stamp}${String(todayCount + 1).padStart(3, '0')}`

    const desc = text(body.desc) || (type === 'Change Model' && body.modelTo ? `${model} → ${text(body.modelTo)}` : '')

    const request = await Request.create({
      request_id,
      line,
      model: model || '',
      modelTo: text(body.modelTo) || '',
      type,
      status: 'Waiting',
      desc,
      requestInfo: personFrom(body.user || {}),
    })

    /* users.request_id — request that this user is currently driving */
    const empId = body.user?.userId || body.user?.empId
    if (empId) {
      await User.updateOne({ empId }, { $set: { request_id } })
    }

    await recordHistory(
      {
        request_id,
        action: 'Request',
        detail: `${type}${model ? ` · ${model}` : ''}`,
        line,
        model,
      },
      body.user,
    )

    return res.json({ success: true, request_id, request })
  }),
)

/* Accept (Fixture Room accepts the job) */
app.put(
  '/api/requests/:requestId/accept',
  asyncRoute(async (req, res) => {
    const request = await Request.findOne({ request_id: text(req.params.requestId) })
    if (!request) return res.status(404).json({ success: false, message: 'ไม่พบคำขอนี้' })
    if (request.status !== 'Waiting') {
      return res.status(409).json({ success: false, message: 'คำขอนี้ได้รับการยืนยันแล้ว' })
    }

    request.acceptInfo = personFrom(req.body?.user || {})
    request.status = 'Accepted'
    await request.save()

    await recordHistory(
      {
        request_id: request.request_id,
        action: 'Accept',
        detail: `รับคำขอ ${request.type}`,
        line: request.line,
        model: request.model,
      },
      req.body?.user,
    )
    return res.json({ success: true, request })
  }),
)

/* Issue (Fixture Room Prepare Fixture + ME/TE confirm recieved) */
app.put(
  '/api/requests/:requestId/issue',
  asyncRoute(async (req, res) => {
    const request = await Request.findOne({ request_id: text(req.params.requestId) })
    if (!request) return res.status(404).json({ success: false, message: 'ไม่พบคำขอนี้' })
    if (request.status !== 'Accepted' && request.status !== 'Waiting') {
      return res.status(409).json({ success: false, message: 'คำขอนี้จ่ายของไปแล้ว' })
    }

    const items = Array.isArray(req.body?.items) ? req.body.items.map(text).filter(Boolean) : []
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือก Fixture ที่จะจ่าย' })
    }

    for (const sn of items) {
      const fixture = await findFixture(sn)
      if (!fixture) {
        return res.status(404).json({ success: false, message: `ไม่พบ ${sn} ในระบบ` })
      }
      await updateFixtureBySn(sn, {
        status: 'In Use',
        'usage.current': (Number(fixture.usage?.current) || 0) + 1,
        ...(request.type === 'Change Model'
          ? { 'usage.changeModel': request.modelTo, 'usage.currentModel': request.model || fixture.model }
          : {}),
      })
      await recordHistory(
        {
          sn,
          request_id: request.request_id,
          action: 'Issue',
          detail: `จ่ายตามคำขอ ${request.request_id} (${request.type})`,
          line: request.line,
          model: request.model,
        },
        req.body?.user,
      )
    }

    request.items = items
    request.issueInfo = personFrom(req.body?.user || {})
    request.status = 'Issued'
    await request.save()

    return res.json({ success: true, request })
  }),
)

/* Breakdown: Verify -> PM & Maintenance / Issue Spare / Record Breakdown */
app.put(
  '/api/requests/:requestId/breakdown',
  asyncRoute(async (req, res) => {
    const request = await Request.findOne({ request_id: text(req.params.requestId) })
    if (!request) return res.status(404).json({ success: false, message: 'ไม่พบคำขอนี้' })
    if (request.type !== 'Breakdown') {
      return res.status(400).json({ success: false, message: 'ใช้กับคำขอ Breakdown เท่านั้น' })
    }
    if (request.status !== 'Accepted' && request.status !== 'Waiting') {
      return res.status(409).json({ success: false, message: 'คำขอนี้ดำเนินการไปแล้ว' })
    }

    const action = text(req.body?.action)
    const sn = text(req.body?.sn)

    if (action === 'Maintenance') {
      if (!sn) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุ SN ของ Fixture ที่เสีย' })
      }
      const fixture = await findFixture(sn)
      if (!fixture) {
        return res.status(404).json({ success: false, message: `ไม่พบ ${sn} ในระบบ` })
      }
      await updateFixtureBySn(sn, { status: 'Maintenance' })
      await recordHistory(
        {
          sn,
          request_id: request.request_id,
          action: 'Breakdown',
          detail: `ส่งซ่อม (${request.request_id})`,
          line: request.line,
          model: request.model,
        },
        req.body?.user,
      )
      request.items = [sn]
    } else if (action === 'Issue Spare') {
      if (!sn) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุ SN ของ Spare ที่จะจ่าย' })
      }
      const fixture = await findFixture(sn)
      if (!fixture) {
        return res.status(404).json({ success: false, message: `ไม่พบ ${sn} ในระบบ` })
      }
      if (fixture.status !== 'In Stock') {
        return res.status(409).json({
          success: false,
          message: `${sn} ไม่ได้อยู่ในสถานะ In Stock (ปัจจุบัน: ${fixture.status})`,
        })
      }
      await updateFixtureBySn(sn, {
        status: 'In Use',
        'usage.current': (Number(fixture.usage?.current) || 0) + 1,
      })
      await recordHistory(
        {
          sn,
          request_id: request.request_id,
          action: 'Issue Spare',
          detail: `จ่าย Spare ตามคำขอ Breakdown ${request.request_id}`,
          line: request.line,
          model: request.model,
        },
        req.body?.user,
      )
      request.items = [sn]
    } else {
      return res.status(400).json({ success: false, message: 'action ต้องเป็น Maintenance หรือ Issue Spare' })
    }

    request.action = action
    request.issueInfo = personFrom(req.body?.user || {})
    request.status = 'Issued'
    await request.save()

    return res.json({ success: true, request })
  }),
)

/* Verify (ME/TE confirm recieved -> Record History -> Done) */
app.put(
  '/api/requests/:requestId/verify',
  asyncRoute(async (req, res) => {
    const request = await Request.findOne({ request_id: text(req.params.requestId) })
    if (!request) return res.status(404).json({ success: false, message: 'ไม่พบคำขอนี้' })
    if (request.status !== 'Issued') {
      return res.status(409).json({ success: false, message: 'คำขอนี้ยังไม่ได้จ่ายของ' })
    }

    for (const sn of request.items || []) {
      if (request.type === 'Change Model' && request.modelTo) {
        await updateFixtureBySn(sn, {
          'usage.currentModel': request.modelTo,
          'usage.changeModel': '',
        })
      }
      await recordHistory(
        {
          sn,
          request_id: request.request_id,
          action: 'Verify',
          detail: `ME/TE ยืนยันรับของ ปิดคำขอ ${request.request_id}`,
          line: request.line,
          model: request.model,
        },
        req.body?.user,
      )
    }

    request.verifyInfo = personFrom(req.body?.user || {})
    request.status = 'Done'
    await request.save()

    return res.json({ success: true, request })
  }),
)

app.delete(
  '/api/requests/:requestId',
  asyncRoute(async (req, res) => {
    const request = await Request.findOneAndDelete({ request_id: text(req.params.requestId) })
    if (!request) return res.status(404).json({ success: false, message: 'ไม่พบคำขอนี้' })
    res.json({ success: true })
  }),
)

/* ------------------------------------------------------------------ */
/* Return (ME/TE Return Fixture -> Fixture confirm returned)           */
/* ------------------------------------------------------------------ */

app.get(
  '/api/return',
  asyncRoute(async (_req, res) => {
    const fixtures = await flattenFixtures({ status: 'In Use,Maintenance' })
    res.json(fixtures)
  }),
)

app.post(
  '/api/return',
  asyncRoute(async (req, res) => {
    const sn = text(req.body?.sn)
    const target = req.body?.target === 'Maintenance' ? 'Maintenance' : 'In Stock'

    if (!sn) return res.status(400).json({ success: false, message: 'กรุณาระบุ Serial Number' })

    const fixture = await findFixture(sn)
    if (!fixture) {
      return res.status(404).json({ success: false, message: 'ไม่พบ Serial Number นี้ในระบบ' })
    }
    if (fixture.status === 'In Stock') {
      return res.status(409).json({
        success: false,
        message: 'Fixture นี้อยู่ใน Stock อยู่แล้ว',
        fixture,
      })
    }

    await updateFixtureBySn(sn, {
      status: target,
      'usage.currentModel': '',
      'usage.changeModel': '',
    })

    await recordHistory(
      {
        sn,
        request_id: text(req.body?.request_id) || '',
        action: 'Return',
        detail: `ME/TE Return Fixture — Fixture confirm returned → ${target}`,
        line: fixture.line,
        model: fixture.model,
      },
      req.body?.user,
    )

    return res.json({
      success: true,
      message: `คืน ${sn} เข้า ${target} สำเร็จ`,
      fixture: { ...fixture, status: target },
    })
  }),
)

/* ------------------------------------------------------------------ */
/* PM Checklist Phase 2                                                */
/* ------------------------------------------------------------------ */

app.get(
  '/api/pm',
  asyncRoute(async (_req, res) => {
    const fixtures = await flattenFixtures({ status: 'In Use,Maintenance' })
    const data = fixtures.map((fixture) => ({
      ...fixture,
      pmStates: pmStateOf(fixture),
      usagePercent:
        Number(fixture.usage?.max) > 0
          ? Math.round(((Number(fixture.usage?.current) || 0) / Number(fixture.usage?.max)) * 100)
          : null,
    }))
    res.json(data)
  }),
)

/* Plan PM -> PM & Maintenance */
app.post(
  '/api/pm/plan',
  asyncRoute(async (req, res) => {
    const sn = text(req.body?.sn)
    const fixture = await findFixture(sn)
    if (!fixture) return res.status(404).json({ success: false, message: 'ไม่พบ Serial Number นี้' })
    if (fixture.status === 'Maintenance') {
      return res.status(409).json({ success: false, message: 'Fixture นี้อยู่ใน Maintenance แล้ว' })
    }
    const pmDate = text(req.body?.date) || new Date().toISOString().slice(0, 10)
    const note = text(req.body?.note) || ''
    await updateFixtureBySn(sn, { status: 'Maintenance', pmDate })
    await recordHistory(
      {
        sn,
        action: 'Plan PM',
        detail: `Plan PM ${pmDate} → PM & Maintenance${note ? ` · ${note}` : ''}`,
        line: fixture.line,
        model: fixture.model,
      },
      req.body?.user,
    )
    return res.json({ success: true, pmDate, message: `ส่ง ${sn} เข้า PM & Maintenance (${pmDate})` })
  }),
)

/* Management Approve: 4M +XX Days */
app.post(
  '/api/pm/extend',
  asyncRoute(async (req, res) => {
    const sn = text(req.body?.sn)
    const days = Number(req.body?.days) || 0
    if (!sn || days <= 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ SN และจำนวนวัน' })
    }
    const fixture = await findFixture(sn)
    if (!fixture) return res.status(404).json({ success: false, message: 'ไม่พบ Serial Number นี้' })

    const formUrl = text(req.body?.formUrl) || ''
    const hasForm = Boolean(formUrl) || (Array.isArray(fixture.pmForms) && fixture.pmForms.length > 0)
    if (days > 7 && !hasForm) {
      return res.status(400).json({
        success: false,
        message: 'PM เกิน 7 วัน ต้อง Import เอกสาร 4M ก่อนอนุมัติ',
        need4M: true,
      })
    }

    const base = daysUntil(fixture.usage?.exp)
    const from = base !== null ? new Date(fixture.usage.exp) : new Date()
    const next = new Date(from)
    next.setDate(next.getDate() + days)
    const iso = next.toISOString().slice(0, 10)

    const set = { 'usage.exp': iso }
    if (formUrl) set.pmForms = [...(Array.isArray(fixture.pmForms) ? fixture.pmForms : []), formUrl]
    await updateFixtureBySn(sn, set)
    await recordHistory(
      {
        sn,
        action: '4M Approve',
        detail: `Management Approve · 4M +${days} Days (ถึง ${iso})${formUrl ? ' · แนบเอกสาร 4M' : ''}`,
        line: fixture.line,
        model: fixture.model,
      },
      req.body?.user,
    )
    return res.json({ success: true, exp: iso, message: `ขยาย PM ของ ${sn} ไปถึง ${iso}` })
  }),
)

/* Import 4M document (PDF / image) */
app.post(
  '/api/pm/forms',
  upload.single('file'),
  asyncRoute(async (req, res) => {
    const sn = text(req.body?.sn)
    const fixture = await findFixture(sn)
    if (!fixture) return res.status(404).json({ success: false, message: 'ไม่พบ Serial Number นี้' })
    if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์เอกสาร 4M' })

    const url = `/uploads/pm/${req.file.filename}`
    await updateFixtureBySn(sn, {
      pmForms: [...(Array.isArray(fixture.pmForms) ? fixture.pmForms : []), url],
    })
    await recordHistory(
      {
        sn,
        action: '4M Document',
        detail: `Import เอกสาร 4M: ${req.file.originalname}`,
        line: fixture.line,
        model: fixture.model,
      },
      req.body?.user,
    )
    return res.json({ success: true, url, originalName: req.file.originalname })
  }),
)

/* Over 7 Day -> 4M +XX Days Management Assign (QA, ME, TE, PD) */
app.post(
  '/api/pm/assign',
  asyncRoute(async (req, res) => {
    const sn = text(req.body?.sn)
    const assignees = Array.isArray(req.body?.assignees)
      ? req.body.assignees.map(text).filter(Boolean)
      : ['QA', 'ME', 'TE', 'PD']
    const days = Number(req.body?.days) || 0

    if (!sn) return res.status(400).json({ success: false, message: 'กรุณาระบุ SN' })
    const fixture = await findFixture(sn)
    if (!fixture) return res.status(404).json({ success: false, message: 'ไม่พบ Serial Number นี้' })

    const set = { status: 'Maintenance' }
    if (days > 0) {
      const from = fixture.usage?.exp ? new Date(fixture.usage.exp) : new Date()
      const next = new Date(from)
      next.setDate(next.getDate() + days)
      set['usage.exp'] = next.toISOString().slice(0, 10)
    }

    await updateFixtureBySn(sn, set)
    await recordHistory(
      {
        sn,
        action: '4M Assign',
        detail: `Management Assign (${assignees.join(', ')})${days ? ` +${days} Days` : ''}`,
        line: fixture.line,
        model: fixture.model,
      },
      req.body?.user,
    )
    return res.json({ success: true, message: `Assign ${sn} ให้ ${assignees.join(', ')} แล้ว` })
  }),
)

/* ------------------------------------------------------------------ */
/* PM & Maintenance -> Verify + Record                                 */
/* ------------------------------------------------------------------ */

app.get(
  '/api/maintenance',
  asyncRoute(async (_req, res) => {
    const queue = await flattenFixtures({ status: 'Maintenance' })
    res.json(queue)
  }),
)

/* Verify + Record: OK -> Reset Due (+ auto print sticker)
   NG -> Need Scrape -> Need PR -> Already have PR -> New One Replacement */
app.post(
  '/api/maintenance/verify',
  asyncRoute(async (req, res) => {
    const sn = text(req.body?.sn)
    const result = text(req.body?.result)
    const body = req.body || {}

    const fixture = await findFixture(sn)
    if (!fixture) return res.status(404).json({ success: false, message: 'ไม่พบ Serial Number นี้' })
    if (fixture.status !== 'Maintenance') {
      return res.status(409).json({
        success: false,
        message: `${sn} ไม่ได้อยู่ในคิว Maintenance (ปัจจุบัน: ${fixture.status})`,
      })
    }

    if (result === 'OK') {
      const newExp = text(body.newExp) || ''
      await updateFixtureBySn(sn, {
        status: 'In Use',
        'usage.exp': newExp,
        'usage.current': 0,
      })
      await recordHistory(
        {
          sn,
          action: 'PM OK',
          detail: `Verify + Record OK — Reset Due${newExp ? ` ถึง ${newExp}` : ''} · Auto Print Sticker`,
          line: fixture.line,
          model: fixture.model,
        },
        body.user,
      )
      return res.json({
        success: true,
        result: 'OK',
        fixture: await findFixture(sn),
        message: `PM ผ่าน — Reset Due ${newExp || '-'} และพิมพ์ sticker ให้แล้ว`,
      })
    }

    if (result === 'NG') {
      const outcome = text(body.outcome)
      const statusMap = {
        'Need Scrape': 'Scrape',
        'Need PR': 'PR',
        'Already have PR': 'PR Ready',
        'New One Replacement': 'Replaced',
      }
      if (!statusMap[outcome]) {
        return res.status(400).json({
          success: false,
          message: 'outcome ต้องเป็น Need Scrape / Need PR / Already have PR / New One Replacement',
        })
      }

      await updateFixtureBySn(sn, {
        status: statusMap[outcome],
        orderStatus: 'Pending',
        orderNote: outcome,
      })
      await recordHistory(
        {
          sn,
          action: 'PM NG',
          detail: `Verify + Record NG — ${outcome}`,
          line: fixture.line,
          model: fixture.model,
        },
        body.user,
      )
      return res.json({
        success: true,
        result: 'NG',
        outcome,
        fixture: await findFixture(sn),
        message:
          outcome === 'New One Replacement'
            ? `${sn} → New One Replacement — ไปที่ Order เพื่อลงทะเบียนตัวแทน`
            : `${sn} → ${outcome}`,
      })
    }

    return res.status(400).json({ success: false, message: 'result ต้องเป็น OK หรือ NG' })
  }),
)

/* ------------------------------------------------------------------ */
/* Order (NG chain: Scrape / PR / Already have PR / New One Replacement) */
/* ------------------------------------------------------------------ */

const ORDER_STATUSES = ['Scrape', 'PR', 'PR Ready', 'Replaced']

app.get(
  '/api/orders',
  asyncRoute(async (_req, res) => {
    const fixtures = await flattenFixtures({ status: ORDER_STATUSES.join(',') })
    res.json(fixtures)
  }),
)

app.post(
  '/api/orders/:sn/action',
  asyncRoute(async (req, res) => {
    const sn = text(req.params.sn)
    const action = text(req.body?.action)
    const fixture = await findFixture(sn)
    if (!fixture) return res.status(404).json({ success: false, message: 'ไม่พบ Serial Number นี้' })

    const transitions = {
      'Need PR': { status: 'PR', label: 'Need PR (Red color)' },
      'Already have PR': { status: 'PR Ready', label: 'Already have PR (Yellow)' },
      'New One Replacement': { status: 'Replaced', label: 'New One Replacement' },
      'Need Scrape': { status: 'Scrape', label: 'Need Scrape (Red color)' },
      Restock: { status: 'In Stock', label: 'Restock เข้า Stock' },
    }

    /* Order lifecycle: Accept / Reject / Hold -> Issue -> Verify */
    const lifecycle = {
      Accept: { orderStatus: 'Accepted', label: 'Accept' },
      Reject: { orderStatus: 'Rejected', label: 'Reject' },
      Hold: { orderStatus: 'Hold', label: 'Hold' },
      Issue: { orderStatus: 'Issued', label: 'Issue' },
      Verify: { orderStatus: 'Verified', status: 'In Stock', label: 'Verify' },
      Reopen: { orderStatus: 'Pending', label: 'Reopen' },
    }

    if (lifecycle[action]) {
      if (action === 'Issue' && !['Accepted', 'Hold'].includes(fixture.orderStatus)) {
        return res.status(409).json({
          success: false,
          message: `${sn} ต้องถูก Accept หรือ Hold ก่อน Issue (ปัจจุบัน: ${fixture.orderStatus || 'Pending'})`,
        })
      }
      if (action === 'Verify' && fixture.orderStatus !== 'Issued') {
        return res.status(409).json({
          success: false,
          message: `${sn} ต้องถูก Issue ก่อน Verify (ปัจจุบัน: ${fixture.orderStatus || 'Pending'})`,
        })
      }
      const nextLife = lifecycle[action]
      const set = { orderStatus: nextLife.orderStatus }
      if (nextLife.status) set.status = nextLife.status
      if (req.body?.note !== undefined) set.orderNote = text(req.body.note)
      await updateFixtureBySn(sn, set)
      await recordHistory(
        {
          sn,
          action: `Order ${action}`,
          detail: `${nextLife.label}${req.body?.note ? ` · ${text(req.body.note)}` : ''}`,
          line: fixture.line,
          model: fixture.model,
        },
        req.body?.user,
      )
      return res.json({
        success: true,
        orderStatus: nextLife.orderStatus,
        status: nextLife.status || fixture.status,
        message: `${sn} → ${nextLife.label}`,
        fixture: await findFixture(sn),
      })
    }

    const next = transitions[action]
    if (!next) {
      return res.status(400).json({
        success: false,
        message:
          'action ต้องเป็น Accept / Reject / Hold / Issue / Verify / Need Scrape / Need PR / Already have PR / New One Replacement / Restock',
      })
    }

    await updateFixtureBySn(sn, { status: next.status, ...(next.status === 'In Stock' ? { orderStatus: 'Verified' } : {}) })
    await recordHistory(
      {
        sn,
        action: 'Order',
        detail: `${next.label}`,
        line: fixture.line,
        model: fixture.model,
      },
      req.body?.user,
    )

    return res.json({
      success: true,
      status: next.status,
      message: `${sn} → ${next.label}`,
      fixture: await findFixture(sn),
    })
  }),
)

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

app.get(
  '/api/dashboard',
  asyncRoute(async (_req, res) => {
    const fixtures = await flattenFixtures()
    const counts = {}
    for (const fixture of fixtures) {
      const key = fixture.status || 'Unknown'
      counts[key] = (counts[key] || 0) + 1
    }

    const docs = await FixtureList.find({}, 'line model fixtureInfo').lean()
    const lines = {}
    for (const doc of docs) {
      lines[doc.line] = (lines[doc.line] || 0) + (doc.fixtureInfo?.length || 0)
    }

    const pmAlerts = fixtures
      .map((fixture) => ({
        ...fixture,
        pmStates: pmStateOf(fixture),
        usagePercent:
          Number(fixture.usage?.max) > 0
            ? Math.round(((Number(fixture.usage?.current) || 0) / Number(fixture.usage?.max)) * 100)
            : null,
      }))
      .filter((fixture) => !fixture.pmStates.every((state) => state === 'tracked'))
      .sort((a, b) => {
        const rank = { 'over-due': 0, 'overdue-remind': 1, 'on-due': 2, 'usage-remind': 3, 'pre-alert': 4, tracked: 5 }
        return (
          Math.min(...a.pmStates.map((state) => rank[state] ?? 6)) -
          Math.min(...b.pmStates.map((state) => rank[state] ?? 6))
        )
      })
      .slice(0, 8)

    const [requests, recentRequests, recentHistory] = await Promise.all([
      Request.find({}, 'status type requestType line model step dueDate request_id requestTime').lean(),
      Request.find({}).sort({ requestTime: -1 }).limit(5).lean(),
      History.find({}).sort({ date: -1 }).limit(8).lean(),
    ])

    const requestStats = {}
    const byLine = {}
    const byModel = {}
    const byProcess = {}
    for (const request of requests) {
      const key = request.status || 'Unknown'
      requestStats[key] = (requestStats[key] || 0) + 1

      const lineKey = request.line || 'N/A'
      byLine[lineKey] = (byLine[lineKey] || 0) + 1
      const modelKey = request.model || 'N/A'
      byModel[modelKey] = (byModel[modelKey] || 0) + 1
      const processKey = request.requestType || request.type || 'N/A'
      byProcess[processKey] = (byProcess[processKey] || 0) + 1
    }

    const dueRequests = requests
      .filter((request) => request.dueDate)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
      .slice(0, 10)
      .map((request) => ({
        ...request,
        daysLeft: daysUntil(request.dueDate),
      }))

    const activeByLine = {}
    const activeByModel = {}
    const activeByProcess = {}
    for (const fixture of fixtures) {
      if (fixture.status !== 'In Use') continue
      const lineKey = fixture.line || 'N/A'
      const modelKey = fixture.model || 'N/A'
      const processKey = fixture.process || fixture.type || 'N/A'
      activeByLine[lineKey] = (activeByLine[lineKey] || 0) + 1
      activeByModel[modelKey] = (activeByModel[modelKey] || 0) + 1
      activeByProcess[processKey] = (activeByProcess[processKey] || 0) + 1
    }

    res.json({
      success: true,
      total: fixtures.length,
      counts,
      orderCount: fixtures.filter((fixture) => ORDER_STATUSES.includes(fixture.status)).length,
      lines,
      requestStats,
      byLine,
      byModel,
      byProcess,
      dueRequests,
      activeByLine,
      activeByModel,
      activeByProcess,
      pmAlerts,
      recentRequests,
      recentHistory,
    })
  }),
)

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

app.get(
  '/api/history',
  asyncRoute(async (req, res) => {
    const filter = {}
    if (req.query.sn) filter.sn = text(req.query.sn)
    if (req.query.action) filter.action = text(req.query.action)
    if (req.query.request_id) filter.request_id = text(req.query.request_id)
    const limit = Math.min(Number(req.query.limit) || 200, 1000)
    let data = await History.find(filter).sort({ date: -1 }).limit(limit).lean()
    if (req.query.q) {
      const needle = String(req.query.q).toLowerCase()
      data = data.filter((item) =>
        [item.sn, item.request_id, item.action, item.detail, item.name, item.lastname, item.empId, item.line, item.model]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle)),
      )
    }
    res.json(data)
  }),
)

/* ------------------------------------------------------------------ */
/* Health & static                                                     */
/* ------------------------------------------------------------------ */

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  })
})

const distDir = path.join(__dirname, 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.use((req, res) => {
  res.status(404).json({ success: false, message: `ไม่พบ API: ${req.method} ${req.path}` })
})

app.use((error, _req, res, _next) => {
  console.error('[api]', error)
  res.status(500).json({ success: false, message: error.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`[api] Fixture Management MM listening on http://localhost:${PORT}`)
  console.log(`[api] Mongo: ${MONGO_URL}`)
})
