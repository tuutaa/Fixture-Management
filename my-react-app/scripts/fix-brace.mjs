import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const lines = s.split(/\r?\n/)
// Find line with "        )" followed by blank then "      <Modal"
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === ')' && lines[i+1] === '' && lines[i+2].trim().startsWith('<Modal')) {
    lines.splice(i+1, 0, '        }')
    fs.writeFileSync(p, lines.join('\n'), 'utf8')
    console.log('inserted } at', i+2)
    break
  }
}