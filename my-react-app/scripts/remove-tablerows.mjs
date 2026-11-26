import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const needle = "  const tableRows = useMemo(() => {\n    const rows = []\n    for (const group of groupedFixtures) {\n      group.positions.forEach((pos, idx) => {\n        rows.push({\n          ...pos,\n          groupLine: group.line,\n          groupModel: group.model,\n          groupTotal: group.total,\n          groupSize: group.positions.length,\n          isFirst: idx === 0,\n        })\n      })\n    }\n    return rows\n  }, [groupedFixtures])\n\n"
if (!s.includes(needle)) { console.log('needle not found'); process.exit(1) }
s = s.replace(needle, '', 1)
fs.writeFileSync(p, s, 'utf8')
console.log('done')