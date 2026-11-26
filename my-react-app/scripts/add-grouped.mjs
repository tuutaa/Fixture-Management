import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const needle = "  }, [matrix])\n\n  const statusValues"
const groupCode = [
  "  }, [matrix])",
  "",
  "  const groupedFixtures = useMemo(() => {",
  "    const groups = new Map()",
  "    for (const row of listRows) {",
  "      const key = row.line + '||' + row.model",
  "      if (!groups.has(key)) {",
  "        groups.set(key, { line: row.line, model: row.model, positions: [], total: 0 })",
  "      }",
  "      const group = groups.get(key)",
  "      group.positions.push(row)",
  "      group.total += row.count",
  "    }",
  "    return [...groups.values()].sort((a, b) =>",
  "      String(a.line || '').localeCompare(String(b.line || '')) ||",
  "      String(a.model || '').localeCompare(String(b.model || '')),",
  "    )",
  "  }, [listRows])",
  "",
  "  const statusValues",
].join("\n")
if (!s.includes(needle)) { console.log('needle not found'); process.exit(1) }
s = s.replace(needle, groupCode, 1)
fs.writeFileSync(p, s, 'utf8')
console.log('done')