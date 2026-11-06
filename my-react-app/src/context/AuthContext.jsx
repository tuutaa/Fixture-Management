import { createContext, useContext, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('fm_user');
    return raw ? JSON.parse(raw) : null;
  });

  async function login(username, password) {
    const res = await api.login(username, password);
    if (!res.success) throw new Error(res.message);
    const u = { name: res.name, userId: res.userId, lastName: res.lastName, role: res.role };
    localStorage.setItem('fm_user', JSON.stringify(u));
    localStorage.setItem('currentUser', res.name);
    localStorage.setItem('currentUserID', res.userId);
    localStorage.setItem('currentLastName', res.lastName);
    localStorage.setItem('userRole', res.role || '');
    setUser(u);
    return u;
  }
  function logout() {
    localStorage.removeItem('fm_user');
    setUser(null);
  }
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}