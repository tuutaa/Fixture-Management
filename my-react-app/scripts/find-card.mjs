import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
const s = fs.readFileSync(p, 'utf8')
const i = s.indexOf('max-h-[calc(100vh-320px)]')
const start = s.lastIndexOf('<Card className="overflow-hidden">', i)
console.log('start', start)
console.log(JSON.stringify(s.slice(start, start+120)))
const end = s.indexOf('         </Card>', i)
console.log('end', end)
console.log(JSON.stringify(s.slice(end, end+40)))