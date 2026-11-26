import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const lines = s.split(/\r?\n/)
for (let i = 738; i <= 745; i++) console.log(i+1, JSON.stringify(lines[i]))