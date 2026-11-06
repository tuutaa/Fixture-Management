const KEY = 'fixture_management_mock_db_v1';

const seed = () => ({
  users: [
    { _id: 'u1', UserID: 'admin', Password: 'admin', Name: 'Admin', LastName: 'User', Status: 'signed', Authorization: 'admin' },
  ],
  employees: [
    { UserID: '8655422', Name: 'สมชาย', LastName: 'ใจดี' },
    { UserID: '8655423', Name: 'สมหญิง', LastName: 'รักงาน' },
  ],
  storages: [{ _id: 's1', StorageLocation: 'A1', Description: 'Storage A1' }],
  models: [{ _id: 'm1', Model: 'Model-X', Description: 'Default model', FixtureList: [] }],
  lines: [{ _id: 'l1', Line: 'Line-1', Description: 'Default line' }],
  fixture_bases: [{ _id: 'b1', SN: 'BASE-001', Name: 'Base Fixture', Description: 'Base', Location: 'A1', ImagePath: '' }],
  fixtures: [],
  fixture_requests: [],
  issue_drafts: [],
});

export function loadDb() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw);
  } catch (e) {
    const s = seed();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
}

export function saveDb(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function resetDb() {
  const s = seed();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}