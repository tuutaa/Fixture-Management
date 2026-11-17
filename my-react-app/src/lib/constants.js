export const SESSION = {
  user: 'currentUser',
  userId: 'currentUserID',
  lastName: 'currentLastName',
  role: 'userRole',
  dept: 'currentDept',
  requestId: 'currentRequestId',
}

/* UI state persisted across page reloads */
export const UI_STATE = {
  page: 'currentPage',
}

/* Fixture status (fixtureDetail.status) — ตาม Flow Fixture MM */
export const FIXTURE_STATUSES = [
  'In Stock',
  'In Use',
  'Maintenance',
  'Scrape',
  'PR',
  'PR Ready',
  'Replaced',
]

export const FIXTURE_STATUS_TONE = {
  'In Stock': {
    label: 'In Stock',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
    dot: 'bg-emerald-500',
  },
  'In Use': {
    label: 'In Use',
    chip: 'bg-blue-50 text-blue-700 ring-blue-600/10',
    dot: 'bg-blue-500',
  },
  Maintenance: {
    label: 'Maintenance',
    chip: 'bg-orange-50 text-orange-700 ring-orange-600/10',
    dot: 'bg-orange-500',
  },
  Scrape: {
    label: 'Need Scrape',
    chip: 'bg-red-50 text-red-700 ring-red-600/10',
    dot: 'bg-red-500',
  },
  PR: {
    label: 'Need PR',
    chip: 'bg-red-50 text-red-700 ring-red-600/10',
    dot: 'bg-red-500',
  },
  'PR Ready': {
    label: 'Already have PR',
    chip: 'bg-amber-50 text-amber-700 ring-amber-600/10',
    dot: 'bg-amber-500',
  },
  Replaced: {
    label: 'New One Replacement',
    chip: 'bg-purple-50 text-purple-700 ring-purple-600/10',
    dot: 'bg-purple-500',
  },
}

/* Request status: Waiting -> Accepted -> Issued -> Done */
export const REQUEST_STATUSES = ['Waiting', 'Accepted', 'Issued', 'Done']

export const REQUEST_STATUS_TONE = {
  Waiting: {
    label: 'Waiting',
    chip: 'bg-red-50 text-red-600 ring-red-600/10',
    dot: 'bg-red-500',
  },
  Accepted: {
    label: 'Accepted',
    chip: 'bg-blue-50 text-blue-600 ring-blue-600/10',
    dot: 'bg-blue-500',
  },
  Issued: {
    label: 'Issued',
    chip: 'bg-amber-50 text-amber-700 ring-amber-600/10',
    dot: 'bg-amber-500',
  },
  Done: {
    label: 'Done',
    chip: 'bg-emerald-50 text-emerald-600 ring-emerald-600/10',
    dot: 'bg-emerald-500',
  },
}

/* Request type per flow: Change Model | Breakdown */
export const REQUEST_TYPES = [
  { value: 'Change Model', label: 'เปลี่ยนรุ่น (Change Model)', hint: 'MainLine / Rotor → Compare Model A → B' },
  { value: 'Breakdown', label: 'Fixture เสีย (Breakdown)', hint: 'Verify → Issue Spare / PM & Maintenance' },
]

/* Request process type (must-have): mainline / rotor / winding / function */
export const PROCESS_TYPES = [
  { value: 'Mainline', label: 'Mainline' },
  { value: 'Rotor', label: 'Rotor' },
  { value: 'Winding', label: 'Winding' },
  { value: 'Function', label: 'Function' },
]

/* Register/Edit status options (canonical values used by the flow) */
export const FIXTURE_STATUS_OPTIONS = [
  { value: 'In Stock', label: 'In Stock (Instock)' },
  { value: 'In Use', label: 'In Use (Inuse)' },
  { value: 'Maintenance', label: 'PM / Breakdown (Maintenance)' },
  { value: 'Scrape', label: 'Scrap (Scrape)' },
  { value: 'PR', label: 'Change Model / Need PR' },
  { value: 'PR Ready', label: 'Already have PR' },
  { value: 'Replaced', label: 'Replacement' },
]

/* Order lifecycle, must-have: Accept / Reject / Hold → Issue → Verify */
export const ORDER_LIFECYCLE = [
  { value: 'Accept', label: 'Accept', hint: 'อนุมัติ Order', tone: 'emerald' },
  { value: 'Reject', label: 'Reject', hint: 'ไม่อนุมัติ', tone: 'red' },
  { value: 'Hold', label: 'Hold', hint: 'พักไว้ก่อน', tone: 'amber' },
  { value: 'Issue', label: 'Issue', hint: 'จ่ายงาน / ส่งซ่อม', tone: 'blue' },
  { value: 'Verify', label: 'Verify', hint: 'ตรวจรับและปิดงาน', tone: 'emerald' },
]

