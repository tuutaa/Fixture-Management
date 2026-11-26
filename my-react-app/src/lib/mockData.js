/**
 * Frontend-only dataset for mock mode (VITE_MOCK=true / npm run dev:mock).
 * -------------------------------------------------------------------
 * The data is generated from the supplied FAN2 exports:
 *   - src/lib/data/fixtures.json               (fixture master export)
 *   - src/lib/data/requests.json               (fixture request export)
 *   - src/lib/data/fixtureMaster.json          (derived from the XLSX master)
 *
 * State is in-memory only and resets on reload. The objects are reshaped into
 * the same contract that server.js returns so every page keeps working.
 */

import rawFixtures from './data/fixtures.json'
import masterData from './data/fixtureMaster.json'

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

export const addDaysInput = (date, days) => {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))
    ? new Date(`${date}T00:00:00`)
    : new Date()
  base.setDate(base.getDate() + days)
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`
}

const text = (value) => (value === undefined || value === null ? '' : String(value).trim())

const norm = (value) => text(value).toLowerCase().replace(/\s+/g, ' ').trim()

const oid = (value) => (value && typeof value === 'object' ? text(value.$oid) : text(value))

const dateOnly = (value) => {
  const raw = value && typeof value === 'object' ? value.$date : value
  if (!raw) return ''
  const stamp = String(raw)
  if (/^\d{4}-\d{2}-\d{2}/.test(stamp)) return stamp.slice(0, 10)
  const parsed = new Date(stamp)
  if (Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
}

const isoDate = (value, fallback = '') => {
  const raw = value && typeof value === 'object' ? value.$date : value
  if (!raw) return fallback
  const stamp = String(raw)
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(stamp) ? new Date(`${stamp}T00:00:00`) : new Date(stamp)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString()
}

const STEP_BY_TYPE = {
  Rotor: 'STEP ROTOR',
  Winding: 'STEP WINDING',
  Function: 'TEST STEP',
  Mainline: 'STEP1',
}

/* Master positions derived from the supplied XLSX "Fixture Lists Detail" and
 * "standardTime" sheets. They are also used as defaults when creating a fixture. */
export const POSITIONS = (masterData.positions || []).map((item) => ({ ...item }))

const POSITION_BY_KEY = new Map(POSITIONS.map((item) => [norm(item.position), item]))
const STEP_BY_PROCESS = masterData.stepByProcess || {}
const MODEL_PROCESS = masterData.modelProcess || {}

const metaFor = (row) => {
  const line = text(row.line ?? row.Line)
  const model = text(row.model ?? row.Model)
  const position = text(row.position ?? row.Name) || 'N/A'
  const rawType = text(row.type ?? row.Type)
  const matched = POSITION_BY_KEY.get(norm(position))
  const process =
    matched?.process || MODEL_PROCESS[`${line}|${model}`] || rawType || 'N/A'
  const type = rawType && rawType !== 'N/A' ? rawType : matched?.type || 'Mainline'
  const step = matched?.step || STEP_BY_PROCESS[norm(process)] || STEP_BY_TYPE[type] || 'STEP1'
  return { position, process, type, step }
}

export const MOCK_STORAGES = [
  ...new Set(rawFixtures.map((row) => text(row.StorageLocation) || 'N/A')),
]
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  .map((location, index) => ({
    _id: `st-${index + 1}`,
    location,
    desc: location === 'N/A' ? 'ไม่ระบุตำแหน่งจัดเก็บ' : `Storage ${location}`,
  }))

const personFromRaw = (raw, fallbackDate = '') => ({
  empId: text(raw?.UserID || raw?.empId),
  name: text(raw?.Name || raw?.name),
  lastname: text(raw?.LastName || raw?.lastname),
  date: isoDate(raw?.Date || raw?.date, fallbackDate || stampAt(0)),
})

const buildFixtures = () =>
  rawFixtures.map((row, index) => {
    const line = text(row.Line) || 'N/A'
    const model = text(row.Model) || 'N/A'
    const status = text(row.Status) || 'In Stock'
    const usageRaw = row.Usage || {}
    const meta = metaFor({ Line: line, Model: model, Type: row.Type, Name: row.Name })
    const sn = text(row.SN) || `SN-${pad(index + 1, 5)}`
    const base = text(row.FixtureBase) || sn.replace(/-\d+$/, '')
    const exp = dateOnly(usageRaw.ExpiredDate)
    const inUseAt = status === 'In Use' ? dateOnly(row.Registed?.Date) || '' : ''

    return {
      _id: oid(row._id) || `fx-${index + 1}`,
      sn,
      line,
      model,
      status,
      type: meta.type,
      step: meta.step,
      process: meta.process,
      position: meta.position,
      description: text(row.Description),
      usage: {
        current: Number(usageRaw.CurrentUsed) || 0,
        max: Number(usageRaw.MaxUsed) || 0,
        exp,
        warningThreshold: usageRaw.Warning_Threshold ?? null,
        storage: text(row.StorageLocation) || 'N/A',
        usedLine: status === 'In Use' ? line : '',
        inUseAt,
        currentModel: status === 'In Use' ? model : '',
        changeModel: '',
      },
      registered: personFromRaw(row.Registed, stampAt(-30 - (index % 90), 8, 30)),
      fixtureBase: base,
      revision: text(sn.split('-').pop()),
      orderId: text(row.OrderID),
      pmStartDate: inUseAt,
      pmDueDate: inUseAt ? addDaysInput(inUseAt, 90) : '',
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
  })

const buildFixtureLists = (fixtures) => {
  const byBase = new Map()
  const byPosition = new Map()
  const push = (map, key, sn) => {
    if (!map.has(key)) map.set(key, [])
    if (!map.get(key).includes(sn)) map.get(key).push(sn)
  }

  for (const fixture of fixtures) {
    const line = text(fixture.line)
    const model = text(fixture.model)
    if (!line || !model || line === 'N/A' || model === 'N/A') continue
    const groupKey = `${norm(line)}|${norm(model)}`
    push(byBase, `${groupKey}|${norm(fixture.fixtureBase)}`, fixture.sn)
    push(byPosition, `${groupKey}|${norm(fixture.position)}`, fixture.sn)
  }

  const lists = new Map()
  for (const row of masterData.fixtureLists || []) {
    const line = text(row.line)
    const model = text(row.model)
    if (!line || !model) continue
    const key = `${norm(line)}|${norm(model)}`
    const fixtureInfo = (row.items || []).map((item) => {
      const bases = item.fixtureBases || []
      const sns = []
      for (const base of bases) {
        for (const sn of byBase.get(`${key}|${norm(base)}`) || []) {
          if (!sns.includes(sn)) sns.push(sn)
        }
      }
      if (!sns.length) {
        for (const sn of byPosition.get(`${key}|${norm(item.position)}`) || []) {
          if (!sns.includes(sn)) sns.push(sn)
        }
      }
      return {
        position: text(item.position),
        process: text(item.process),
        step: text(item.step),
        fixtureBases: bases,
        count: Number(item.count) || 0,
        countText: text(item.countText),
        sn: sns,
      }
    })
    lists.set(key, {
      _id: text(row._id) || `fl-${lists.size + 1}`,
      line,
      model,
      process: text(row.process),
      fixtureInfo,
    })
  }

  /* Fallback for Line/Model pairs that exist in the fixture export but not in
   * the XLSX master, so compare still has data for every real fixture group. */
  for (const fixture of fixtures) {
    const line = text(fixture.line)
    const model = text(fixture.model)
    if (!line || !model || line === 'N/A' || model === 'N/A') continue
    const key = `${norm(line)}|${norm(model)}`
    if (lists.has(key)) continue
    const group = {
      _id: `fl-${lists.size + 1}`,
      line,
      model,
      process: fixture.process,
      info: new Map(),
    }
    lists.set(key, group)
  }
  for (const fixture of fixtures) {
    const line = text(fixture.line)
    const model = text(fixture.model)
    if (!line || !model || line === 'N/A' || model === 'N/A') continue
    const group = lists.get(`${norm(line)}|${norm(model)}`)
    if (!group?.info) continue
    const infoKey = norm(fixture.position)
    if (!group.info.has(infoKey)) {
      group.info.set(infoKey, {
        position: fixture.position,
        process: fixture.process,
        step: fixture.step,
        fixtureBases: [fixture.fixtureBase],
        count: 0,
        sn: [],
      })
    }
    const bucket = group.info.get(infoKey)
    if (!bucket.sn.includes(fixture.sn)) bucket.sn.push(fixture.sn)
    bucket.count = bucket.sn.length
  }

  return [...lists.values()]
    .map((group) =>
      group.info
        ? { ...group, fixtureInfo: [...group.info.values()], info: undefined }
        : group,
    )
    .sort((a, b) => `${a.line}|${a.model}`.localeCompare(`${b.line}|${b.model}`))
}

const modelRows = (fixtureLists, line, model) => {
  const doc = fixtureLists.find((item) => item.line === line && item.model === model)
  const map = new Map()
  for (const info of doc?.fixtureInfo || []) {
    const key = norm(info.position)
    if (!key) continue
    if (!map.has(key)) {
      map.set(key, {
        position: text(info.position),
        process: text(info.process),
        sn: [],
      })
    }
    const bucket = map.get(key)
    if (!bucket.process && info.process) bucket.process = text(info.process)
    for (const sn of info.sn || []) if (sn) bucket.sn.push(text(sn))
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

const buildHistory = (fixtures) => {
  const history = []
  const add = (entry, person) => {
    history.push({
      _id: `hist-${pad(history.length + 1, 4)}`,
      sn: '',
      request_id: '',
      pm_run_id: '',
      action: '',
      detail: '',
      line: '',
      model: '',
      ...entry,
      empId: text(person?.empId) || 'system',
      name: text(person?.name) || 'System',
      lastname: text(person?.lastname),
      date: person?.date || stampAt(0),
    })
  }

  const today = todayInput()
  fixtures
    .filter((fixture) => fixture.status === 'In Use' && fixture.pmDueDate && fixture.pmDueDate <= today)
    .slice(0, 24)
    .forEach((fixture) => {
      add(
        {
          sn: fixture.sn,
          action: 'PM Due',
          detail: `ครบกำหนด PM 90 วัน (${fixture.pmDueDate}) → รอทำ PM`,
          line: fixture.line,
          model: fixture.model,
        },
        { empId: 'system', name: 'System', lastname: '', date: `${fixture.pmDueDate}T08:00:00.000Z` },
      )
    })

  return history
}

const buildUsers = () => {
  const users = [
    {
      _id: 'u-admin',
      empId: 'admin',
      username: 'admin',
      pass: 'admin',
      name: 'Administrator',
      lastname: '',
      dept: 'System',
      status: 'Admin',
      request_id: '',
    },
    {
      _id: 'u-demo',
      empId: '10001',
      username: '',
      pass: '1234',
      name: 'Demo User',
      lastname: '',
      dept: 'Maintenance',
      status: 'Signed',
      request_id: '',
    },
  ]
  const seen = new Set(users.map((user) => user.empId))

  for (const row of rawFixtures) {
    const empId = text(row.Registed?.UserID)
    if (!empId || seen.has(empId)) continue
    seen.add(empId)
    users.push({
      _id: `u-${users.length + 1}`,
      empId,
      username: '',
      pass: '1234',
      name: text(row.Registed?.Name) || empId,
      lastname: text(row.Registed?.LastName),
      dept: 'Production',
      status: 'Signed',
      request_id: '',
    })
    if (users.length >= 16) break
  }

  return users
}

const buildMachines = (fixtures) => {
  const seen = new Set()
  const machines = []
  for (const fixture of fixtures) {
    if (fixture.status !== 'In Use' || fixture.line === 'N/A' || fixture.model === 'N/A') continue
    const key = `${fixture.line}|${fixture.model}`
    if (seen.has(key)) continue
    seen.add(key)
    machines.push({
      machineCode: fixture.fixtureBase || fixture.sn,
      name: fixture.position || fixture.model,
      locationName: fixture.line,
      model: fixture.model,
    })
    if (machines.length >= 60) break
  }
  return machines
}

export function createMockDb() {
  const fixtures = buildFixtures()
  const fixtureLists = buildFixtureLists(fixtures)

  return {
    users: buildUsers(),
    fixtureLists,
    fixtures,
    storages: MOCK_STORAGES.map((item) => ({ ...item })),
    locations: [...new Set(fixtures.map((item) => item.line).filter((line) => line !== 'N/A'))].sort(
      (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    ),
    models: [...new Set(fixtureLists.map((item) => item.model))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    ),
    machines: buildMachines(fixtures),
    requests: [],
    history: buildHistory(fixtures),
    seq: 0,
  }
}
