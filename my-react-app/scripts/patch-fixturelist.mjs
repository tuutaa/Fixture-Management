import fs from 'node:fs'
const p = 'D:/TIW/Webapp/Fixture Management/my-react-app/src/pages/FixtureListPage.jsx'
let s = fs.readFileSync(p, 'utf8')
const needle = "}, [docs, appliedFilters.line, appliedFilters.model, needle, snNeedle, t])\n"
if (!s.includes(needle)) throw new Error('needle not found')
const insert = needle + `
  const listRows = useMemo(() => {
    const rows = []
    for (const row of matrix.rows) {
      for (const position of matrix.positions) {
        const sns = row.cell.get(position) || []
        if (!sns.length) continue
        rows.push({
          id: \`\${row.id}-\${position}\`,
          line: row.line || '-',
          model: row.model || '-',
          position,
          process: [...(matrix.processBy.get(position) || [])].join(', ') || '-',
          sns,
          count: sns.length,
        })
      }
    }
    return rows.sort((a, b) =>
      String(a.line || '').localeCompare(String(b.line || '')) ||
      String(a.model || '').localeCompare(String(b.model || '')) ||
      String(a.position || '').localeCompare(String(b.position || '')),
    )
  }, [matrix])
`
s = s.replace(needle, insert, 1)
fs.writeFileSync(p, s, 'utf8')
console.log('done')