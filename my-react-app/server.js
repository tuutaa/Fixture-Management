/**
 * Fixture Management MM — API server
 * ------------------------------------------------------------
 * Source of truth: Fixture MM.drawio (flow + schema)
 *
 * Flow:
 *   Register -> Input Fixture Information -> If Exist / Not Exist
 *   Request (Change Model | Breakdown) -> MainLine / Rotor -> Line / Model / Step / Fixture List
 *     -> Compare Model A->B -> Summary Issue/Return
 *     -> Fixture Room Progress -> ME/TE confirm recieved -> Record History -> Done
 *     -> ME/TE Return Fixture -> Fixture confirm returned -> Record History
 *     -> Breakdown -> Verify / Issue Spare -> Fixture Room Progress / Record Breakdown
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
import { FIXTURE_POSITION_MASTER, checkPositionMeta, normalizeMeta } from './src/lib/fixtureMeta.js'

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
  // 4M documents are often scanned PDFs / photos from the shop floor.
  // 15 MB rejected real attachments, so allow up to the JSON body limit.
  limits: { fileSize: 25 * 1024 * 1024 },
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
    status: { type: String, default: 'Unsigned', index: true },
    request_id: { type: String, default: '' },
  },
  { versionKey: false },
)
const User = mongoose.model('User', userSchema, 'users')

/* Fixture `type` = Process Type; canonical values mirror Request's PROCESS_TYPES. */
const FIXTURE_TYPE_VALUES = ['Mainline', 'Rotor', 'Winding', 'Function']
const canonicalProcessType = (value) => {
  const raw = String(value ?? '').trim()
  return FIXTURE_TYPE_VALUES.find((item) => item.toLowerCase() === raw.toLowerCase()) || raw
}
const FIXTURE_STATUS_VALUES = [
  'In Stock',
  'In Use',
  'Maintenance',
  'Scrape',
  'PR',
  'PR Ready',
  'Replaced',
]

/* fixtureDetail { sn, line, model, status, type, step, process, position, usage, registered, fixtureBase, revision } */
const fixtureDetailSchema = new mongoose.Schema(
  {
    sn: { type: String, required: true, unique: true, index: true },
    line: { type: String, default: '' },
    model: { type: String, default: '' },
    status: { type: String, default: 'In Stock', index: true },
    type: String,
    step: { type: String, default: '' },
    process: { type: String, default: '' },
    position: { type: String, default: '' },
    usage: {
      current: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      exp: String,
      storage: String,
      usedLine: String, // Line ที่ Fixture ถูกใช้งานอยู่ (อัปเดตตอนสแกนจ่าย)
      inUseAt: String, // วันที่ล่าสุดที่เปลี่ยน In Stock → In Use = จุดเริ่มรอบ PM 90 วัน
      currentModel: String,
      changeModel: String,
    },
    registered: personSchema,
    fixtureBase: String,
    revision: { type: String, default: '' },
    pmDate: { type: String, default: '' },
    pmForms: { type: [String], default: [] }, // เอกสาร 4M (บังคับเมื่อเกินกำหนด PM 3 วัน)
    pmRequestedDays: { type: Number, default: 0 }, // จำนวนวันที่ขอซ่อม PM
    pmApproval: { type: String, default: '' }, // Pending / Approved / Rejected / NotRequired
    pmApprovedBy: { type: String, default: '' },
    pmApprovedAt: { type: String, default: '' },
    pmRunId: { type: String, default: '' }, // groups one PM run for Line + Model + PM date
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
    currentModel: String,
    changeModel: String,
    type: { type: String, index: true },
    requestType: String, // Process Type (Mainline/Rotor/Winding/Function)
    step: String,
    dueDate: String,
    status: { type: String, default: 'Waiting', index: true },
    desc: { type: String, default: '' },
    queueDate: String,
    queueSlot: String,
    replaceQty: Number,
    items: { type: [String], default: [] },
    action: String,
    breakdownItems: {
      type: [{ sn: String, symptom: String, _id: false }],
      default: [],
    },
    requestInfo: personSchema,
    acceptInfo: personSchema,
    issueInfo: personSchema,
    verifyInfo: personSchema,
    issueDone: { type: Boolean, default: false },
    returnDone: { type: Boolean, default: false },
    returnApprovals: {
      type: [{ role: String, empId: String, name: String, lastname: String, date: Date }],
      default: [],
    },
    scannedIssue: { type: [String], default: [] },
    returnedItems: { type: [String], default: [] },
    scanMatches: {
      type: [{ sn: String, scannedSn: String, planSn: String, planIndex: Number, action: String, position: String, process: String }],
      default: [],
    },
  },
  { versionKey: false },
)
const Request = mongoose.model('Request', requestSchema, 'request')

/* History — "Record History" step of every branch */
const historySchema = new mongoose.Schema(
  {
    sn: { type: String, index: true, default: '' },
    request_id: { type: String, index: true, default: '' },
    pm_run_id: { type: String, index: true, default: '' },
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
const escapeRegexValue = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const metaKey = (value) => normalizeMeta(value).toLowerCase()
const metaSame = (a, b) => metaKey(a) === metaKey(b)
const metaRowMatches = (a = {}, b = {}) =>
  ['step', 'process', 'position'].every((key) => metaSame(a[key], b[key]))
const baseKey = (value) => text(value).replace(/\s+/g, '').toUpperCase()

const ACTIVE_REQUEST_STATUSES = ['Waiting', 'Progress', 'Hold', 'Verify']
const isModelSwap = (type) => /^change\s*model$/i.test(String(type || '').trim())

/* Change Model queue — 07:00–16:00, one 1-hour slot globally per day. */
const CHANGE_MODEL_SLOTS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']
const slotEnd = (slot) => {
  const hour = Number(String(slot).split(':')[0]) + 1
  return `${String(hour).padStart(2, '0')}:00`
}
const slotLabel = (slot) => `${slot}–${slotEnd(slot)}`
const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next)

const todayStamp = () => {
  const now = new Date()
  const y = String(now.getFullYear()).slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}
const todayInput = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
/* One PM document per Line + Model + PM date. Deterministic so fixtures
 * started individually on the same day still land in the same PM run. */
const pmRunKey = (line, model, date) =>
  `PM|${date || todayInput()}|${text(line) || 'N/A'}|${text(model) || 'N/A'}`
const addDaysInput = (date, days) => {
  const base = validDate(date) ? new Date(`${date}T00:00:00`) : new Date()
  base.setDate(base.getDate() + days)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
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

/* Persist one history row per business event. Order events are written as they
 * happen so that, once Verify completes, History holds the full order trail. */
const recordHistory = async (entry = {}, user = {}) => {
  const action = text(entry.action)
  if (!action) return

  await History.create({
    sn: text(entry.sn),
    request_id: text(entry.request_id),
    pm_run_id: text(entry.pm_run_id),
    action,
    detail: text(entry.detail),
    line: text(entry.line),
    model: text(entry.model),
    empId: text(user?.userId || user?.empId || entry.empId),
    name: text(user?.name || entry.name),
    lastname: text(user?.lastName || user?.lastname || entry.lastname),
    date: entry.date ? new Date(entry.date) : new Date(),
  })
}

const findFixture = async (sn) => {
  let detail = await FixtureDetail.findOne({ sn }).lean()
  let resolvedSn = sn
  if (!detail) {
    // fixtureList stores the fixture base (without revision suffix); resolve to an
    // individual fixtureDetail record by prefix so issue/verify/edit flows work.
    const escaped = String(sn).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    detail = await FixtureDetail.findOne({ sn: { $regex: `^${escaped}-` } }).lean()
    if (detail) resolvedSn = detail.sn
  }
  if (!detail) return null
  const escapedLookup = String(sn).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const doc = await FixtureList.findOne({ 'fixtureInfo.sn': sn }).lean()
    || await FixtureList.findOne({ 'fixtureInfo.sn': resolvedSn }).lean()
    || await FixtureList.findOne({ 'fixtureInfo.sn': { $regex: `^${escapedLookup}$` } }).lean()
  let step = ''
  let process = ''
  let position = ''
  if (doc) {
    const info = (doc.fixtureInfo || []).find((item) =>
      (item.sn || []).some((s) => [sn, resolvedSn].some((value) => String(s).trim() === String(value).trim())),
    )
    if (info) {
      step = info.step || ''
      process = info.process || ''
      position = info.position || ''
    }
  }
  return {
    ...detail,
    sn: resolvedSn,
    // fixtureDetail is authoritative; fixtureList is only a legacy fallback.
    line: detail.line || doc?.line || '',
    model: detail.model || doc?.model || '',
    step: detail.step || step,
    process: detail.process || process,
    position: detail.position || position,
  }
}

const updateFixtureBySn = async (sn, set) => {
  if (!set || Object.keys(set).length === 0) return false
  // resolve base SN (from fixtureList) to an individual fixtureDetail record
  let targetSn = sn
  let detail = await FixtureDetail.findOne({ sn }).lean()
  if (!detail) {
    const escaped = String(sn).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    detail = await FixtureDetail.findOne({ sn: { $regex: `^${escaped}-` } }).lean()
    if (detail) targetSn = detail.sn
  }
  if (!detail) return false
  const result = await FixtureDetail.updateOne({ sn: targetSn }, { $set: set })
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

const matchesText = (value, needle) =>
  !needle || String(value ?? '').toLowerCase().includes(String(needle).toLowerCase())

const matchesFixtureFilters = (
  row,
  { line, model, status, sn, type, step, process, position, storage, fixtureBase, revision } = {},
) => {
  if (line && !matchesText(row.line, line)) return false
  if (model && !matchesText(row.model, model)) return false
  if (status && !String(status).split(',').includes(row.status)) return false
  if (!matchesText(row.sn, sn)) return false
  if (!matchesText(row.type, type)) return false
  if (!matchesText(row.step, step)) return false
  if (!matchesText(row.process, process)) return false
  if (!matchesText(row.position, position)) return false
  if (!matchesText(row.usage?.storage || row.storage, storage)) return false
  if (!matchesText(row.fixtureBase, fixtureBase)) return false
  if (!matchesText(row.revision, revision)) return false
  return true
}

const flattenFixtures = async (filters = {}) => {
  const { line, model } = filters
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
        const row = {
          ...detail,
          line: detail.line || doc.line || '',
          model: detail.model || doc.model || '',
          step: detail.step || info.step || '',
          process: detail.process || info.process || '',
          position: detail.position || info.position || '',
        }
        if (matchesFixtureFilters(row, filters)) result.push(row)
      }
    }
  }
  return result
}

