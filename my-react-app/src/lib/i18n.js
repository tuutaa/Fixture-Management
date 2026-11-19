import { useLanguage } from '../context/LanguageContext'

export { useLanguage }

/* Canonical backend value -> [Thai, English] display pair. */
const LABELS = {
  fixture: {
    'In Stock': ['ในสต็อก', 'In Stock'],
    'In Use': ['ใช้งานที่ไลน์', 'In Use'],
    Maintenance: ['ซ่อมบำรุง', 'Maintenance'],
    Scrape: ['ต้อง Scrape', 'Need Scrape'],
    PR: ['ต้อง PR', 'Need PR'],
    'PR Ready': ['มี PR แล้ว', 'Already have PR'],
    Replaced: ['เปลี่ยนตัวใหม่', 'New One Replacement'],
  },
  request: {
    Waiting: ['รอดำเนินการ', 'Waiting'],
    Progress: ['กำลังดำเนินการ', 'In Progress'],
    Hold: ['พักงาน', 'Hold'],
    Verify: ['รอตรวจสอบ', 'Verify'],
    Done: ['เสร็จสิ้น', 'Done'],
    Rejected: ['ปฏิเสธ', 'Rejected'],
  },
  orderState: {
    '': ['รอดำเนินการ', 'Pending'],
    Pending: ['รอดำเนินการ', 'Pending'],
    Accepted: ['รับงานแล้ว', 'Accepted'],
    Rejected: ['ปฏิเสธแล้ว', 'Rejected'],
    Hold: ['พักงาน', 'Hold'],
    Issued: ['จ่ายแล้ว', 'Issued'],
    Verified: ['ตรวจสอบแล้ว', 'Verified'],
  },
  pm: {
    tracked: ['ติดตามผล', 'Tracking'],
    'pre-alert': ['แจ้งล่วงหน้า', 'Pre-Alert'],
    'overdue-remind': ['เกินกำหนด 3 วัน', 'Overdue 3 days'],
    'usage-remind': ['ใช้งานถึง 80%', 'Current reach 80%'],
    'on-due': ['ถึงกำหนด PM', 'PM On Due'],
    'over-due': ['เกินกำหนด PM', 'PM Over Due'],
  },
  requestType: {
    'Change Model': ['เปลี่ยนรุ่น', 'Change Model'],
    Breakdown: ['เสีย', 'Breakdown'],
  },
}

const pair = (group, value) => {
  const found = LABELS[group]?.[value]
  return found || [value || '-', value || '-']
}

const label = (t, group, value) => {
  const [th, en] = pair(group, value)
  return t(th, en)
}

export function useLabels() {
  const { t, lang, setLang } = useLanguage()
  return {
    t,
    lang,
    setLang,
    fixtureStatus: (status) => label(t, 'fixture', status),
    requestStatus: (status) => label(t, 'request', status),
    orderState: (state) => label(t, 'orderState', state),
    pmState: (state) => label(t, 'pm', state),
    requestType: (type) => label(t, 'requestType', type),
  }
}

/* Backend messages are authored in Thai. Map the common ones so toasts and
 * inline errors follow the selected language too. */
