/**
 * Demo dataset for mock mode (VITE_MOCK=true / npm run dev:mock).
 * ------------------------------------------------------------
 * Shapes mirror what server.js returns, so every page renders without
 * MongoDB. State is in-memory only and resets on reload.
 */

const pad = (value, size = 2) => String(value).padStart(size, '0')

const dateAt = (days, hour = 9, minute = 15) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, minute, 0, 0)
  return date
}

export const dayOffset = (days) => {
  const date = dateAt(days)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const todayInput = () => dayOffset(0)

const stampAt = (days, hour = 9, minute = 15) => dateAt(days, hour, minute).toISOString()

const todayStamp = () => {
  const now = new Date()
  return `${String(now.getFullYear()).slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
}

export const addDaysInput = (date, days) => {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))
    ? new Date(`${date}T00:00:00`)
    : new Date()
  base.setDate(base.getDate() + days)
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`
}

/* Master positions (same step / process / position that the real app imports). */
export const POSITIONS = [
  { step: 'STEP ROTOR', process: 'Rotor Assy', position: 'Stopport Impeller', type: 'Rotor', scope: 'rotor' },
  { step: 'STEP ROTOR', process: 'Rotor Assy', position: 'Permanence yoke', type: 'Rotor', scope: 'rotor' },
  { step: 'STEP ROTOR', process: 'Rotor Assy', position: 'Insert Rot', type: 'Rotor', scope: 'rotor' },
  { step: 'STEP ROTOR', process: 'Rotor Assy', position: 'Vibration rotor', type: 'Rotor', scope: 'rotor' },
  { step: 'STEP ROTOR', process: 'Rotor Assy', position: 'Support Apply oil', type: 'Rotor', scope: 'rotor' },
  { step: 'TEST STEP', process: 'BL Test', position: 'Balance rotor', type: 'Function', scope: 'common' },
  { step: 'STEP WINDING', process: 'Winding', position: 'Winding (Arbor)', type: 'Winding', scope: 'stator' },
  { step: 'TEST STEP', process: 'Stator Test', position: 'DCR Test', type: 'Function', scope: 'stator' },
  { step: 'STEP1', process: 'Solder PWB', position: 'Insert stator with PWB', type: 'Mainline', scope: 'stator' },
  { step: 'STEP2', process: 'Apply silicone', position: 'Apply silicone', type: 'Mainline', scope: 'common' },
  { step: 'TEST STEP', process: 'Function', position: 'Function Test', type: 'Function', scope: 'common' },
]

const STAFF = [
  { empId: '10001', name: 'Somchai', lastname: 'Jaidee', dept: 'Maintenance' },
  { empId: '10002', name: 'Naree', lastname: 'Sukjai', dept: 'Production' },
  { empId: '10003', name: 'Preeda', lastname: 'Kongdee', dept: 'QA' },
  { empId: '10004', name: 'Anan', lastname: 'Rattana', dept: 'Fixture Room' },
]

const ORDER_STATE_BY_STATUS = {
  Scrape: 'Pending',
  PR: 'Accepted',
  'PR Ready': 'Hold',
  Replaced: 'Issued',
}

/* Current models first — entries marked shareWith are reused by the target
 * model on the same line so Change Model compare has a non-empty keep group. */
const MODEL_SPECS = [
  {
    line: 'FAN2-L1',
    model: 'MX-100A',
    code: 'MX1A',
    entries: [
      { pos: 0, status: 'In Use', exp: -10, forms: true },
      { pos: 1, status: 'In Use', exp: -1, shareWith: true },
      { pos: 2, status: 'In Use', exp: 0 },
      { pos: 3, status: 'In Use', exp: 2 },
      { pos: 4, status: 'In Use', exp: 12 },
      { pos: 5, status: 'In Use', exp: 45, current: 92, shareWith: true },
      { pos: 6, status: 'Maintenance', exp: -5, pmDate: 0, forms: true },
      { pos: 7, status: 'PM', exp: -1, forms: true, run: true },
      { pos: 8, status: 'PM', exp: -12, forms: true },
      { pos: 9, status: 'In Use', exp: 30 },
      { pos: 10, status: 'In Use', exp: 60 },
    ],
  },
  {
    line: 'FAN2-L1',
    model: 'MX-200B',
    code: 'MX2B',
    entries: [
      { pos: 1, share: true },
      { pos: 2, status: 'In Stock' },
      { pos: 3, status: 'In Stock' },
      { pos: 5, share: true },
      { pos: 6, status: 'In Stock' },
    ],
  },
  {
    line: 'FAN2-L2',
    model: 'MX-100A',
    code: 'MX1A',
    entries: [
      { pos: 0, status: 'In Use', exp: -8, shareWith: true },
      { pos: 1, status: 'In Use', exp: 5 },
      { pos: 2, status: 'In Use', exp: 30 },
      { pos: 2, status: 'In Stock', extra: true },
      { pos: 3, status: 'In Use', exp: 60 },
      { pos: 4, status: 'In Use', exp: -2, forms: true, shareWith: true },
      { pos: 5, status: 'In Use', exp: 0 },
      { pos: 6, status: 'Maintenance', exp: -3, pmDate: -1, forms: true },
      {
        pos: 7,
        status: 'PM Pending',
        exp: -4,
        forms: true,
        requestedDays: 14,
        approval: 'Pending',
      },
      { pos: 8, status: 'Maintenance', exp: -1, pmDate: 0, forms: true },
      { pos: 9, status: 'In Use', exp: 15 },
      { pos: 10, status: 'In Use', exp: 90 },
    ],
  },
  {
    line: 'FAN2-L2',
    model: 'MX-300C',
    code: 'MX3C',
    entries: [
      { pos: 0, share: true },
      { pos: 4, share: true },
      { pos: 8, status: 'In Stock' },
      { pos: 9, status: 'In Stock' },
      { pos: 10, status: 'In Stock' },
    ],
  },
  {
    line: 'FAN2-L3',
    model: 'RTR-500',
    code: 'RTR5',
    entries: [
      { pos: 0, status: 'In Use', exp: -15 },
      { pos: 1, status: 'In Use', exp: -1 },
      { pos: 2, status: 'In Use', exp: 3 },
      { pos: 3, status: 'Maintenance', exp: -2, pmDate: 0, forms: true },
      { pos: 4, status: 'In Use', exp: 20 },
      { pos: 4, status: 'In Stock', extra: true },
      { pos: 5, status: 'PM', exp: 0, forms: true, run: true },
      {
        pos: 9,
        status: 'PM Pending',
        exp: -6,
        forms: true,
        requestedDays: 10,
        approval: 'Pending',
      },
      { pos: 10, status: 'Scrape', exp: -4, orderNote: 'Need Scrape (Red color)' },
    ],
  },
  {
    line: 'FAN2-L4',
    model: 'ST-700',
    code: 'ST7',
    entries: [
      { pos: 5, status: 'In Use', exp: -6, forms: true },
      { pos: 6, status: 'In Use', exp: 4 },
      { pos: 7, status: 'In Use', exp: 25 },
      { pos: 7, status: 'In Stock', extra: true },
      { pos: 8, status: 'PR', exp: -2, orderNote: 'Need PR (Red color)' },
      { pos: 9, status: 'PR Ready', exp: -1, orderNote: 'Already have PR (Yellow)' },
      { pos: 10, status: 'Replaced', exp: -7, orderNote: 'New One Replacement' },
    ],
  },
]

export const MOCK_STORAGES = [
  { _id: 'st-1', location: 'A-01', desc: 'Rack A · Rotor fixtures' },
  { _id: 'st-2', location: 'A-02', desc: 'Rack A · Stator fixtures' },
  { _id: 'st-3', location: 'B-01', desc: 'Rack B · Mainline fixtures' },
  { _id: 'st-4', location: 'B-02', desc: 'Rack B · Winding fixtures' },
  { _id: 'st-5', location: 'C-01', desc: 'Cabinet C · Spare fixtures' },
]

const personAt = (staff, daysAgo, hour = 8, minute = 0) => ({
  empId: staff.empId,
  name: staff.name,
  lastname: staff.lastname,
  date: stampAt(-daysAgo, hour, minute),
})

const ADMIN_PERSON = { empId: 'admin', name: 'Administrator', lastname: '', dept: 'System' }

const personFor = (empId, daysAgo, hour = 8, minute = 0) => {
  const staff =
    empId === ADMIN_PERSON.empId
      ? ADMIN_PERSON
      : STAFF.find((item) => item.empId === empId) || STAFF[0]
  return personAt(staff, daysAgo, hour, minute)
}

const modelRows = (fixtureLists, line, model) => {
  const doc = fixtureLists.find((item) => item.line === line && item.model === model)
  const map = new Map()
  for (const info of doc?.fixtureInfo || []) {
    const key = String(info.position || '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (!key) continue
    if (!map.has(key)) {
      map.set(key, {
        position: String(info.position || '').trim(),
        process: String(info.process || '').trim(),
        sn: [],
      })
    }
    const bucket = map.get(key)
    if (!bucket.process && info.process) bucket.process = String(info.process).trim()
    for (const sn of info.sn || []) if (sn) bucket.sn.push(String(sn))
  }
  return [...map.values()].flatMap((bucket) =>
    bucket.sn.map((sn) => ({ sn, position: bucket.position, process: bucket.process })),
  )
}

/* Same contract as /api/fixturelist/compare. */
export const compareFromDb = (db, line, from, to) => {
  const fromItems = modelRows(db.fixtureLists, line, from)
  const toItems = modelRows(db.fixtureLists, line, to)
  const fromSns = new Set(fromItems.map((item) => item.sn))
  const toSns = new Set(toItems.map((item) => item.sn))
  return {
    issue: toItems.filter((item) => !fromSns.has(item.sn)),
    return: fromItems.filter((item) => !toSns.has(item.sn)),
    keep: toItems.filter((item) => fromSns.has(item.sn)),
  }
}

export function createMockDb() {
  const storages = MOCK_STORAGES.map((item) => ({ ...item }))
  const fixtures = []
  const fixtureLists = []
  const shared = new Map()
  let index = 0

  for (const spec of MODEL_SPECS) {
    const doc = {
      _id: `fl-${fixtureLists.length + 1}`,
      line: spec.line,
      model: spec.model,
      fixtureInfo: [],
    }
    const infoByPos = new Map()

    for (const entry of spec.entries) {
      const definition = POSITIONS[entry.pos]
      if (!definition) continue
      const lineKey = spec.line.replace('FAN2-', '')
      const base = `${lineKey}${spec.code}-P${pad(entry.pos + 1)}`
      const sharedKey = `${spec.line}|${entry.pos}`

      let sn
      if (entry.share) {
        sn = shared.get(sharedKey)
        if (!sn) continue
      } else {
        const revision = entry.extra ? '02' : '01'
        sn = `${base}-${revision}`
        if (entry.shareWith) shared.set(sharedKey, sn)

        const staff = STAFF[index % STAFF.length]
        const status = entry.status || 'In Stock'
        const exp =
          entry.exp === undefined
            ? status === 'In Use'
              ? dayOffset(90)
              : dayOffset(120)
            : dayOffset(entry.exp)
        const current =
          entry.current !== undefined ? entry.current : status === 'In Use' ? 12 : 0
        const pmDate = entry.pmDate !== undefined ? dayOffset(entry.pmDate) : ''
        const pmRunId = entry.run && pmDate ? `PM|${pmDate}|${spec.line}|${spec.model}` : ''

        fixtures.push({
          sn,
          line: spec.line,
          model: spec.model,
          status,
          type: definition.type,
          step: definition.step,
          process: definition.process,
          position: definition.position,
          usage: {
            current,
            max: 100,
            exp,
            storage: storages[index % storages.length].location,
            usedLine: status === 'In Use' ? spec.line : '',
            inUseAt: status === 'In Use' ? dayOffset(-30 - (index % 20)) : '',
            currentModel: status === 'In Use' ? spec.model : '',
            changeModel: '',
          },
          registered: personAt(staff, 30 + ((index * 7) % 90), 8, 30),
          fixtureBase: base,
          revision: entry.extra ? '02' : '01',
          pmDate,
          pmForms: entry.forms ? ['/uploads/pm/mock-4m.pdf'] : [],
          pmRequestedDays: entry.requestedDays || 0,
          pmApproval: entry.approval || '',
          pmApprovedBy: entry.approval === 'Pending' ? '' : entry.forms ? 'admin Administrator' : '',
          pmApprovedAt: '',
          pmRunId,
          orderStatus: ORDER_STATE_BY_STATUS[status] || '',
          orderNote: entry.orderNote || '',
        })
        index += 1
      }

      if (!infoByPos.has(entry.pos)) {
        infoByPos.set(entry.pos, {
          step: definition.step,
          process: definition.process,
          position: definition.position,
          sn: [],
        })
      }
      const info = infoByPos.get(entry.pos)
      if (!info.sn.includes(sn)) info.sn.push(sn)
    }

    doc.fixtureInfo = [...infoByPos.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, info]) => info)
    fixtureLists.push(doc)
  }

  const snAt = (line, model, pos) =>
    fixtures.find(
      (item) =>
        item.line === line &&
        item.model === model &&
        item.position === POSITIONS[pos]?.position &&
        item.revision === '01',
    )?.sn || ''

  const spareAt = (line, model, pos) =>
    fixtures.find(
      (item) =>
        item.line === line &&
        item.model === model &&
        item.position === POSITIONS[pos]?.position &&
        item.revision === '02',
    )?.sn || ''

  const db = { fixtureLists }

  /* Prefill a Verify request so the two-person confirm can be tried immediately. */
  const changePlan = (line, from, to) => {
    const cmp = compareFromDb(db, line, from, to)
    return [
      ...cmp.issue.map((item) => ({ ...item, action: 'issue' })),
      ...cmp.return.map((item) => ({ ...item, action: 'return' })),
    ]
  }

  const matchesFor = (plan) =>
    plan.map((item, planIndex) => ({
      sn: item.sn,
      scannedSn: item.sn,
      planSn: item.sn,
      planIndex,
      action: item.action,
      position: item.position || '',
      process: item.process || '',
    }))

  const verifyChangePlan = changePlan('FAN2-L1', 'MX-100A', 'MX-200B')
  const verifyChangeMatches = matchesFor(verifyChangePlan)

  const brokenL3 = snAt('FAN2-L3', 'RTR-500', 4)
  const spareL3 = spareAt('FAN2-L3', 'RTR-500', 4)
  const brokenL2 = snAt('FAN2-L2', 'MX-100A', 2)
  const brokenL4 = snAt('FAN2-L4', 'ST-700', 7)

  const changePlanL2 = changePlan('FAN2-L2', 'MX-100A', 'MX-300C')

  const donePlanL2 = changePlanL2
  const doneMatchesL2 = matchesFor(donePlanL2)

  const requests = [
    {
      _id: 'req-001',
      request_id: `REQ${todayStamp()}001`,
      line: 'FAN2-L1',
      currentModel: 'MX-100A',
      changeModel: 'MX-200B',
      queueDate: todayInput(),
      queueSlot: '07:00',
      requestType: 'Mainline',
      step: '',
      dueDate: dayOffset(3),
      type: 'Change Model',
      status: 'Waiting',
      desc: 'MX-100A → MX-200B',
      breakdownItems: [],
      items: [],
      scanMatches: [],
      returnApprovals: [],
      requestInfo: personFor('admin', 0, 7, 50),
    },
    {
      _id: 'req-002',
      request_id: `REQ${todayStamp()}002`,
      line: 'FAN2-L2',
      currentModel: 'MX-100A',
      changeModel: '',
      queueDate: '',
      queueSlot: '',
      requestType: 'Rotor',
      step: 'STEP ROTOR',
      dueDate: dayOffset(1),
      type: 'Breakdown',
      status: 'Waiting',
      desc: 'Motor สั่น ผิดปกติ',
      breakdownItems: [{ sn: brokenL2, symptom: 'Motor สั่น ผิดปกติ' }],
      items: [],
      scanMatches: [],
      returnApprovals: [],
      requestInfo: personFor('admin', 0, 8, 40),
    },
    {
      _id: 'req-003',
      request_id: `REQ${todayStamp()}003`,
      line: 'FAN2-L1',
      currentModel: 'MX-100A',
      changeModel: 'MX-200B',
      queueDate: todayInput(),
      queueSlot: '08:00',
      requestType: 'Mainline',
      step: '',
      dueDate: dayOffset(4),
      type: 'Change Model',
      status: 'Progress',
      desc: 'MX-100A → MX-200B',
      breakdownItems: [],
      items: [],
      scanMatches: [],
      returnApprovals: [],
      issueDone: false,
      returnDone: false,
      requestInfo: personFor('admin', 1, 9, 10),
      acceptInfo: personFor('admin', 1, 9, 45),
    },
    {
      _id: 'req-004',
      request_id: `REQ${todayStamp()}004`,
      line: 'FAN2-L3',
      currentModel: 'RTR-500',
      changeModel: '',
      queueDate: '',
      queueSlot: '',
      requestType: 'Rotor',
      step: 'STEP ROTOR',
      dueDate: dayOffset(2),
      type: 'Breakdown',
      status: 'Hold',
      desc: 'Bearing มีเสียงดัง',
      breakdownItems: [{ sn: brokenL3, symptom: 'Bearing มีเสียงดัง' }],
      items: [],
      scanMatches: [],
      returnApprovals: [],
      issueDone: false,
      returnDone: false,
      requestInfo: personFor('admin', 1, 13, 40),
      acceptInfo: personFor('admin', 1, 14, 10),
    },
    {
      _id: 'req-005',
      request_id: `REQ${todayStamp()}005`,
      line: 'FAN2-L1',
      currentModel: 'MX-100A',
      changeModel: 'MX-200B',
      queueDate: todayInput(),
      queueSlot: '09:00',
      requestType: 'Mainline',
      step: '',
      dueDate: dayOffset(0),
      type: 'Change Model',
      status: 'Verify',
      desc: 'MX-100A → MX-200B',
      breakdownItems: [],
      items: verifyChangePlan.filter((item) => item.action === 'issue').map((item) => item.sn),
      scannedIssue: verifyChangePlan.filter((item) => item.action === 'issue').map((item) => item.sn),
      returnedItems: [],
      scanMatches: verifyChangeMatches,
      returnApprovals: [{ role: 'requester', ...personFor('admin', 0, 11, 0) }],
      issueDone: true,
      returnDone: false,
      requestInfo: personFor('admin', 2, 9, 15),
      acceptInfo: personFor('admin', 2, 9, 45),
      issueInfo: personFor('admin', 1, 10, 5),
    },
    {
      _id: 'req-006',
      request_id: `REQ${todayStamp()}006`,
      line: 'FAN2-L3',
      currentModel: 'RTR-500',
      changeModel: '',
      queueDate: '',
      queueSlot: '',
      requestType: 'Rotor',
      step: 'STEP ROTOR',
      dueDate: dayOffset(0),
      type: 'Breakdown',
      status: 'Verify',
      desc: 'Vibration rotor สึก',
      breakdownItems: [{ sn: brokenL3, symptom: 'Vibration rotor สึก' }],
      items: [spareL3],
      scannedIssue: [spareL3],
      returnedItems: [],
      scanMatches: [
        {
          sn: spareL3,
          scannedSn: spareL3,
          planSn: brokenL3,
          planIndex: 0,
          action: 'issue',
          position: POSITIONS[4].position,
          process: POSITIONS[4].process,
        },
        {
          sn: brokenL3,
          scannedSn: brokenL3,
          planSn: brokenL3,
          planIndex: 1,
          action: 'return',
          position: POSITIONS[4].position,
          process: POSITIONS[4].process,
        },
      ],
      returnApprovals: [],
      issueDone: true,
      returnDone: false,
      requestInfo: personFor('admin', 1, 15, 30),
      acceptInfo: personFor('admin', 1, 16, 0),
      issueInfo: personFor('admin', 1, 16, 20),
    },
    {
      _id: 'req-007',
      request_id: `REQ${todayStamp()}007`,
      line: 'FAN2-L4',
      currentModel: 'ST-700',
      changeModel: '',
      queueDate: '',
      queueSlot: '',
      requestType: 'Mainline',
      step: 'STEP1',
      dueDate: dayOffset(1),
      type: 'Breakdown',
      status: 'Progress',
      desc: 'ซิลิโคนเสื่อมสภาพ',
      breakdownItems: [{ sn: brokenL4, symptom: 'ซิลิโคนเสื่อมสภาพ' }],
      items: [],
      scanMatches: [],
      returnApprovals: [],
      issueDone: false,
      returnDone: false,
      requestInfo: personFor('admin', 0, 10, 20),
      acceptInfo: personFor('admin', 0, 10, 40),
    },
    {
      _id: 'req-008',
      request_id: `REQ${todayStamp()}008`,
      line: 'FAN2-L2',
      currentModel: 'MX-100A',
      changeModel: 'MX-300C',
      queueDate: dayOffset(-3),
      queueSlot: '07:00',
      requestType: 'Mainline',
      step: '',
      dueDate: dayOffset(-3),
      type: 'Change Model',
      status: 'Done',
      desc: 'MX-100A → MX-300C',
      breakdownItems: [],
      items: donePlanL2.filter((item) => item.action === 'issue').map((item) => item.sn),
      scannedIssue: donePlanL2.filter((item) => item.action === 'issue').map((item) => item.sn),
      returnedItems: donePlanL2.filter((item) => item.action === 'return').map((item) => item.sn),
      scanMatches: doneMatchesL2,
      returnApprovals: [
        { role: 'requester', ...personFor('10003', 3, 15, 0) },
        { role: 'assignee', ...personFor('10001', 3, 15, 10) },
      ],
      issueDone: true,
      returnDone: true,
      requestInfo: personFor('10003', 4, 8, 0),
      acceptInfo: personFor('10001', 4, 8, 30),
      issueInfo: personFor('10004', 3, 9, 0),
      verifyInfo: personFor('10003', 3, 15, 0),
    },
    {
      _id: 'req-009',
      request_id: `REQ${todayStamp()}009`,
      line: 'FAN2-L2',
      currentModel: 'MX-100A',
      changeModel: '',
      queueDate: '',
      queueSlot: '',
      requestType: 'Rotor',
      step: 'STEP ROTOR',
      dueDate: dayOffset(-5),
      type: 'Breakdown',
      status: 'Done',
      desc: 'สลักหลวม',
      breakdownItems: [{ sn: snAt('FAN2-L2', 'MX-100A', 1), symptom: 'สลักหลวม' }],
      items: [snAt('FAN2-L2', 'MX-100A', 1)],
      scanMatches: [],
      returnApprovals: [
        { role: 'requester', ...personFor('10002', 5, 10, 0) },
        { role: 'assignee', ...personFor('10001', 5, 10, 10) },
      ],
      issueDone: true,
      returnDone: true,
      requestInfo: personFor('10002', 6, 8, 10),
      acceptInfo: personFor('10001', 6, 8, 40),
      verifyInfo: personFor('10002', 5, 10, 0),
    },
    {
      _id: 'req-010',
      request_id: `REQ${todayStamp()}010`,
      line: 'FAN2-L4',
      currentModel: 'ST-700',
      changeModel: 'ST-800',
      queueDate: dayOffset(-2),
      queueSlot: '10:00',
      requestType: 'Winding',
      step: 'STEP WINDING',
      dueDate: dayOffset(-2),
      type: 'Change Model',
      status: 'Rejected',
      desc: 'ST-700 → ST-800',
      breakdownItems: [],
      items: [],
      scanMatches: [],
      returnApprovals: [],
      requestInfo: personFor('10003', 2, 14, 20),
    },
  ]

  const history = []
  const addHistory = (entry, staff, daysAgo, hour, minute) => {
    const person = personAt(staff, daysAgo, hour, minute)
    history.push({
      _id: `hist-${pad(history.length + 1, 3)}`,
      sn: '',
      request_id: '',
      pm_run_id: '',
      action: '',
      detail: '',
      line: '',
      model: '',
      ...entry,
      empId: person.empId,
      name: person.name,
      lastname: person.lastname,
      date: person.date,
    })
  }

  const runL1 = `PM|${dayOffset(0)}|FAN2-L1|MX-100A`
  addHistory(
    {
      sn: snAt('FAN2-L1', 'MX-100A', 7),
      action: 'Start PM',
      detail: `เริ่มทำ PM ${dayOffset(0)} → PM & Maintenance`,
      line: 'FAN2-L1',
      model: 'MX-100A',
      pm_run_id: runL1,
    },
    STAFF[0],
    0,
    7,
    55,
  )
  addHistory(
    {
      sn: snAt('FAN2-L1', 'MX-100A', 6),
      action: 'PM OK',
      detail: 'Verify + Record OK — กลับเข้า In Stock (รอจ่ายออกเพื่อเริ่ม PM รอบใหม่)',
      line: 'FAN2-L1',
      model: 'MX-100A',
      pm_run_id: runL1,
    },
    STAFF[0],
    0,
    9,
    20,
  )
  addHistory(
    {
      sn: snAt('FAN2-L2', 'MX-100A', 8),
      action: 'PM NG',
      detail: 'Verify + Record NG — Need PR',
      line: 'FAN2-L2',
      model: 'MX-100A',
    },
    STAFF[3],
    0,
    10,
    5,
  )
  addHistory(
    {
      sn: snAt('FAN2-L2', 'MX-100A', 7),
      action: '4M Approval Request',
      detail: 'แนบเอกสาร 4M · ขอทำ PM 14 วัน → รอ Admin อนุมัติ',
      line: 'FAN2-L2',
      model: 'MX-100A',
    },
    STAFF[0],
    0,
    10,
    40,
  )
  addHistory(
    {
      request_id: `REQ${todayStamp()}005`,
      action: 'Issue (Scan)',
      detail: 'สแกนจ่าย 3 ตัว → ใช้ที่ FAN2-L1',
      line: 'FAN2-L1',
      model: 'MX-100A',
    },
    STAFF[0],
    1,
    10,
    5,
  )
  addHistory(
    {
      request_id: `REQ${todayStamp()}006`,
      action: 'Breakdown',
      detail: `ส่งซ่อม (${`REQ${todayStamp()}006`})`,
      line: 'FAN2-L3',
      model: 'RTR-500',
    },
    STAFF[1],
    1,
    16,
    20,
  )
  addHistory(
    {
      sn: snAt('FAN2-L3', 'RTR-500', 9),
      action: '4M Approve',
      detail: `Management Approve · 4M +10 Days (ถึง ${dayOffset(4)})`,
      line: 'FAN2-L3',
      model: 'RTR-500',
    },
    STAFF[2],
    1,
    17,
    20,
  )
  addHistory(
    {
      request_id: `REQ${todayStamp()}002`,
      action: 'Request',
      detail: 'Breakdown · MX-100A',
      line: 'FAN2-L2',
      model: 'MX-100A',
    },
    STAFF[1],
    0,
    8,
    40,
  )
  addHistory(
    {
      sn: snAt('FAN2-L4', 'ST-700', 10),
      action: 'Order',
      detail: 'New One Replacement',
      line: 'FAN2-L4',
      model: 'ST-700',
    },
    STAFF[0],
    2,
    9,
    0,
  )
  addHistory(
    {
      sn: snAt('FAN2-L1', 'MX-100A', 5),
      action: 'Issue',
      detail: 'จ่าย Fixture เข้าไลน์ (usage 92%)',
      line: 'FAN2-L1',
      model: 'MX-100A',
    },
    STAFF[3],
    2,
    11,
    30,
  )
  addHistory(
    {
      sn: snAt('FAN2-L4', 'ST-700', 6),
      action: 'Edit',
      detail: 'แก้ไขข้อมูล Fixture',
      line: 'FAN2-L4',
      model: 'ST-700',
    },
    STAFF[1],
    3,
    14,
    10,
  )
  addHistory(
    {
      sn: snAt('FAN2-L1', 'MX-100A', 0),
      action: 'PM Due',
      detail: `ครบกำหนด PM 90 วัน (${dayOffset(-10)}) → รอทำ PM`,
      line: 'FAN2-L1',
      model: 'MX-100A',
    },
    STAFF[0],
    3,
    8,
    0,
  )
  addHistory(
    {
      sn: snAt('FAN2-L2', 'MX-100A', 6),
      action: 'Plan PM',
      detail: `Plan PM ${dayOffset(-1)} → PM & Maintenance`,
      line: 'FAN2-L2',
      model: 'MX-100A',
    },
    STAFF[0],
    4,
    9,
    30,
  )
  addHistory(
    {
      request_id: `REQ${todayStamp()}008`,
      action: 'Return (Verify)',
      detail: `รับคืน 9 ตัว → In Stock ตอน Verify ${`REQ${todayStamp()}008`}`,
      line: 'FAN2-L2',
      model: 'MX-100A',
    },
    STAFF[3],
    3,
    15,
    15,
  )
  addHistory(
    {
      request_id: `REQ${todayStamp()}008`,
      action: 'Verify',
      detail: `ปิดคำขอ ${`REQ${todayStamp()}008`} · Change Model`,
      line: 'FAN2-L2',
      model: 'MX-100A',
    },
    STAFF[1],
    3,
    15,
    20,
  )
  addHistory(
    {
      sn: snAt('FAN2-L3', 'RTR-500', 2),
      action: 'Register',
      detail: 'ลงทะเบียนใหม่ FAN2-L3 · RTR-500',
      line: 'FAN2-L3',
      model: 'RTR-500',
    },
    STAFF[1],
    4,
    8,
    0,
  )
  addHistory(
    {
      sn: snAt('FAN2-L1', 'MX-100A', 8),
      action: '4M Document',
      detail: 'แนบเอกสาร 4M ก่อนเริ่ม PM',
      line: 'FAN2-L1',
      model: 'MX-100A',
    },
    STAFF[0],
    4,
    13,
    0,
  )
  addHistory(
    {
      request_id: `REQ${todayStamp()}009`,
      action: 'Verify',
      detail: `ปิดคำขอ ${`REQ${todayStamp()}009`} · Breakdown`,
      line: 'FAN2-L2',
      model: 'MX-100A',
    },
    STAFF[1],
    5,
    10,
    0,
  )
  addHistory(
    {
      sn: 'FAN2-L4-ST7-P05-02',
      action: 'Delete',
      detail: 'ลบ Fixture ออกจากระบบ',
      line: 'FAN2-L4',
      model: 'ST-700',
    },
    STAFF[1],
    6,
    11,
    0,
  )

  return {
    users: [
      {
        _id: 'u-1',
        empId: 'admin',
        username: 'admin',
        pass: 'admin',
        name: 'Administrator',
        lastname: '',
        dept: 'System',
        status: 'Admin',
        request_id: '',
      },
      ...STAFF.map((staff, staffIndex) => ({
        _id: `u-${staffIndex + 2}`,
        empId: staff.empId,
        username: '',
        pass: '1234',
        name: staff.name,
        lastname: staff.lastname,
        dept: staff.dept,
        status: 'Signed',
        request_id: '',
      })),
      {
        _id: 'u-6',
        empId: '10005',
        username: '',
        pass: '1234',
        name: 'Kanya',
        lastname: 'Prasert',
        dept: 'Production',
        status: 'Unsigned',
        request_id: '',
      },
    ],
    fixtureLists,
    fixtures,
    storages,
    locations: ['FAN2-L1', 'FAN2-L2', 'FAN2-L3', 'FAN2-L4'],
    models: ['MX-100A', 'MX-200B', 'MX-300C', 'RTR-500', 'ST-700'],
    machines: [
      { machineCode: 'FAN2-M01', name: 'Main Line Press 01', locationName: 'FAN2-L1', model: 'MX-100A' },
      { machineCode: 'FAN2-M02', name: 'Rotor Balance 02', locationName: 'FAN2-L2', model: 'MX-100A' },
      { machineCode: 'FAN2-M03', name: 'Winding Station 03', locationName: 'FAN2-L3', model: 'RTR-500' },
      { machineCode: 'FAN2-M04', name: 'Function Test 04', locationName: 'FAN2-L4', model: 'ST-700' },
      { machineCode: 'FAN2-M05', name: 'Main Line Press 05', locationName: 'FAN2-L1', model: 'MX-200B' },
    ],
    requests,
    history,
    seq: 0,
  }
}
