import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const lines = s.split(/\r?\n/)
// Remove line 742 (index 741) which is duplicate ") : ("
const idx = lines.findIndex((l, i) => i === 741 && l.trim() === ') : (')
if (idx >= 0) {
  lines.splice(idx, 1)
  fs.writeFileSync(p, lines.join('\n'), 'utf8')
  console.log('removed line', idx+1)
} else {
  console.log('not found')
}