/* Edit page source of truth: fixtureDetail first, fixtureList only as legacy fallback. */
const flattenFixtureDetails = async (filters = {}) => {
  const details = await FixtureDetail.find({}).lean()
  const lists = await FixtureList.find({}, 'line model fixtureInfo').lean()
  const listed = new Map()
  for (const doc of lists) {
    for (const info of doc.fixtureInfo || []) {
      for (const s of info.sn || []) {
        listed.set(s, {
          line: doc.line || '',
          model: doc.model || '',
          step: info.step || '',
          process: info.process || '',
          position: info.position || '',
        })
      }
    }
  }
  return details
    .map((detail) => {
      const fallback = listed.get(detail.sn) || {}
      return {
        ...detail,
        line: detail.line || fallback.line || '',
        model: detail.model || fallback.model || '',
        step: detail.step || fallback.step || '',
        process: detail.process || fallback.process || '',
        position: detail.position || fallback.position || '',
      }
    })
    .filter((row) => matchesFixtureFilters(row, filters))
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
    if (days > 3) states.push('tracked') // เกิน 3 วัน → ต้องแนบ 4M ก่อนทำ PM
    else if (days > 0) states.push('pre-alert')
    else if (days === 0) states.push('on-due')
    else if (days >= -3) states.push('overdue-remind')
    else states.push('over-due')
  }
  if (ratio !== null && ratio >= 0.8) states.push('usage-remind')
  if (states.length === 0) states.push('tracked')
  return states
}

const pmOverdueDays = (fixture) => {
  const days = daysUntil(fixture?.usage?.exp)
  return days === null ? 0 : Math.max(0, -days)
}
/* 4M is a Line + Model control. Fixtures without both keys are not grouped,
 * so they must not be blocked or counted by any 4M rule. */
const hasPmGroup = (fixture) => {
  const line = String(fixture?.line ?? '').trim().toLowerCase()
  const model = String(fixture?.model ?? '').trim().toLowerCase()
  return Boolean(line) && Boolean(model) && line !== 'n/a' && model !== 'n/a'
}
const needs4MDocument = (fixture) =>
  hasPmGroup(fixture) &&
  pmOverdueDays(fixture) > 3 &&
  !(Array.isArray(fixture?.pmForms) ? fixture.pmForms : []).length
const assertFixtureEditable = async (sn) => {
  const fixture = await findFixture(text(sn))
  if (fixture && needs4MDocument(fixture)) {
    return {
      status: 409,
      message: `Fixture ${fixture.sn} เกินกำหนด PM ${pmOverdueDays(fixture)} วัน — กรุณาแนบเอกสาร 4M ก่อนแก้ไขข้อมูล`,
      sn: fixture.sn,
      line: fixture.line || '',
    }
  }
  return null
}

/* A fixture that reaches its 90-day PM due date moves In Use -> PM.
 * There is no scheduler, so the transition is synced lazily on read. */
const syncPmStatuses = async () => {
  const today = todayInput()
  const due = await FixtureDetail.find({
    status: 'In Use',
    'usage.exp': { $exists: true, $ne: '', $lte: today },
  }).lean()
  for (const fixture of due) {
    await updateFixtureBySn(fixture.sn, { status: 'PM' })
    await recordHistory(
      {
        sn: fixture.sn,
        action: 'PM Due',
        detail: `ครบกำหนด PM 90 วัน (${fixture.usage?.exp || today}) → รอทำ PM`,
        line: fixture.line || '',
        model: fixture.model || '',
      },
      null,
    )
  }
  return due.length
}

const statusOfUser = (user) => String(user?.status || '').trim()
const isSigned = (user) => /^signed$/i.test(statusOfUser(user))
const isAdmin = (user) => /^admin$/i.test(statusOfUser(user))
const canLogin = (user) => isSigned(user) || isAdmin(user)

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
    if (!canLogin(user)) {
      return res.status(403).json({
        success: false,
        message: 'บัญชีของคุณยังไม่ได้ลงนาม กรุณาติดต่อผู้ดูแลระบบ',
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
      status: 'Unsigned',
      request_id: '',
    })

    return res.json({ success: true, message: 'Register Success! รอผู้ดูแลระบบลงนาม' })
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
    const byLine = {}
    for (const doc of docs) {
      if (!doc.line || !doc.model) continue
      if (!byLine[doc.line]) byLine[doc.line] = new Set()
      byLine[doc.line].add(doc.model)
    }
    const modelsByLine = Object.fromEntries(
      Object.entries(byLine).map(([k, v]) => [k, [...v].sort()]),
    )
    res.json({ lines, models, modelsByLine })
  }),
)

/* Raw fixturelist documents (nested fixtureInfo) for the Fixture List page */
app.get(
  '/api/fixturelist',
  asyncRoute(async (req, res) => {
    await syncPmStatuses()
    const filter = {}
    if (req.query.line) filter.line = text(req.query.line)
    if (req.query.model) filter.model = text(req.query.model)
    const docs = await FixtureList.find(filter).sort({ line: 1, model: 1 }).lean()
    res.json(docs)
  }),
)

/* Batch import / update fixturelist from Excel rows.
 * Before writing, validate step/process/position of every registered fixture
 * whose base appears in the file. If any fixture is missing or mismatched,
 * return a preview and wait for the client's confirmation. */
