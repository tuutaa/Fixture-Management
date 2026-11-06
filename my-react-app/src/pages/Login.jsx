import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { Package } from 'lucide-react';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reg, setReg] = useState({ UserID: '', Password: '', Name: '', LastName: '' });
  const [error, setError] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  useEffect(() => {
    if (user) navigate('/main', { replace: true });
  }, [user, navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/main', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
      setPassword('');
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setRegError(''); setRegSuccess(false);
    try {
      const res = await api.register(reg);
      if (res.success) {
        setRegSuccess(true);
        setTimeout(() => { setMode('login'); setUsername(reg.UserID); setRegSuccess(false); }, 2000);
      } else {
        setRegError(res.message);
      }
    } catch (err) {
      setRegError('ไม่สามารถติดต่อระบบได้');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><Package className="h-5 w-5" /></div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Fixture Management</h1>
        </div>

        {mode === 'login' ? (
          <>
            <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">เข้าสู่ระบบ</h2>
            {error && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">ชื่อผู้ใช้งาน (UserID)</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-blue-600/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">รหัสผ่าน</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-blue-600/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              </div>
              <button type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700">เข้าสู่ระบบ</button>
            </form>
            <p className="mt-4 text-center text-sm text-slate-500">
              ยังไม่มีบัญชีผู้ใช้? <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); }} className="text-blue-600 hover:underline">สมัครสมาชิกที่นี่</a>
            </p>
          </>
        ) : (
          <>
            <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">สมัครสมาชิก</h2>
            {regError && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{regError}</div>}
            {regSuccess && <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">สมัครสมาชิกสำเร็จ!</div>}
            <form onSubmit={handleRegister} className="space-y-4">
              {['UserID-รหัสพนักงาน','Password-รหัสผ่าน','Name-ชื่อ','LastName-นามสกุล'].map((item) => {
                const [k,label] = item.split('-');
                const key = k === 'UserID' ? 'UserID' : k === 'Password' ? 'Password' : k === 'Name' ? 'Name' : 'LastName';
                return (
                  <div key={key}>
                    <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">{label}</label>
                    <input
                      type={key === 'Password' ? 'password' : 'text'}
                      value={reg[key]}
                      onChange={(e) => setReg({ ...reg, [key]: e.target.value })}
                      required
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-blue-600/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                );
              })}
              <button type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700">ลงทะเบียน</button>
            </form>
            <p className="mt-4 text-center text-sm text-slate-500">
              มีบัญชีผู้ใช้อยู่แล้ว? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); }} className="text-blue-600 hover:underline">กลับไปหน้าล็อกอิน</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}