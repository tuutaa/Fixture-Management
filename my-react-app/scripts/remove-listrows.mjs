import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const needle = "  const listRows = useMemo(() => {\n    const rows = []\n    for (const row of matrix.rows) {\n      for (const position of matrix.positions) {\n        const sns = row.cell.get(position) || []\n        if (!sns.length) continue\n        rows.push({\n          id: `${row.id}-${position}`,\n          line: row.line || '-',\n          model: row.model || '-',\n          position,\n          process: [...(matrix.processBy.get(position) || [])].join(', ') || '-',\n          sns,\n          count: sns.length,\n        })\n      }\n    }\n    return rows.sort((a, b) =>\n      String(a.line || '').localeCompare(String(b.line || '')) ||\n      String(a.model || '').localeCompare(String(b.model || '')) ||\n      String(a.position || '').localeCompare(String(b.position || '')),\n    )\n  }, [matrix])\n\n"
if (!s.includes(needle)) { console.log('needle not found'); process.exit(1) }
s = s.replace(needle, '', 1)
fs.writeFileSync(p, s, 'utf8')
console.log('done')