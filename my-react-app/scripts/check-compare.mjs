import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/server.js'
let s = fs.readFileSync(p, 'utf8')
const idx = s.indexOf('const compareModels = async (line, from, to) => {')
console.log('idx', idx)
console.log(JSON.stringify(s.slice(idx, idx+80)))