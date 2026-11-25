import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
const s = fs.readFileSync(p, 'utf8')
console.log('by model:', s.indexOf('Fixture list by model'))
console.log('w-max:', s.indexOf('w-max min-w-full'))
console.log('max-h calc:', s.indexOf('max-h-[calc(100vh-320px)]'))
const i = s.indexOf('max-h-[calc(100vh-320px)]')
console.log(s.slice(i-20, i+50))