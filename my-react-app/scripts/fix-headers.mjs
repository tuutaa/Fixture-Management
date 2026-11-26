import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const old = "                  {matrix.positions.map((position) => (\n                    <th key={position} className=\"sticky top-0 z-20 min-w-[44px] border-b border-r border-slate-200 bg-slate-50 px-1 py-2 text-center text-[9px] font-black text-slate-400\" title={position}>\n                      <span className=\"block truncate\" style={{maxWidth:'44px'}}>{position.split(' ').slice(0,2).join(' ')}</span>\n                    </th>\n                  ))}"
const neu = "                  {matrix.positions.map((position) => (\n                    <th key={position} className=\"sticky top-0 z-20 w-[26px] min-w-[26px] border-b border-r border-slate-200 bg-slate-50 px-0 py-1 text-center text-[9px] font-bold text-slate-500\" title={position} style={{writingMode:'vertical-rl', textOrientation:'mixed', height:'90px'}}>\n                      {position}\n                    </th>\n                  ))}"
if (!s.includes(old)) { console.log('old not found'); process.exit(1) }
s = s.replace(old, neu, 1)
s = s.replace('min-w-[44px]', 'min-w-[26px]')
s = s.replace('className="border-r border-slate-100 px-1 py-1.5 text-center text-[10px] text-slate-300"', 'className="border-r border-slate-100 px-0 py-1 text-center text-[9px] text-slate-300"')
s = s.replace('className="border-r border-slate-100 px-1 py-1.5 text-center" title={sns.join(\'\\n\')}', 'className="border-r border-slate-100 px-0 py-1 text-center" title={sns.join(\'\\n\')}')
s = s.replace('className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-blue-100 px-1 text-[10px] font-black text-blue-700"', 'className="inline-flex h-4 min-w-[18px] items-center justify-center rounded bg-blue-100 px-0.5 text-[9px] font-black text-blue-700"')
fs.writeFileSync(p, s, 'utf8')
console.log('done')