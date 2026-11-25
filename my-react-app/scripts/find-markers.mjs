import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
const s = fs.readFileSync(p, 'utf8')
console.log('title marker:', s.indexOf("title={t('รายการ Fixture แยกตาม Model'"))
console.log('card marker:', s.indexOf('         </Card>\n       )}'))
console.log('listRows:', s.indexOf('const listRows'))