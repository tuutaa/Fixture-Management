import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const divMarker = '<div className="overflow-hidden rounded-xl border border-slate-200 bg-white">'
const divStart = s.indexOf(divMarker)
if (divStart < 0) { console.log('div not found'); process.exit(1) }
const modalIdx = s.indexOf('<Modal', divStart)
const endDiv = s.lastIndexOf('</div>', modalIdx)
const closingParen = s.indexOf(')', endDiv)
const newlineAfter = s.indexOf('\n', closingParen) + 1
console.log('divStart', divStart, 'endDiv', endDiv, 'closingParen', closingParen)
const replacement = [
"          <div className=\"overflow-x-auto rounded-xl border border-slate-200 bg-white\">",
"            <table className=\"border-collapse text-left text-[11px]\">",
"              <thead>",
"                <tr className=\"bg-slate-50\">",
"                  <th className=\"sticky left-0 top-0 z-30 min-w-[60px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500\">",
"                    {t('Line', 'Line')}",
"                  </th>",
"                  <th className=\"sticky left-[60px] top-0 z-30 min-w-[120px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500\">",
"                    {t('Model', 'Model')}",
"                  </th>",
"                  {matrix.positions.map((position) => (",
"                    <th key={position} className=\"sticky top-0 z-20 min-w-[44px] border-b border-r border-slate-200 bg-slate-50 px-1 py-2 text-center text-[9px] font-black text-slate-400\" title={position}>",
"                      <span className=\"block truncate\" style={{maxWidth:'44px'}}>{position.split(' ').slice(0,2).join(' ')}</span>",
"                    </th>",
"                  ))}",
"                </tr>",
"              </thead>",
"              <tbody>",
"                {matrix.rows.map((row) => (",
"                  <tr key={row.id} className=\"border-b border-slate-100 hover:bg-blue-50/40\">",
"                    <td className=\"sticky left-0 z-10 min-w-[60px] border-r border-slate-100 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700\">",
"                      {row.line || '-'}",
"                    </td>",
"                    <td className=\"sticky left-[60px] z-10 min-w-[120px] border-r border-slate-100 bg-white px-2 py-1.5 font-mono text-[10px] font-semibold text-slate-600\">",
"                      {row.model || '-'}",
"                    </td>",
"                    {matrix.positions.map((position) => {",
"                      const sns = row.cell.get(position) || []",
"                      if (sns.length === 0) return (",
"                        <td key={position} className=\"border-r border-slate-100 px-1 py-1.5 text-center text-[10px] text-slate-300\">",
"                          -",
"                        </td>",
"                      )",
"                      return (",
"                        <td key={position} className=\"border-r border-slate-100 px-1 py-1.5 text-center\" title={sns.join('\\n')}>",
"                          <span className=\"inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-blue-100 px-1 text-[10px] font-black text-blue-700\">",
"                            {sns.length}",
"                          </span>",
"                        </td>",
"                      )",
"                    })}",
"                  </tr>",
"                ))}",
"              </tbody>",
"            </table>",
"            {matrix.rows.length === 0 ? (",
"              <div className=\"flex flex-col items-center justify-center gap-2 p-10 text-center\">",
"                <Boxes className=\"h-8 w-8 text-slate-300\" />",
"                <p className=\"text-[12px] font-semibold text-slate-400\">",
"                  {t('ไม่พบรายการ Fixture', 'No fixture list found')}",
"                </p>",
"              </div>",
"            ) : null}",
"          </div>",
].join("\n")
s = s.substring(0, divStart) + replacement + s.substring(newlineAfter)
fs.writeFileSync(p, s, 'utf8')
console.log('done')