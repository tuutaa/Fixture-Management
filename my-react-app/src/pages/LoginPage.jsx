import { useState } from 'react'
import { Building2, IdCard, Lock, LogIn, UserRound } from 'lucide-react'
import AuthCard, { authButton, authIcon, authInput, authLabel } from '../components/AuthCard'
import { useToast } from '../components/ui/Toast'
import api from '../lib/api'
import { SESSION } from '../lib/constants'

export default function LoginPage({ onLogin }) {
  const toast = useToast()
  const [mode, setMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    empId: '',
    username: '',
    pass: '',
    name: '',
    lastname: '',
    dept: '',
  })

  const setField = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const submitLogin = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api.login({ empId: form.empId.trim(), pass: form.pass })
      if (!result.success) throw new Error(result.message || 'เข้าสู่ระบบไม่สำเร็จ')
      localStorage.setItem(SESSION.user, result.name || '')
      localStorage.setItem(SESSION.userId, result.userId || '')
      localStorage.setItem(SESSION.lastName, result.lastName || '')
      localStorage.setItem(SESSION.role, result.role || '')
      localStorage.setItem(SESSION.dept, result.dept || '')
      onLogin({
        name: result.name,
        userId: result.userId,
        lastName: result.lastName,
        role: result.role,
        dept: result.dept,
      })
      toast.success(`ยินดีต้อนรับ ${result.name || result.userId}`, { title: 'Login success' })
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submitRegister = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.register({
        empId: form.empId.trim(),
        username: form.username.trim(),
        pass: form.pass,
        name: form.name.trim(),
        lastname: form.lastname.trim(),
        dept: form.dept.trim(),
      })
      toast.success('ลงทะเบียนสำเร็จ กรุณารอการอนุมัติจากผู้ดูแล', { title: 'Register success' })
      setMode('login')
      setForm((current) => ({ ...current, pass: '' }))
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <AuthCard
        icon={LogIn}
        title={isLogin ? 'Fixture Management' : 'Register'}
        subtitle={isLogin ? 'เข้าสู่ระบบด้วย Employee ID / Username' : 'สร้างบัญชีผู้ใช้ใหม่'}
      >
        {error ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <form onSubmit={isLogin ? submitLogin : submitRegister} className="space-y-4" noValidate>
          <div>
            <label className={authLabel} htmlFor="empId">
              Employee ID
            </label>
            <div className="relative">
              <IdCard className={authIcon} />
              <input
                id="empId"
                type="text"
                autoComplete="username"
                placeholder="Employee ID หรือ Username"
                className={authInput}
                value={form.empId}
                onChange={setField('empId')}
                required
              />
            </div>
          </div>

          {!isLogin ? (
            <>
              <div>
                <label className={authLabel} htmlFor="username">User</label>
                <div className="relative">
                  <UserRound className={authIcon} />
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    placeholder="ชื่อผู้ใช้ (ถ้ามี)"
                    className={authInput}
                    value={form.username}
                    onChange={setField('username')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={authLabel} htmlFor="name">Name</label>
                  <div className="relative">
                    <UserRound className={authIcon} />
                    <input
                      id="name"
                      type="text"
                      className={authInput}
                      value={form.name}
                      onChange={setField('name')}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={authLabel} htmlFor="lastname">Lastname</label>
                  <div className="relative">
                    <UserRound className={authIcon} />
                    <input
                      id="lastname"
                      type="text"
                      className={authInput}
                      value={form.lastname}
                      onChange={setField('lastname')}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className={authLabel} htmlFor="dept">Department</label>
                <div className="relative">
                  <Building2 className={authIcon} />
                  <input
                    id="dept"
                    type="text"
                    className={authInput}
                    value={form.dept}
                    onChange={setField('dept')}
                  />
                </div>
              </div>
            </>
          ) : null}

          <div>
            <label className={authLabel} htmlFor="pass">Password</label>
            <div className="relative">
              <Lock className={authIcon} />
              <input
                id="pass"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                className={authInput}
                value={form.pass}
                onChange={setField('pass')}
                required
              />
            </div>
          </div>

          <button type="submit" className={authButton} disabled={busy}>
            {busy ? 'กำลังดำเนินการ…' : isLogin ? 'เข้าสู่ระบบ' : 'ลงทะเบียน'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? 'ยังไม่มีบัญชี?' : 'มีบัญชีแล้ว?'}{' '}
          <button
            type="button"
            onClick={() => setMode(isLogin ? 'register' : 'login')}
            className="font-bold text-blue-600 hover:underline"
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </div>
      </AuthCard>
    </div>
  )
}
