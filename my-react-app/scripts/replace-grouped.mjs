import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const marker = "groupedFixtures.map((group) => ("
const idx = s.indexOf(marker)
if (idx < 0) { console.log('marker not found'); process.exit(1) }
// walk back to find the ") : (" before the div space-y-3
const divStart = s.lastIndexOf('<div className="space-y-3">', idx)
if (divStart < 0) { console.log('div start not found'); process.exit(1) }
// walk back to find ") : (" 
const branchStart = s.lastIndexOf(') : (', divStart)
if (branchStart < 0) { console.log('branch start not found'); process.exit(1) }
// find the end: the closing </div> before )} and Modal
const modalIdx = s.indexOf('<Modal', divStart)
const endDiv = s.lastIndexOf('</div>', modalIdx)
if (endDiv < 0) { console.log('end div not found'); process.exit(1) }
const closingParen = s.indexOf(')', endDiv)
const newlineAfter = s.indexOf('\n', closingParen) + 1
console.log('divStart', divStart, 'branchStart', branchStart, 'endDiv', endDiv, 'closingParen', closingParen)
const replacement = [
"       ) : (",
"          <div className=\"overflow-hidden rounded-xl border border-slate-200 bg-white\">",
"            <table className=\"min-w-full border-collapse text-left text-[11px]\">",
"              <thead>",
"                <tr className=\"bg-slate-50\">",
"                  <th className=\"sticky top-0 z-20 border-b border-r border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500\">",
"                    {t('Line', 'Line')}",
"                  </th>",
"                  <th className=\"sticky top-0 z-20 border-b border-r border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500\">",
"                    {t('Model', 'Model')}",
"                  </th>",
"                  <th className=\"sticky top-0 z-20 border-b border-r border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500\">",
"                    {t('Position', 'Position')}",
"                  </th>",
"                  <th className=\"sticky top-0 z-20 border-b border-r border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500\">",
"                    {t('Process', 'Process')}",
"                  </th>",
"                  <th className=\"sticky top-0 z-20 border-b border-r border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500\">",
"                    {t('SN', 'SN')}",
"                  </th>",
"                  <th className=\"sticky top-0 z-20 border-b border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500\">",
"                    {t('จำนวน', 'Count')}",
"                  </th>",
"                </tr>",
"              </thead>",
"              <tbody>",
"                {tableRows.map((row) => (",
"                  <tr key={row.id} className=\"border-b border-slate-100 hover:bg-slate-50/70\">",
"                    {row.isFirst ? (",
"                      <>",
"                        <td className=\"border-r border-slate-100 bg-slate-50/40 px-3 py-2 text-[12px] font-bold text-slate-700\" rowSpan={row.groupSize}>",
"                          {row.groupLine}",
"                        </td>",
"                        <td className=\"border-r border-slate-100 bg-slate-50/40 px-3 py-2 font-mono text-[11px] font-semibold text-slate-600\" rowSpan={row.groupSize}>",
"                          {row.groupModel}",
"                          <span className=\"ml-2 text-[9px] font-bold text-blue-600\">{row.groupTotal}</span>",
"                        </td>",
"                      </>",
"                    ) : null}",
"                    <td className=\"border-r border-slate-100 px-3 py-2 text-[12px] font-semibold text-slate-700\">",
"                      {row.position}",
"                    </td>",
"                    <td className=\"border-r border-slate-100 px-3 py-2 text-[11px] text-slate-500\">",
"                      {row.process}",
"                    </td>",
"                    <td className=\"border-r border-slate-100 px-3 py-2\">",
"                      <div className=\"flex flex-wrap gap-1\">",
"                        {row.sns.map((sn) => (",
"                          <span key={sn} className=\"rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200\" title={sn}>",
"                            {sn}",
"                          </span>",
"                        ))}",
"                      </div>",
"                    </td>",
"                    <td className=\"px-3 py-2 text-center text-[11px] font-black text-blue-600\">",
"                      {row.count.toLocaleString()}",
"                    </td>",
"                  </tr>",
"                ))}",
"              </tbody>",
"            </table>",
"            {tableRows.length === 0 ? (",
"              <div className=\"flex flex-col items-center justify-center gap-2 p-10 text-center\">",
"                <Boxes className=\"h-8 w-8 text-slate-300\" />",
"                <p className=\"text-[12px] font-semibold text-slate-400\">",
"                  {t('ไม่พบรายการ Fixture', 'No fixture list found')}",
"                </p>",
"                <p className=\"text-[10px] text-slate-400\">",
"                  {t('ลองเปลี่ยนตัวกรองหรือล้างตัวกรอง', 'Try changing filters or clearing them')}",
"                </p>",
"              </div>",
"            ) : null}",
"          </div>",
].join("\n")
// replace from branchStart to newlineAfter
s = s.substring(0, branchStart) + "       ) : (\n" + replacement + "\n        )\n" + s.substring(newlineAfter)
fs.writeFileSync(p, s, 'utf8')
console.log('done')