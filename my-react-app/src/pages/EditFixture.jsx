import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function EditFixture() {
  const [fixtures, setFixtures] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');

  async function load() { setFixtures(await api.getFixtures()); }
  useEffect(() => { load(); }, []);

  const filtered = fixtures.filter((f) => !q || String(f.SN).toLowerCase().includes(q.toLowerCase()) || String(f.Name||'').toLowerCase().includes(q.toLowerCase()));

  function pick(f) { setSelected(f); setForm({ Name: f.Name, Status: f.Status, Type: f.Type, Model: f.Model, Line: f.Line, StorageLocation: f.StorageLocation, Description: f.Description, Usage: f.Usage || {} }); }

  async function save() {
    const res = await api.updateFixtureBySn(selected.SN, form);
    if (res.success) { setMsg('อัปเดตสำเร็จ'); setSelected(null); load(); }
    else setMsg(res.message);
  }
  async function del(sn) {
    if (!confirm(`ลบ ${sn}?`)) return;
    await api.deleteFixtureBySn(sn);
    load();
  }

  return (
    <div>
      <div className="header"><h1>Edit Fixtures</h1></div>
      <div className="search-panel-advanced">
        <input placeholder="ค้นหา SN / Name" value={q} onChange={(e)=>setQ(e.target.value)} />
      </div>
      {selected ? (
        <div className="search-panel-advanced">
          <h3>แก้ไข {selected.SN}</h3>
          <div className="search-columns">
            <div className="search-col">
              <div className="search-field"><label>Name</label><input value={form.Name||''} onChange={(e)=>setForm({...form,Name:e.target.value})} /></div>
              <div className="search-field"><label>Status</label><select value={form.Status||''} onChange={(e)=>setForm({...form,Status:e.target.value})}><option>In Stock</option><option>In Use</option><option>Maintenance</option></select></div>
              <div className="search-field"><label>Type</label><input value={form.Type||''} onChange={(e)=>setForm({...form,Type:e.target.value})} /></div>
            </div>
            <div className="search-col">
              <div className="search-field"><label>Model</label><input value={form.Model||''} onChange={(e)=>setForm({...form,Model:e.target.value})} /></div>
              <div className="search-field"><label>Line</label><input value={form.Line||''} onChange={(e)=>setForm({...form,Line:e.target.value})} /></div>
              <div className="search-field"><label>Storage</label><input value={form.StorageLocation||''} onChange={(e)=>setForm({...form,StorageLocation:e.target.value})} /></div>
            </div>
            <div className="search-col">
              <div className="search-field"><label>Description</label><input value={form.Description||''} onChange={(e)=>setForm({...form,Description:e.target.value})} /></div>
              <button className="btn-query" onClick={save}>บันทึก</button>
              <button className="btn-reset" onClick={() => setSelected(null)}>ยกเลิก</button>
            </div>
          </div>
          {msg ? <p>{msg}</p> : null}
        </div>
      ) : null}
      <div className="data-container">
        <table>
          <thead><tr><th>SN</th><th>Name</th><th>Status</th><th>Model</th><th>Line</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="6" className="text-center">ไม่พบข้อมูล</td></tr> : filtered.map((f) => (
              <tr key={f.SN}><td>{f.SN}</td><td>{f.Name}</td><td>{f.Status}</td><td>{f.Model}</td><td>{f.Line}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-browse" onClick={() => pick(f)}>Edit</button>
                  <button className="btn-reset" onClick={() => del(f.SN)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}