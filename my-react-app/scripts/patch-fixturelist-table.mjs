import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const startMarker = "         <Card className=\"overflow-hidden\">\n           <div className=\"flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3\">\n             <div>\n               <p className=\"text-xs font-black text-slate-800\">{t('รายการ Fixture แยกตาม Model'"
const endMarker = "         </Card>\n       )}"
const start = s.indexOf(startMarker)
const end = s.indexOf(endMarker, start)
if (start < 0 || end < 0) throw new Error(`markers not found start=${start} end=${end}`)
const replacement = `         <Card className="overflow-hidden">
           <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
             <div>
               <p className="text-xs font-black text-slate-800">{t('รายการ Fixture แยกตาม Position', 'Fixture list by position')}</p>
               <p className="text-[10px] text-slate-400">
                 {t('แต่ละแถวคือ Line + Model + Position · SN แสดงเป็น chips', 'Each row is Line + Model + Position · SNs shown as chips')}
               </p>
             </div>
             <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
               {t(\`\${listRows.length.toLocaleString()} รายการ\`, \`\${listRows.length.toLocaleString()} row(s)\`)}
             </span>
           </div>

           <div className="max-h-[calc(100vh-320px)] overflow-auto">
             <table className="min-w-full border-collapse text-left text-[11px]">
               <thead>
                 <tr className="bg-slate-50">
                   <th className="sticky top-0 z-20 border-b border-r border-slate-200 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                     {t('Line', 'Line')}
                   </th>
                   <th className="sticky top-0 z-20 border-b border-r border-slate-200 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                     {t('Model', 'Model')}
                   </th>
                   <th className="sticky top-0 z-20 border-b border-r border-slate-200 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                     {t('Position', 'Position')}
                   </th>
                   <th className="sticky top-0 z-20 border-b border-r border-slate-200 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                     {t('Process', 'Process')}
                   </th>
                   <th className="sticky top-0 z-20 border-b border-r border-slate-200 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                     {t('SN', 'SN')}
                   </th>
                   <th className="sticky top-0 z-20 border-b border-slate-200 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                     {t('จำนวน', 'Count')}
                   </th>
                 </tr>
               </thead>
               <tbody>
                 {listRows.map((row) => (
                   <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                     <td className="border-r border-slate-100 px-3 py-2 text-[11px] font-bold text-slate-700">
                       {row.line || '-'}
                     </td>
                     <td className="border-r border-slate-100 px-3 py-2 font-mono text-[10px] font-semibold text-slate-600">
                       {row.model || '-'}
                     </td>
                     <td className="border-r border-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-700">
                       {row.position || '-'}
                     </td>
                     <td className="border-r border-slate-100 px-3 py-2 text-[10px] text-slate-500">
                       {row.process || '-'}
                     </td>
                     <td className="border-r border-slate-100 px-3 py-2">
                       <div className="flex flex-wrap gap-1">
                         {row.sns.map((sn) => (
                           <span
                             key={sn}
                             className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600"
                             title={sn}
                           >
                             {sn}
                           </span>
                         ))}
                       </div>
                     </td>
                     <td className="px-3 py-2 text-center text-[11px] font-black text-blue-600">
                       {row.count.toLocaleString()}
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
             {listRows.length === 0 ? (
               <div className="p-6 text-center text-[11px] font-semibold text-slate-400">
                 {t('ไม่พบรายการ Fixture', 'No fixture list found')}
               </div>
             ) : null}
           </div>
         </Card>`
s = s.substring(0, start) + replacement + s.substring(end + endMarker.length)
fs.writeFileSync(p, s, 'utf8')
console.log('done')