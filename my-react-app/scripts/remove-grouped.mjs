import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const needle = "  const groupedFixtures = useMemo(() => {\n    const groups = new Map()\n    for (const row of listRows) {\n      const key = row.line + '||' + row.model\n      if (!groups.has(key)) {\n        groups.set(key, { line: row.line, model: row.model, positions: [], total: 0 })\n      }\n      const group = groups.get(key)\n      group.positions.push(row)\n      group.total += row.count\n    }\n    return [...groups.values()].sort((a, b) =>\n      String(a.line || '').localeCompare(String(b.line || '')) ||\n      String(a.model || '').localeCompare(String(b.model || '')),\n    )\n  }, [listRows])\n\n"
if (!s.includes(needle)) { console.log('needle not found'); process.exit(1) }
s = s.replace(needle, '', 1)
fs.writeFileSync(p, s, 'utf8')
console.log('done')