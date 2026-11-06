import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Order() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const data = await api.getFixtureRequests();
    setRows(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function acceptOnly(orderNo) {
    await api.acceptOnly(orderNo, { acceptID: user?.userId });
    load();
  }
  async function markReady(orderNo) {
    const input = prompt('ระบุ SN ที่จ่าย (คั่นด้วย ,) — หรือเว้นว่าง');
    const fixtures = input ? input.split(',').map((s) => s.trim()).filter(Boolean) : [];
    await api.accept(orderNo, { fixtures });
    load();
  }
  async function complete(orderNo) {
    const receiveBy = prompt('ชื่อผู้รับ (ReceiveBy)');
    if (!receiveBy) return;
    await api.complete(orderNo, { receiveBy });
    load();
  }

  const totals = {
    total: rows.length,
    waiting: rows.filter((r) => r.Status === 'Waiting').length,
    inprog: rows.filter((r) => r.Status === 'In-progress').length,
    finished: rows.filter((r) => r.Status === 'Finished').length,
  };

  return (
    <div>
      <div className="kpi-container">
        <div className="kpi-card"><div className="kpi-info"><h3>{totals.total}</h3><p>Total Orders</p></div></div>
        <div className="kpi-card"><div className="kpi-info"><h3>{totals.waiting}</h3><p>Waiting</p></div></div>
        <div className="kpi-card"><div className="kpi-info"><h3>{totals.inprog}</h3><p>In-progress</p></div></div>
        <div className="kpi-card"><div className="kpi-info"><h3>{totals.finished}</h3><p>Finished</p></div></div>
      </div>
      <div className="data-container">
        <div className="table-responsive">
          <table>
            <thead><tr><th>OrderNo</th><th>Status</th><th>Model</th><th>Line</th><th>Type</th><th>RequestID</th><th>RequestTime</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan="8" className="text-center">ไม่พบข้อมูล</td></tr> : rows.map((r) => (
                <tr key={r.OrderNo}>
                  <td>{r.OrderNo}</td>
                  <td><span className="badge status-ready">{r.Status}</span></td>
                  <td>{r.Model}</td>
                  <td>{r.Line}</td>
                  <td>{r.Type}</td>
                  <td>{r.RequestID}</td>
                  <td>{r.RequestTime ? new Date(r.RequestTime).toLocaleString() : '-'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {r.Status === 'Waiting' && <button className="btn-browse" onClick={() => acceptOnly(r.OrderNo)}>Accept</button>}
                    {r.Status === 'In-progress' && <button className="btn-browse" onClick={() => markReady(r.OrderNo)}>Mark Ready</button>}
                    {(r.Status === 'In-progress' || r.Status === 'Ready') && <button className="btn-browse" onClick={() => complete(r.OrderNo)}>Complete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}