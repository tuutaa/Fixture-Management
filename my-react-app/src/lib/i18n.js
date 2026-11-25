import { useCallback, useMemo } from 'react'
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
    Replace: ['เปลี่ยน Fixture', 'Replace'],
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
  return useMemo(() => ({
    t,
    lang,
    setLang,
    fixtureStatus: (status) => label(t, 'fixture', status),
    requestStatus: (status) => label(t, 'request', status),
    orderState: (state) => label(t, 'orderState', state),
    pmState: (state) => label(t, 'pm', state),
    requestType: (type) => label(t, 'requestType', type),
  }), [t, lang, setLang])
}

/* Backend messages are authored in Thai. Map the common ones so toasts and
 * inline errors follow the selected language too. */
const MESSAGES = {
  'กรุณากรอก Emp ID และ Password': 'Please enter Emp ID and password',
  'Emp ID หรือ Password ไม่ถูกต้อง': 'Incorrect Emp ID or password',
  'บัญชีของคุณยังไม่ได้ลงนาม กรุณาติดต่อผู้ดูแลระบบ': 'Your account is not signed yet. Please contact an administrator',
  'กรุณากรอก Emp ID, ชื่อ และ Password': 'Please enter Emp ID, name and password',
  'Emp ID นี้ถูกใช้งานแล้ว': 'This Emp ID is already in use',
  'Username นี้ถูกใช้งานแล้ว': 'This username is already in use',
  'Register Success! รอผู้ดูแลระบบลงนาม': 'Registration successful! Waiting for administrator signature',
  'ลงทะเบียนสำเร็จ กรุณารอการลงนามจากผู้ดูแล': 'Registration successful. Please wait for the administrator to sign your account',
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
  'คำขอนี้ไม่สามารถสแกนคืนได้': 'This request cannot be scanned for return',
  'เฉพาะช่างที่รับงานนี้เท่านั้นที่สแกนได้': 'Only the assigned technician can scan this job',
  'เฉพาะช่างที่รับงานนี้เท่านั้นที่สแกนคืนได้': 'Only the assigned technician can scan returns',
  'เฉพาะผู้ขอ (Requestor) เท่านั้นที่ยืนยันได้': 'Only the requester can confirm',
  'กรุณาสแกน Serial Number': 'Please scan a serial number',
  'รีเซ็ตรายการสแกนแล้ว': 'Scan list reset',
  'รีเซ็ตรายการสแกนคืนแล้ว': 'Return scan list reset',
  'ยังไม่มี Fixture ที่สแกนตรงกัน': 'No matching fixture has been scanned yet',
  'ต้องสแกนทั้งรายการจ่ายและรับคืนก่อนกดตกลง': 'Scan both issue and return items before confirming',
  'ใช้กับคำขอ Breakdown เท่านั้น': 'Only available for Breakdown requests',
  'คำขอนี้ดำเนินการไปแล้ว': 'This request has already been processed',
  'กรุณาระบุ SN ของ Fixture ที่เสีย': 'Please specify the SN of the broken fixture',
  'กรุณาระบุ SN ของ Spare ที่จะจ่าย': 'Please specify the SN of the spare to issue',
  'action ต้องเป็น Maintenance หรือ Issue Spare': 'Action must be Maintenance or Issue Spare',
  'คำขอนี้ยังไม่พร้อม verify': 'This request is not ready for verification',
  'เฉพาะผู้ขอหรือช่างที่รับงานเท่านั้นที่ยืนยันการคืนได้': 'Only the requester or assignee can confirm this return',
  'บันทึกการยืนยันจากผู้ขอแล้ว — รอช่างที่รับงานสแกนและยืนยัน': 'Requester confirmation recorded — waiting for the assignee to scan and confirm',
  'บันทึกการยืนยันจากช่างแล้ว — รอผู้ขอยืนยัน': 'Assignee confirmation recorded — waiting for the requester to confirm',
  'กรุณาระบุ Serial Number': 'Please specify a serial number',
  'Fixture นี้อยู่ใน Stock อยู่แล้ว': 'This fixture is already in stock',
  'กรุณาระบุ SN และจำนวนวัน': 'Please specify SN and number of days',
  'PM เกิน 7 วัน ต้อง Import เอกสาร 4M ก่อนอนุมัติ': 'PM is over 7 days — import the 4M document before approval',
  'กรุณาระบุจำนวนวันที่ต้องการทำ PM (1–365)': 'Please enter how many days of PM (1–365)',
  'action ต้องเป็น approve หรือ reject': 'Action must be approve or reject',
  'เฉพาะ Admin เท่านั้นที่อนุมัติ PM ได้': 'Only Admin can approve PM',
  'Fixture นี้รอ Admin อนุมัติ PM อยู่ — ยังเริ่ม PM ไม่ได้': 'This fixture is waiting for Admin approval — PM cannot start yet',
  'PM เกิน 7 วันต้องได้รับการอนุมัติจาก Admin ก่อน': 'PM over 7 days needs Admin approval first',
  'กรุณาเลือกไฟล์เอกสาร 4M': 'Please select the 4M document file',
  'กรุณาระบุ Line': 'Please specify a line',
  'ต้องสแกนรายการจ่ายก่อนกดตกลง': 'Scan the issue items before confirming',
  'กรุณาเลือกคิว Change Model (07:00–16:00)': 'Please pick a Change Model slot (07:00–16:00)',
  'กรุณาระบุจำนวน Fixture ที่ต้องเปลี่ยน (อย่างน้อย 1)': 'Please specify how many fixtures to replace (at least 1)',
  'ไม่มี Fixture ที่เลือกในระบบ': 'No selected fixture was found in the system',
  'กรุณาระบุวันที่ Exp ไม่ถูกต้อง': 'Invalid expiry date',
  'กรุณาระบุ SN': 'Please specify SN',
  'Fixture นี้อยู่ใน Maintenance แล้ว': 'This fixture is already in maintenance',
  'PM ได้เฉพาะ Fixture ที่ใช้งานอยู่ (In Use) เท่านั้น': 'PM can only be planned for fixtures currently In Use',
  'result ต้องเป็น OK หรือ NG': 'Result must be OK or NG',
  'outcome ต้องเป็น Need Scrape / Need PR / Already have PR / New One Replacement':
    'Outcome must be Need Scrape / Need PR / Already have PR / New One Replacement',
  'Fixture ที่ไม่มี Line / Model ไม่ต้องแนบเอกสาร 4M':
    'Fixtures without line / model do not need a 4M document',
  'กรุณาเลือก Fixture ที่ต้อง Verify': 'Please select the fixtures to verify',
  'ไม่มี Fixture ที่ Verify ได้': 'No fixture can be verified',
  'กรุณาเลือก Line และ Model ก่อนส่ง PM': 'Please choose a line and model before starting PM',
}

