import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Issue() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [orderNo, setOrderNo] = useState('');
  const [model, setModel] = useState('');
  const [line, setLine] = useState('');
  const [maxUsed, setMaxUsed] = useState('');
  const [expiredDate, setExpiredDate] = useState('');
  const [withdrawBy, setWithdrawBy] = useState('');
  const [sns, setSns] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.getFixtureRequests().then((data) => setOrders(data.filter((r) => r.Status === 'Waiting' || r.Status === 'In-progress')));
  }, []);

  useEffect(() => {
    const r = orders.find((x) => x.OrderNo === orderNo);
    if (r) { setModel(r.Model); setLine(r.Line); }
  }, [orderNo, orders]);

  async function handleIssue(e) {
    e.preventDefault();
    const items = sns.split('\n').map((s) => s.trim()).filter(Boolean).map((sn) => ({
      SN: sn, Line: line, Model: model, OrderID: orderNo, MaxUsed: Number(maxUsed) || 0, ExpiredDate: expiredDate, WithdrawBy: withdrawBy || user?.name
    }));
    await api.bulkIssue({ items });
    if (orderNo) await api.accept(orderNo, { fixtures: items.map((i) => i.SN) });
    setMsg(`เบิกจ่าย ${items.length} รายการสำเร็จ`);
    setSns('');
  }

  return (
    <div>
      <div className="header"><h1>Issue Fixtures</h1></div>
      <div className="search-panel-advanced">
        <form onSubmit={handleIssue}>
          <div className="search-columns">
            <div className="search-col">
              <div className="search-field"><label>Order</label><select value={orderNo} onChange={(e)=>setOrderNo(e.target.value)}><option value="">-- เลือก Order --</option>{orders.map(o=><option key={o.OrderNo} value={o.OrderNo}>{o.OrderNo} ({o.Status})</option>)}</select></div>
              <div className="search-field"><label>Model</label><input value={model} onChange={(e)=>setModel(e.target.value)} /></div>
            </div>
            <div className="search-col">
              <div className="search-field"><label>Line</label><input value={line} onChange={(e)=>setLine(e.target.value)} /></div>
              <div className="search-field"><label>MaxUsed</label><input value={maxUsed} onChange={(e)=>setMaxUsed(e.target.value)} /></div>
            </div>
            <div className="search-col">
              <div className="search-field"><label>ExpiredDate</label><input type="date" value={expiredDate} onChange={(e)=>setExpiredDate(e.target.value)} /></div>
              <div className="search-field"><label>WithdrawBy</label><input value={withdrawBy} placeholder={user?.name} onChange={(e)=>setWithdrawBy(e.target.value)} /></div>
            </div>
          </div>
          <div className="input-group" style={{ marginTop: 12 }}>
            <label>Serial Numbers (หนึ่ง SN ต่อบรรทัด)</label>
            <textarea value={sns} onChange={(e)=>setSns(e.target.value)} rows={8} style={{ width: '100%' }} />
          </div>
          <button type="submit" className="btn-query" style={{ marginTop: 10 }}>ยืนยันการเบิกจ่าย</button>
          {msg ? <p style={{ marginTop: 8 }}>{msg}</p> : null}
        </form>
      </div>
    </div>
  );
}