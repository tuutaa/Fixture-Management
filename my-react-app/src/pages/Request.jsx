import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Request() {
  const { user } = useAuth();
  const [models, setModels] = useState([]);
  const [lines, setLines] = useState([]);
  const [model, setModel] = useState('');
  const [line, setLine] = useState('');
  const [type, setType] = useState('ChangeModel');
  const [description, setDescription] = useState('');
  const [msg, setMsg] = useState('');
  const [requestedList, setRequestedList] = useState([]);

  useEffect(() => {
    api.getOptions().then((o) => { setModels(o.models || []); setLines(o.lines || []); });
  }, []);
  useEffect(() => {
    if (!model) { setRequestedList([]); return; }
    api.getModels().then((list) => {
      const m = list.find((x) => x.Model === model);
      setRequestedList(m?.FixtureList || []);
    });
  }, [model]);

  async function submit(e) {
    e.preventDefault();
    const res = await api.createFixtureRequest({ model, line, type, description, requestID: user?.userId, fixtures: [], requested_fixture_list: requestedList.map((r) => ({ ...r })) });
    if (res.success) { setMsg(`สร้างคำขอ ${res.orderNo} สำเร็จ`); setDescription(''); }
    else setMsg(res.message || 'ผิดพลาด');
  }

  const input = "w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-900">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
          <div><label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Model</label><select value={model} onChange={(e)=>setModel(e.target.value)} required className={input}><option value="">เลือก Model</option>{models.map(m=><option key={m.Model} value={m.Model}>{m.Model}</option>)}</select></div>
          <div><label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Line</label><select value={line} onChange={(e)=>setLine(e.target.value)} required className={input}><option value="">เลือก Line</option>{lines.map(l=><option key={l.Line} value={l.Line}>{l.Line}</option>)}</select></div>
          <div><label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Type</label><select value={type} onChange={(e)=>setType(e.target.value)} className={input}><option>ChangeModel</option><option>ChangeItem</option></select></div>
          <div className="md:col-span-2"><label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Description</label><input value={description} onChange={(e)=>setDescription(e.target.value)} className={input} /></div>
          <div className="flex items-end"><button type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700">ส่งคำขอ</button></div>
        </form>
        {msg && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{msg}</p>}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Requested Fixture List ({requestedList.length})</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 text-left dark:border-slate-700"><th className="px-3 py-2">SN/Base</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Description</th></tr></thead>
            <tbody>{requestedList.length===0 ? <tr><td colSpan="4" className="px-3 py-6 text-center text-slate-500">ไม่มีรายการ</td></tr> : requestedList.map((r,i)=>(<tr key={i} className="border-b border-slate-100 dark:border-slate-800"><td className="px-3 py-2">{r.SN}</td><td className="px-3 py-2">{r.Qty}</td><td className="px-3 py-2">{r.Location}</td><td className="px-3 py-2">{r.Description}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}