export const ORDER_STATE_TONE = {
  '': { label: 'Pending', chip: 'bg-red-50 text-red-700 ring-red-600/10', dot: 'bg-red-500' },
  Pending: { label: 'Pending', chip: 'bg-red-50 text-red-700 ring-red-600/10', dot: 'bg-red-500' },
  Accepted: { label: 'Accepted', chip: 'bg-blue-50 text-blue-700 ring-blue-600/10', dot: 'bg-blue-500' },
  Rejected: { label: 'Rejected', chip: 'bg-red-50 text-red-700 ring-red-600/10', dot: 'bg-red-500' },
  Hold: { label: 'Hold', chip: 'bg-amber-50 text-amber-700 ring-amber-600/10', dot: 'bg-amber-500' },
  Issued: { label: 'Issued', chip: 'bg-orange-50 text-orange-700 ring-orange-600/10', dot: 'bg-orange-500' },
  Verified: { label: 'Verified', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10', dot: 'bg-emerald-500' },
}

export function orderTone(state) {
  return ORDER_STATE_TONE[state || ''] || ORDER_STATE_TONE['']
}

export const BREAKDOWN_ACTIONS = [
  {
    value: 'Maintenance',
    label: 'PM & Maintenance',
    hint: 'ส่ง Fixture เข้าซ่อมบำรุง',
    tone: 'orange',
  },
  {
    value: 'Issue Spare',
    label: 'Issue Spare',
    hint: 'จ่าย Spare จาก Stock แทนทันที',
    tone: 'blue',
  },
]

export const RETURN_TARGETS = [
  {
    value: 'In Stock',
    label: 'In Stock',
    hint: 'Fixture confirm returned → พร้อมใช้รอบถัดไป',
    tone: 'emerald',
  },
  {
    value: 'Maintenance',
    label: 'Maintenance',
    hint: 'ส่ง PM & Maintenance ก่อนกลับเข้า Stock',
    tone: 'orange',
  },
]

/* PM states (computed จาก usage.exp / usage.current vs max) */
export const PM_STATES = ['pre-alert', 'overdue-remind', 'usage-remind', 'on-due', 'over-due']

export const PM_STATE_TONE = {
  tracked: { label: 'Tracking', chip: 'bg-slate-100 text-slate-500 ring-slate-500/10' },
  'pre-alert': { label: 'Pre-Alert', chip: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
  'overdue-remind': { label: 'Overdue 3 day (Orange)', chip: 'bg-orange-50 text-orange-700 ring-orange-600/10' },
  'usage-remind': { label: 'Current reach 80% (Orange)', chip: 'bg-orange-50 text-orange-700 ring-orange-600/10' },
  'on-due': { label: 'PM On Due', chip: 'bg-blue-50 text-blue-600 ring-blue-600/10' },
  'over-due': { label: 'PM Over Due', chip: 'bg-red-50 text-red-700 ring-red-600/10' },
}

export const PM_STATE_RANK = {
  'over-due': 0,
  'overdue-remind': 1,
  'on-due': 2,
  'usage-remind': 3,
  'pre-alert': 4,
  tracked: 5,
}

/* Verify + Record (NG chain) — Need Scrape → Need PR → Already have PR → New One Replacement */
export const MAINTENANCE_NG_OUTCOMES = [
  { value: 'Need Scrape', label: 'Need Scrape (Red color)', tone: 'red', status: 'Scrape' },
  { value: 'Need PR', label: 'Need PR (Red color)', tone: 'red', status: 'PR' },
  { value: 'Already have PR', label: 'Already have PR (Yellow)', tone: 'amber', status: 'PR Ready' },
  { value: 'New One Replacement', label: 'New One Replacement', tone: 'purple', status: 'Replaced' },
]

/* Order actions (NG chain → Order page) */
export const ORDER_ACTIONS = [
  {
    value: 'Need Scrape',
    label: 'Need Scrape (Red color)',
    hint: 'ส่ง Scrape / Re-surface',
    status: 'Scrape',
    tone: 'red',
  },
  {
    value: 'Need PR',
    label: 'Need PR (Red color)',
    hint: 'เปิด PR ขออะไหล่ใหม่',
    status: 'PR',
    tone: 'red',
  },
  {
    value: 'Already have PR',
    label: 'Already have PR (Yellow)',
    hint: 'มี PR อยู่แล้ว รออะไหล่',
    status: 'PR Ready',
    tone: 'amber',
  },
  {
    value: 'New One Replacement',
    label: 'New One Replacement',
    hint: 'สั่งทำ Fixture ตัวใหม่แทน',
    status: 'Replaced',
    tone: 'purple',
  },
  {
    value: 'Restock',
    label: 'Restock → In Stock',
    hint: 'ซ่อม / เปลี่ยนเสร็จ กลับเข้า Stock',
    status: 'In Stock',
    tone: 'emerald',
  },
]

/* User status (users.status : string) */
export const USER_STATUSES = ['Pending', 'Approved', 'Admin']

export const ROLE = {
  isAdmin: (role) => /admin/i.test(String(role || '')),
}

export function fixtureTone(status) {
  return (
    FIXTURE_STATUS_TONE[status] || {
      label: status || 'Unknown',
      chip: 'bg-slate-100 text-slate-600 ring-slate-500/10',
      dot: 'bg-slate-400',
    }
  )
}

export function requestTone(status) {
  return (
    REQUEST_STATUS_TONE[status] || {
      label: status || 'Unknown',
      chip: 'bg-slate-100 text-slate-600 ring-slate-500/10',
      dot: 'bg-slate-400',
    }
  )
}

export function pmTone(state) {
  return (
    PM_STATE_TONE[state] || {
      label: state || '-',
      chip: 'bg-slate-100 text-slate-500 ring-slate-500/10',
    }
  )
}

export function orderActionTone(value) {
  const action = ORDER_ACTIONS.find((item) => item.value === value)
  return action?.tone || 'slate'
}
