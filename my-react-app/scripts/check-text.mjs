import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const lines = s.split(/\r?\n/)
console.log(JSON.stringify(lines[779]))
console.log(JSON.stringify(lines[780]))
console.log(JSON.stringify(lines[781]))
console.log(JSON.stringify(lines[782]))
console.log(JSON.stringify(lines[783]))