const dynamicMessage = (text) => {
  let m = text.match(/^ไม่พบ (.+) ในระบบ — ต้องสแกน Serial Number ที่มีอยู่ในระบบเท่านั้น(.*)$/)
  if (m) {
    const hint = m[2].replace('เช่น', 'e.g.')
    return [text, `${m[1]} not found in the system — scan a registered serial number only${hint}`]
  }
  m = text.match(/^ไม่พบ (.+) ในระบบ$/)
  if (m) return [text, `${m[1]} not found in the system`]
  m = text.match(/^สแกน(?:จ่าย)?ไม่ครบ — ยังขาด (\d+) ตัว \((.+)\)$/)
  if (m) return [text, `Incomplete issue scan — ${m[1]} item(s) missing (${m[2]})`]
  m = text.match(/^สแกนคืนไม่ครบ — ยังขาด (\d+) ตัว \((.+)\)$/)
  if (m) return [text, `Incomplete return scan — ${m[1]} item(s) missing (${m[2]})`]
  m = text.match(/^(.+) สแกนคืนครบตามรายการที่ระบุในคำขอแล้ว$/)
  if (m) return [text, `${m[1]} — all SNs listed in this request have been scanned`]
  m = text.match(/^(.+) ไม่ตรงกับ Serial Number ที่ต้องคืนของคำขอนี้$/)
  if (m) return [text, `${m[1]} is not the exact serial number required for this return`]
  m = text.match(/^base (.+) สแกนจ่ายครบตามจำนวนที่ระบบคำนวณแล้ว$/)
  if (m) return [text, `Base ${m[1]} — all issue items have been scanned`]
  m = text.match(/^base (.+) สแกนคืนครบตามจำนวนที่ระบบคำนวณแล้ว$/)
  if (m) return [text, `Base ${m[1]} — all return items have been scanned`]
  m = text.match(/^(.+) ไม่ตรงกับรายการที่ต้องจ่ายของคำขอนี้ \(base (.+)\)$/)
  if (m) return [text, `${m[1]} is not in this request's issue list (base ${m[2]})`]
  m = text.match(/^(.+) ไม่ตรงกับรายการที่ต้องคืนของคำขอนี้ \(base (.+)\)$/)
  if (m) return [text, `${m[1]} is not in this request's return list (base ${m[2]})`]
  m = text.match(/^(.+) อยู่ในสถานะ (.+) \(ต้องเป็น In Stock ก่อนจ่าย\)$/)
  if (m) return [text, `${m[1]} is ${m[2]} (must be In Stock before issuing)`]
  m = text.match(/^จ่าย (\d+) ตัวสำเร็จ — (.+) พร้อม Verify และรับคืน$/)
  if (m) return [text, `Issued ${m[1]} item(s) — ${m[2]} is ready to verify and return`]
  m = text.match(/^อัปเดต (\d+) ตัวสำเร็จ — (.+) พร้อมให้เจ้าของคำขอ Verify$/)
  if (m) return [text, `Updated ${m[1]} item(s) successfully — ${m[2]} is ready for requester verification`]
  m = text.match(/^Verify สำเร็จ — (.+) ปิดงานแล้ว$/)
  if (m) return [text, `Verify successful — ${m[1]} closed`]
  m = text.match(/^นำเข้าข้อมูลเรียบร้อย: เพิ่มใหม่ (\d+) รายการ, อัปเดต (\d+) รายการ, อัปเดต Fixture (\d+) ตัว$/)
  if (m) return [text, `Import complete: ${m[1]} added, ${m[2]} updated, ${m[3]} fixtures corrected`]
  m = text.match(/^นำเข้าข้อมูลเรียบร้อย: เพิ่มใหม่ (\d+) รายการ, อัปเดต (\d+) รายการ$/)
  if (m) return [text, `Import complete: ${m[1]} added, ${m[2]} updated`]
  m = text.match(/^พบ Fixture ที่ต้องอัปเดต step\/process\/position (\d+) รายการ — กดยืนยันเพื่ออัปเดตและนำเข้าไฟล์$/)
  if (m) return [text, `${m[1]} fixture(s) need step/process/position correction — confirm to update and import`]
  m = text.match(/^มีคำขอ (.+) ที่ยังดำเนินการอยู่สำหรับ Fixture (.+)$/)
  if (m) return [text, `Request ${m[1]} is still active for fixture ${m[2]}`]
  m = text.match(/^มีคำขอ (.+) ที่ยังดำเนินการอยู่สำหรับ (.+) (.+)$/)
  if (m) return [text, `Request ${m[1]} is already active for ${m[2]} ${m[3]}`]
  m = text.match(/^คิว (.+) วันที่ (.+) ถูกคำขอ (.+) ใช้งานอยู่ กรุณาเลือกคิวอื่น$/)
  if (m) return [text, `Slot ${m[1]} on ${m[2]} is already taken by ${m[3]} — please pick another slot`]
  m = text.match(/^Fixture (.+) เกินกำหนด PM (\d+) วัน — กรุณาแนบเอกสาร 4M ก่อนแก้ไขข้อมูล$/)
  if (m) return [text, `Fixture ${m[1]} is ${m[2]} days overdue — attach the 4M document before editing`]
  m = text.match(/^ไม่มี Fixture ใน Line (.+) \/ Model (.+) ที่เกินกำหนด PM มากกว่า 3 วัน$/)
  if (m) return [text, `No fixture in line ${m[1]} / model ${m[2]} is more than 3 days overdue`]
  m = text.match(/^ไม่มี Fixture ใน Line (.+) ที่เกินกำหนด PM มากกว่า 7 วัน$/)
  if (m) return [text, `No fixture in line ${m[1]} is more than 7 days overdue`]
  m = text.match(/^ต้องแนบเอกสาร 4M ก่อนเริ่ม PM (\d+) ตัวใน Line (.+) \/ Model (.+)$/)
  if (m) return [text, `${m[1]} fixture(s) need 4M before PM can start in line ${m[2]} / model ${m[3]}`]
  m = text.match(/^ไม่มี Fixture ที่พร้อมเริ่ม PM ใน Line (.+) \/ Model (.+)$/)
  if (m) return [text, `No fixture is ready to start PM in line ${m[1]} / model ${m[2]}`]
  m = text.match(/^เริ่ม PM (\d+) ตัว → PM & Maintenance \((.+)\) · Line (.+) \/ Model (.+)(?: · ข้าม (\d+) ตัว)?$/)
  if (m) return [text, `Started PM for ${m[1]} fixture(s) → PM & Maintenance (${m[2]}) · line ${m[3]} / model ${m[4]}${m[5] ? ` · skipped ${m[5]}` : ''}`]
  m = text.match(/^แนบ 4M ให้ (\d+) ตัวแล้ว · ขอ PM (\d+) วัน — รอ Admin อนุมัติก่อนเข้าซ่อม$/)
  if (m) return [text, `4M attached to ${m[1]} fixture(s) · ${m[2]} days of PM — awaiting Admin approval before repair`]
  m = text.match(/^แนบ 4M ให้ (\d+) ตัวแล้ว · กำหนด PM (\d+) วัน — พร้อมกดกำลังทำ PM$/)
  if (m) return [text, `4M attached to ${m[1]} fixture(s) · ${m[2]} days of PM — ready to start PM`]
  m = text.match(/^(.+) อนุมัติ PM (\d+) วัน — เข้าสู่ Maintenance แล้ว$/)
  if (m) return [text, `Approved ${m[2]} days of PM for ${m[1]} — now in Maintenance`]
  m = text.match(/^(.+) ปฏิเสธ PM — กลับไปรอทำ PM$/)
  if (m) return [text, `Rejected PM for ${m[1]} — back to waiting for PM`]
  m = text.match(/^PM ผ่าน — (.+) กลับเข้า In Stock แล้ว \(รอจ่ายออกเพื่อเริ่ม PM รอบใหม่\)$/)
  if (m) return [text, `Passed PM — ${m[1]} is back In Stock (new PM clock starts when issued)`]
  m = text.match(/^Verify OK (\d+) ตัว — กลับเข้า In Stock แล้ว$/)
  if (m) return [text, `Verified OK: ${m[1]} fixture(s) — back In Stock`]
  m = text.match(/^Verify NG (\d+) ตัว — (.+)$/)
  if (m) return [text, `Verified NG: ${m[1]} fixture(s) — ${m[2]}`]
  m = text.match(/^Verify \+ Record OK — กลับเข้า In Stock \(รอจ่ายออกเพื่อเริ่ม PM รอบใหม่\)$/)
  if (m) return [text, 'Verify + Record OK — back In Stock (new PM clock starts when issued)']
  m = text.match(/^Verify \+ Record NG — (.+)$/)
  if (m) return [text, `Verify + Record NG — ${m[1]}`]
  m = text.match(/^Import เอกสาร 4M: (.+)$/)
  if (m) return [text, `4M document attached: ${m[1]}`]
  m = text.match(/^ครบกำหนด PM 90 วัน \((.+)\) → รอทำ PM$/)
  if (m) return [text, `90-day PM due (${m[1]}) — waiting for PM`]
  m = text.match(/^เริ่มทำ PM (.+) → PM & Maintenance · (.+)$/)
  if (m) return [text, `PM started ${m[1]} → PM & Maintenance · ${m[2]}`]
  m = text.match(/^(.+) → Maintenance · เริ่มทำ PM (.+)$/)
  if (m) return [text, `${m[1]} → Maintenance · PM started ${m[2]}`]
  m = text.match(/^(.+) ไม่ได้อยู่ในสถานะ PM \(ปัจจุบัน: (.+)\)$/)
  if (m) return [text, `${m[1]} is not in PM status (currently: ${m[2]})`]
  m = text.match(/^(.+) ไม่ได้รออนุมัติ PM \(ปัจจุบัน: (.+)\)$/)
  if (m) return [text, `${m[1]} is not awaiting PM approval (currently: ${m[2]})`]
  m = text.match(/^ลงทะเบียน (.+) สำเร็จ \(Not Exist\)$/)
  if (m) return [text, `Registered ${m[1]} successfully (Not Exist)`]
  m = text.match(/^Fixture นี้ไม่ได้อยู่ใน Stock \((.+)\)$/)
  if (m) return [text, `This fixture is not in stock (${m[1]})`]
  m = text.match(/^จ่าย (.+) ให้ (.+) · (.+) สำเร็จ$/)
  if (m) return [text, `Issued ${m[1]} to ${m[2]} · ${m[3]} successfully`]
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
  return useCallback((message) => {
    const text = String(message || '')
    const english = MESSAGES[text]
    if (english) return t(text, english)
    const translated = dynamicMessage(text)
    return translated ? t(translated[0], translated[1]) : text
  }, [t])
}
