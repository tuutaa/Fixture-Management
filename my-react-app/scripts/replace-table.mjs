import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const marker = "Fixture list by position"
const idx = s.indexOf(marker)
if (idx < 0) { console.log('marker not found'); process.exit(1) }
// walk back to find the Card opening
const cardStart = s.lastIndexOf('<Card className="overflow-hidden">', idx)
if (cardStart < 0) { console.log('card start not found'); process.exit(1) }
// find the matching closing </Card> then )} after cardStart
const cardEnd = s.indexOf('</Card>', cardStart)
if (cardEnd < 0) { console.log('card end not found'); process.exit(1) }
// endMarker includes the )} after </Card>
const fullEnd = s.indexOf(')', cardEnd)
// we want up to and including the )} on its own line; find next newline after )
const afterParen = s.indexOf('\n', fullEnd)
const end = afterParen
console.log('cardStart', cardStart, 'cardEnd', cardEnd, 'fullEnd', fullEnd)
const replacement = [
"          <div className=\"space-y-3\">",
"            {groupedFixtures.map((group) => (",
"              <Card key={group.line + '||' + group.model} className=\"overflow-hidden\">",
"                <div className=\"flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3\">",
"                  <div className=\"min-w-0\">",
"                    <p className=\"text-[13px] font-black text-slate-800\">",
"                      {group.line} <span className=\"text-slate-400\">/</span> {group.model}",
"                    </p>",
"                    <p className=\"text-[10px] text-slate-400\">",
"                      {t('ตำแหน่งทั้งหมด', 'Positions')} · {group.positions.length} · {t('รวม', 'Total')} {group.total.toLocaleString()} SN",
"                    </p>",
"                  </div>",
"                  <span className=\"rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200\">",
"                    {group.total.toLocaleString()} SN",
"                  </span>",
"                </div>",
"                <div className=\"divide-y divide-slate-100\">",
"                  {group.positions.map((row) => (",
"                    <div key={row.id} className=\"flex flex-wrap items-start gap-3 px-4 py-3 hover:bg-slate-50/70\">",
"                      <div className=\"min-w-[140px]\">",
"                        <p className=\"text-[11px] font-bold text-slate-700\">{row.position}</p>",
"                        <p className=\"text-[10px] text-slate-400\">{row.process}</p>",
"                      </div>",
"                      <div className=\"flex flex-1 flex-wrap gap-1\">",
"                        {row.sns.map((sn) => (",
"                          <span",
"                            key={sn}",
"                            className=\"rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200\"",
"                            title={sn}",
"                          >",
"                            {sn}",
"                          </span>",
"                        ))}",
"                      </div>",
"                      <span className=\"text-[11px] font-black text-blue-600\">{row.count.toLocaleString()}</span>",
"                    </div>",
"                  ))}",
"                </div>",
"              </Card>",
"            ))}",
"            {groupedFixtures.length === 0 ? (",
"              <Card>",
"                <div className=\"flex flex-col items-center justify-center gap-2 p-10 text-center\">",
"                  <Boxes className=\"h-8 w-8 text-slate-300\" />",
"                  <p className=\"text-[12px] font-semibold text-slate-400\">",
"                    {t('ไม่พบรายการ Fixture', 'No fixture list found')}",
"                  </p>",
"                  <p className=\"text-[10px] text-slate-400\">",
"                    {t('ลองเปลี่ยนตัวกรองหรือล้างตัวกรอง', 'Try changing filters or clearing them')}",
"                  </p>",
"                </div>",
"              </Card>",
"            ) : null}",
"          </div>",
].join("\n")
// We want to replace from cardStart to end (inclusive of the )} line)
// Find the line that contains ")" after cardEnd and its newline
const closingLineEnd = s.indexOf("\n", s.indexOf(")", cardEnd)) + 1
s = s.substring(0, cardStart) + replacement + "\n" + s.substring(closingLineEnd)
fs.writeFileSync(p, s, 'utf8')
console.log('done')