const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

async function request(path, { method = 'GET', body, headers, signal } = {}) {
  const options = {
    method,
    signal,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
  }

  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, options)
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า server.js ทำงานอยู่', 0)
  }

  const isJson = (response.headers.get('content-type') || '').includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    const message = payload?.message || payload?.error || `Request failed (${response.status})`
    throw new ApiError(message, response.status, payload)
  }

  return payload
}

function withQuery(path, params = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  }
  const query = search.toString()
  return `${path}${query ? `?${query}` : ''}`
}

export const api = {
  /* Auth (users { empId, pass, name, lastname, dept, status, request_id }) */
  login: ({ empId, pass } = {}) =>
    request('/login', { method: 'POST', body: { empId, pass } }),
  register: (payload) => request('/register', { method: 'POST', body: payload }),
  me: (empId) => request(withQuery('/me', { empId })),

  users: () => request('/users'),
  updateUser: (id, payload) => request(`/users/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  deleteUser: (id) => request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /* Fixture list (schema: line / model / fixtureInfo[]) */
  fixtureOptions: (signal) => request('/fixturelist/options', { signal }),
  fixtureList: ({ line, model, signal } = {}) =>
    request(withQuery('/fixturelist', { line, model }), { signal }),
  importFixtureList: (items, confirm = false) =>
    request('/fixturelist/import', { method: 'POST', body: { items, confirm } }),

  /* Flat fixtures (fixtureDetail + line/model/step/process/position) */
  fixtures: (
    { line, model, status, sn, type, step, process, position, storage, fixtureBase, revision, q, signal } = {},
  ) =>
    request(
      withQuery('/fixtures', {
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
        q,
      }),
      { signal },
    ),
  fixtureFieldOptions: (signal) => request('/fixtures/options', { signal }),
  /* Edit page — source of truth is fixtureDetail, with fixtureList as legacy fallback. */
  editFixtures: (
    { line, model, status, sn, type, step, process, position, storage, fixtureBase, revision, q, signal } = {},
  ) =>
    request(
      withQuery('/fixtures/detail', {
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
        q,
      }),
      { signal },
    ),
  editFixtureOptions: (signal) => request('/fixtures/detail/options', { signal }),
  fixtureStats: (signal) => request('/fixture-stats', { signal }),
  fixtureDetails: (signal) => request('/fixture-details', { signal }),
  fixture: (sn) => request(`/fixtures/${encodeURIComponent(sn)}`),
  createFixture: (payload) => request('/fixtures', { method: 'POST', body: payload }),
  updateFixture: (sn, payload) =>
    request(`/fixtures/${encodeURIComponent(sn)}`, { method: 'PUT', body: payload }),
  deleteFixture: (sn, user) =>
    request(`/fixtures/${encodeURIComponent(sn)}`, { method: 'DELETE', body: { user } }),

  /* Compare model เดิม -> ใหม่ (Change Model): issue / return / keep */
  compareFixtureList: ({ line, from, to, signal } = {}) =>
    request(withQuery('/fixturelist/compare', { line, from, to }), { signal }),

  /* FAN2 external data */
  fan2Locations: (signal) => request('/fan2/locations', { signal }),
  fan2Models: (signal) => request('/fan2/models', { signal }),

  /* Storage management (Edit page) */
  storages: (signal) => request('/storages', { signal }),
  createStorage: (payload) => request('/storages', { method: 'POST', body: payload }),
  updateStorage: (id, payload) => request(`/storages/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  deleteStorage: (id) => request(`/storages/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /* Request: Waiting -> Accepted -> Issued -> Done */
  requests: ({ status, type, empId, signal } = {}) =>
    request(withQuery('/requests', { status, type, empId }), { signal }),
  request: (requestId) => request(`/requests/${encodeURIComponent(requestId)}`),
  createRequest: (payload) => request('/requests', { method: 'POST', body: payload }),
  acceptRequest: (requestId, user) =>
    request(`/requests/${encodeURIComponent(requestId)}/accept`, { method: 'PUT', body: { user } }),
  holdRequest: (requestId, user) =>
    request(`/requests/${encodeURIComponent(requestId)}/hold`, { method: 'PUT', body: { user } }),
  rejectRequest: (requestId, user) =>
    request(`/requests/${encodeURIComponent(requestId)}/reject`, { method: 'PUT', body: { user } }),
  completeRequest: (requestId, user) =>
    request(`/requests/${encodeURIComponent(requestId)}/complete`, { method: 'PUT', body: { user } }),
  scanPlan: (requestId) =>
    request(`/requests/${encodeURIComponent(requestId)}/scan-plan`),
  scanRequest: (requestId, sn, user) =>
    request(`/requests/${encodeURIComponent(requestId)}/scan`, {
      method: 'POST',
      body: { sn, user },
    }),
  confirmScan: (requestId, user) =>
    request(`/requests/${encodeURIComponent(requestId)}/confirm-scan`, {
      method: 'POST',
      body: { user },
    }),
  resetScan: (requestId, user) =>
    request(`/requests/${encodeURIComponent(requestId)}/reset-scan`, {
      method: 'POST',
      body: { user },
    }),
  breakdownRequest: (requestId, action, sn, user) =>
    request(`/requests/${encodeURIComponent(requestId)}/breakdown`, {
      method: 'PUT',
      body: { action, sn, user },
    }),
  verifyRequest: (requestId, user) =>
    request(`/requests/${encodeURIComponent(requestId)}/verify`, { method: 'PUT', body: { user } }),
  deleteRequest: (requestId) =>
    request(`/requests/${encodeURIComponent(requestId)}`, { method: 'DELETE' }),

  /* Manual Issue / Return (backup flow, no Order/Request) */
  issueFixture: (payload) => request('/issue', { method: 'POST', body: payload }),
  returnList: (signal) => request('/return', { signal }),
  returnFixture: (payload) => request('/return', { method: 'POST', body: payload }),

  /* PM Checklist Phase 2 */
  pm: (signal) => request('/pm', { signal }),
  pmPlan: (sn, user, date, note) =>
    request('/pm/plan', { method: 'POST', body: { sn, user, date, note } }),
  pmExtend: (sn, days, user, formUrl) =>
    request('/pm/extend', { method: 'POST', body: { sn, days, user, formUrl } }),
  pmAssign: (sn, payload = {}) => request('/pm/assign', { method: 'POST', body: { sn, ...payload } }),
  pmUpload: async (sn, file, user) => {
    const form = new FormData()
    form.append('sn', sn)
    if (user) form.append('user', JSON.stringify(user))
    form.append('file', file)
    const response = await fetch(`${API_BASE}/pm/forms`, { method: 'POST', body: form })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new ApiError(payload?.message || `Upload failed (${response.status})`, response.status, payload)
    }
    return payload
  },

  /* PM & Maintenance -> Verify + Record */
  maintenance: (signal) => request('/maintenance', { signal }),
  maintenanceVerify: (payload) => request('/maintenance/verify', { method: 'POST', body: payload }),

  /* Order (Need Scrape / Need PR / Already have PR / New One Replacement) - read-only */
  orders: (signal) => request('/orders', { signal }),

  /* Dashboard */
  dashboard: (signal) => request('/dashboard', { signal }),

  /* History (Record History) */
  history: ({ sn, action, requestId, q, limit, signal } = {}) =>
    request(
      withQuery('/history', { sn, action, request_id: requestId, q, limit }),
      { signal },
    ),

  health: () => request('/health'),
}

export { ApiError }
export default api
