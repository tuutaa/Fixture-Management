import { useState } from 'react';
import { api } from '../services/api';

export default function ReturnPage() {
  const [sn, setSn] = useState('');
  const [info, setInfo] = useState(null);
  const [targetStatus, setTargetStatus] = useState('In Stock');
  const [msg, setMsg] = useState('');
  const [returnBy, setReturnBy] = useState('');

  async function lookup() {
    const res = await api.checkStatus(sn.trim());
    setInfo(res);
  }

  async function doReturn() {
    const res = await api.returnInstant({ serialNumber: sn.trim(), targetStatus });
    if (res.success) {
      setMsg(`คืน ${sn} → ${targetStatus} สำเร็จ`);
      setSn(''); setInfo(null);
    } else {
      setMsg(res.message);
    }
  }

  return (
    <div>
      <div className="header"><h1>Return Fixture</h1></div>
      <div className="search-panel-advanced">
        <div className="search-columns">
          <div className="search-col">
            <div className="search-field"><label>Serial No.</label><input value={sn} onChange={(e)=>setSn(e.target.value)} /></div>
            <button className="btn-query" onClick={lookup}>ตรวจสอบ</button>
          </div>
          <div className="search-col">
            <div className="search-field"><label>Return By</label><input value={returnBy} onChange={(e)=>setReturnBy(e.target.value)} /></div>
            <div className="search-field"><label>Target Status</label><select value={targetStatus} onChange={(e)=>setTargetStatus(e.target.value)}><option>In Stock</option><option>Maintenance</option></select></div>
          </div>
          <div className="search-col">
            <button className="btn-query" onClick={doReturn}>คืนคลัง</button>
          </div>
        </div>
        {info ? (
          <div style={{ marginTop: 12 }}>
            <p>found: {String(info.found)} / status: {info.status} / name: {info.name} / model: {info.model} / line: {info.currentLine}</p>
          </div>
        ) : null}
        {msg ? <p style={{ marginTop: 8 }}>{msg}</p> : null}
      </div>
    </div>
  );
}