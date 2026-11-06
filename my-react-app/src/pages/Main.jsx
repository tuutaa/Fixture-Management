import { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { Package, Search, RotateCcw } from 'lucide-react';

export default function Main() {
  const [fixtures, setFixtures] = useState([]);
  const [models, setModels] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ sn: '', name: '', model: '', line: '', status: '', type: '' });
  const pageSize = 20;

  async function load() {
    setLoading(true);
    const [f, opts] = await Promise.all([api.getFixtures(), api.getOptions()]);
    setFixtures(f);
    setModels(opts.models || []);
    setLines(opts.lines || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => fixtures.filter((f) => {
    if (filters.sn && !String(f.SN || '').toLowerCase().includes(filters.sn.toLowerCase())) return false;
    if (filters.name && !String(f.Name || '').toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.model && f.Model !== filters.model) return false;
    if (filters.line && f.Line !== filters.line) return false;
    if (filters.status && f.Status !== filters.status) return false;
    if (filters.type && f.Type !== filters.type) return false;
    return true;
  }), [fixtures, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const kpis = {
    total: fixtures.length,
    inStock: fixtures.filter((f) => f.Status === 'In Stock').length,
    inUse: fixtures.filter((f) => f.Status === 'In Use').length,
    maintenance: fixtures.filter((f) => f.Status === 'Maintenance').length,
  };

  function reset() { setFilters({ sn: '', name: '', model: '', line: '', status: '', type: '' }); setPage(1); }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Total Fixtures', kpis.total, 'bg-blue-50 dark:bg-blue-500/10', 'text-blue-600'],
          ['In Stock', kpis.inStock, 'bg-emerald-50 dark:bg-emerald-500/10', 'text-emerald-600'],
          ['In Use', kpis.inUse, 'bg-red-50 dark:bg-red-500/10', 'text-red-600'],
          ['Maintenance', kpis.maintenance, 'bg-amber-50 dark:bg-amber-500/10', 'text-amber-600'],
        ].map(([label, val, bg, color]) => (
          <div key={label} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-900`}>
            <div className={`mb-2 inline-flex rounded-xl px-2.5 py-1 text-xs font-semibold ${bg} ${color}`}>{label}</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{val}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Serial No.</label>
            <div className="flex gap-2">
              <input value={filters.sn} onChange={(e) => setFilters({ ...filters, sn: e.target.value })} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-blue-600/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              <button onClick={() => setPage(1)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Search className="h-4 w-4" />ค้นหา</button>
              <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><RotateCcw className="h-4 w-4" />รีเซ็ต</button>
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['Name', 'text', 'name', null],
            ['Model', 'select', 'model', models.map((m) => m.Model)],
            ['Line', 'select', 'line', lines.map((l) => l.Line)],
            ['Status', 'select', 'status', ['In Stock', 'In Use', 'Maintenance']],
            ['Type', 'text', 'type', null],
          ].map(([label, type, key, opts]) => (
            <div key={key}>
              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">{label}</label>
              {type === 'select' ? (
                <select value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">ทั้งหมด</option>
                  {(opts || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-blue-600/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-900">
        {loading && <div className="py-10 text-center text-slate-500">กำลังโหลด...</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <th className="px-3 py-2">SN</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Model</th><th className="px-3 py-2">Line</th><th className="px-3 py-2">Storage</th><th className="px-3 py-2">Used/Max</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? <tr><td colSpan="8" className="px-3 py-6 text-center text-slate-500">ไม่พบข้อมูล</td></tr> : rows.map((f) => (
                <tr key={f.SN + (f._id || '')} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{f.SN}</td>
                  <td className="px-3 py-2">{f.Name}</td>
                  <td className="px-3 py-2">{f.Type}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      f.Status === 'In Use' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' :
                      f.Status === 'In Stock' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' :
                      'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                    }`}>{f.Status}</span>
                  </td>
                  <td className="px-3 py-2">{f.Model}</td>
                  <td className="px-3 py-2">{f.Line}</td>
                  <td className="px-3 py-2">{f.StorageLocation}</td>
                  <td className="px-3 py-2">{f.Usage?.CurrentUsed || 0}/{f.Usage?.MaxUsed || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700">ก่อนหน้า</button>
          <span className="text-sm text-slate-500">หน้า {page} / {totalPages} (ทั้งหมด {filtered.length})</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700">ถัดไป</button>
        </div>
      </div>
    </div>
  );
}