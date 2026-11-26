import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const old = "{t('ไม่พบรายการ Fixture', 'No fixture list found')}"
const neu = "<Boxes className=\"h-8 w-8 text-slate-300\" />\n                  <p className=\"text-[12px] font-semibold text-slate-400\">\n                    {t('ไม่พบรายการ Fixture', 'No fixture list found')}\n                  </p>\n                  <p className=\"text-[10px] text-slate-400\">\n                    {t('ลองเปลี่ยนตัวกรองหรือล้างตัวกรอง', 'Try changing filters or clearing them')}\n                  </p>"
if (s.includes(old)) {
  s = s.replace(old, neu)
  fs.writeFileSync(p, s, 'utf8')
  console.log('done')
} else {
  console.log('not found')
}