import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { LayoutDashboard, Package, Settings, ClipboardList, LogOut, Sun, Moon, Wrench, Printer } from 'lucide-react';

const adminItems = [
  { to: '/main', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/edit', label: 'Edit Fixtures', icon: Settings },
  { to: '/register-fixture', label: 'Register', icon: Package },
  { to: '/issue', label: 'Issue', icon: Wrench },
  { to: '/return', label: 'Return', icon: Wrench },
  { to: '/list', label: 'Fixture List', icon: ClipboardList },
  { to: '/test-print', label: 'Test Print', icon: Printer },
];
const userItems = [
  { to: '/request', label: 'Request', icon: ClipboardList },
  { to: '/order', label: 'Order Status', icon: ClipboardList },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const items = isAdmin ? [...adminItems, ...userItems] : userItems;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 lg:flex">
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-blue-600 px-4 py-3 text-white">
          <Package className="h-5 w-5" />
          <div className="font-semibold">Fixture Management</div>
        </div>
        <nav className="flex-1 space-y-1">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/70 dark:focus-visible:ring-blue-400/70 ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full min-h-[44px] items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            type="button"
            onClick={() => { logout(); navigate('/login'); }}
            className="flex w-full min-h-[44px] items-center gap-3 rounded-xl bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 lg:hidden">
          <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{user?.name}{' '}<span className="text-blue-600 dark:text-blue-400">FAN2</span></span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}