import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(/<\/Card><\/Card>\r?\n/, '</Card>\n')
fs.writeFileSync(p, s, 'utf8')
console.log('done')