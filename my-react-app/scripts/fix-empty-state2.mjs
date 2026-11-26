import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const old = `              {listRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                  {t('ไม่พบรายการ Fixture', 'No fixture list found')}
                </div>
              ) : null}`
const neu = `              {listRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                  <Boxes className="h-8 w-8 text-slate-300" />
                  <p className="text-[12px] font-semibold text-slate-400">
                    {t('ไม่พบรายการ Fixture', 'No fixture list found')}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {t('ลองเปลี่ยนตัวกรองหรือล้างตัวกรอง', 'Try changing filters or clearing them')}
                  </p>
                </div>
              ) : null}`
if (s.includes(old)) {
  s = s.replace(old, neu)
  fs.writeFileSync(p, s, 'utf8')
  console.log('done')
} else {
  console.log('not found')
}