app.post(
  '/api/fixturelist/import',
  asyncRoute(async (req, res) => {
    const list = Array.isArray(req.body?.items) ? req.body.items : []
    if (!list.length) {
      return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลสำหรับ Import' })
    }
    const confirm = req.body?.confirm === true

    const normalizedList = list
      .map((item) => {
        const line = text(item.line)
        const model = text(item.model)
        const fixtureInfo = (Array.isArray(item.fixtureInfo) ? item.fixtureInfo : [])
          .map((info) => {
            const imported = {
              step: normalizeMeta(info?.step),
              process: normalizeMeta(info?.process),
              position: normalizeMeta(info?.position),
            }
            const check = checkPositionMeta(imported)
            const canonical = check.canonical
            const matchesMaster = check.matches && !check.unknown
            const desired = canonical || imported
            const count = Number(info?.count)
            return {
              ...imported,
              canonical,
              matchesMaster,
              desired,
              count: Number.isFinite(count) && count > 0 ? count : 0,
              sn: (Array.isArray(info?.sn) ? info.sn : [])
                .map((sn) => text(sn))
                .filter(Boolean),
            }
          })
          .filter((info) => info.position)
        return { line, model, fixtureInfo }
      })
      .filter((item) => item.line && item.model)

    if (!normalizedList.length) {
      return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลสำหรับ Import' })
    }

    /* base SN -> imported rows that reference it */
    const baseRefs = new Map()
    for (const item of normalizedList) {
      for (const info of item.fixtureInfo) {
        for (const rawBase of info.sn) {
          const base = baseKey(rawBase)
          if (!base) continue
          if (!baseRefs.has(base)) baseRefs.set(base, [])
          baseRefs.get(base).push({ line: item.line, model: item.model, info })
        }
      }
    }

    let registered = []
    if (baseRefs.size) {
      const basePattern = new RegExp(
        `^(${[...baseRefs.keys()].map(escapeRegexValue).join('|')})$`,
        'i',
      )
      registered = await FixtureDetail.find({ fixtureBase: basePattern }).lean()
    }

    const issues = []
    const seenIssues = new Set()
    for (const detail of registered) {
      const base = baseKey(detail.fixtureBase)
      const refs = baseRefs.get(base) || []
      if (!refs.length) continue
      const current = {
        step: text(detail.step) || '',
        process: text(detail.process) || '',
        position: text(detail.position) || '',
      }
      for (const ref of refs) {
        const issueKey = `${base}|${detail.sn}`
        if (seenIssues.has(issueKey)) continue
        const hasCurrent = ['step', 'process', 'position'].every((key) => metaKey(current[key]))
        const desired = ref.info.desired
        const matches = metaRowMatches(current, desired)
        if (hasCurrent && matches && ref.info.matchesMaster) continue
        seenIssues.add(issueKey)
        const reason = !ref.info.matchesMaster
          ? 'master'
          : !hasCurrent
            ? 'missing'
            : 'mismatch'
        issues.push({
          base: text(detail.fixtureBase),
          sn: detail.sn,
          line: ref.line,
          model: ref.model,
          current,
          desired,
          imported: {
            step: ref.info.step,
            process: ref.info.process,
            position: ref.info.position,
          },
          reason,
        })
      }
    }

    const blocked4M = []
    for (const issue of issues) {
      const guard = await assertFixtureEditable(issue.sn)
      if (guard) blocked4M.push({ sn: issue.sn, message: guard.message })
    }
    if (blocked4M.length) {
      return res.status(409).json({
        success: false,
        message: blocked4M[0].message,
        blocked: blocked4M,
      })
    }

    if (issues.length && !confirm) {
      return res.status(409).json({
        success: false,
        needsConfirm: true,
        message: `พบ Fixture ที่ต้องอัปเดต step/process/position ${issues.length} รายการ — กดยืนยันเพื่ออัปเดตและนำเข้าไฟล์`,
        issues,
      })
    }

    let detailsUpdated = 0
    for (const issue of issues) {
      await FixtureDetail.updateOne(
        { sn: issue.sn },
        {
          $set: {
            line: issue.line,
            model: issue.model,
            step: issue.desired.step,
            process: issue.desired.process,
            position: issue.desired.position,
          },
        },
      )
      detailsUpdated++
    }

    let inserted = 0
    let updated = 0
    for (const item of normalizedList) {
      const fixtureInfo = item.fixtureInfo.map((info) => ({
        step: info.desired.step,
        process: info.desired.process,
        position: info.desired.position,
        count: info.count,
        sn: info.sn,
      }))
      const existing = await FixtureList.findOne({ line: item.line, model: item.model })

      if (existing) {
        existing.fixtureInfo = fixtureInfo
        await existing.save()
        updated++
      } else {
        await FixtureList.create({ line: item.line, model: item.model, fixtureInfo })
        inserted++
      }
    }

    res.json({
      success: true,
      message: `นำเข้าข้อมูลเรียบร้อย: เพิ่มใหม่ ${inserted} รายการ, อัปเดต ${updated} รายการ, อัปเดต Fixture ${detailsUpdated} ตัว`,
      inserted,
      updated,
      detailsUpdated,
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

app.get(
  '/api/fan2/machines',
  asyncRoute(async (_req, res) => {
    const db = await getFan2Db()
    const docs = await db.collection('MachineNew').find({}, { projection: { machineCode: 1, name: 1, thaiName: 1, 'locationInfo.name': 1 } }).toArray()
    const machines = [...new Set(docs.map((d) => text(d.machineCode)).filter(Boolean))].map((machineCode) => {
      const machine = docs.find((d) => text(d.machineCode) === machineCode) || {}
      return {
        machineCode,
        name: text(machine.name) || text(machine.thaiName) || '',
        locationName: text(machine.locationInfo?.name),
      }
    })
    res.json(machines)
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
    await syncPmStatuses()
    const { line, model, status, sn, type, step, process, position, storage, fixtureBase, revision, q } = req.query
    let data = await flattenFixtures({
      line,
      model,
      status,
      sn,
      type,
      step,
      process,
      position,
      storage,
      fixtureBase,
      revision,
    })
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

/* Distinct values for the Edit page filter zone + field dropdowns. */
app.get(
  '/api/fixtures/options',
  asyncRoute(async (_req, res) => {
    const fixtures = await flattenFixtures({})
    const sortValues = (values) =>
      [...new Set(values.filter((value) => value !== '' && value !== null && value !== undefined))].sort(
        (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }),
      )
    const pick = (getter) => sortValues(fixtures.map(getter))
    const storageDocs = await Storage.find({}, 'location').lean()

    res.json({
      lines: pick((row) => row.line),
      models: pick((row) => row.model),
      statuses: pick((row) => row.status),
      types: sortValues(fixtures.map((row) => canonicalProcessType(row.type))),
      steps: pick((row) => row.step),
      processes: pick((row) => row.process),
      positions: pick((row) => row.position),
      fixtureBases: pick((row) => row.fixtureBase),
      revisions: pick((row) => row.revision),
      storages: sortValues([
        ...storageDocs.map((doc) => doc.location),
        ...fixtures.map((row) => row.usage?.storage || row.storage),
      ]),
    })
  }),
)

/* Edit page — options + rows sourced from fixtureDetail (fixtureList is fallback only). */
app.get(
  '/api/fixtures/detail/options',
  asyncRoute(async (_req, res) => {
    const rows = await flattenFixtureDetails({})
    const sortValues = (values) =>
      [...new Set(values.filter((value) => value !== '' && value !== null && value !== undefined))].sort(
        (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }),
      )

    let fanLocations = []
    let fanModels = []
    try {
      const db = await getFan2Db()
      const locationDocs = await db.collection('Location').find({}, { projection: { location: 1 } }).toArray()
      const modelDocs = await db.collection('ModelNEW').find({}, { projection: { model: 1 } }).toArray()
      fanLocations = locationDocs.map((doc) => text(doc.location)).filter(Boolean)
      fanModels = modelDocs.map((doc) => text(doc.model)).filter(Boolean)
    } catch {
      // FAN2 may be unavailable — fixtureDetail values still populate every filter.
    }

    const storageDocs = await Storage.find({}, 'location').lean()
    const positionByProcess = {}
    const addPosition = (process, position) => {
      if (!process || !position) return
      if (!positionByProcess[process]) positionByProcess[process] = []
      if (!positionByProcess[process].includes(position)) positionByProcess[process].push(position)
    }
    for (const item of FIXTURE_POSITION_MASTER) addPosition(item.process, item.position)
    for (const row of rows) addPosition(row.process, row.position)
    for (const key of Object.keys(positionByProcess)) positionByProcess[key] = sortValues(positionByProcess[key])

    res.json({
      sns: sortValues(rows.map((row) => row.sn)),
      lines: sortValues([...fanLocations, ...rows.map((row) => row.line)]),
      models: sortValues([...fanModels, ...rows.map((row) => row.model)]),
      statuses: sortValues([...FIXTURE_STATUS_VALUES, ...rows.map((row) => row.status)]),
      types: sortValues([...FIXTURE_TYPE_VALUES, ...rows.map((row) => canonicalProcessType(row.type))]),
      steps: sortValues([...FIXTURE_POSITION_MASTER.map((item) => item.step), ...rows.map((row) => row.step)]),
      processes: sortValues([...FIXTURE_POSITION_MASTER.map((item) => item.process), ...rows.map((row) => row.process)]),
      positions: sortValues([...FIXTURE_POSITION_MASTER.map((item) => item.position), ...rows.map((row) => row.position)]),
      fixtureBases: sortValues(rows.map((row) => row.fixtureBase)),
      revisions: sortValues(rows.map((row) => row.revision)),
      storages: sortValues([
        ...storageDocs.map((doc) => doc.location),
        ...rows.map((row) => row.usage?.storage || row.storage),
      ]),
      positionByProcess,
    })
  }),
)

app.get(
  '/api/fixtures/detail',
  asyncRoute(async (req, res) => {
    const { line, model, status, sn, type, step, process, position, storage, fixtureBase, revision, q } = req.query
    let data = await flattenFixtureDetails({
      line,
      model,
      status,
      sn,
      type,
      step,
      process,
      position,
      storage,
      fixtureBase,
      revision,
    })
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

/* Edit page — Due Date tab: bulk update usage.exp for selected SNs */
app.post(
  '/api/fixtures/due-date',
  asyncRoute(async (req, res) => {
    const body = req.body || {}
    const sns = [...new Set((Array.isArray(body.sns) ? body.sns : []).map(text).filter(Boolean))]
    const exp = text(body.exp)

    if (!sns.length) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือก Fixture อย่างน้อย 1 ตัว' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exp) || Number.isNaN(new Date(`${exp}T00:00:00Z`).getTime())) {
      return res.status(400).json({ success: false, message: 'วันที่ Exp ไม่ถูกต้อง' })
    }

    const updated = []
    const missing = []
    const blocked = []
    for (const sn of sns) {
      const fixture = await findFixture(sn)
      if (!fixture) {
        missing.push(sn)
        continue
      }
      const guard = await assertFixtureEditable(sn)
      if (guard) {
        blocked.push({ sn, message: guard.message })
        continue
      }
      await updateFixtureBySn(sn, { 'usage.exp': exp })
      await recordHistory(
        { sn, action: 'Edit', detail: `อัปเดต Exp (PM Due) เป็น ${exp}`, line: fixture.line, model: fixture.model },
        body.user,
      )
      updated.push(sn)
    }

    if (blocked.length) {
      return res.status(409).json({
        success: false,
        message: blocked[0].message,
        blocked,
        updated,
        missing,
      })
    }
    if (!updated.length) {
      return res.status(404).json({ success: false, message: 'ไม่พบ Fixture ที่เลือกในระบบ', missing })
    }

    return res.json({
      success: true,
      count: updated.length,
      updated,
      missing,
      message: `อัปเดต Exp ${updated.length} Fixture เป็น ${exp} แล้ว`,
    })
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

    const step = normalizeMeta(body.step)
    const process = normalizeMeta(body.process)
    const position = normalizeMeta(body.position)

    // Not Exist -> create fixtureDetail + add sn to fixtureList
    await FixtureDetail.create({
      sn,
      line: text(body.line),
      model: text(body.model),
      status: text(body.status) || 'In Stock',
      type: canonicalProcessType(body.type),
      step,
      process,
      position,
      usage: {
        current: Number(body.current) || 0,
        max: Number(body.max) || 0,
        exp: body.exp || '',
        storage: text(body.usageStorage || body.storage) || '',
      },
      registered: personFrom(body.user || {}),
      fixtureBase: text(body.fixtureBase) || sn.split('-')[0] || '',
      revision: text(body.revision) || '',
      pmDate: text(body.pmDate) || '',
    })

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
    const guard = await assertFixtureEditable(sn)
    if (guard) return res.status(guard.status).json({ success: false, message: guard.message, ...guard })

    const set = {}
    for (const key of ['line', 'model', 'status', 'type', 'fixtureBase', 'revision', 'pmDate']) {
      if (body[key] !== undefined) set[key] = body[key]
    }
    for (const key of ['step', 'process', 'position']) {
      if (body[key] !== undefined) set[key] = normalizeMeta(body[key])
    }
    if (set.type !== undefined) set.type = canonicalProcessType(set.type)
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
      for (const key of ['current', 'max', 'exp', 'storage']) {
        if (body.usage[key] !== undefined) set[`usage.${key}`] = body.usage[key]
      }
    }

    if (set.status === 'In Use' && fixture.status !== 'In Use') {
      const inUseAt = todayInput()
      set['usage.inUseAt'] = inUseAt
      set['usage.exp'] = addDaysInput(inUseAt, 90)
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
    const guard = await assertFixtureEditable(sn)
    if (guard) return res.status(guard.status).json({ success: false, message: guard.message, ...guard })
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
const compareModels = async (line, from, to) => {
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

  return {
    issue,
    return: returnList,
    keep,
    total: { issue: issue.length, return: returnList.length, keep: keep.length },
    missing: { from: !fromDoc, to: !toDoc },
  }
}

/* Compare can be empty when the Fixture List has not been updated for the
 * new model yet. Fall back to the registered fixtures of each model:
 * issue the target model, return everything registered to the current model. */
const modelFallbackPlan = async (line, from, to) => {
  const [toRows, fromRows] = await Promise.all([
    FixtureDetail.find({ line, model: to }, 'sn position process status').lean(),
    FixtureDetail.find({ line, model: from }, 'sn position process status').lean(),
  ])

  const toPlan = (rows, action) => {
    const seen = new Set()
    return rows
      .map((row) => ({
        sn: text(row.sn),
        position: text(row.position),
        process: text(row.process),
        status: text(row.status),
        action,
        fallback: true,
      }))
      .filter((row) => {
        const key = scanKey(row.sn)
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
  }

  const issue = toPlan(toRows, 'issue')
  const issuedSn = new Set(issue.map((item) => scanKey(item.sn)))
  const returnList = toPlan(fromRows, 'return').filter((item) => !issuedSn.has(scanKey(item.sn)))
  return [...issue, ...returnList]
}

/* Plan of fixtures that must be issued / returned for a request. */
const scanPlanForRequest = async (request) => {
  if (isModelSwap(request?.type)) {
    const to = text(request.changeModel)
      || String(request.desc || '').split('→').slice(1).join('→').trim()
    const from = text(request.currentModel)
    const line = text(request.line)
    if (!line || !from || !to) return []
    const cmp = await compareModels(line, from, to)
    if (!cmp.issue.length && !cmp.return.length && !cmp.keep.length) {
      return modelFallbackPlan(line, from, to)
    }
    return [
      ...cmp.issue.map((item) => ({ ...item, action: 'issue' })),
      ...cmp.return.map((item) => ({ ...item, action: 'return' })),
    ]
  }
  if (/breakdown/i.test(String(request?.type || ''))) {
    // Issue: any registered spare with the same base is acceptable.
    // Return: only the exact broken SNs named in the request are acceptable.
    const broken = (Array.isArray(request?.breakdownItems) ? request.breakdownItems : [])
      .map((item) => ({ sn: text(item?.sn), symptom: text(item?.symptom) }))
      .filter((item) => item.sn)
    const details = await Promise.all(broken.map((item) => findFixture(item.sn)))
    const bases = new Set()
    const issuePlan = []
    broken.forEach((item, index) => {
      const base = fixtureBase(details[index]?.fixtureBase || item.sn)
      if (!base || bases.has(base)) return
      bases.add(base)
      issuePlan.push({
        sn: item.sn,
        base,
        position: details[index]?.position || item.symptom || '',
        process: details[index]?.process || '',
        action: 'issue',
        allowSameBase: true,
      })
    })
    const returnPlan = broken.map((item, index) => ({
      sn: item.sn,
      position: details[index]?.position || item.symptom || '',
      process: details[index]?.process || '',
      symptom: item.symptom,
      action: 'return',
      strictSn: true,
    }))
    return [...issuePlan, ...returnPlan]
  }
  return []
}

app.get(
  '/api/fixturelist/compare',
  asyncRoute(async (req, res) => {
    const line = text(req.query.line)
    const from = text(req.query.from)
    const to = text(req.query.to)
    if (!line || !from || !to) {
      return res.status(400).json({ success: false, message: 'ต้องระบุ line, from และ to' })
    }
    res.json({ success: true, line, from, to, ...(await compareModels(line, from, to)) })
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
    const data = await Request.find(filter).sort({ _id: -1 }).lean()
    res.json(data)
  }),
)

/* Change Model queue availability for one day — shared across every Line. */
app.get(
  '/api/requests/change-model-slots',
  asyncRoute(async (req, res) => {
    const date = text(req.query.date) || todayInput()
    if (!validDate(date)) {
      return res.status(400).json({ success: false, message: 'วันที่ไม่ถูกต้อง' })
    }
    const taken = await Request.find({
      type: 'Change Model',
      queueDate: date,
      queueSlot: { $in: CHANGE_MODEL_SLOTS },
    })
      .select('request_id queueSlot line currentModel changeModel')
      .lean()
    const bySlot = new Map(taken.map((row) => [row.queueSlot, row]))

    return res.json(
      CHANGE_MODEL_SLOTS.map((slot) => {
        const row = bySlot.get(slot)
        return {
          value: slot,
          label: slotLabel(slot),
          available: !row,
          requestId: row?.request_id || null,
          line: row?.line || null,
          currentModel: row?.currentModel || null,
          changeModel: row?.changeModel || null,
        }
      }),
    )
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
    const currentModel = text(body.currentModel || body.model)
    const changeModel = text(body.changeModel || body.modelTo)
    const queueDate = text(body.queueDate) || todayInput()
    const queueSlot = text(body.queueSlot)

    if (!type || !line) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุประเภทคำขอและ Line' })
    }
    if (!['Change Model', 'Breakdown'].includes(type)) {
      return res.status(400).json({ success: false, message: 'ประเภทคำขอไม่ถูกต้อง' })
    }

    /* A Change Model request reserves one global 1-hour prep slot for the day. */
    if (type === 'Change Model') {
      if (!validDate(queueDate) || !CHANGE_MODEL_SLOTS.includes(queueSlot)) {
        return res.status(400).json({ success: false, message: 'กรุณาเลือกวันที่และคิว Change Model (07:00–16:00)' })
      }
      const taken = await Request.findOne({
        type: 'Change Model',
        queueDate,
        queueSlot,
      }).lean()
      if (taken) {
        return res.status(409).json({
          success: false,
          message: `คิว ${slotLabel(queueSlot)} วันที่ ${queueDate} ถูกคำขอ ${taken.request_id} ใช้งานอยู่ กรุณาเลือกคิวอื่น`,
          conflict: { requestId: taken.request_id, queueDate, queueSlot },
        })
      }
    }

    const breakdownItems = Array.isArray(body.breakdownItems)
      ? body.breakdownItems.map((it) => ({ sn: text(it?.sn) || '', symptom: text(it?.symptom) || '' })).filter((it) => it.sn || it.symptom)
      : []

    /* Block duplicate requests. Rejected/Done are history and may be requested
     * again; Waiting/Progress/Hold/Verify are still active in the system. */
    const duplicateFilter = { status: { $in: ACTIVE_REQUEST_STATUSES } }
    if (type === 'Breakdown') {
      const sns = breakdownItems.map((it) => it.sn).filter(Boolean)
      if (sns.length) {
        const duplicate = await Request.findOne({
          ...duplicateFilter,
          'breakdownItems.sn': { $in: sns },
        }).lean()
        if (duplicate) {
          const matchedSn = (duplicate.breakdownItems || [])
            .find((it) => sns.includes(it.sn))?.sn || sns[0]
          return res.status(409).json({
            success: false,
            message: `มีคำขอ ${duplicate.request_id} ที่ยังดำเนินการอยู่สำหรับ Fixture ${matchedSn}`,
            duplicate,
          })
        }
      }
    } else if (isModelSwap(type) && currentModel && changeModel) {
      const duplicate = await Request.findOne({
        ...duplicateFilter,
        type: 'Change Model',
        line,
        currentModel,
        changeModel,
      }).lean()
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `มีคำขอ ${duplicate.request_id} ที่ยังดำเนินการอยู่สำหรับ ${type} ${line} · ${currentModel} → ${changeModel}`,
          duplicate,
        })
      }
    }

    const stamp = todayStamp()
    const todayCount = await Request.countDocuments({
      request_id: new RegExp(`^REQ${stamp}`),
    })
    const request_id = `REQ${stamp}${String(todayCount + 1).padStart(3, '0')}`

    const desc = text(body.desc) || (isModelSwap(type) && changeModel ? `${currentModel} → ${changeModel}` : '')

    const request = await Request.create({
      request_id,
      line,
      currentModel: currentModel || '',
      changeModel: changeModel || '',
      queueDate: type === 'Change Model' ? queueDate : undefined,
      queueSlot: type === 'Change Model' ? queueSlot : undefined,
      requestType: text(body.requestType),
      step: text(body.step),
      dueDate: text(body.dueDate),
      type,
      status: 'Waiting',
      desc,
      breakdownItems,
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
        detail: `${type}${currentModel ? ` · ${currentModel}` : ''}`,
        line,
        model: currentModel,
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
    if (request.status !== 'Waiting' && request.status !== 'Hold') {
      return res.status(409).json({ success: false, message: 'คำขอนี้ได้รับการยืนยันแล้ว' })
    }

    // Only Progress blocks a new Accept — Verify and Hold can run alongside another job
    const empId = req.body?.user?.userId || req.body?.user?.empId
    if (empId) {
      const active = await Request.findOne({
        'acceptInfo.empId': empId,
        status: { $in: ['Progress'] },
        request_id: { $ne: request.request_id },
      })
      if (active) {
        return res.status(409).json({ success: false, message: 'คุณมีงานที่รับอยู่แล้ว ไม่สามารถรับงานใหม่ได้' })
      }
    }

    request.acceptInfo = personFrom(req.body?.user || {})
    request.status = 'Progress'
    await request.save()

    await recordHistory(
      {
        request_id: request.request_id,
        action: 'Accept',
        detail: `รับคำขอ ${request.type}`,
        line: request.line,
        model: request.currentModel,
      },
      req.body?.user,
    )
    return res.json({ success: true, request })
  }),
)

/* Hold (pause job) */
app.put(
  '/api/requests/:requestId/hold',
  asyncRoute(async (req, res) => {
    const request = await Request.findOne({ request_id: text(req.params.requestId) })
    if (!request) return res.status(404).json({ success: false, message: 'ไม่พบคำขอนี้' })
    if (request.status !== 'Progress') {
      return res.status(409).json({ success: false, message: 'คำขอนี้ไม่สามารถ hold ได้' })
    }
    request.status = 'Hold'
    await request.save()
    await recordHistory(
      { request_id: request.request_id, action: 'Hold', detail: `Hold คำขอ ${request.request_id}`, line: request.line, model: request.currentModel },
      req.body?.user,
    )
    return res.json({ success: true, request })
  }),
)

/* Reject (cancel request) */
app.put(
  '/api/requests/:requestId/reject',
  asyncRoute(async (req, res) => {
    const request = await Request.findOne({ request_id: text(req.params.requestId) })
    if (!request) return res.status(404).json({ success: false, message: 'ไม่พบคำขอนี้' })
    if (request.status !== 'Waiting' && request.status !== 'Hold') {
      return res.status(409).json({ success: false, message: 'คำขอนี้ไม่สามารถ reject ได้' })
    }
    request.status = 'Rejected'
    await request.save()
    return res.json({ success: true, request })
  }),
)

/* Complete (move to Verify) */
app.put(
  '/api/requests/:requestId/complete',
  asyncRoute(async (req, res) => {
    const request = await Request.findOne({ request_id: text(req.params.requestId) })
    if (!request) return res.status(404).json({ success: false, message: 'ไม่พบคำขอนี้' })
    if (request.status !== 'Progress' && request.status !== 'Hold') {
      return res.status(409).json({ success: false, message: 'คำขอนี้ไม่สามารถ complete ได้' })
    }
    request.status = 'Verify'
    await request.save()
    await recordHistory(
      { request_id: request.request_id, action: 'Complete', detail: `Complete คำขอ ${request.request_id}`, line: request.line, model: request.currentModel },
      req.body?.user,
    )
    return res.json({ success: true, request })
  }),
)

const scanKey = (value) => String(value || '').trim().toUpperCase()
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Fixture base = SN without the revision suffix (-01, -02, ...)
const fixtureBase = (value) => scanKey(value).replace(/-\d+$/, '')

const scanRequestGuard = (request, user, phase = 'issue') => {
  if (!request) return { status: 404, message: 'ไม่พบคำขอนี้' }
  const actor = String(user?.userId || user?.empId || '').toLowerCase()

  // Every barcode scan in Order (issue and return) belongs to the assigned technician.
  if (phase === 'return') {
    if (request.status !== 'Verify') {
      return { status: 409, message: 'คำขอนี้ไม่สามารถสแกนคืนได้' }
    }
  } else if (request.status !== 'Progress' && request.status !== 'Hold') {
    return { status: 409, message: 'คำขอนี้ไม่สามารถสแกนได้อีก' }
  }

  const assignee = String(request.acceptInfo?.empId || request.issueInfo?.empId || '').toLowerCase()
  if (!assignee || actor !== assignee) {
    return { status: 403, message: 'เฉพาะช่างที่รับงานนี้เท่านั้นที่สแกนได้' }
  }
  return null
}

/* Plan of fixtures that must be issued / returned (red list in Complete modal). */
app.get(
  '/api/requests/:requestId/scan-plan',
  asyncRoute(async (req, res) => {
    const request = await Request.findOne({ request_id: text(req.params.requestId) }).lean()
    if (!request) return res.status(404).json({ success: false, message: 'ไม่พบคำขอนี้' })
    res.json({
      success: true,
      plan: await scanPlanForRequest(request),
      matches: request.scanMatches || [],
    })
  }),
)

/* Clear recorded scans so the issue / return lists go back to red and can be
 * rescanned. Fixture statuses are untouched until ตกลง. */
app.post(
  '/api/requests/:requestId/reset-scan',
  asyncRoute(async (req, res) => {
    const request = await Request.findOne({ request_id: text(req.params.requestId) })
    const phase = text(req.body?.phase) === 'return' ? 'return' : 'issue'
    const blocked = scanRequestGuard(request, req.body?.user, phase)
    if (blocked) return res.status(blocked.status).json({ success: false, message: blocked.message })

    // Reset only the active phase so issue history is not silently destroyed.
    request.scanMatches = (request.scanMatches || [])
      .filter((match) => match.action !== (phase === 'return' ? 'return' : 'issue'))
    await request.save()

    return res.json({
      success: true,
      request,
      message: phase === 'return' ? 'รีเซ็ตรายการสแกนคืนแล้ว' : 'รีเซ็ตรายการสแกนแล้ว',
    })
  }),
)

/* Scan one SN: auto-detect issue/return from the plan, validate it, record the
 * match only. Fixture statuses are not changed until the user presses ตกลง. */
app.post(
  '/api/requests/:requestId/scan',
  asyncRoute(async (req, res) => {
    const request = await Request.findOne({ request_id: text(req.params.requestId) })
    const phase = text(req.body?.phase) || 'all'
    const guardPhase = phase === 'return' ? 'return' : 'issue'
    const blocked = scanRequestGuard(request, req.body?.user, guardPhase)
    if (blocked) return res.status(blocked.status).json({ success: false, message: blocked.message })

    const raw = text(req.body?.sn)
    if (!raw) return res.status(400).json({ success: false, message: 'กรุณาสแกน Serial Number' })

    const scanValue = scanKey(raw)
    const usedSn = new Set((request.scanMatches || []).map((item) => scanKey(item.sn)))
    const exact = await FixtureDetail.findOne({ sn: scanValue }).lean()
    if (!exact) {
      // Base-only scans are rejected — the SN must be registered in fixtureDetail.
      const base = fixtureBase(scanValue)
      const candidates = await FixtureDetail
        .find({ sn: { $regex: `^${escapeRegex(base)}-\\d+$` } }, { sn: 1 })
        .lean()
      const hint = candidates.length > 0
        ? ` (เช่น ${candidates.slice(0, 3).map((item) => item.sn).join(', ')})`
        : ''
      return res.status(404).json({
        success: false,
        message: `ไม่พบ ${raw} ในระบบ — ต้องสแกน Serial Number ที่มีอยู่ในระบบเท่านั้น${hint}`,
      })
    }

    const fixture = await findFixture(scanValue)
    if (!fixture) {
      return res.status(404).json({ success: false, message: `ไม่พบ ${raw} ในระบบ` })
    }
    const resolvedSn = fixture.sn
    const plan = await scanPlanForRequest(request)
    let match
    if (plan.length > 0) {
      const base = fixtureBase(scanValue)
      const planMatches = (item) => (item.strictSn
        ? scanKey(item.sn) === scanKey(resolvedSn)
        : fixtureBase(item.sn) === base)
      const usedIndexes = new Set((request.scanMatches || [])
        .map((item) => item.planIndex)
        .filter((value) => Number.isInteger(value)))
      const scopedPlan = phase === 'return'
        ? plan.filter((item) => item.action === 'return')
        : phase === 'issue'
          ? plan.filter((item) => item.action === 'issue')
          : plan
      const candidates = scopedPlan
        .map((item) => ({ ...item, planIndex: plan.indexOf(item) }))
        .filter((item) => planMatches(item) && !usedIndexes.has(item.planIndex))
      if (scopedPlan.some(planMatches) && candidates.length === 0) {
        const strict = scopedPlan.some((item) => item.strictSn)
        return res.status(409).json({
          success: false,
          message: strict
            ? `${resolvedSn} สแกนคืนครบตามรายการที่ระบุในคำขอแล้ว`
            : phase === 'return'
              ? `base ${base} สแกนคืนครบตามจำนวนที่ระบบคำนวณแล้ว`
              : phase === 'issue'
                ? `base ${base} สแกนจ่ายครบตามจำนวนที่ระบบคำนวณแล้ว`
                : `base ${base} สแกนครบตามจำนวนที่ระบบคำนวณแล้ว`,
        })
      }
      if (candidates.length === 0) {
        const strict = scopedPlan.some((item) => item.strictSn)
        return res.status(409).json({
          success: false,
          message: strict
            ? `${resolvedSn} ไม่ตรงกับ Serial Number ที่ต้องคืนของคำขอนี้`
            : phase === 'return'
              ? `${resolvedSn} ไม่ตรงกับรายการที่ต้องคืนของคำขอนี้ (base ${base})`
              : `${resolvedSn} ไม่ตรงกับรายการที่ต้องจ่ายของคำขอนี้ (base ${base})`,
        })
      }
      match = candidates[0]
    } else {
      match = {
        sn: resolvedSn,
        position: '',
        process: '',
        action: phase === 'return'
          ? 'return'
          : phase === 'issue'
            ? 'issue'
            : (fixture.status === 'In Stock' ? 'issue' : 'return'),
      }
    }

    if (usedSn.has(scanKey(resolvedSn))) {
      return res.status(409).json({ success: false, message: `${resolvedSn} ถูกสแกนไปแล้ว` })
    }
    if (match.action === 'issue' && fixture.status !== 'In Stock') {
      return res.status(409).json({
        success: false,
        message: `${resolvedSn} อยู่ในสถานะ ${fixture.status} (ต้องเป็น In Stock ก่อนจ่าย)`,
        fixture,
      })
    }
    // A return-plan fixture already in Stock is treated as confirmed returned;
    // Verify skips the update for it instead of blocking the whole request.

    const matchRecord = {
      sn: scanKey(resolvedSn),
      scannedSn: scanKey(raw),
      planSn: scanKey(match.sn),
      planIndex: match.planIndex,
      action: match.action,
      position: match.position || '',
      process: match.process || '',
    }
    request.scanMatches = [...(request.scanMatches || []), matchRecord]
    await request.save()

    return res.json({
      success: true,
      match: matchRecord,
      request,
      message: `${resolvedSn} ตรงกับรายการ ${match.action === 'issue' ? 'เบิก / จ่าย' : 'รับคืน'}`,
    })
  }),
)

/* ตกลง: apply every matched fixture + move the request to Verify. */
app.post(
  '/api/requests/:requestId/confirm-scan',
  asyncRoute(async (req, res) => {
    const request = await Request.findOne({ request_id: text(req.params.requestId) })
    const blocked = scanRequestGuard(request, req.body?.user, 'issue')
    if (blocked) return res.status(blocked.status).json({ success: false, message: blocked.message })

    const matches = request.scanMatches || []
    const issueMatches = matches.filter((match) => match.action === 'issue')
    const plan = await scanPlanForRequest(request)
    /* Progress phase handles issuing only — returns are shown/applied in Verify. */
    const issuePlan = plan
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.action === 'issue')

    if (issuePlan.length) {
      const usedIndexes = new Set(matches
        .map((match) => match.planIndex)
        .filter((value) => Number.isInteger(value)))
      const remaining = issueMatches
        .filter((match) => !Number.isInteger(match.planIndex))
        .map((match) => scanKey(match.planSn || match.sn))
      const missing = issuePlan.filter(({ item, index }) => {
        if (usedIndexes.has(index)) return false
        const key = scanKey(item.sn)
        const exact = remaining.indexOf(key)
        if (exact >= 0) {
          remaining.splice(exact, 1)
          return false
        }
        const byBase = remaining.findIndex((value) => fixtureBase(value) === fixtureBase(item.sn))
        if (byBase >= 0) {
          remaining.splice(byBase, 1)
          return false
        }
        return true
      })
      if (missing.length) {
        const sample = missing.slice(0, 3).map(({ item }) => item.sn).join(', ')
        return res.status(409).json({
          success: false,
          message: `สแกนจ่ายไม่ครบ — ยังขาด ${missing.length} ตัว (${sample}${missing.length > 3 ? ' …' : ''})`,
        })
      }
    } else if (plan.length === 0 && !issueMatches.length) {
      return res.status(409).json({
        success: false,
        message: 'ต้องสแกนรายการจ่ายก่อนกดตกลง',
      })
    }

    const items = []
    for (const match of issueMatches) {
      const fixture = await findFixture(match.sn)
      if (!fixture) {
        return res.status(404).json({ success: false, message: `ไม่พบ ${match.sn} ในระบบ` })
      }
      const guard = await assertFixtureEditable(fixture.sn)
      if (guard) return res.status(guard.status).json({ success: false, message: guard.message, ...guard })
      if (fixture.status !== 'In Stock') {
        return res.status(409).json({
          success: false,
          message: `${fixture.sn} อยู่ในสถานะ ${fixture.status} (ต้องเป็น In Stock ก่อนจ่าย)`,
        })
      }
      items.push({ match, fixture })
    }

    const inUseAt = todayInput()
    for (const { fixture } of items) {
      const modelForUse = isModelSwap(request.type)
        ? (request.changeModel || request.currentModel || '')
        : (request.currentModel || '')
      await updateFixtureBySn(fixture.sn, {
        status: 'In Use',
        'usage.current': (Number(fixture.usage?.current) || 0) + 1,
        'usage.usedLine': request.line || '',
        'usage.inUseAt': inUseAt,
        'usage.exp': addDaysInput(inUseAt, 90),
        'usage.currentModel': modelForUse,
        'usage.changeModel': isModelSwap(request.type) ? (request.changeModel || '') : '',
      })
      await recordHistory(
        {
          sn: fixture.sn,
          request_id: request.request_id,
          action: 'Issue (Scan)',
          detail: `สแกนจ่าย ${fixture.sn} → ใช้ที่ ${request.line || '-'}`,
          line: request.line,
          model: request.currentModel,
        },
        req.body?.user,
      )
    }

    request.scannedIssue = items.map((item) => item.fixture.sn)
    request.scanMatches = issueMatches
    request.returnedItems = []
    request.issueDone = true
    request.returnDone = false
    request.issueInfo = personFrom(req.body?.user || {})
    request.status = 'Verify'
    await request.save()

    return res.json({
      success: true,
      request,
      message: `จ่าย ${items.length} ตัวสำเร็จ — ${request.request_id} พร้อม Verify และรับคืน`,
    })
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
    if (request.status !== 'Progress' && request.status !== 'Hold') {
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
      const guard = await assertFixtureEditable(sn)
      if (guard) return res.status(guard.status).json({ success: false, message: guard.message, ...guard })
      await updateFixtureBySn(sn, { status: 'Maintenance' })
      await recordHistory(
        {
          sn,
          request_id: request.request_id,
          action: 'Breakdown',
          detail: `ส่งซ่อม (${request.request_id})`,
          line: request.line,
          model: request.currentModel,
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
      const guard = await assertFixtureEditable(sn)
      if (guard) return res.status(guard.status).json({ success: false, message: guard.message, ...guard })
      if (fixture.status !== 'In Stock') {
        return res.status(409).json({
          success: false,
          message: `${sn} ไม่ได้อยู่ในสถานะ In Stock (ปัจจุบัน: ${fixture.status})`,
        })
      }
      const inUseAt = todayInput()
      await updateFixtureBySn(sn, {
        status: 'In Use',
        'usage.current': (Number(fixture.usage?.current) || 0) + 1,
        'usage.usedLine': request.line || '',
        'usage.inUseAt': inUseAt,
        'usage.exp': addDaysInput(inUseAt, 90),
      })
      await recordHistory(
        {
          sn,
          request_id: request.request_id,
          action: 'Issue Spare',
          detail: `จ่าย Spare ตามคำขอ Breakdown ${request.request_id}`,
          line: request.line,
          model: request.currentModel,
        },
        req.body?.user,
      )
      request.items = [sn]
    } else {
      return res.status(400).json({ success: false, message: 'action ต้องเป็น Maintenance หรือ Issue Spare' })
    }

    request.action = action
    request.issueInfo = personFrom(req.body?.user || {})
    request.issueDone = true
    request.returnDone = true
    request.status = 'Verify'
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
    if (request.status !== 'Verify') {
      return res.status(409).json({ success: false, message: 'คำขอนี้ยังไม่พร้อม verify' })
    }

    const actor = String(req.body?.user?.userId || req.body?.user?.empId || '').toLowerCase()
    const requester = String(request.requestInfo?.empId || '').toLowerCase()
    const assignee = String(request.acceptInfo?.empId || request.issueInfo?.empId || '').toLowerCase()
    const roles = []
    if (actor && actor === requester) roles.push('requester')
    if (actor && actor === assignee && !roles.includes('assignee')) roles.push('assignee')
    if (!roles.length) {
      return res.status(403).json({
        success: false,
        message: 'เฉพาะผู้ขอหรือช่างที่รับงานเท่านั้นที่ยืนยันการคืนได้',
      })
    }

    const plan = await scanPlanForRequest(request)
    const returnPlan = plan
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.action === 'return')
    const returnMatches = (request.scanMatches || []).filter((match) => match.action === 'return')
    const returnItems = []
    const missing = []

    if (returnPlan.length) {
      const usedIndexes = new Set(returnMatches
        .map((match) => match.planIndex)
        .filter((value) => Number.isInteger(value)))
      const remaining = returnMatches
        .filter((match) => !Number.isInteger(match.planIndex))
        .map((match) => scanKey(match.planSn || match.sn))

      for (const entry of returnPlan) {
        if (usedIndexes.has(entry.index)) {
          returnItems.push(entry.item)
          continue
        }
        const key = scanKey(entry.item.sn)
        const exact = remaining.indexOf(key)
        if (exact >= 0) {
          remaining.splice(exact, 1)
          returnItems.push(entry.item)
          continue
        }
        // Breakdown returns are pinned to the exact SN in breakdownItems.
        const byBase = entry.item.strictSn
          ? -1
          : remaining.findIndex((value) => fixtureBase(value) === fixtureBase(entry.item.sn))
        if (byBase >= 0) {
          remaining.splice(byBase, 1)
          returnItems.push(entry.item)
          continue
        }
        missing.push(entry.item)
      }
    } else {
      returnItems.push(...returnMatches.map((match) => ({
        sn: match.sn,
        position: match.position || '',
        process: match.process || '',
      })))
    }

    if (missing.length) {
      const sample = missing.slice(0, 3).map((item) => item.sn).join(', ')
      return res.status(409).json({
        success: false,
        message: `สแกนคืนไม่ครบ — ยังขาด ${missing.length} ตัว (${sample}${missing.length > 3 ? ' …' : ''})`,
      })
    }

    // Two-person sign-off: requester + assignee. No password in the Verify modal.
    const approvals = Array.isArray(request.returnApprovals) ? [...request.returnApprovals] : []
    for (const role of roles) {
      const approval = { role, ...personFrom(req.body?.user || {}) }
      const index = approvals.findIndex((item) => item.role === role)
      if (index >= 0) approvals[index] = approval
      else approvals.push(approval)
    }
    request.returnApprovals = approvals

    const approved = new Set(approvals.map((item) => item.role))
    if (!approved.has('requester') || !approved.has('assignee')) {
      request.verifyInfo = personFrom(req.body?.user || {})
      await request.save()
      const waiting = approved.has('requester') ? 'assignee' : 'requester'
      await recordHistory(
        {
          request_id: request.request_id,
          action: 'Verify',
          detail: `ยืนยันโดย ${roles.join(', ')} — รอ${waiting === 'assignee' ? 'ช่างที่รับงาน' : 'ผู้ขอ'}`,
          line: request.line,
          model: request.currentModel,
        },
        req.body?.user,
      )
      return res.json({
        success: true,
        request,
        pending: waiting,
        message: waiting === 'assignee'
          ? 'บันทึกการยืนยันจากผู้ขอแล้ว — รอช่างที่รับงานสแกนและยืนยัน'
          : 'บันทึกการยืนยันจากช่างแล้ว — รอผู้ขอยืนยัน',
      })
    }

    if (!request.returnDone) {
      const returned = []
      for (const item of returnItems) {
        const sn = text(item.sn)
        if (!sn) continue
        const fixture = await findFixture(sn)
        if (!fixture || fixture.status === 'In Stock') continue
        const guard = await assertFixtureEditable(sn)
        if (guard) return res.status(guard.status).json({ success: false, message: guard.message, ...guard })
        await updateFixtureBySn(sn, {
          status: 'In Stock',
          'usage.current': 0,
          'usage.usedLine': '',
          'usage.inUseAt': '',
          'usage.currentModel': '',
          'usage.changeModel': '',
        })
        await recordHistory(
          {
            sn,
            request_id: request.request_id,
            action: 'Return (Verify)',
            detail: `รับคืน ${sn} → In Stock ตอน Verify ${request.request_id}`,
            line: request.line,
            model: request.currentModel,
          },
          req.body?.user,
        )
        returned.push(sn)
      }
      request.returnedItems = returned
      request.returnDone = true
    }

    for (const sn of request.items || []) {
      await recordHistory(
        {
          sn,
          request_id: request.request_id,
          action: 'Verify',
          detail: `ME/TE ยืนยันรับของ ปิดคำขอ ${request.request_id}`,
          line: request.line,
          model: request.currentModel,
        },
        req.body?.user,
      )
    }

    const verifiedSn = [...new Set([
      ...(request.scannedIssue || []),
      ...(request.returnedItems || []),
      ...(request.items || []),
    ].map((sn) => text(sn)).filter(Boolean))]
    const signers = (request.returnApprovals || [])
      .map((item) => `${item.role}:${item.name || item.empId || '-'}`)
      .join(', ')
    await recordHistory(
      {
        request_id: request.request_id,
        action: 'Verify',
        detail: `ปิดคำขอ ${request.request_id} · ${request.type || '-'} · ${verifiedSn.length} ตัว${verifiedSn.length ? ` (${verifiedSn.join(', ')})` : ''}${signers ? ` · ${signers}` : ''}`,
        line: request.line,
        model: request.currentModel,
      },
      req.body?.user,
    )

    request.verifyInfo = personFrom(req.body?.user || {})
    request.status = 'Done'
    await request.save()

    return res.json({ success: true, request, message: `Verify สำเร็จ — ${request.request_id} ปิดงานแล้ว` })
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

/* Manual Issue / Return was removed — all issuing/returning now flows through Order. */

/* ------------------------------------------------------------------ */
/* PM Checklist Phase 2                                                */
/* ------------------------------------------------------------------ */

app.get(
  '/api/pm',
  asyncRoute(async (_req, res) => {
    await syncPmStatuses()
    const fixtures = await flattenFixtureDetails({ status: 'In Use,Maintenance,PM,PM Pending' })
    const data = fixtures.map((fixture) => ({
      ...fixture,
      pmStates: pmStateOf(fixture),
      pmOverdueDays: pmOverdueDays(fixture),
      needs4M: needs4MDocument(fixture),
      usagePercent:
        Number(fixture.usage?.max) > 0
          ? Math.round(((Number(fixture.usage?.current) || 0) / Number(fixture.usage?.max)) * 100)
          : null,
    }))
    res.json(data)
  }),
)

/* Plan PM -> PM & Maintenance (one Line + Model group at a time) */
app.post(
  '/api/pm/plan',
  asyncRoute(async (req, res) => {
    // The UI shows an empty line/model as N/A; treat both spellings as the same group.
    const groupValue = (value) => {
      const raw = text(value)
      return /^n\/?a$/i.test(raw) ? '' : raw
    }
    const lineRaw = text(req.body?.line)
    const modelRaw = text(req.body?.model)
    const line = groupValue(lineRaw)
    const model = groupValue(modelRaw)
    // An explicit empty string is valid: it means the ungrouped (N/A) fixtures.
    // Only a completely missing body should be rejected.
    if (req.body?.line === undefined && req.body?.model === undefined) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือก Line และ Model ก่อนส่ง PM' })
    }
    const lineLabel = line || 'N/A'
    const modelLabel = model || 'N/A'
    const pmDate = text(req.body?.date) || new Date().toISOString().slice(0, 10)
    const note = text(req.body?.note) || ''
    await syncPmStatuses()

    const fixtures = await flattenFixtureDetails({ status: 'PM' })
    const groupRows = fixtures.filter(
      (fixture) => groupValue(fixture.line) === line && groupValue(fixture.model) === model,
    )
    const ready = groupRows.filter((fixture) => !needs4MDocument(fixture))

    const planned = []
    const skipped = []
    for (const fixture of ready) {
      const pmRunId = pmRunKey(fixture.line, fixture.model, pmDate)
      const ok = await updateFixtureBySn(fixture.sn, {
        status: 'Maintenance',
        pmDate,
        pmApproval: 'NotRequired',
        pmRunId,
      })
      if (!ok) {
        skipped.push(fixture.sn)
        continue
      }
      await recordHistory(
        {
          sn: fixture.sn,
          action: 'Start PM',
          detail: `เริ่มทำ PM ${pmDate} → PM & Maintenance${note ? ` · ${note}` : ''}`,
          line: fixture.line,
          model: fixture.model,
          pm_run_id: pmRunId,
        },
        req.body?.user,
      )
      planned.push(fixture.sn)
    }

    if (planned.length === 0) {
      const blockedCount = groupRows.filter((fixture) => needs4MDocument(fixture)).length
      return res.status(409).json({
        success: false,
        skipped,
        message: blockedCount
          ? `ต้องแนบเอกสาร 4M ก่อนเริ่ม PM ${blockedCount} ตัวใน Line ${lineLabel} / Model ${modelLabel}`
          : `ไม่มี Fixture ที่พร้อมเริ่ม PM ใน Line ${lineLabel} / Model ${modelLabel}`,
      })
    }
    return res.json({
      success: true,
      count: planned.length,
      skipped,
      pmDate,
      message: `เริ่ม PM ${planned.length} ตัว → PM & Maintenance (${pmDate}) · Line ${lineLabel} / Model ${modelLabel}${skipped.length ? ` · ข้าม ${skipped.length} ตัว` : ''}`,
    })
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
    const guard = await assertFixtureEditable(sn)
    if (guard) return res.status(guard.status).json({ success: false, message: guard.message, ...guard })

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

/* Attach one 4M document to every overdue fixture in a line + model group. */
app.post(
  '/api/pm/forms/group',
  upload.single('file'),
  asyncRoute(async (req, res) => {
    const groupValue = (value) => {
      const raw = text(value)
      return /^n\/?a$/i.test(raw) ? '' : raw
    }
    const line = groupValue(req.body?.line)
    const model = groupValue(req.body?.model)
    if (!line || !model) {
      return res.status(400).json({
        success: false,
        message: 'Fixture ที่ไม่มี Line / Model ไม่ต้องแนบเอกสาร 4M',
      })
    }
    const lineLabel = line || 'N/A'
    const modelLabel = model || 'N/A'
    const days = Number(req.body?.days)
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุจำนวนวันที่ต้องการทำ PM (1–365)' })
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์เอกสาร 4M' })
    await syncPmStatuses()

    const fixtures = await flattenFixtureDetails({ status: 'In Use,PM,PM Pending,Maintenance' })
    const overdue = fixtures
      .filter((fixture) => groupValue(fixture.line) === line && groupValue(fixture.model) === model)
      .filter((fixture) => pmOverdueDays(fixture) > 3)
    if (!overdue.length) {
      return res.status(400).json({
        success: false,
        message: `ไม่มี Fixture ใน Line ${lineLabel} / Model ${modelLabel} ที่เกินกำหนด PM มากกว่า 3 วัน`,
      })
    }

    const needsApproval = days > 7
    const url = `/uploads/pm/${req.file.filename}`
    for (const fixture of overdue) {
      const set = {
        pmForms: [...(Array.isArray(fixture.pmForms) ? fixture.pmForms : []), url],
        pmRequestedDays: days,
        pmApproval: needsApproval ? 'Pending' : 'NotRequired',
        pmApprovedBy: '',
        pmApprovedAt: '',
      }
      // A fixture already being repaired must not be pushed backwards.
      if (fixture.status !== 'Maintenance') {
        set.status = needsApproval ? 'PM Pending' : 'PM'
      }
      await updateFixtureBySn(fixture.sn, set)
      await recordHistory(
        {
          sn: fixture.sn,
          request_id: '',
          action: needsApproval ? '4M Approval Request' : '4M Document',
          detail: `แนบเอกสาร 4M ประจำ Line ${lineLabel} / Model ${modelLabel} · ขอทำ PM ${days} วัน${needsApproval ? ' → รอ Admin อนุมัติ' : ''}: ${req.file.originalname}`,
          line: lineLabel,
          model: modelLabel,
        },
        req.body?.user,
      )
    }
    return res.json({
      success: true,
      url,
      line: lineLabel,
      model: modelLabel,
      count: overdue.length,
      sns: overdue.map((fixture) => fixture.sn),
      originalName: req.file.originalname,
      days,
      needsApproval,
      message: needsApproval
        ? `แนบ 4M ให้ ${overdue.length} ตัวแล้ว · ขอ PM ${days} วัน — รอ Admin อนุมัติก่อนเข้าซ่อม`
        : `แนบ 4M ให้ ${overdue.length} ตัวแล้ว · กำหนด PM ${days} วัน — พร้อมกดกำลังทำ PM`,
    })
  }),
)

/* Start PM: PM -> Maintenance (single fixture, used by the "กำลังทำ PM" button) */
app.post(
  '/api/pm/start',
  asyncRoute(async (req, res) => {
    const sn = text(req.body?.sn)
    const fixture = await findFixture(sn)
    if (!fixture) return res.status(404).json({ success: false, message: 'ไม่พบ Serial Number นี้' })
    if (fixture.status === 'PM Pending') {
      return res.status(409).json({ success: false, message: 'Fixture นี้รอ Admin อนุมัติ PM อยู่ — ยังเริ่ม PM ไม่ได้' })
    }
    if (fixture.status !== 'PM') {
      return res.status(409).json({ success: false, message: `${sn} ไม่ได้อยู่ในสถานะ PM (ปัจจุบัน: ${fixture.status})` })
    }
    const guard = await assertFixtureEditable(sn)
    if (guard) return res.status(guard.status).json({ success: false, message: guard.message, ...guard })
    if (Number(fixture.pmRequestedDays) > 7 && fixture.pmApproval !== 'Approved') {
      return res.status(409).json({ success: false, message: 'PM เกิน 7 วันต้องได้รับการอนุมัติจาก Admin ก่อน' })
    }
    const pmDate = text(req.body?.date) || todayInput()
    const pmRunId = pmRunKey(fixture.line, fixture.model, pmDate)
    await updateFixtureBySn(sn, { status: 'Maintenance', pmDate, pmRunId })
    await recordHistory(
      {
        sn,
        action: 'Start PM',
        detail: `เริ่มทำ PM ${pmDate} → PM & Maintenance`,
        line: fixture.line,
        model: fixture.model,
        pm_run_id: pmRunId,
      },
      req.body?.user,
    )
    return res.json({ success: true, message: `${sn} → Maintenance · เริ่มทำ PM ${pmDate}` })
  }),
)

/* Admin approve / reject a PM request longer than 7 days */
app.post(
  '/api/pm/approve',
  asyncRoute(async (req, res) => {
    const sn = text(req.body?.sn)
    const action = text(req.body?.action)
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action ต้องเป็น approve หรือ reject' })
    }
    if (!isAdmin(req.body?.user)) {
      return res.status(403).json({ success: false, message: 'เฉพาะ Admin เท่านั้นที่อนุมัติ PM ได้' })
    }
    const fixture = await findFixture(sn)
    if (!fixture) return res.status(404).json({ success: false, message: 'ไม่พบ Serial Number นี้' })
    if (fixture.status !== 'PM Pending') {
      return res.status(409).json({ success: false, message: `${sn} ไม่ได้รออนุมัติ PM (ปัจจุบัน: ${fixture.status})` })
    }

    const approved = action === 'approve'
    const actor = personFrom(req.body?.user || {})
    const pmRunId = approved ? pmRunKey(fixture.line, fixture.model, todayInput()) : ''
    await updateFixtureBySn(sn, {
      status: approved ? 'Maintenance' : 'PM',
      pmApproval: approved ? 'Approved' : 'Rejected',
      pmApprovedBy: [actor.empId, actor.name, actor.lastname].filter(Boolean).join(' ') || 'Admin',
      pmApprovedAt: new Date().toISOString(),
      pmDate: approved ? todayInput() : '',
      pmRunId,
    })
    await recordHistory(
      {
        sn,
        action: approved ? 'PM Approve' : 'PM Reject',
        detail: `Admin ${approved ? 'อนุมัติ' : 'ปฏิเสธ'} PM ${Number(fixture.pmRequestedDays) || 0} วัน${approved ? ' → Maintenance' : ' → กลับเป็น PM'}`,
        line: fixture.line,
        model: fixture.model,
        pm_run_id: pmRunId,
      },
      req.body?.user,
    )
    return res.json({
      success: true,
      message: approved
        ? `${sn} อนุมัติ PM ${Number(fixture.pmRequestedDays) || 0} วัน — เข้าสู่ Maintenance แล้ว`
        : `${sn} ปฏิเสธ PM — กลับไปรอทำ PM`,
    })
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
    const guard = await assertFixtureEditable(sn)
    if (guard) return res.status(guard.status).json({ success: false, message: guard.message, ...guard })

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
    const queue = await flattenFixtureDetails({ status: 'Maintenance' })
    res.json(queue)
  }),
)

/* Verify + Record: OK -> In Stock (new 90-day clock starts on the next issue)
   NG -> Need Scrape -> Need PR -> Already have PR -> New One Replacement */
const NG_OUTCOME_STATUS = {
  'Need Scrape': 'Scrape',
  'Need PR': 'PR',
  'Already have PR': 'PR Ready',
  'New One Replacement': 'Replaced',
}

const verifyMaintenanceFixture = async (sn, result, outcome, user) => {
  const fixture = await findFixture(sn)
  if (!fixture) {
    return { ok: false, status: 404, sn, message: 'ไม่พบ Serial Number นี้' }
  }
  const guard = await assertFixtureEditable(sn)
  if (guard) {
    return { ok: false, status: guard.status, sn, message: guard.message }
  }
  if (fixture.status !== 'Maintenance') {
    return {
      ok: false,
      status: 409,
      sn,
      message: `${sn} ไม่ได้อยู่ในคิว Maintenance (ปัจจุบัน: ${fixture.status})`,
    }
  }
  const pmRunId = text(fixture.pmRunId)

  if (result === 'OK') {
    await updateFixtureBySn(sn, {
      status: 'In Stock',
      pmDate: '',
      pmRunId: '',
      pmRequestedDays: 0,
      pmApproval: '',
      pmApprovedBy: '',
      pmApprovedAt: '',
      'usage.inUseAt': '',
      'usage.exp': '',
      'usage.current': 0,
      'usage.usedLine': '',
      'usage.currentModel': '',
      'usage.changeModel': '',
    })
    await recordHistory(
      {
        sn,
        action: 'PM OK',
        detail: 'Verify + Record OK — กลับเข้า In Stock (รอจ่ายออกเพื่อเริ่ม PM รอบใหม่)',
        line: fixture.line,
        model: fixture.model,
        pm_run_id: pmRunId,
      },
      user,
    )
    return {
      ok: true,
      sn,
      result: 'OK',
      fixture: await findFixture(sn),
      message: `PM ผ่าน — ${sn} กลับเข้า In Stock แล้ว (รอจ่ายออกเพื่อเริ่ม PM รอบใหม่)`,
    }
  }

  if (result === 'NG') {
    if (!NG_OUTCOME_STATUS[outcome]) {
      return {
        ok: false,
        status: 400,
        sn,
        message: 'outcome ต้องเป็น Need Scrape / Need PR / Already have PR / New One Replacement',
      }
    }
    await updateFixtureBySn(sn, {
      status: NG_OUTCOME_STATUS[outcome],
      pmDate: '',
      pmRunId: '',
      pmRequestedDays: 0,
      pmApproval: '',
      pmApprovedBy: '',
      pmApprovedAt: '',
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
        pm_run_id: pmRunId,
      },
      user,
    )
    return {
      ok: true,
      sn,
      result: 'NG',
      outcome,
      fixture: await findFixture(sn),
      message:
        outcome === 'New One Replacement'
          ? `${sn} → New One Replacement — ไปที่ Order เพื่อลงทะเบียนตัวแทน`
          : `${sn} → ${outcome}`,
    }
  }

  return { ok: false, status: 400, sn, message: 'result ต้องเป็น OK หรือ NG' }
}

app.post(
  '/api/maintenance/verify',
  asyncRoute(async (req, res) => {
    const result = text(req.body?.result)
    const verified = await verifyMaintenanceFixture(
      text(req.body?.sn),
      result,
      text(req.body?.outcome),
      req.body?.user,
    )
    if (!verified.ok) {
      return res.status(verified.status).json({ success: false, message: verified.message, sn: verified.sn })
    }
    return res.json({
      success: true,
      result: verified.result,
      ...(verified.result === 'NG' ? { outcome: verified.outcome } : {}),
      fixture: verified.fixture,
      message: verified.message,
    })
  }),
)

/* Bulk Verify from the grouped PM & Maintenance queue. Every SN is checked
 * independently; a blocked SN is skipped and reported instead of failing all. */
app.post(
  '/api/maintenance/verify/bulk',
  asyncRoute(async (req, res) => {
    const sns = Array.isArray(req.body?.sns)
      ? [...new Set(req.body.sns.map(text).filter(Boolean))]
      : []
    if (!sns.length) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือก Fixture ที่ต้อง Verify' })
    }
    const result = text(req.body?.result)
    if (!['OK', 'NG'].includes(result)) {
      return res.status(400).json({ success: false, message: 'result ต้องเป็น OK หรือ NG' })
    }
    const outcome = text(req.body?.outcome)
    if (result === 'NG' && !NG_OUTCOME_STATUS[outcome]) {
      return res.status(400).json({
        success: false,
        message: 'outcome ต้องเป็น Need Scrape / Need PR / Already have PR / New One Replacement',
      })
    }

    const processed = []
    const skipped = []
    for (const sn of sns) {
      const verified = await verifyMaintenanceFixture(sn, result, outcome, req.body?.user)
      if (verified.ok) processed.push({ sn, message: verified.message })
      else skipped.push({ sn, message: verified.message })
    }

    if (!processed.length) {
      return res.status(409).json({
        success: false,
        processed,
        skipped,
        message: skipped[0]?.message || 'ไม่มี Fixture ที่ Verify ได้',
      })
    }

    return res.json({
      success: true,
      result,
      count: processed.length,
      processed,
      skipped,
      message: result === 'OK'
        ? `Verify OK ${processed.length} ตัว — กลับเข้า In Stock แล้ว`
        : `Verify NG ${processed.length} ตัว — ${outcome}`,
    })
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
    await syncPmStatuses()
    const fixtures = await flattenFixtureDetails()
    const counts = {}
    const lineMap = new Map()
    const storageMap = new Map()

    const storageDocs = await Storage.find({}, 'location desc').lean()
    for (const doc of storageDocs) {
      storageMap.set(doc.location, {
        location: doc.location,
        desc: doc.desc || '',
        total: 0,
        inUse: 0,
        maintenance: 0,
      })
    }

    for (const fixture of fixtures) {
      const key = fixture.status || 'Unknown'
      counts[key] = (counts[key] || 0) + 1

      const lineKey = fixture.line || 'N/A'
      const lineRow = lineMap.get(lineKey) || {
        line: lineKey,
        total: 0,
        inUse: 0,
        maintenance: 0,
        order: 0,
        pmOverdue: 0,
      }
      lineRow.total += 1
      if (fixture.status === 'In Use') lineRow.inUse += 1
      if (fixture.status === 'Maintenance') lineRow.maintenance += 1
      if (ORDER_STATUSES.includes(fixture.status)) lineRow.order += 1
      if (pmOverdueDays(fixture) > 0) lineRow.pmOverdue += 1
      lineMap.set(lineKey, lineRow)

      const storageKey = fixture.usage?.storage || fixture.storage || 'ไม่ระบุ'
      const storageRow = storageMap.get(storageKey) || {
        location: storageKey,
        desc: '',
        total: 0,
        inUse: 0,
        maintenance: 0,
      }
      storageRow.total += 1
      if (fixture.status === 'In Use') storageRow.inUse += 1
      if (fixture.status === 'Maintenance') storageRow.maintenance += 1
      storageMap.set(storageKey, storageRow)
    }

    const lineStats = [...lineMap.values()].sort((a, b) => a.line.localeCompare(b.line))
    const storageStats = [...storageMap.values()].sort((a, b) => a.location.localeCompare(b.location))

    const docs = await FixtureList.find({}, 'line model fixtureInfo').lean()
    const lines = {}
    for (const doc of docs) {
      lines[doc.line] = (lines[doc.line] || 0) + (doc.fixtureInfo?.length || 0)
    }

    const pmAlerts = fixtures
      .map((fixture) => ({
        ...fixture,
        pmStates: pmStateOf(fixture),
        pmOverdueDays: pmOverdueDays(fixture),
        needs4M: needs4MDocument(fixture),
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

    const pmStateCounts = {}
    for (const fixture of pmAlerts) {
      const state = fixture.pmStates[0] || 'tracked'
      pmStateCounts[state] = (pmStateCounts[state] || 0) + 1
    }

    const maintenanceQueue = fixtures
      .filter((fixture) => fixture.status === 'Maintenance')
      .map((fixture) => ({
        sn: fixture.sn,
        line: fixture.line,
        model: fixture.model,
        type: fixture.type,
        pmDate: fixture.pmDate,
        usage: fixture.usage,
        pmForms: fixture.pmForms,
        pmOverdueDays: pmOverdueDays(fixture),
        needs4M: needs4MDocument(fixture),
      }))

    const orderFixtures = fixtures
      .filter((fixture) => ORDER_STATUSES.includes(fixture.status))
      .map((fixture) => ({
        sn: fixture.sn,
        line: fixture.line,
        model: fixture.model,
        type: fixture.type,
        status: fixture.status,
        usage: fixture.usage,
      }))

    const recentFixtures = fixtures
      .filter((fixture) => fixture.registered?.date)
      .sort((a, b) => new Date(b.registered.date).getTime() - new Date(a.registered.date).getTime())
      .slice(0, 8)
      .map((fixture) => ({
        sn: fixture.sn,
        line: fixture.line,
        model: fixture.model,
        type: fixture.type,
        status: fixture.status,
        storage: fixture.usage?.storage || fixture.storage || '',
        registered: fixture.registered,
      }))

    const [requests, recentRequests, recentHistory, historyCount] = await Promise.all([
      Request.find({}, 'status type requestType line currentModel changeModel step dueDate queueDate queueSlot request_id').lean(),
      Request.find({}).sort({ _id: -1 }).lean(),
      History.find({}).sort({ date: -1 }).limit(20).lean(),
      History.countDocuments(),
    ])

    const requestStats = {}
    const requestTypeStats = {}
    const byLine = {}
    const byModel = {}
    const byProcess = {}
    for (const request of requests) {
      const key = request.status || 'Unknown'
      requestStats[key] = (requestStats[key] || 0) + 1

      const typeKey = request.type || 'Unknown'
      requestTypeStats[typeKey] = (requestTypeStats[typeKey] || 0) + 1

      const lineKey = request.line || 'N/A'
      byLine[lineKey] = (byLine[lineKey] || 0) + 1
      const modelKey = request.currentModel || 'N/A'
      byModel[modelKey] = (byModel[modelKey] || 0) + 1
      const processKey = request.requestType || 'N/A'
      byProcess[processKey] = (byProcess[processKey] || 0) + 1
    }

    const dueRequests = requests
      .filter((request) => request.dueDate)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
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

    /* Seven-day request trend — read-only input for the Dashboard area chart. */
    const trendDays = Array.from({ length: 7 }, (_, index) => addDaysInput(todayInput(), index - 6))
    const trendMap = new Map(trendDays.map((date) => [date, {
      date,
      label: `${Number(date.slice(5, 7))}/${date.slice(8, 10)}`,
      count: 0,
    }]))
    for (const request of recentRequests) {
      const rawDate = request?.requestInfo?.date || request?.date || request?.createdAt
      if (!rawDate) continue
      const day = String(rawDate).slice(0, 10)
      const row = trendMap.get(day)
      if (row) row.count += 1
    }

    /* Ranked breakdown hotspots for the Dashboard "Top fixture breakdown" list. */
    const breakdownMap = new Map()
    for (const fixture of fixtures) {
      const maintenance = fixture.status === 'Maintenance' ? 1 : 0
      const ng = ORDER_STATUSES.includes(fixture.status) ? 1 : 0
      const pm = pmOverdueDays(fixture) > 0 ? 1 : 0
      if (!maintenance && !ng && !pm) continue
      const line = fixture.line || 'N/A'
      const model = fixture.model || 'N/A'
      const key = `${line} · ${model}`
      const row = breakdownMap.get(key) || { key, line, model, maintenance: 0, ng: 0, pm: 0, total: 0 }
      row.maintenance += maintenance
      row.ng += ng
      row.pm += pm
      row.total += maintenance + ng + pm
      breakdownMap.set(key, row)
    }
    const topBreakdown = [...breakdownMap.values()]
      .sort((a, b) => b.total - a.total || b.maintenance - a.maintenance || a.key.localeCompare(b.key))
      .slice(0, 6)

    res.json({
      success: true,
      total: fixtures.length,
      counts,
      orderCount: orderFixtures.length,
      lines,
      lineStats,
      storageStats,
      requestStats,
      requestTypeStats,
      byLine,
      byModel,
      byProcess,
      dueRequests,
      activeByLine,
      activeByModel,
      activeByProcess,
      requestTrend: [...trendMap.values()],
      topBreakdown,
      pmAlerts,
      pmStateCounts,
      maintenanceQueue,
      orderFixtures,
      recentFixtures,
      recentRequests,
      recentHistory,
      historyCount,
    })
  }),
)

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

/* History has two business sections. Keep the action sets here so the API can
 * filter server-side and the UI can show the same split without guessing. */
const HISTORY_SECTION_ACTIONS = {
  order: [
    'Register', 'Request', 'Accept', 'Hold', 'Reject', 'Complete',
    'Issue', 'Issue (Scan)', 'Breakdown', 'Issue Spare',
    'Verify', 'Return', 'Return (Verify)', 'Edit', 'Delete', 'Order',
  ],
  pm: [
    'PM Due', '4M Document', '4M Approval Request', '4M Approve', '4M Assign',
    'Plan PM', 'Start PM', 'PM Approve', 'PM Reject', 'PM OK', 'PM NG',
  ],
}

app.get(
  '/api/history',
  asyncRoute(async (req, res) => {
    const filter = {}
    const section = text(req.query.section)
    if (HISTORY_SECTION_ACTIONS[section]) {
      filter.action = { $in: HISTORY_SECTION_ACTIONS[section] }
    }
    if (req.query.sn) filter.sn = text(req.query.sn)
    if (req.query.action) {
      filter.action = section && HISTORY_SECTION_ACTIONS[section]
        ? { $in: [text(req.query.action)] }
        : text(req.query.action)
    }
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