const MESSAGES = {
  'กรุณากรอก Emp ID และ Password': 'Please enter Emp ID and password',
  'Emp ID หรือ Password ไม่ถูกต้อง': 'Incorrect Emp ID or password',
  'บัญชีของคุณยังไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ': 'Your account is not approved yet. Please contact an administrator',
  'กรุณากรอก Emp ID, ชื่อ และ Password': 'Please enter Emp ID, name and password',
  'Emp ID นี้ถูกใช้งานแล้ว': 'This Emp ID is already in use',
  'Username นี้ถูกใช้งานแล้ว': 'This username is already in use',
  'Register Success! รอผู้ดูแลระบบอนุมัติ': 'Registration successful! Waiting for administrator approval',
  'ไม่มีข้อมูลที่ต้องการแก้ไข': 'No changes to update',
  'ไม่มีข้อมูลสำหรับ Import': 'No data to import',
  'กรุณาระบุ Storage Location': 'Please specify a storage location',
  'Storage นี้มีอยู่แล้ว': 'This storage already exists',
  'ไม่พบ Serial Number นี้ในระบบ': 'Serial number not found in the system',
  'กรุณากรอก SN, Line และ Model': 'Please enter SN, line and model',
  'ต้องระบุ line, from และ to': 'Please specify line, from and to',
  'ไม่พบคำขอนี้': 'Request not found',
  'กรุณาระบุประเภทคำขอและ Line': 'Please specify request type and line',
  'คำขอนี้ได้รับการยืนยันแล้ว': 'This request has already been accepted',
  'คุณมีงานที่รับอยู่แล้ว ไม่สามารถรับงานใหม่ได้': 'You already have an active job and cannot accept another',
  'คำขอนี้ไม่สามารถ hold ได้': 'This request cannot be held',
  'คำขอนี้ไม่สามารถ reject ได้': 'This request cannot be rejected',
  'คำขอนี้ไม่สามารถ complete ได้': 'This request cannot be completed',
  'คำขอนี้ไม่สามารถสแกนได้อีก': 'This request can no longer be scanned',
  'เฉพาะช่างที่รับงานนี้เท่านั้นที่สแกนได้': 'Only the assigned technician can scan this job',
  'กรุณาสแกน Serial Number': 'Please scan a serial number',
  'ยังไม่มี Fixture ที่สแกนตรงกัน': 'No matching fixture has been scanned yet',
  'ต้องสแกนทั้งรายการจ่ายและรับคืนก่อนกดตกลง': 'Scan both issue and return items before confirming',
  'ใช้กับคำขอ Breakdown เท่านั้น': 'Only available for Breakdown requests',
  'คำขอนี้ดำเนินการไปแล้ว': 'This request has already been processed',
  'กรุณาระบุ SN ของ Fixture ที่เสีย': 'Please specify the SN of the broken fixture',
  'กรุณาระบุ SN ของ Spare ที่จะจ่าย': 'Please specify the SN of the spare to issue',
  'action ต้องเป็น Maintenance หรือ Issue Spare': 'Action must be Maintenance or Issue Spare',
  'คำขอนี้ยังไม่พร้อม verify': 'This request is not ready for verification',
  'มีเพียงผู้ขอ (Requestor) เท่านั้นที่ Verify ได้': 'Only the requester can verify this job',
  'กรุณาระบุ Serial Number': 'Please specify a serial number',
  'Fixture นี้อยู่ใน Stock อยู่แล้ว': 'This fixture is already in stock',
  'กรุณาระบุ SN และจำนวนวัน': 'Please specify SN and number of days',
  'PM เกิน 7 วัน ต้อง Import เอกสาร 4M ก่อนอนุมัติ': 'PM is over 7 days — import the 4M document before approval',
  'กรุณาเลือกไฟล์เอกสาร 4M': 'Please select the 4M document file',
  'กรุณาระบุ SN': 'Please specify SN',
  'Fixture นี้อยู่ใน Maintenance แล้ว': 'This fixture is already in maintenance',
  'result ต้องเป็น OK หรือ NG': 'Result must be OK or NG',
  'outcome ต้องเป็น Need Scrape / Need PR / Already have PR / New One Replacement':
    'Outcome must be Need Scrape / Need PR / Already have PR / New One Replacement',
}

const dynamicMessage = (text) => {
  let m = text.match(/^ไม่พบ (.+) ในระบบ — ต้องสแกน Serial Number ที่มีอยู่ในระบบเท่านั้น(.*)$/)
  if (m) {
    const hint = m[2].replace('เช่น', 'e.g.')
    return [text, `${m[1]} not found in the system — scan a registered serial number only${hint}`]
  }
  m = text.match(/^ไม่พบ (.+) ในระบบ$/)
  if (m) return [text, `${m[1]} not found in the system`]
  m = text.match(/^สแกนไม่ครบ — ยังขาด (\d+) ตัว \((.+)\)$/)
  if (m) return [text, `Incomplete scan — ${m[1]} item(s) missing (${m[2]})`]
  m = text.match(/^อัปเดต (\d+) ตัวสำเร็จ — (.+) พร้อมให้เจ้าของคำขอ Verify$/)
  if (m) return [text, `Updated ${m[1]} item(s) successfully — ${m[2]} is ready for requester verification`]
  m = text.match(/^นำเข้าข้อมูลเรียบร้อย: เพิ่มใหม่ (\d+) รายการ, อัปเดต (\d+) รายการ$/)
  if (m) return [text, `Import complete: ${m[1]} added, ${m[2]} updated`]
  m = text.match(/^ลงทะเบียน (.+) สำเร็จ \(Not Exist\)$/)
  if (m) return [text, `Registered ${m[1]} successfully (Not Exist)`]
  m = text.match(/^คืน (.+) เข้า (.+) สำเร็จ$/)
  if (m) return [text, `Returned ${m[1]} to ${m[2]} successfully`]
  m = text.match(/^ส่ง (.+) เข้า PM & Maintenance \((.+)\)$/)
  if (m) return [text, `Sent ${m[1]} to PM & Maintenance (${m[2]})`]
  m = text.match(/^ขยาย PM ของ (.+) ไปถึง (.+)$/)
  if (m) return [text, `Extended PM for ${m[1]} until ${m[2]}`]
  m = text.match(/^ไม่พบ API: (.+)$/)
  if (m) return [text, `API not found: ${m[1]}`]
  return null
}

export function useServerMessage() {
  const { t } = useLanguage()
  return (message) => {
    const text = String(message || '')
    const english = MESSAGES[text]
    if (english) return t(text, english)
    const translated = dynamicMessage(text)
    return translated ? t(translated[0], translated[1]) : text
  }
}
