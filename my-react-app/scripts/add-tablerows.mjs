import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const needle = "  }, [listRows])\n\n  const statusValues"
const code = [
  "  }, [listRows])",
  "",
  "  const tableRows = useMemo(() => {",
  "    const rows = []",
  "    for (const group of groupedFixtures) {",
  "      group.positions.forEach((pos, idx) => {",
  "        rows.push({",
  "          ...pos,",
  "          groupLine: group.line,",
  "          groupModel: group.model,",
  "          groupTotal: group.total,",
  "          groupSize: group.positions.length,",
  "          isFirst: idx === 0,",
  "        })",
  "      })",
  "    }",
  "    return rows",
  "  }, [groupedFixtures])",
  "",
  "  const statusValues",
].join("\n")
if (!s.includes(needle)) { console.log('needle not found'); process.exit(1) }
s = s.replace(needle, code, 1)
fs.writeFileSync(p, s, 'utf8')
console.log('done')