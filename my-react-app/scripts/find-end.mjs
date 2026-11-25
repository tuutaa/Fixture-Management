import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
const s = fs.readFileSync(p, 'utf8')
const i = s.indexOf('max-h-[calc(100vh-320px)]')
const j = s.indexOf('</Card>', i)
console.log('j', j)
console.log(JSON.stringify(s.slice(j-20, j+20)))