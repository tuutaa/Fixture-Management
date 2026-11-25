import re
p=r"D:\TIW\Webapp\Fixture Management\my-react-app\src\pages\FixtureListPage.jsx"
s=open(p,encoding='utf-8').read()
needle="}, [docs, appliedFilters.line, appliedFilters.model, needle, snNeedle, t])\n"
assert needle in s
insert = needle + """
  const listRows = useMemo(() => {
    const rows = []
    for (const row of matrix.rows) {
      for (const position of matrix.positions) {
        const sns = row.cell.get(position) || []
        if (!sns.length) continue
        rows.push({
          id: `${row.id}-${position}`,
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
"""
s=s.replace(needle, insert, 1)
open(p,'w',encoding='utf-8').write(s)
print("done")
PY