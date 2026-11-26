/* Central UI copy catalog for the language switcher.
 * Domain tokens (Fixture / PM / NG / SN / Doc NO. / project badge) stay as-is. */
export const UI_TEXT = {
  thai: ['ไทย', 'Thai'],
  english: ['อังกฤษ', 'English'],
  liveSnapshot: ['สถานะล่าสุด', 'Live snapshot'],
  byLine: ['ตาม Line', 'By line'],
  workflow: ['ขั้นตอนงาน', 'Workflow'],
  status: ['สถานะ', 'Status'],
  types: ['ประเภท', 'Types'],
  process: ['กระบวนการ', 'Process'],
  focus: ['โฟกัส', 'Focus'],
  dueOverdue: ['ครบ / เกินกำหนด', 'Due / overdue'],
  topBreakdown: ['Breakdown สูงสุด', 'Top breakdown'],
  activeFleet: ['Fixture ที่ใช้งาน', 'Active fleet'],
  latestRequests: ['คำขอล่าสุด', 'Latest requests'],
  last7Days: ['7 วัน', '7d'],
  inUseShort: ['ใช้งาน', 'In Use'],
  stockShort: ['สต็อก', 'Stock'],
  maintShort: ['ซ่อม', 'Maint.'],
  ngShort: ['NG', 'NG'],
  pmShort: ['PM', 'PM'],
  notAvailable: ['ไม่มีข้อมูล', 'N/A'],
  mockData: ['ข้อมูลจำลอง', 'Mock data'],
  waitingCaps: ['รอดำเนินการ', 'WAITING'],
  progressCaps: ['กำลังดำเนินการ', 'PROGRESS'],
  holdCaps: ['พักงาน', 'HOLD'],
  verifyCaps: ['ตรวจสอบ', 'VERIFY'],
  doneCaps: ['เสร็จสิ้น', 'DONE'],
  fixtureIntelligence: ['ข้อมูลเชิงลึก Fixture', 'Fixture Intelligence'],
}

export const getUiText = (key, lang) => {
  const pair = UI_TEXT[key]
  if (!pair) return key
  return lang === 'TH' ? pair[0] : (pair[1] ?? pair[0])
}
