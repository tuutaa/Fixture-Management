/**
 * Frontend-only API used when VITE_MOCK=true (npm run dev:mock).
 * It mirrors the response shapes of server.js and keeps every mutation in
 * memory, so the whole UI can be demoed without MongoDB.
 */
import { addDaysInput, compareFromDb, createMockDb, dayOffset, POSITIONS, todayInput } from './mockData.js'

const CHANGE_MODEL_SLOTS = ['07:00', '08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']

const ORDER_STATUSES = ['Scrape', 'PR', 'PR Ready', 'Replaced']

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

class MockError extends Error {
  constructor(message, status = 400, payload = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

const fail = (message, status = 400, payload = null) => {
  throw new MockError(message, status, payload)
}

const clone = (value) => {
  if (value === undefined) return value
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

const pad = (value, size = 2) => String(value).padStart(size, '0')

const text = (value) => (value === undefined || value === null ? '' : String(value).trim())

const norm = (value) => text(value).toLowerCase()

const same = (a, b) => norm(a) === norm(b)

const statusOfUser = (user) => text(user?.status)

const isAdmin = (user) => /^admin$/i.test(statusOfUser(user))

const isSigned = (user) => /^signed$/i.test(statusOfUser(user))

const canLogin = (user) => isSigned(user) || isAdmin(user)

const personFrom = (user) => ({
  empId: text(user?.userId || user?.empId),
  name: text(user?.name),
  lastname: text(user?.lastName || user?.lastname),
  date: new Date().toISOString(),
})

const actorId = (user) => text(user?.userId || user?.empId).toLowerCase()

const scanKey = (value) => text(value).toUpperCase()

const fixtureBase = (value) => scanKey(value).replace(/-\d+$/, '')

const daysUntil = (value) => {
  const raw = text(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

/* PM uses usage.inUseAt + 90 days. usage.exp is the fixture expiry date and is
 * kept separate so dashboard expiry KPIs do not affect PM overdue logic. */
const pmStartDateOf = (fixture) => text(fixture?.pmStartDate) || text(fixture?.usage?.inUseAt)
const pmDueDateOf = (fixture) => {
  const explicit = text(fixture?.pmDueDate)
  if (/^\d{4}-\d{2}-\d{2}/.test(explicit)) return explicit.slice(0, 10)
  const start = pmStartDateOf(fixture)
  if (!/^\d{4}-\d{2}-\d{2}/.test(start)) return ''
  return addDaysInput(start.slice(0, 10), 90)
}

const todayStamp = () => {
  const now = new Date()
  return `${String(now.getFullYear()).slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
}

const slotLabel = (slot) => {
  if (!slot) return ''
  const hour = Number(String(slot).split(':')[0])
  return `${pad(hour)}:00–${pad(hour + 1)}:00`
}

const pmRunKey = (line, model, date) =>
  `PM|${text(date)}|${text(line) || 'N/A'}|${text(model) || 'N/A'}`

const pmStateOf = (fixture) => {
  const days = daysUntil(pmDueDateOf(fixture))
  const states = []
  if (days !== null) {
    if (days > 3) states.push('tracked')
    else if (days > 0) states.push('pre-alert')
    else if (days === 0) states.push('on-due')
    else if (days >= -3) states.push('overdue-remind')
    else states.push('over-due')
  }
  if (states.length === 0) states.push('tracked')
  return states
}

const pmOverdueDays = (fixture) => {
  const days = daysUntil(pmDueDateOf(fixture))
  return days === null ? 0 : Math.max(0, -days)
}

const hasPmGroup = (fixture) => {
  const line = norm(fixture?.line)
  const model = norm(fixture?.model)
  return Boolean(line) && Boolean(model) && line !== 'n/a' && model !== 'n/a'
}

const needs4MDocument = (fixture) =>
  hasPmGroup(fixture) &&
  pmOverdueDays(fixture) > 3 &&
  !(Array.isArray(fixture?.pmForms) ? fixture.pmForms : []).length

const decoratePm = (fixture) => ({
  ...fixture,
  pmStartDate: pmStartDateOf(fixture),
  pmDueDate: pmDueDateOf(fixture),
  pmStates: pmStateOf(fixture),
  pmOverdueDays: pmOverdueDays(fixture),
  needs4M: needs4MDocument(fixture),
})

const sortValues = (values) =>
  [...new Set(values.filter((value) => value !== '' && value !== null && value !== undefined))].sort(
    (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }),
  )

const matchesFilters = (row, filters = {}) => {
  const checks = ['line', 'model', 'sn', 'type', 'step', 'process', 'position', 'fixtureBase', 'revision']
  for (const key of checks) {
    const wanted = text(filters[key])
    if (!wanted) continue
    if (!norm(row?.[key]).includes(norm(wanted))) return false
  }
  const storage = text(filters.storage)
  if (storage && !norm(row?.usage?.storage || row?.storage).includes(norm(storage))) return false
  const status = text(filters.status)
  if (status) {
    const allowed = status.split(',').map((value) => norm(value)).filter(Boolean)
    if (!allowed.includes(norm(row?.status))) return false
  }
  return true
}

const setDeep = (target, path, value) => {
  const keys = String(path).split('.')
  let node = target
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index]
    if (!node[key] || typeof node[key] !== 'object') node[key] = {}
    node = node[key]
  }
  node[keys[keys.length - 1]] = value
}

let db = createMockDb()

const getDb = () => {
  if (!db) db = createMockDb()
  return db
}

export const resetMockDb = () => {
  db = createMockDb()
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const findFixture = (sn) => getDb().fixtures.find((item) => same(item.sn, sn)) || null

const updateFixture = (sn, set = {}) => {
  const fixture = findFixture(sn)
  if (!fixture) return false
  for (const [key, value] of Object.entries(set)) setDeep(fixture, key, value)
  return true
}

const recordHistory = (entry, user) => {
  const person = personFrom(user)
  getDb().history.push({
    _id: `hist-${Date.now()}-${getDb().seq += 1}`,
    sn: '',
    request_id: '',
    pm_run_id: '',
    action: '',
    detail: '',
    line: '',
    model: '',
    ...entry,
    empId: person.empId || 'system',
    name: person.name || 'System',
    lastname: person.lastname,
    date: person.date,
  })
}

const syncPmStatuses = () => {
  const today = todayInput()
  for (const fixture of getDb().fixtures) {
    if (fixture.status !== 'In Use') continue
    const dueDate = pmDueDateOf(fixture)
    if (!dueDate || dueDate > today) continue
    fixture.status = 'PM'
    recordHistory(
      {
        sn: fixture.sn,
        action: 'PM Due',
        detail: `ครบกำหนด PM 90 วัน (${pmDueDateOf(fixture) || todayInput()}) → รอทำ PM`,
        line: fixture.line,
        model: fixture.model,
      },
      { empId: 'system', name: 'System' },
    )
  }
}

const assertEditable = (fixture) => {
  if (!fixture) fail('ไม่พบ Serial Number นี้', 404)
  if (needs4MDocument(fixture)) {
    fail(
      `Fixture ${fixture.sn} เกินกำหนด PM ${pmOverdueDays(fixture)} วัน — ต้องแนบเอกสาร 4M ก่อนแก้ไข`,
      409,
      { needs4M: true, sn: fixture.sn, line: fixture.line || '' },
    )
  }
}

const detailRows = () => getDb().fixtures

const flattenListed = (filters = {}) => {
  const result = []
  for (const doc of getDb().fixtureLists) {
    if (text(filters.line) && !same(doc.line, filters.line)) continue
    if (text(filters.model) && !same(doc.model, filters.model)) continue
    for (const info of doc.fixtureInfo || []) {
      for (const sn of info.sn || []) {
        const detail = findFixture(sn)
        if (!detail) continue
        const row = {
          ...detail,
          line: detail.line || doc.line || '',
          model: detail.model || doc.model || '',
          step: detail.step || info.step || '',
          process: detail.process || info.process || '',
          position: detail.position || info.position || '',
        }
        if (matchesFilters(row, filters)) result.push(row)
      }
    }
  }
  return result
}

const findRequest = (requestId) =>
  getDb().requests.find((item) => same(item.request_id, requestId)) || null

const planForRequest = (request) => {
  if (!request) return []
  if (request.type === 'Change Model') {
    const cmp = compareFromDb(getDb(), request.line, request.currentModel, request.changeModel)
    return [
      ...cmp.issue.map((item) => ({ ...item, action: 'issue' })),
      ...cmp.return.map((item) => ({ ...item, action: 'return' })),
    ]
  }
  if (request.type === 'Breakdown') {
    const plan = []
    const seen = new Set()
    for (const item of request.breakdownItems || []) {
      const fixture = findFixture(item.sn)
      const base = fixture?.fixtureBase || fixtureBase(item.sn)
      if (!base || seen.has(base)) continue
      seen.add(base)
      plan.push({
        sn: item.sn,
        base,
        symptom: item.symptom || '',
        position: fixture?.position || '',
        process: fixture?.process || '',
        action: 'issue',
        allowSameBase: true,
      })
    }
    for (const item of request.breakdownItems || []) {
      if (!text(item.sn)) continue
      const fixture = findFixture(item.sn)
      plan.push({
        sn: item.sn,
        symptom: item.symptom || '',
        position: fixture?.position || '',
        process: fixture?.process || '',
        action: 'return',
        strictSn: true,
      })
    }
    return plan
  }
  return []
}

const scanGuard = (request, user, phase = 'issue') => {
  if (!request) return { status: 404, message: 'ไม่พบคำขอนี้' }
  if (phase === 'return') {
    if (request.status !== 'Verify') return { status: 409, message: 'คำขอนี้ไม่สามารถสแกนคืนได้' }
  } else if (request.status !== 'Progress' && request.status !== 'Hold') {
    return { status: 409, message: 'คำขอนี้ไม่สามารถสแกนได้อีก' }
  }
  const assignee = text(request.acceptInfo?.empId || request.issueInfo?.empId).toLowerCase()
  if (!assignee || actorId(user) !== assignee) {
    return { status: 403, message: 'เฉพาะช่างที่รับงานนี้เท่านั้นที่สแกนได้' }
  }
  return null
}

/* Mock mirror of the server step after Maintenance OK: the order waits for
 * the requester's final Verify before history close. */
const completeMaintenanceLoops = (sns, user) => {
  const verified = new Set((Array.isArray(sns) ? sns : []).map(text).filter(Boolean))
  if (!verified.size) return []
  const awaitingRequester = []
  for (const request of getDb().requests) {
    if (request.status !== 'Verify' || !request.maintenancePending) continue
    const linked = [...new Set([
      ...(request.maintenanceSns || []),
      ...(request.returnedItems || []),
      ...(request.scannedIssue || []),
    ].map((sn) => text(sn)).filter(Boolean))]
    if (!linked.some((sn) => verified.has(sn))) continue
    request.maintenancePending = false
    request.maintenanceSns = linked
    request.maintenanceCompletedAt = new Date().toISOString()
    request.requesterFinalApproval = false
    request.requesterFinalApprovalAt = null
    request.verifyInfo = personFrom(user || {})
    recordHistory(
      {
        request_id: request.request_id,
        action: 'Maintenance Done',
        detail: `Verify Maintenance เสร็จ — ${request.request_id} รอผู้ขอ Verify เพื่อปิดคำขอ (${linked.filter((sn) => verified.has(sn)).join(', ')})`,
        line: request.line,
        model: request.currentModel,
      },
      user,
    )
    awaitingRequester.push(request.request_id)
  }
  return awaitingRequester
}

const verifyMaintenanceFixture = (sn, result, outcome, user) => {
  const fixture = findFixture(sn)
  if (!fixture) return { ok: false, status: 404, sn, message: 'ไม่พบ Serial Number นี้' }
  try {
    assertEditable(fixture)
  } catch (error) {
    return { ok: false, status: error.status, sn, message: error.message }
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
  const outcomes = {
    'Need Scrape': 'Scrape',
    'Need PR': 'PR',
    'Already have PR': 'PR Ready',
    'New One Replacement': 'Replaced',
  }

  if (result === 'OK') {
    updateFixture(sn, {
      status: 'In Stock',
      pmDate: '',
      pmStartDate: '',
      pmDueDate: '',
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
    recordHistory(
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
      fixture: clone(fixture),
      message: `PM ผ่าน — ${sn} กลับเข้า In Stock แล้ว (รอจ่ายออกเพื่อเริ่ม PM รอบใหม่)`,
    }
  }

  if (result === 'NG') {
    if (!outcomes[outcome]) {
      return {
        ok: false,
        status: 400,
        sn,
        message: 'outcome ต้องเป็น Need Scrape / Need PR / Already have PR / New One Replacement',
      }
    }
    updateFixture(sn, {
      status: outcomes[outcome],
      pmDate: '',
      pmRunId: '',
      pmRequestedDays: 0,
      pmApproval: '',
      pmApprovedBy: '',
      pmApprovedAt: '',
      orderStatus: 'Pending',
      orderNote: outcome,
    })
    recordHistory(
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
      fixture: clone(fixture),
      message:
        outcome === 'New One Replacement'
          ? `${sn} → New One Replacement — ไปที่ Order เพื่อลงทะเบียนตัวแทน`
          : `${sn} → ${outcome}`,
    }
  }

  return { ok: false, status: 400, sn, message: 'result ต้องเป็น OK หรือ NG' }
}

/* ------------------------------------------------------------------ */
/* route handlers                                                      */
/* ------------------------------------------------------------------ */

const handleLogin = (body) => {
  const empId = text(body?.empId ?? body?.username)
  const pass = body?.pass ?? body?.password
  if (!empId || !pass) fail('กรุณากรอก Emp ID และ Password')
  const user = getDb().users.find(
    (item) => (same(item.empId, empId) || same(item.username, empId)) && item.pass === String(pass),
  )
  if (!user) fail('Emp ID หรือ Password ไม่ถูกต้อง', 401)
  if (!canLogin(user)) fail('บัญชีของคุณยังไม่ได้ลงนาม กรุณาติดต่อผู้ดูแลระบบ', 403)
  return {
    success: true,
    name: user.name || '',
    userId: user.empId,
    lastName: user.lastname || '',
    dept: user.dept || '',
    status: user.status || '',
    requestId: user.request_id || '',
    role: isAdmin(user) ? 'admin' : '',
  }
}

const handleRegister = (body) => {
  const empId = text(body?.empId ?? body?.username)
  const pass = text(body?.pass ?? body?.password)
  if (!empId || !pass) fail('กรุณากรอก Emp ID และ Password')
  if (getDb().users.some((item) => same(item.empId, empId) || (item.username && same(item.username, empId)))) {
    fail(`Emp ID ${empId} ถูกใช้งานแล้ว`, 409)
  }
  const user = {
    _id: `u-${getDb().users.length + 1}`,
    empId,
    username: text(body?.username),
    pass,
    name: text(body?.name),
    lastname: text(body?.lastname),
    dept: text(body?.dept),
    status: 'Unsigned',
    request_id: '',
  }
  getDb().users.push(user)
  return {
    success: true,
    message: 'ลงทะเบียนสำเร็จ — รอผู้ดูแลระบบลงนามก่อนเข้าใช้งาน',
    user: { ...user, pass: undefined },
  }
}

const handleFixtureOptions = () => {
  const rows = flattenListed({})
  const pick = (getter) => sortValues(rows.map(getter))
  return {
    lines: pick((row) => row.line),
    models: pick((row) => row.model),
    statuses: pick((row) => row.status),
    types: pick((row) => row.type),
    steps: pick((row) => row.step),
    processes: pick((row) => row.process),
    positions: pick((row) => row.position),
    fixtureBases: pick((row) => row.fixtureBase),
    revisions: pick((row) => row.revision),
    storages: sortValues([
      ...getDb().storages.map((item) => item.location),
      ...rows.map((row) => row.usage?.storage || row.storage),
    ]),
  }
}

const handleDetailOptions = () => {
  const rows = detailRows()
  const positionByProcess = {}
  const addPosition = (process, position) => {
    if (!process || !position) return
    if (!positionByProcess[process]) positionByProcess[process] = []
    if (!positionByProcess[process].includes(position)) positionByProcess[process].push(position)
  }
  for (const item of POSITIONS) addPosition(item.process, item.position)
  for (const row of rows) addPosition(row.process, row.position)
  for (const key of Object.keys(positionByProcess)) positionByProcess[key] = sortValues(positionByProcess[key])
  return {
    sns: sortValues(rows.map((row) => row.sn)),
    lines: sortValues([...getDb().locations, ...rows.map((row) => row.line)]),
    models: sortValues([...getDb().models, ...rows.map((row) => row.model)]),
    statuses: sortValues([
      'In Stock', 'In Use', 'Maintenance', 'Scrape', 'PR', 'PR Ready', 'Replaced', 'PM', 'PM Pending',
      ...rows.map((row) => row.status),
    ]),
    types: sortValues(['Mainline', 'Rotor', 'Winding', 'Function', ...rows.map((row) => row.type)]),
    steps: sortValues([...POSITIONS.map((item) => item.step), ...rows.map((row) => row.step)]),
    processes: sortValues([...POSITIONS.map((item) => item.process), ...rows.map((row) => row.process)]),
    positions: sortValues([...POSITIONS.map((item) => item.position), ...rows.map((row) => row.position)]),
    fixtureBases: sortValues(rows.map((row) => row.fixtureBase)),
    revisions: sortValues(rows.map((row) => row.revision)),
    storages: sortValues([
      ...getDb().storages.map((item) => item.location),
      ...rows.map((row) => row.usage?.storage || row.storage),
    ]),
    positionByProcess,
  }
}

const handleCreateFixture = (body) => {
  const sn = text(body?.sn)
  const line = text(body?.line)
  const model = text(body?.model)
  if (!sn || !line || !model) fail('กรุณากรอก SN, Line และ Model')
  const exists = findFixture(sn)
  if (exists) {
    fail(`Serial Number ${sn} มีในระบบแล้ว (If Exist)`, 409, { fixture: clone(exists) })
  }
  const base = text(body?.fixtureBase) || fixtureBase(sn)
  const revisionMatch = sn.match(/-(\d+)$/)
  const definition =
    POSITIONS.find((item) => same(item.position, body?.position)) || POSITIONS[0]
  const fixture = {
    sn,
    line,
    model,
    status: text(body?.status) || 'In Stock',
    type: text(body?.type) || definition.type,
    step: text(body?.step) || definition.step,
    process: text(body?.process) || definition.process,
    position: text(body?.position) || definition.position,
    usage: {
      current: Number(body?.usage?.current) || 0,
      max: Number(body?.usage?.max) || 100,
      exp: text(body?.usage?.exp) || dayOffset(90),
      storage: text(body?.usage?.storage) || getDb().storages[0]?.location || 'A-01',
      usedLine: '',
      inUseAt: '',
      currentModel: '',
      changeModel: '',
    },
    registered: {
      ...personFrom(body?.user),
      date: text(body?.registeredDate) || new Date().toISOString(),
    },
    fixtureBase: base,
    revision: text(body?.revision) || (revisionMatch ? revisionMatch[1] : '01'),
    pmDate: '',
    pmForms: [],
    pmRequestedDays: 0,
    pmApproval: '',
    pmApprovedBy: '',
    pmApprovedAt: '',
    pmRunId: '',
    orderStatus: '',
    orderNote: '',
  }
  getDb().fixtures.push(fixture)

  let doc = getDb().fixtureLists.find((item) => same(item.line, line) && same(item.model, model))
  if (!doc) {
    doc = { _id: `fl-${getDb().fixtureLists.length + 1}`, line, model, fixtureInfo: [] }
    getDb().fixtureLists.push(doc)
  }
  let info = doc.fixtureInfo.find((item) => same(item.position, fixture.position))
  if (!info) {
    info = { step: fixture.step, process: fixture.process, position: fixture.position, sn: [] }
    doc.fixtureInfo.push(info)
  }
  if (!info.sn.includes(sn)) info.sn.push(sn)

  recordHistory(
    {
      sn,
      action: 'Register',
      detail: `ลงทะเบียนใหม่ ${line} · ${model}`,
      line,
      model,
    },
    body?.user,
  )
  return { success: true, fixture: clone(fixture), message: `ลงทะเบียน ${sn} สำเร็จ` }
}

const handleUpdateFixture = (snValue, body) => {
  const fixture = findFixture(snValue)
  if (!fixture) fail('ไม่พบ Serial Number นี้ในระบบ', 404)
  assertEditable(fixture)

  const set = {}
  for (const key of ['line', 'model', 'type', 'step', 'process', 'position', 'fixtureBase', 'revision', 'description']) {
    if (body?.[key] !== undefined) set[key] = text(body[key])
  }
  if (body?.status !== undefined && text(body.status)) set.status = text(body.status)
  if (body?.usage && typeof body.usage === 'object') {
    for (const [key, value] of Object.entries(body.usage)) {
      set[`usage.${key}`] = key === 'current' || key === 'max' ? Number(value) || 0 : text(value)
    }
  }
  if (body?.registeredDate) {
    set['registered.date'] = new Date(`${text(body.registeredDate)}T08:00:00`).toISOString()
  }
  updateFixture(fixture.sn, set)

  // Keep fixtureList in sync when line/model/step/process/position change.
  for (const listDoc of getDb().fixtureLists) {
    for (const info of listDoc.fixtureInfo || []) {
      const index = (info.sn || []).indexOf(fixture.sn)
      if (index >= 0) {
        info.sn.splice(index, 1)
        if (!info.sn.length) {
          listDoc.fixtureInfo = listDoc.fixtureInfo.filter((row) => row !== info)
        }
      }
    }
  }
  let target = getDb().fixtureLists.find(
    (item) => same(item.line, fixture.line) && same(item.model, fixture.model),
  )
  if (!target) {
    target = { _id: `fl-${getDb().fixtureLists.length + 1}`, line: fixture.line, model: fixture.model, fixtureInfo: [] }
    getDb().fixtureLists.push(target)
  }
  let info = target.fixtureInfo.find((item) => same(item.position, fixture.position))
  if (!info) {
    info = { step: fixture.step, process: fixture.process, position: fixture.position, sn: [] }
    target.fixtureInfo.push(info)
  }
  if (!info.sn.includes(fixture.sn)) info.sn.push(fixture.sn)

  recordHistory(
    {
      sn: fixture.sn,
      action: 'Edit',
      detail: 'แก้ไขข้อมูล Fixture',
      line: fixture.line,
      model: fixture.model,
    },
    body?.user,
  )
  return { success: true, fixture: clone(fixture), message: `บันทึก ${fixture.sn} สำเร็จ` }
}

const handleDeleteFixture = (snValue, body) => {
  const fixture = findFixture(snValue)
  if (!fixture) fail('ไม่พบ Serial Number นี้ในระบบ', 404)
  assertEditable(fixture)
  getDb().fixtures = getDb().fixtures.filter((item) => item !== fixture)
  for (const doc of getDb().fixtureLists) {
    for (const info of doc.fixtureInfo || []) {
      info.sn = (info.sn || []).filter((sn) => !same(sn, fixture.sn))
    }
    doc.fixtureInfo = (doc.fixtureInfo || []).filter((info) => (info.sn || []).length > 0)
  }
  recordHistory(
    {
      sn: fixture.sn,
      action: 'Delete',
      detail: 'ลบ Fixture ออกจากระบบ',
      line: fixture.line,
      model: fixture.model,
    },
    body?.user,
  )
  return { success: true, message: `ลบ ${fixture.sn} แล้ว` }
}

const handleDueDateBulk = (body) => {
  const sns = [...new Set((Array.isArray(body?.sns) ? body.sns : []).map(text).filter(Boolean))]
  const exp = text(body?.exp)
  if (!sns.length) fail('กรุณาเลือก Fixture อย่างน้อย 1 ตัว')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exp) || Number.isNaN(new Date(`${exp}T00:00:00`).getTime())) {
    fail('วันที่ Exp ไม่ถูกต้อง')
  }
  const updated = []
  const missing = []
  const blocked = []
  for (const sn of sns) {
    const fixture = findFixture(sn)
    if (!fixture) {
      missing.push(sn)
      continue
    }
    try {
      assertEditable(fixture)
    } catch (error) {
      blocked.push({ sn, message: error.message })
      continue
    }
    updateFixture(fixture.sn, { 'usage.exp': exp })
    recordHistory(
      {
        sn: fixture.sn,
        action: 'Edit',
        detail: `อัปเดต Exp (PM Due) เป็น ${exp}`,
        line: fixture.line,
        model: fixture.model,
      },
      body?.user,
    )
    updated.push(fixture.sn)
  }
  if (blocked.length) {
    fail(blocked[0].message, 409, { blocked, updated, missing })
  }
  if (!updated.length) fail('ไม่พบ Fixture ที่เลือกในระบบ', 404, { missing })
  return {
    success: true,
    count: updated.length,
    updated,
    missing,
    message: `อัปเดต Exp ${updated.length} Fixture เป็น ${exp} แล้ว`,
  }
}

const handleImportFixtureList = (items) => {
  const list = Array.isArray(items) ? items : []
  if (!list.length) fail('ไม่มีข้อมูลสำหรับ Import')
  let imported = 0
  let inserted = 0
  let updated = 0
  const updatedFixtures = new Set()

  for (const raw of list) {
    const line = text(raw?.line)
    const model = text(raw?.model)
    if (!line || !model) continue
    const fixtureInfo = (Array.isArray(raw?.fixtureInfo) ? raw.fixtureInfo : [])
      .map((info) => {
        const count = Number(info?.count)
        return {
          step: text(info?.step),
          process: text(info?.process),
          position: text(info?.position),
          count: Number.isFinite(count) && count > 0 ? count : 0,
          sn: (Array.isArray(info?.sn) ? info.sn : []).map(text).filter(Boolean),
        }
      })
      .filter((info) => info.position)

    const existing = getDb().fixtureLists.find((doc) => same(doc.line, line) && same(doc.model, model))
    if (existing) {
      existing.fixtureInfo = fixtureInfo
      updated += 1
    } else {
      getDb().fixtureLists.push({
        _id: `fl-${getDb().fixtureLists.length + 1}`,
        line,
        model,
        fixtureInfo,
      })
      inserted += 1
    }
    imported += 1

    /* Fixture List is a position/base master — never create serial records here.
     * Only refresh step/process/position of fixtures already registered. */
    for (const info of fixtureInfo) {
      const bases = new Set(info.sn.map((sn) => fixtureBase(sn)).filter(Boolean))
      if (!bases.size) continue
      for (const fixture of getDb().fixtures) {
        if (!bases.has(fixtureBase(fixture.fixtureBase || fixture.sn))) continue
        fixture.line = line
        fixture.model = model
        fixture.step = info.step
        fixture.process = info.process
        fixture.position = info.position
        updatedFixtures.add(fixture.sn)
      }
    }
  }

  return {
    success: true,
    count: imported,
    inserted,
    updated,
    detailsUpdated: updatedFixtures.size,
    created: 0,
    message: `นำเข้าข้อมูล ${imported} Line/Model เรียบร้อย · เพิ่มใหม่ ${inserted} รายการ, อัปเดต ${updated} รายการ, อัปเดต Fixture ${updatedFixtures.size} ตัว`,
  }
}

const handleCreateRequest = (body) => {
  const type = text(body?.type)
  let line = text(body?.line)
  let currentModel = text(body?.currentModel || body?.model)
  const changeModel = text(body?.changeModel || body?.modelTo)
  const changeBy = type === 'Change Model' && text(body?.changeBy) === 'machine' ? 'machine' : 'line'
  const machine = text(body?.machine)
  const queueDate = text(body?.queueDate) || todayInput()
  const queueSlot = text(body?.queueSlot)
  const breakdownItems = Array.isArray(body?.breakdownItems)
    ? body.breakdownItems
        .map((item) => ({ sn: text(item?.sn), symptom: text(item?.symptom) }))
        .filter((item) => item.sn || item.symptom)
    : []

  if (type === 'Breakdown' && breakdownItems.length) {
    const firstFixture = breakdownItems.map((item) => findFixture(item.sn)).find(Boolean)
    if (!line && firstFixture?.line) line = text(firstFixture.line)
    if (!currentModel && firstFixture?.model) currentModel = text(firstFixture.model)
  }

  if (!type || !line) fail('กรุณาระบุประเภทคำขอและ Line')
  if (!['Change Model', 'Breakdown'].includes(type)) fail('ประเภทคำขอไม่ถูกต้อง')

  if (type === 'Change Model' && changeBy === 'machine') {
    if (!machine) fail('กรุณาเลือกเครื่องจักร (Machine)')
  }

  if (type === 'Change Model' && changeBy === 'line') {
    if (!CHANGE_MODEL_SLOTS.includes(queueSlot)) {
      fail('กรุณาเลือกคิว Change Model (07:00–16:00)')
    }
    const taken = getDb().requests.find(
      (item) => item.type === 'Change Model' && item.queueDate === queueDate && item.queueSlot === queueSlot,
    )
    if (taken) {
      fail(
        `คิว ${slotLabel(queueSlot)} วันที่ ${queueDate} ถูกคำขอ ${taken.request_id} ใช้งานอยู่ กรุณาเลือกคิวอื่น`,
        409,
        { conflict: { requestId: taken.request_id, queueDate, queueSlot } },
      )
    }
  }

  const active = ['Waiting', 'Progress', 'Hold', 'Verify']
  if (type === 'Breakdown') {
    const sns = breakdownItems.map((item) => item.sn).filter(Boolean)
    const duplicate = getDb().requests.find(
      (item) =>
        active.includes(item.status) &&
        (item.breakdownItems || []).some((entry) => sns.includes(text(entry.sn))),
    )
    if (duplicate) {
      const matched = (duplicate.breakdownItems || []).find((entry) => sns.includes(text(entry.sn)))?.sn || sns[0]
      fail(`มีคำขอ ${duplicate.request_id} ที่ยังดำเนินการอยู่สำหรับ Fixture ${matched}`, 409, {
        duplicate: clone(duplicate),
      })
    }
  } else if (currentModel && changeModel) {
    const duplicate = getDb().requests.find(
      (item) =>
        active.includes(item.status) &&
        item.type === 'Change Model' &&
        same(item.line, line) &&
        same(item.currentModel, currentModel) &&
        same(item.changeModel, changeModel) &&
        (changeBy !== 'machine' || same(item.machine, machine)),
    )
    if (duplicate) {
      fail(
        `มีคำขอ ${duplicate.request_id} ที่ยังดำเนินการอยู่สำหรับ ${type} ${line}${changeBy === 'machine' ? ` · ${machine}` : ''} · ${currentModel} → ${changeModel}`,
        409,
        { duplicate: clone(duplicate) },
      )
    }
  }

  const stamp = todayStamp()
  const count = getDb().requests.filter((item) => item.request_id.startsWith(`REQ${stamp}`)).length
  const requestId = `REQ${stamp}${pad(count + 1, 3)}`
  const desc = text(body?.desc) || (changeModel
    ? `${changeBy === 'machine' && machine ? `${machine} · ` : ''}${currentModel} → ${changeModel}`
    : '')
  const request = {
    _id: `req-${getDb().requests.length + 1}`,
    request_id: requestId,
    line,
    currentModel: currentModel || '',
    changeModel: changeModel || '',
    changeBy: type === 'Change Model' ? changeBy : '',
    machine: type === 'Change Model' && changeBy === 'machine' ? machine : '',
    queueDate: type === 'Change Model' && changeBy === 'line' ? queueDate : '',
    queueSlot: type === 'Change Model' && changeBy === 'line' ? queueSlot : '',
    requestType: text(body?.requestType),
    step: text(body?.step),
    dueDate: text(body?.dueDate),
    type,
    status: 'Waiting',
    desc,
    breakdownItems,
    items: [],
    scannedIssue: [],
    returnedItems: [],
    scanMatches: [],
    returnApprovals: [],
    issueDone: false,
    returnDone: false,
    maintenancePending: false,
    maintenanceSns: [],
    requesterFinalApproval: false,
    requesterFinalApprovalAt: null,
    requestInfo: personFrom(body?.user),
  }
  getDb().requests.push(request)
  recordHistory(
    {
      request_id: requestId,
      action: 'Request',
      detail: `${type}${changeBy === 'machine' && machine ? ` · ${machine}` : ''}${currentModel ? ` · ${currentModel}` : ''}`,
      line,
      model: currentModel,
    },
    body?.user,
  )
  return { success: true, request_id: requestId, request: clone(request) }
}

const ensureRequest = (requestId) => {
  const request = findRequest(requestId)
  if (!request) fail('ไม่พบคำขอนี้', 404)
  return request
}

const handleScanPlan = (requestId) => {
  const request = ensureRequest(requestId)
  return { success: true, plan: planForRequest(request), matches: request.scanMatches || [] }
}

const handleScan = (requestId, body) => {
  const request = ensureRequest(requestId)
  const phase = text(body?.phase) || 'all'
  const guardPhase = phase === 'return' ? 'return' : 'issue'
  const blocked = scanGuard(request, body?.user, guardPhase)
  if (blocked) fail(blocked.message, blocked.status)

  const raw = text(body?.sn)
  if (!raw) fail('กรุณาสแกน Serial Number')
  const fixture = findFixture(raw)
  if (!fixture) {
    const base = fixtureBase(raw)
    const hint = getDb().fixtures
      .filter((item) => item.fixtureBase === base)
      .slice(0, 3)
      .map((item) => item.sn)
    fail(
      `ไม่พบ ${raw} ในระบบ — ต้องสแกน Serial Number ที่มีอยู่ในระบบเท่านั้น${hint.length ? ` (เช่น ${hint.join(', ')})` : ''}`,
      404,
    )
  }

  if ((request.scanMatches || []).some((match) => same(match.sn, fixture.sn))) {
    fail(`${fixture.sn} ถูกสแกนไปแล้ว`, 409)
  }

  const plan = planForRequest(request)
  let match
  if (plan.length) {
    const base = fixtureBase(fixture.sn)
    const usedIndexes = new Set(
      (request.scanMatches || [])
        .map((item) => item.planIndex)
        .filter((value) => Number.isInteger(value)),
    )
    const scoped = plan
      .map((item, index) => ({ ...item, planIndex: index }))
      .filter((item) => phase === 'all' || item.action === phase)
    if (!scoped.length) fail(`ไม่มีรายการ${phase === 'return' ? 'คืน' : 'จ่าย'}ในคำขอนี้`, 409)
    const candidates = scoped.filter(
      (item) =>
        !usedIndexes.has(item.planIndex) &&
        (item.strictSn ? same(item.sn, fixture.sn) : fixtureBase(item.sn) === base),
    )
    if (!candidates.length) {
      const matchedAny = scoped.some((item) =>
        item.strictSn ? same(item.sn, fixture.sn) : fixtureBase(item.sn) === base,
      )
      if (matchedAny) {
        fail(
          `${fixture.sn} ถูกสแกนครบตามรายการที่ระบบคำนวณแล้ว`,
          409,
        )
      }
      fail(
        phase === 'return'
          ? `${fixture.sn} ไม่ตรงกับรายการที่ต้องคืนของคำขอนี้ (base ${base})`
          : `${fixture.sn} ไม่ตรงกับรายการที่ต้องจ่ายของคำขอนี้ (base ${base})`,
        409,
      )
    }
    match = candidates[0]
  } else {
    match = {
      sn: fixture.sn,
      position: '',
      process: '',
      action: phase === 'return' ? 'return' : phase === 'issue' ? 'issue' : fixture.status === 'In Stock' ? 'issue' : 'return',
    }
  }

  if (match.action === 'issue' && fixture.status !== 'In Stock') {
    fail(`${fixture.sn} อยู่ในสถานะ ${fixture.status} (ต้องเป็น In Stock ก่อนจ่าย)`, 409, {
      fixture: clone(fixture),
    })
  }

  const matchRecord = {
    sn: fixture.sn,
    scannedSn: scanKey(raw),
    planSn: scanKey(match.sn),
    planIndex: match.planIndex,
    action: match.action,
    position: match.position || '',
    process: match.process || '',
  }
  request.scanMatches = [...(request.scanMatches || []), matchRecord]

  return {
    success: true,
    match: matchRecord,
    request: clone(request),
    message: `${fixture.sn} ตรงกับรายการ ${match.action === 'issue' ? 'เบิก / จ่าย' : 'รับคืน'}`,
  }
}

const handleResetScan = (requestId, body) => {
  const request = ensureRequest(requestId)
  const phase = text(body?.phase) === 'return' ? 'return' : 'issue'
  const blocked = scanGuard(request, body?.user, phase)
  if (blocked) fail(blocked.message, blocked.status)
  request.scanMatches = (request.scanMatches || []).filter(
    (match) => match.action !== (phase === 'return' ? 'return' : 'issue'),
  )
  return {
    success: true,
    request: clone(request),
    message: phase === 'return' ? 'รีเซ็ตรายการสแกนคืนแล้ว' : 'รีเซ็ตรายการสแกนแล้ว',
  }
}

const handleConfirmScan = (requestId, body) => {
  const request = ensureRequest(requestId)
  const blocked = scanGuard(request, body?.user, 'issue')
  if (blocked) fail(blocked.message, blocked.status)

  const matches = request.scanMatches || []
  const issueMatches = matches.filter((match) => match.action === 'issue')
  const plan = planForRequest(request)
  const issuePlan = plan.map((item, index) => ({ item, index })).filter(({ item }) => item.action === 'issue')

  if (issuePlan.length) {
    const usedIndexes = new Set(
      matches.map((match) => match.planIndex).filter((value) => Number.isInteger(value)),
    )
    const remaining = issueMatches
      .filter((match) => !Number.isInteger(match.planIndex))
      .map((match) => scanKey(match.planSn || match.sn))
    const missing = issuePlan.filter(({ item, index }) => {
      if (usedIndexes.has(index)) return false
      const exact = remaining.indexOf(scanKey(item.sn))
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
      fail(`สแกนจ่ายไม่ครบ — ยังขาด ${missing.length} ตัว (${sample}${missing.length > 3 ? ' …' : ''})`, 409)
    }
  } else if (plan.length === 0 && !issueMatches.length) {
    fail('ต้องสแกนรายการจ่ายก่อนกดตกลง', 409)
  }

  const items = []
  for (const match of issueMatches) {
    const fixture = findFixture(match.sn)
    if (!fixture) fail(`ไม่พบ ${match.sn} ในระบบ`, 404)
    assertEditable(fixture)
    if (fixture.status !== 'In Stock') {
      fail(`${fixture.sn} อยู่ในสถานะ ${fixture.status} (ต้องเป็น In Stock ก่อนจ่าย)`, 409)
    }
    const inUseAt = todayInput()
    updateFixture(fixture.sn, {
      status: 'In Use',
      'usage.current': (Number(fixture.usage?.current) || 0) + 1,
      'usage.usedLine': request.line || '',
      'usage.inUseAt': inUseAt,
      pmStartDate: inUseAt,
      pmDueDate: addDaysInput(inUseAt, 90),
      'usage.exp': addDaysInput(inUseAt, 90),
      'usage.currentModel': request.changeModel || request.currentModel || '',
      'usage.changeModel': '',
    })
    recordHistory(
      {
        sn: fixture.sn,
        request_id: request.request_id,
        action: 'Issue (Scan)',
        detail: `สแกนจ่าย → ใช้ที่ ${request.line || 'N/A'}`,
        line: request.line,
        model: request.currentModel,
      },
      body?.user,
    )
    items.push(fixture.sn)
  }

  request.items = [...new Set([...(request.items || []), ...items])]
  request.scannedIssue = items
  request.issueInfo = personFrom(body?.user)
  request.issueDone = true
  request.returnDone = false
  request.status = 'Verify'

  recordHistory(
    {
      request_id: request.request_id,
      action: 'Issue',
      detail: `จ่าย Fixture ${items.length} ตัว → รอตรวจรับคืน`,
      line: request.line,
      model: request.currentModel,
    },
    body?.user,
  )

  return {
    success: true,
    request: clone(request),
    items,
    message: `จ่าย ${items.length} ตัวสำเร็จ — คำขออยู่ระหว่าง Verify`,
  }
}

const handleVerifyRequest = (requestId, body) => {
  const request = ensureRequest(requestId)
  if (request.status !== 'Verify') fail('คำขอนี้ยังไม่พร้อม verify', 409)

  const actor = actorId(body?.user)
  const requester = text(request.requestInfo?.empId).toLowerCase()
  const assignee = text(request.acceptInfo?.empId || request.issueInfo?.empId).toLowerCase()

  // Final requester Verify is deliberately separate from Maintenance OK.
  if (body?.finalApproval === true || body?.requesterFinal === true) {
    if (!request.returnDone) fail('ยังไม่บันทึกการรับคืนของคำขอนี้', 409)
    if (!request.maintenanceCompletedAt) fail('ยังรอ Maintenance เสร็จก่อน Verify ผู้ขอ', 409)
    if (request.requesterFinalApproval) fail('ผู้ขอ Verify ปิดคำขอนี้แล้ว', 409)
    if (!actor || actor !== requester) fail('เฉพาะผู้ขอเท่านั้นที่ Verify ปิดงานได้', 403)

    request.requesterFinalApproval = true
    request.requesterFinalApprovalAt = new Date().toISOString()
    request.verifyInfo = personFrom(body?.user)

    for (const sn of request.items || []) {
      recordHistory(
        {
          sn,
          request_id: request.request_id,
          action: 'Verify',
          detail: `ME/TE ยืนยันผล Maintenance และปิดคำขอ ${request.request_id}`,
          line: request.line,
          model: request.currentModel,
        },
        body?.user,
      )
    }

    const verifiedSn = [...new Set([
      ...(request.scannedIssue || []),
      ...(request.returnedItems || []),
      ...(request.maintenanceSns || []),
      ...(request.items || []),
    ].map((sn) => text(sn)).filter(Boolean))]
    const signers = (request.returnApprovals || [])
      .map((item) => `${item.role}:${item.name || item.empId || '-'}`)
      .join(', ')
    recordHistory(
      {
        request_id: request.request_id,
        action: 'Verify (Requester)',
        detail: `ปิดคำขอ ${request.request_id} · ${request.type || '-'} · ${verifiedSn.length} ตัว${verifiedSn.length ? ` (${verifiedSn.join(', ')})` : ''} · หลัง Maintenance OK${signers ? ` · ${signers}` : ''}`,
        line: request.line,
        model: request.currentModel,
      },
      body?.user,
    )

    request.status = 'Done'
    return {
      success: true,
      request: clone(request),
      message: `Verify สำเร็จ — ${request.request_id} ปิดงานแล้ว`,
    }
  }

  const roles = []
  if (actor && actor === requester) roles.push('requester')
  if (actor && actor === assignee && !roles.includes('assignee')) roles.push('assignee')
  if (!roles.length) fail('เฉพาะผู้ขอหรือช่างที่รับงานเท่านั้นที่ยืนยันการคืนได้', 403)

  const plan = planForRequest(request)
  const returnPlan = plan.map((item, index) => ({ item, index })).filter(({ item }) => item.action === 'return')
  const returnMatches = (request.scanMatches || []).filter((match) => match.action === 'return')
  const returnItems = []
  const missing = []

  if (returnPlan.length) {
    const usedIndexes = new Set(
      returnMatches.map((match) => match.planIndex).filter((value) => Number.isInteger(value)),
    )
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
    returnMatches.forEach((match) => {
      returnItems.push({ sn: match.sn, position: match.position || '', process: match.process || '' })
    })
  }

  if (missing.length) {
    const sample = missing.slice(0, 3).map((item) => item.sn).join(', ')
    fail(`สแกนคืนไม่ครบ — ยังขาด ${missing.length} ตัว (${sample}${missing.length > 3 ? ' …' : ''})`, 409)
  }

  const approvals = Array.isArray(request.returnApprovals) ? [...request.returnApprovals] : []
  for (const role of roles) {
    const approval = { role, ...personFrom(body?.user) }
    const index = approvals.findIndex((item) => item.role === role)
    if (index >= 0) approvals[index] = approval
    else approvals.push(approval)
  }
  request.returnApprovals = approvals

  const approved = new Set(approvals.map((item) => item.role))
  if (!approved.has('requester') || !approved.has('assignee')) {
    request.verifyInfo = personFrom(body?.user)
    const waiting = approved.has('requester') ? 'assignee' : 'requester'
    recordHistory(
      {
        request_id: request.request_id,
        action: 'Verify',
        detail: `ยืนยันโดย ${roles.join(', ')} — รอ${waiting === 'assignee' ? 'ช่างที่รับงาน' : 'ผู้ขอ'}`,
        line: request.line,
        model: request.currentModel,
      },
      body?.user,
    )
    return {
      success: true,
      request: clone(request),
      pending: waiting,
      message:
        waiting === 'assignee'
          ? 'บันทึกการยืนยันจากผู้ขอแล้ว — รอช่างที่รับงานสแกนและยืนยัน'
          : 'บันทึกการยืนยันจากช่างแล้ว — รอผู้ขอยืนยัน',
    }
  }

  const wantsMaintenance = body?.maintenance === true || body?.needMaintenance === true
  if (!request.returnDone) {
    const returned = []
    for (const item of returnItems) {
      const fixture = findFixture(item.sn)
      if (!fixture) continue
      if (!wantsMaintenance && fixture.status === 'In Stock') continue
      assertEditable(fixture)
      updateFixture(fixture.sn, {
        status: wantsMaintenance ? 'Maintenance' : 'In Stock',
        pmStartDate: '',
        pmDueDate: '',
        'usage.current': 0,
        'usage.usedLine': '',
        'usage.inUseAt': '',
        'usage.currentModel': '',
        'usage.changeModel': '',
      })
      recordHistory(
        {
          sn: fixture.sn,
          request_id: request.request_id,
          action: 'Return (Verify)',
          detail: `รับคืน ${fixture.sn} → ${wantsMaintenance ? 'Maintenance (รอซ่อม)' : 'In Stock'} ตอน Verify ${request.request_id}`,
          line: request.line,
          model: request.currentModel,
        },
        body?.user,
      )
      returned.push(fixture.sn)
    }
    request.returnedItems = returned
    request.returnDone = true
  }

  request.verifyInfo = personFrom(body?.user)

  if (wantsMaintenance) {
    const pendingSns = [...new Set(
      (request.returnedItems || []).map((sn) => text(sn)).filter(Boolean),
    )]
    request.maintenancePending = true
    request.maintenanceSns = pendingSns
    request.maintenanceRequestedAt = new Date().toISOString()
    request.maintenanceCompletedAt = null
    request.status = 'Verify'
    recordHistory(
      {
        request_id: request.request_id,
        action: 'Maintenance Pending',
        detail: `Verify สำเร็จ — ${request.request_id} รอ Maintenance ${pendingSns.length} ตัว ไปที่หน้า PM & Maintenance เพื่อตรวจรับ`,
        line: request.line,
        model: request.currentModel,
      },
      body?.user,
    )
    return {
      success: true,
      request: clone(request),
      maintenancePending: true,
      message: `Verify สำเร็จ — ${request.request_id} รอ Maintenance ${pendingSns.length} ตัว (ไปที่ PM & Maintenance)`,
    }
  }

  for (const sn of request.items || []) {
    recordHistory(
      {
        sn,
        request_id: request.request_id,
        action: 'Verify',
        detail: `ME/TE ยืนยันรับของ ปิดคำขอ ${request.request_id}`,
        line: request.line,
        model: request.currentModel,
      },
      body?.user,
    )
  }

  request.verifyInfo = personFrom(body?.user)
  request.status = 'Done'
  return {
    success: true,
    request: clone(request),
    message: `Verify สำเร็จ — ${request.request_id} ปิดงานแล้ว`,
  }
}

const handleBreakdown = (requestId, body) => {
  const request = ensureRequest(requestId)
  if (request.type !== 'Breakdown') fail('ใช้กับคำขอ Breakdown เท่านั้น')
  if (request.status !== 'Progress' && request.status !== 'Hold') fail('คำขอนี้ดำเนินการไปแล้ว', 409)

  const action = text(body?.action)
  const sn = text(body?.sn)
  if (!sn) fail('กรุณาระบุ SN ของ Fixture')
  const fixture = findFixture(sn)
  if (!fixture) fail(`ไม่พบ ${sn} ในระบบ`, 404)
  assertEditable(fixture)

  if (action === 'Maintenance') {
    updateFixture(fixture.sn, { status: 'Maintenance' })
    recordHistory(
      {
        sn: fixture.sn,
        request_id: request.request_id,
        action: 'Breakdown',
        detail: `ส่งซ่อม (${request.request_id})`,
        line: request.line,
        model: request.currentModel,
      },
      body?.user,
    )
  } else if (action === 'Issue Spare') {
    if (fixture.status !== 'In Stock') {
      fail(`${fixture.sn} ไม่ได้อยู่ในสถานะ In Stock (ปัจจุบัน: ${fixture.status})`, 409)
    }
    const inUseAt = todayInput()
    updateFixture(fixture.sn, {
      status: 'In Use',
      'usage.current': (Number(fixture.usage?.current) || 0) + 1,
      'usage.usedLine': request.line || '',
      'usage.inUseAt': inUseAt,
      pmStartDate: inUseAt,
      pmDueDate: addDaysInput(inUseAt, 90),
      'usage.exp': addDaysInput(inUseAt, 90),
    })
    recordHistory(
      {
        sn: fixture.sn,
        request_id: request.request_id,
        action: 'Issue Spare',
        detail: `จ่าย Spare ตามคำขอ Breakdown ${request.request_id}`,
        line: request.line,
        model: request.currentModel,
      },
      body?.user,
    )
  } else {
    fail('action ต้องเป็น Maintenance หรือ Issue Spare')
  }

  request.items = [fixture.sn]
  request.action = action
  request.issueInfo = personFrom(body?.user)
  request.issueDone = true
  request.returnDone = true
  // Breakdown actions bypass the scan flow — record the plan as already handled
  // so Verify can close the request immediately.
  const plan = planForRequest(request)
  request.scanMatches = plan.map((item, planIndex) => ({
    sn: item.action === 'issue' && action === 'Issue Spare' ? fixture.sn : item.sn,
    scannedSn: item.sn,
    planSn: item.sn,
    planIndex,
    action: item.action,
    position: item.position || '',
    process: item.process || '',
  }))
  request.status = 'Verify'
  return { success: true, request: clone(request) }
}

/* ------------------------------------------------------------------ */
/* request dispatcher                                                  */
/* ------------------------------------------------------------------ */

export async function mockRequest(path, { method = 'GET', body } = {}) {
  const database = getDb()
  const [pathname, search = ''] = String(path).split('?')
  const parts = pathname.split('/').filter(Boolean)
  const query = new URLSearchParams(search)
  const verb = String(method).toUpperCase()
  const segment = (index) => parts[index] || ''

  /* health */
  if (verb === 'GET' && parts[0] === 'health') {
    return { ok: true, mongo: 'mock', time: new Date().toISOString() }
  }

  /* auth / users */
  if (verb === 'POST' && parts[0] === 'login') return clone(handleLogin(body))
  if (verb === 'POST' && parts[0] === 'register') return clone(handleRegister(body))
  if (verb === 'GET' && parts[0] === 'me') {
    const empId = text(query.get('empId'))
    const user = database.users.find((item) => same(item.empId, empId))
    if (!user) fail('ไม่พบผู้ใช้นี้', 404)
    return clone({ ...user, pass: undefined })
  }
  if (parts[0] === 'users') {
    if (verb === 'GET') return clone(database.users.map((item) => ({ ...item, pass: undefined })))
    if (verb === 'PUT' && parts[1]) {
      const user = database.users.find((item) => same(item._id, decodeURIComponent(parts[1])) || same(item.empId, decodeURIComponent(parts[1])))
      if (!user) fail('ไม่พบผู้ใช้นี้', 404)
      for (const key of ['empId', 'username', 'name', 'lastname', 'dept', 'status', 'request_id']) {
        if (body?.[key] !== undefined) user[key] = text(body[key])
      }
      if (body?.pass) user.pass = text(body.pass)
      return clone({ success: true, user: { ...user, pass: undefined } })
    }
    if (verb === 'DELETE' && parts[1]) {
      database.users = database.users.filter(
        (item) => !same(item._id, decodeURIComponent(parts[1])) && !same(item.empId, decodeURIComponent(parts[1])),
      )
      return { success: true }
    }
  }

  /* fixture list */
  if (parts[0] === 'fixturelist') {
    if (verb === 'GET' && parts[1] === 'options') {
      const lines = sortValues(database.fixtureLists.map((doc) => doc.line))
      const models = sortValues(database.fixtureLists.map((doc) => doc.model))
      const modelsByLine = {}
      for (const doc of database.fixtureLists) {
        if (!doc.line || !doc.model) continue
        if (!modelsByLine[doc.line]) modelsByLine[doc.line] = []
        if (!modelsByLine[doc.line].includes(doc.model)) modelsByLine[doc.line].push(doc.model)
      }
      for (const key of Object.keys(modelsByLine)) modelsByLine[key].sort()
      return clone({ lines, models, modelsByLine })
    }
    if (verb === 'GET' && parts[1] === 'compare') {
      const line = text(query.get('line'))
      const from = text(query.get('from'))
      const to = text(query.get('to'))
      if (!line || !from || !to) fail('ต้องระบุ line, from และ to')
      return clone({ success: true, line, from, to, ...compareFromDb(database, line, from, to) })
    }
    if (verb === 'GET' && !parts[1]) {
      syncPmStatuses()
      const line = text(query.get('line'))
      const model = text(query.get('model'))
      const docs = database.fixtureLists
        .filter((doc) => (!line || same(doc.line, line)) && (!model || same(doc.model, model)))
        .slice()
        .sort((a, b) => `${a.line}|${a.model}`.localeCompare(`${b.line}|${b.model}`))
      return clone(docs)
    }
    if (verb === 'POST' && parts[1] === 'import') {
      return clone(handleImportFixtureList(body?.items))
    }
  }

  /* fixtures */
  if (parts[0] === 'fixture-stats' && verb === 'GET') {
    const counts = {}
    for (const fixture of database.fixtures) {
      counts[fixture.status || 'Unknown'] = (counts[fixture.status || 'Unknown'] || 0) + 1
    }
    return clone({ total: database.fixtures.length, counts })
  }
  if (parts[0] === 'fixture-details' && verb === 'GET') return clone(database.fixtures)

  if (parts[0] === 'fixtures') {
    if (verb === 'GET' && parts[1] === 'options') return clone(handleFixtureOptions())
    if (verb === 'GET' && parts[1] === 'detail' && parts[2] === 'options') return clone(handleDetailOptions())
    if (verb === 'GET' && parts[1] === 'detail') {
      syncPmStatuses()
      const filters = {}
      for (const key of ['line', 'model', 'status', 'sn', 'type', 'step', 'process', 'position', 'storage', 'fixtureBase', 'revision']) {
        filters[key] = query.get(key) || ''
      }
      let rows = database.fixtures.filter((row) => matchesFilters(row, filters))
      const q = text(query.get('q'))
      if (q) {
        const needle = norm(q)
        rows = rows.filter((row) =>
          [row.sn, row.type, row.fixtureBase, row.usage?.storage, row.model, row.line, row.process, row.position, row.revision, row.description]
            .filter(Boolean)
            .some((value) => norm(value).includes(needle)),
        )
      }
      return clone(rows)
    }
    if (verb === 'POST' && parts[1] === 'due-date') return clone(handleDueDateBulk(body))
    if (verb === 'GET' && !parts[1]) {
      syncPmStatuses()
      const filters = {}
      for (const key of ['line', 'model', 'status', 'sn', 'type', 'step', 'process', 'position', 'storage', 'fixtureBase', 'revision']) {
        filters[key] = query.get(key) || ''
      }
      let rows = flattenListed(filters)
      const q = text(query.get('q'))
      if (q) {
        const needle = norm(q)
        rows = rows.filter((row) =>
          [row.sn, row.type, row.fixtureBase, row.usage?.storage, row.model, row.line, row.process, row.position]
            .filter(Boolean)
            .some((value) => norm(value).includes(needle)),
        )
      }
      return clone(rows)
    }
    if (verb === 'POST' && !parts[1]) return clone(handleCreateFixture(body))
    if (verb === 'GET' && parts[1]) {
      const fixture = findFixture(decodeURIComponent(parts[1]))
      if (!fixture) fail('ไม่พบ Serial Number นี้ในระบบ', 404)
      return clone({ success: true, fixture })
    }
    if (verb === 'PUT' && parts[1]) {
      return clone(handleUpdateFixture(decodeURIComponent(parts[1]), body))
    }
    if (verb === 'DELETE' && parts[1]) {
      return clone(handleDeleteFixture(decodeURIComponent(parts[1]), body))
    }
  }

  /* storages */
  if (parts[0] === 'storages') {
    if (verb === 'GET') return clone(database.storages)
    if (verb === 'POST') {
      const location = text(body?.location)
      if (!location) fail('กรุณาระบุ Location')
      if (database.storages.some((item) => same(item.location, location))) {
        fail(`Location ${location} มีอยู่แล้ว`, 409)
      }
      const storage = { _id: `st-${database.storages.length + 1}`, location, desc: text(body?.desc) }
      database.storages.push(storage)
      return clone({ success: true, storage })
    }
    if (verb === 'PUT' && parts[1]) {
      const storage = database.storages.find((item) => item._id === decodeURIComponent(parts[1]))
      if (!storage) fail('ไม่พบ Storage นี้', 404)
      if (body?.location !== undefined) storage.location = text(body.location)
      if (body?.desc !== undefined) storage.desc = text(body.desc)
      return clone({ success: true, storage })
    }
    if (verb === 'DELETE' && parts[1]) {
      database.storages = database.storages.filter((item) => item._id !== decodeURIComponent(parts[1]))
      return { success: true }
    }
  }

  /* FAN2 reference data */
  if (parts[0] === 'fan2') {
    if (parts[1] === 'locations') return clone(database.locations)
    if (parts[1] === 'models') return clone(database.models)
    if (parts[1] === 'machines') return clone(database.machines)
  }

  /* requests */
  if (parts[0] === 'requests') {
    if (verb === 'GET' && parts[1] === 'change-model-slots') {
      const date = text(query.get('date')) || todayInput()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('วันที่ไม่ถูกต้อง')
      const taken = database.requests.filter(
        (item) => item.type === 'Change Model' && item.queueDate === date && CHANGE_MODEL_SLOTS.includes(item.queueSlot),
      )
      return clone(
        CHANGE_MODEL_SLOTS.map((slot) => {
          const row = taken.find((item) => item.queueSlot === slot)
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
    }
    if (verb === 'GET' && !parts[1]) {
      const status = text(query.get('status'))
      const type = text(query.get('type'))
      const empId = text(query.get('empId'))
      const rows = database.requests
        .filter((item) => (!status || same(item.status, status)) && (!type || same(item.type, type)))
        .filter((item) => !empId || same(item.requestInfo?.empId, empId))
        .slice()
        .reverse()
      return clone(rows)
    }
    if (verb === 'POST' && !parts[1]) return clone(handleCreateRequest(body))

    const requestId = decodeURIComponent(parts[1] || '')
    const action = segment(2)
    const request = () => ensureRequest(requestId)

    if ((verb === 'GET' || verb === 'POST') && action === 'scan-plan') {
      return clone(handleScanPlan(requestId))
    }
    if (verb === 'POST' && action === 'scan') return clone(handleScan(requestId, body))
    if (verb === 'POST' && action === 'reset-scan') return clone(handleResetScan(requestId, body))
    if (verb === 'POST' && action === 'confirm-scan') return clone(handleConfirmScan(requestId, body))
    if (verb === 'PUT' && action === 'breakdown') return clone(handleBreakdown(requestId, body))
    if (verb === 'PUT' && action === 'verify') return clone(handleVerifyRequest(requestId, body))

    if (verb === 'GET' && parts[1] && !action) {
      const row = ensureRequest(requestId)
      return clone({ success: true, request: row })
    }
    if (verb === 'DELETE' && parts[1] && !action) {
      const row = ensureRequest(requestId)
      database.requests = database.requests.filter((item) => item !== row)
      recordHistory(
        {
          request_id: row.request_id,
          action: 'Delete',
          detail: `ลบคำขอ ${row.request_id}`,
          line: row.line,
          model: row.currentModel,
        },
        body?.user,
      )
      return { success: true }
    }

    if (verb === 'PUT' && action === 'accept') {
      const row = request()
      if (row.status !== 'Waiting' && row.status !== 'Hold') fail('คำขอนี้ได้รับการยืนยันแล้ว', 409)
      row.status = 'Progress'
      row.acceptInfo = personFrom(body?.user)
      row.issueDone = false
      row.returnDone = false
      recordHistory(
        {
          request_id: row.request_id,
          action: 'Accept',
          detail: `รับงาน ${row.type || ''} · ${row.line || '-'}`,
          line: row.line,
          model: row.currentModel,
        },
        body?.user,
      )
      return clone({ success: true, request: row })
    }
    if (verb === 'PUT' && action === 'hold') {
      const row = request()
      if (row.status !== 'Progress') fail('คำขอนี้ไม่สามารถ Hold ได้', 409)
      row.status = 'Hold'
      recordHistory(
        { request_id: row.request_id, action: 'Hold', detail: `พักงาน ${row.request_id}`, line: row.line, model: row.currentModel },
        body?.user,
      )
      return clone({ success: true, request: row })
    }
    if (verb === 'PUT' && action === 'reject') {
      const row = request()
      if (row.status !== 'Waiting' && row.status !== 'Hold') fail('คำขอนี้ไม่สามารถปฏิเสธได้', 409)
      row.status = 'Rejected'
      recordHistory(
        { request_id: row.request_id, action: 'Reject', detail: `ปฏิเสธ ${row.request_id}`, line: row.line, model: row.currentModel },
        body?.user,
      )
      return clone({ success: true, request: row })
    }
    if (verb === 'PUT' && action === 'complete') {
      const row = request()
      if (row.status !== 'Progress' && row.status !== 'Hold') fail('คำขอนี้ไม่สามารถ complete ได้', 409)
      row.status = 'Verify'
      recordHistory(
        { request_id: row.request_id, action: 'Complete', detail: `Complete คำขอ ${row.request_id}`, line: row.line, model: row.currentModel },
        body?.user,
      )
      return clone({ success: true, request: row })
    }
  }

  /* PM */
  if (parts[0] === 'pm') {
    if (verb === 'GET' && !parts[1]) {
      syncPmStatuses()
      const rows = database.fixtures
        .filter((fixture) => ['In Use', 'Maintenance', 'PM', 'PM Pending'].includes(fixture.status))
        .map(decoratePm)
      return clone(rows)
    }
    if (verb === 'POST' && parts[1] === 'plan') {
      const groupValue = (value) => {
        const raw = text(value)
        return /^n\/?a$/i.test(raw) ? '' : raw
      }
      if (body?.line === undefined && body?.model === undefined) {
        fail('กรุณาเลือก Line และ Model ก่อนส่ง PM')
      }
      const line = groupValue(body?.line)
      const model = groupValue(body?.model)
      const pmDate = text(body?.date) || todayInput()
      const note = text(body?.note)
      syncPmStatuses()
      const groupRows = database.fixtures.filter(
        (fixture) =>
          fixture.status === 'PM' &&
          groupValue(fixture.line) === line &&
          groupValue(fixture.model) === model,
      )
      const ready = groupRows.filter((fixture) => !needs4MDocument(fixture))
      const planned = []
      const skipped = []
      for (const fixture of ready) {
        const pmRunId = pmRunKey(fixture.line, fixture.model, pmDate)
        updateFixture(fixture.sn, {
          status: 'Maintenance',
          pmDate,
          pmApproval: 'NotRequired',
          pmRunId,
        })
        recordHistory(
          {
            sn: fixture.sn,
            action: 'Start PM',
            detail: `เริ่มทำ PM ${pmDate} → PM & Maintenance${note ? ` · ${note}` : ''}`,
            line: fixture.line,
            model: fixture.model,
            pm_run_id: pmRunId,
          },
          body?.user,
        )
        planned.push(fixture.sn)
      }
      if (!planned.length) {
        const blocked = groupRows.filter((fixture) => needs4MDocument(fixture)).length
        fail(
          blocked
            ? `ต้องแนบเอกสาร 4M ก่อนเริ่ม PM ${blocked} ตัวใน Line ${line || 'N/A'} / Model ${model || 'N/A'}`
            : `ไม่มี Fixture ที่พร้อมเริ่ม PM ใน Line ${line || 'N/A'} / Model ${model || 'N/A'}`,
          409,
          { skipped },
        )
      }
      return clone({
        success: true,
        count: planned.length,
        skipped,
        pmDate,
        message: `เริ่ม PM ${planned.length} ตัว → PM & Maintenance (${pmDate}) · Line ${line || 'N/A'} / Model ${model || 'N/A'}${skipped.length ? ` · ข้าม ${skipped.length} ตัว` : ''}`,
      })
    }
    if (verb === 'POST' && parts[1] === 'start') {
      const sn = text(body?.sn)
      const fixture = findFixture(sn)
      if (!fixture) fail('ไม่พบ Serial Number นี้', 404)
      if (fixture.status === 'PM Pending') fail('Fixture นี้รอ Admin อนุมัติ PM อยู่ — ยังเริ่ม PM ไม่ได้', 409)
      if (fixture.status !== 'PM') fail(`${sn} ไม่ได้อยู่ในสถานะ PM (ปัจจุบัน: ${fixture.status})`, 409)
      assertEditable(fixture)
      if (Number(fixture.pmRequestedDays) > 7 && fixture.pmApproval !== 'Approved') {
        fail('PM เกิน 7 วันต้องได้รับการอนุมัติจาก Admin ก่อน', 409)
      }
      const pmDate = text(body?.date) || todayInput()
      const pmRunId = pmRunKey(fixture.line, fixture.model, pmDate)
      updateFixture(fixture.sn, { status: 'Maintenance', pmDate, pmRunId })
      recordHistory(
        {
          sn,
          action: 'Start PM',
          detail: `เริ่มทำ PM ${pmDate} → PM & Maintenance`,
          line: fixture.line,
          model: fixture.model,
          pm_run_id: pmRunId,
        },
        body?.user,
      )
      return clone({ success: true, message: `${sn} → Maintenance · เริ่มทำ PM ${pmDate}` })
    }
    if (verb === 'POST' && parts[1] === 'approve') {
      const sn = text(body?.sn)
      const action = text(body?.action)
      if (!['approve', 'reject'].includes(action)) fail('action ต้องเป็น approve หรือ reject')
      if (!isAdmin(body?.user)) fail('เฉพาะ Admin เท่านั้นที่อนุมัติ PM ได้', 403)
      const fixture = findFixture(sn)
      if (!fixture) fail('ไม่พบ Serial Number นี้', 404)
      if (fixture.status !== 'PM Pending') {
        fail(`${sn} ไม่ได้รออนุมัติ PM (ปัจจุบัน: ${fixture.status})`, 409)
      }
      const approved = action === 'approve'
      const actor = personFrom(body?.user)
      const pmRunId = approved ? pmRunKey(fixture.line, fixture.model, todayInput()) : ''
      updateFixture(fixture.sn, {
        status: approved ? 'Maintenance' : 'PM',
        pmApproval: approved ? 'Approved' : 'Rejected',
        pmApprovedBy: [actor.empId, actor.name, actor.lastname].filter(Boolean).join(' ') || 'Admin',
        pmApprovedAt: new Date().toISOString(),
        pmDate: approved ? todayInput() : '',
        pmRunId,
      })
      recordHistory(
        {
          sn,
          action: approved ? 'PM Approve' : 'PM Reject',
          detail: `Admin ${approved ? 'อนุมัติ' : 'ปฏิเสธ'} PM ${Number(fixture.pmRequestedDays) || 0} วัน${approved ? ' → Maintenance' : ' → กลับเป็น PM'}`,
          line: fixture.line,
          model: fixture.model,
          pm_run_id: pmRunId,
        },
        body?.user,
      )
      return clone({
        success: true,
        message: approved
          ? `${sn} อนุมัติ PM ${Number(fixture.pmRequestedDays) || 0} วัน — เข้าสู่ Maintenance แล้ว`
          : `${sn} ปฏิเสธ PM — กลับไปรอทำ PM`,
      })
    }
    if (verb === 'POST' && parts[1] === 'extend') {
      const sn = text(body?.sn)
      const days = Number(body?.days) || 0
      if (!sn || days <= 0) fail('กรุณาระบุ SN และจำนวนวัน')
      const fixture = findFixture(sn)
      if (!fixture) fail('ไม่พบ Serial Number นี้', 404)
      assertEditable(fixture)
      const formUrl = text(body?.formUrl)
      const hasForm = Boolean(formUrl) || (Array.isArray(fixture.pmForms) && fixture.pmForms.length > 0)
      if (days > 7 && !hasForm) {
        fail('PM เกิน 7 วัน ต้อง Import เอกสาร 4M ก่อนอนุมัติ', 400, { need4M: true })
      }
      const due = pmDueDateOf(fixture)
      const base = due ? new Date(`${due}T00:00:00`) : new Date()
      base.setDate(base.getDate() + days)
      const iso = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`
      const set = { pmDueDate: iso }
      if (formUrl) set.pmForms = [...(fixture.pmForms || []), formUrl]
      updateFixture(fixture.sn, set)
      recordHistory(
        {
          sn,
          action: '4M Approve',
          detail: `Management Approve · 4M +${days} Days (ถึง ${iso})${formUrl ? ' · แนบเอกสาร 4M' : ''}`,
          line: fixture.line,
          model: fixture.model,
        },
        body?.user,
      )
      return clone({ success: true, pmDueDate: iso, exp: iso, message: `ขยาย PM ของ ${sn} ไปถึง ${iso}` })
    }
    if (verb === 'POST' && parts[1] === 'assign') {
      const sn = text(body?.sn)
      const assignees = Array.isArray(body?.assignees) && body.assignees.length
        ? body.assignees.map(text).filter(Boolean)
        : ['QA', 'ME', 'TE', 'PD']
      const days = Number(body?.days) || 0
      if (!sn) fail('กรุณาระบุ SN')
      const fixture = findFixture(sn)
      if (!fixture) fail('ไม่พบ Serial Number นี้', 404)
      assertEditable(fixture)
      const set = { status: 'Maintenance' }
      if (days > 0) {
        const due = pmDueDateOf(fixture)
        const base = due ? new Date(`${due}T00:00:00`) : new Date()
        base.setDate(base.getDate() + days)
        set.pmDueDate = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`
      }
      updateFixture(fixture.sn, set)
      recordHistory(
        {
          sn,
          action: '4M Assign',
          detail: `Management Assign (${assignees.join(', ')})${days ? ` +${days} Days` : ''}`,
          line: fixture.line,
          model: fixture.model,
        },
        body?.user,
      )
      return clone({ success: true, message: `Assign ${sn} ให้ ${assignees.join(', ')} แล้ว` })
    }
  }

  /* maintenance */
  if (parts[0] === 'maintenance') {
    if (verb === 'GET' && !parts[1]) {
      const rows = database.fixtures.filter((fixture) => fixture.status === 'Maintenance')
      return clone(rows)
    }
    if (verb === 'POST' && parts[1] === 'verify' && parts[2] === 'bulk') {
      const sns = Array.isArray(body?.sns) ? body.sns.map(text).filter(Boolean) : []
      if (!sns.length) fail('กรุณาเลือก Fixture อย่างน้อย 1 ตัว')
      const result = text(body?.result)
      const processed = []
      const skipped = []
      for (const sn of sns) {
        try {
          const verified = verifyMaintenanceFixture(sn, result, text(body?.outcome), body?.user)
          if (!verified.ok) {
            skipped.push({ sn, message: verified.message })
            continue
          }
          processed.push({
            sn,
            result: verified.result,
            ...(verified.result === 'NG' ? { outcome: verified.outcome } : {}),
          })
        } catch (error) {
          skipped.push({ sn, message: error.message })
        }
      }
      if (!processed.length) {
        fail(skipped[0]?.message || 'ไม่สามารถ Verify Fixture ที่เลือกได้', 409, { skipped, processed })
      }
      const closedRequests = result === 'OK'
        ? completeMaintenanceLoops(processed.map((item) => item.sn), body?.user)
        : []
      return clone({
        success: true,
        count: processed.length,
        processed,
        skipped,
        closedRequests,
        message: `Verify ${processed.length} ตัวสำเร็จ${skipped.length ? ` · ข้าม ${skipped.length} ตัว` : ''}${closedRequests.length ? ` · ${closedRequests.join(', ')} รอผู้ขอ Verify` : ''}`,
      })
    }
    if (verb === 'POST' && parts[1] === 'verify') {
      const verified = verifyMaintenanceFixture(
        text(body?.sn),
        text(body?.result),
        text(body?.outcome),
        body?.user,
      )
      if (!verified.ok) {
        fail(verified.message, verified.status || 400, {
          ...(verified.result === 'NG' ? { outcome: verified.outcome } : {}),
          sn: verified.sn,
        })
      }
      const closedRequests = verified.result === 'OK'
        ? completeMaintenanceLoops([verified.sn], body?.user)
        : []
      return clone({
        success: true,
        result: verified.result,
        ...(verified.result === 'NG' ? { outcome: verified.outcome } : {}),
        fixture: verified.fixture,
        closedRequests,
        message: closedRequests.length
          ? `${verified.message} · ${closedRequests.join(', ')} รอผู้ขอ Verify เพื่อปิดคำขอ`
          : verified.message,
      })
    }
  }

  /* orders */
  if (parts[0] === 'orders') {
    if (verb === 'GET') {
      syncPmStatuses()
      return clone(database.fixtures.filter((fixture) => ORDER_STATUSES.includes(fixture.status)))
    }
    if (verb === 'POST' && parts[1] && parts[2] === 'action') {
      const fixture = findFixture(decodeURIComponent(parts[1]))
      if (!fixture) fail('ไม่พบ Serial Number นี้', 404)
      const transitions = {
        'Need PR': { status: 'PR', label: 'Need PR (Red color)' },
        'Already have PR': { status: 'PR Ready', label: 'Already have PR (Yellow)' },
        'New One Replacement': { status: 'Replaced', label: 'New One Replacement' },
        'Need Scrape': { status: 'Scrape', label: 'Need Scrape (Red color)' },
        Restock: { status: 'In Stock', label: 'Restock เข้า Stock' },
      }
      const action = text(body?.action)
      const target = transitions[action]
      if (!target) fail('action ไม่ถูกต้อง')
      updateFixture(fixture.sn, {
        status: target.status,
        orderStatus: action === 'Restock' ? '' : 'Pending',
        orderNote: action === 'Restock' ? '' : action,
      })
      recordHistory(
        {
          sn: fixture.sn,
          action: 'Order',
          detail: target.label,
          line: fixture.line,
          model: fixture.model,
        },
        body?.user,
      )
      return clone({ success: true, message: `${fixture.sn} → ${target.label}` })
    }
  }

  /* dashboard */
  if (parts[0] === 'dashboard' && verb === 'GET') {
    syncPmStatuses()
    const fixtures = database.fixtures
    const counts = {}
    const lineMap = new Map()
    const storageMap = new Map()
    for (const storage of database.storages) {
      storageMap.set(storage.location, {
        location: storage.location,
        desc: storage.desc || '',
        total: 0,
        inUse: 0,
        maintenance: 0,
      })
    }
    const expiryStats = { expiringIn3Days: 0, expired: 0 }
    for (const fixture of fixtures) {
      const key = fixture.status || 'Unknown'
      counts[key] = (counts[key] || 0) + 1

      const expDays = daysUntil(fixture.usage?.exp)
      if (expDays !== null && expDays >= 0 && expDays <= 3) expiryStats.expiringIn3Days += 1
      if (expDays !== null && expDays < 0) expiryStats.expired += 1

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

      const storageKey = fixture.usage?.storage || 'ไม่ระบุ'
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

    const lines = {}
    for (const doc of database.fixtureLists) {
      lines[doc.line] = (lines[doc.line] || 0) + (doc.fixtureInfo?.length || 0)
    }

    const pmAlerts = fixtures
      .map(decoratePm)
      .filter((fixture) => !fixture.pmStates.every((state) => state === 'tracked'))
      .sort((a, b) => {
        const rank = { 'over-due': 0, 'overdue-remind': 1, 'on-due': 2, 'pre-alert': 3, tracked: 4 }
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
        pmStartDate: pmStartDateOf(fixture),
        pmDueDate: pmDueDateOf(fixture),
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
      .slice()
      .sort((a, b) => new Date(b.registered.date).getTime() - new Date(a.registered.date).getTime())
      .slice(0, 8)
      .map((fixture) => ({
        sn: fixture.sn,
        line: fixture.line,
        model: fixture.model,
        type: fixture.type,
        status: fixture.status,
        storage: fixture.usage?.storage || '',
        registered: fixture.registered,
      }))

    const requestStats = {}
    const requestTypeStats = {}
    const byLine = {}
    const byModel = {}
    const byProcess = {}
    for (const request of database.requests) {
      const key = request.status || 'Unknown'
      requestStats[key] = (requestStats[key] || 0) + 1
      requestTypeStats[request.type || 'Unknown'] = (requestTypeStats[request.type || 'Unknown'] || 0) + 1
      byLine[request.line || 'N/A'] = (byLine[request.line || 'N/A'] || 0) + 1
      byModel[request.currentModel || 'N/A'] = (byModel[request.currentModel || 'N/A'] || 0) + 1
      byProcess[request.requestType || 'N/A'] = (byProcess[request.requestType || 'N/A'] || 0) + 1
    }

    const dueRequests = database.requests
      .filter((request) => request.dueDate)
      .slice()
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
      .map((request) => ({ ...request, daysLeft: daysUntil(request.dueDate) }))

    const activeByLine = {}
    const activeByModel = {}
    const activeByProcess = {}
    for (const fixture of fixtures) {
      if (fixture.status !== 'In Use') continue
      activeByLine[fixture.line || 'N/A'] = (activeByLine[fixture.line || 'N/A'] || 0) + 1
      activeByModel[fixture.model || 'N/A'] = (activeByModel[fixture.model || 'N/A'] || 0) + 1
      const processKey = fixture.type || 'N/A'
      activeByProcess[processKey] = (activeByProcess[processKey] || 0) + 1
    }

    const trendDays = Array.from({ length: 7 }, (_, index) => addDaysInput(todayInput(), index - 6))
    const trendMap = new Map(
      trendDays.map((date) => [
        date,
        { date, label: `${Number(date.slice(5, 7))}/${date.slice(8, 10)}`, count: 0 },
      ]),
    )
    for (const request of database.requests) {
      const rawDate = request?.requestInfo?.date || request?.date
      if (!rawDate) continue
      const row = trendMap.get(String(rawDate).slice(0, 10))
      if (row) row.count += 1
    }

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

    const recentRequests = database.requests.slice().reverse()

    return clone({
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
      expiryStats,
      pmAlerts,
      pmStateCounts,
      maintenanceQueue,
      orderFixtures,
      recentFixtures,
      recentRequests,
      recentHistory: database.history
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20),
      historyCount: database.history.length,
    })
  }

  /* history */
  if (parts[0] === 'history' && verb === 'GET') {
    const section = text(query.get('section'))
    const action = text(query.get('action'))
    const sn = text(query.get('sn'))
    const requestId = text(query.get('request_id'))
    const q = text(query.get('q'))
    const limit = Math.min(Number(query.get('limit')) || 200, 1000)
    let rows = database.history.slice()
    if (HISTORY_SECTION_ACTIONS[section]) {
      rows = rows.filter((item) => HISTORY_SECTION_ACTIONS[section].includes(item.action))
    }
    if (sn) rows = rows.filter((item) => same(item.sn, sn))
    if (action) rows = rows.filter((item) => same(item.action, action))
    if (requestId) rows = rows.filter((item) => same(item.request_id, requestId))
    if (q) {
      const needle = norm(q)
      rows = rows.filter((item) =>
        [item.sn, item.request_id, item.action, item.detail, item.name, item.lastname, item.empId, item.line, item.model]
          .filter(Boolean)
          .some((value) => norm(value).includes(needle)),
      )
    }
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return clone(rows.slice(0, limit))
  }

  fail(`Mock mode: ไม่รองรับ ${verb} ${pathname}`, 404)
}

/* Multipart uploads are wired straight from api.js in mock mode. */
export function mockPmUpload(sn, file, user) {
  const fixture = findFixture(sn)
  if (!fixture) fail('ไม่พบ Serial Number นี้', 404)
  if (!file) fail('กรุณาเลือกไฟล์เอกสาร 4M')
  const url = `/uploads/pm/mock-${fixture.sn}.pdf`
  updateFixture(fixture.sn, { pmForms: [...(fixture.pmForms || []), url] })
  recordHistory(
    {
      sn: fixture.sn,
      action: '4M Document',
      detail: `Import เอกสาร 4M: ${file?.name || 'mock-4m.pdf'}`,
      line: fixture.line,
      model: fixture.model,
    },
    user,
  )
  return clone({ success: true, url, originalName: file?.name || 'mock-4m.pdf' })
}

export function mockPmUploadGroup(line, model, docNo, days, user) {
  if (!line || !model) fail('Fixture ที่ไม่มี Line / Model ไม่ต้องใส่ Doc NO. 4M')
  const amount = Number(days)
  if (!Number.isFinite(amount) || amount < 1 || amount > 365) {
    fail('กรุณาระบุจำนวนวันที่ต้องการทำ PM (1–365)')
  }
  const value = String(docNo || '').trim()
  if (!value) fail('กรุณากรอก Doc NO. 4M')
  syncPmStatuses()
  const overdue = getDb().fixtures.filter(
    (fixture) =>
      ['In Use', 'PM', 'PM Pending', 'Maintenance'].includes(fixture.status) &&
      same(fixture.line, line) &&
      same(fixture.model, model) &&
      pmOverdueDays(fixture) > 3,
  )
  if (!overdue.length) {
    fail(`ไม่มี Fixture ใน Line ${line} / Model ${model} ที่เกินกำหนด PM มากกว่า 3 วัน`)
  }
  const needsApproval = amount > 7
  for (const fixture of overdue) {
    const set = {
      pmForms: [...(fixture.pmForms || []), value],
      pmRequestedDays: amount,
      pmApproval: needsApproval ? 'Pending' : 'NotRequired',
      pmApprovedBy: '',
      pmApprovedAt: '',
    }
    if (fixture.status !== 'Maintenance') set.status = needsApproval ? 'PM Pending' : 'PM'
    updateFixture(fixture.sn, set)
    recordHistory(
      {
        sn: fixture.sn,
        action: needsApproval ? '4M Approval Request' : '4M Document',
        detail: `ใส่ Doc NO. 4M ประจำ Line ${line} / Model ${model} · ขอทำ PM ${amount} วัน${needsApproval ? ' → รอ Admin อนุมัติ' : ''}: ${value}`,
        line,
        model,
      },
      user,
    )
  }
  return clone({
    success: true,
    docNo: value,
    line,
    model,
    count: overdue.length,
    sns: overdue.map((fixture) => fixture.sn),
    days: amount,
    needsApproval,
    message: needsApproval
      ? `ใส่ Doc NO. 4M ให้ ${overdue.length} ตัวแล้ว · ขอ PM ${amount} วัน — รอ Admin อนุมัติก่อนเข้าซ่อม`
      : `ใส่ Doc NO. 4M ให้ ${overdue.length} ตัวแล้ว · กำหนด PM ${amount} วัน — พร้อมกดกำลังทำ PM`,
  })
}
