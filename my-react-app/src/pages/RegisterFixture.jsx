import { useState } from 'react';
import { api } from '../services/api';

export default function RegisterFixture() {
  const [sns, setSns] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [model, setModel] = useState('');
  const [line, setLine] = useState('N/A');
  const [storage, setStorage] = useState('');
  const [maxUsed, setMaxUsed] = useState('');
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();
    const items = sns.split('\n').map((s) => s.trim()).filter(Boolean).map((sn) => ({
      SN: sn,
      Name: name,
      Type: type,
      Status: 'In Stock',
      StorageLocation: storage,
      FixtureBase: name,
      Line: line,
      Model: model || 'N/A',
      OrderID: '',
      Usage: { CurrentUsed: 0, MaxUsed: Number(maxUsed) || null, ExpiredDate: null },
      Registed: { Date: new Date().toISOString().slice(0, 10) },
    }));
    const res = await api.bulkRegister(items);
    setMsg(`ลงทะเบียน ${res.count} รายการสำเร็จ`);
    setSns('');
  }

  return (
    <div>
      <div className="header"><h1>Register Fixtures</h1></div>
      <div className="search-panel-advanced">
        <form onSubmit={submit}>
          <div className="search-columns">
            <div className="search-col">
              <div className="search-field"><label>Name</label><input value={name} onChange={(e)=>setName(e.target.value)} required /></div>
              <div className="search-field"><label>Type</label><input value={type} onChange={(e)=>setType(e.target.value)} /></div>
            </div>
            <div className="search-col">
              <div className="search-field"><label>Model</label><input value={model} onChange={(e)=>setModel(e.target.value)} /></div>
              <div className="search-field"><label>Storage</label><input value={storage} onChange={(e)=>setStorage(e.target.value)} /></div>
            </div>
            <div className="search-col">
              <div className="search-field"><label>MaxUsed</label><input value={maxUsed} onChange={(e)=>setMaxUsed(e.target.value)} /></div>
              <div className="search-field"><label>Line</label><input value={line} onChange={(e)=>setLine(e.target.value)} /></div>
            </div>
          </div>
          <div className="input-group" style={{ marginTop: 12 }}>
            <label>Serial Numbers (หนึ่ง SN ต่อบรรทัด)</label>
            <textarea value={sns} onChange={(e)=>setSns(e.target.value)} rows={10} style={{ width: '100%' }} />
          </div>
          <button type="submit" className="btn-query" style={{ marginTop: 10 }}>ลงทะเบียน</button>
          {msg ? <p style={{ marginTop: 8 }}>{msg}</p> : null}
        </form>
      </div>
    </div>
  );
}