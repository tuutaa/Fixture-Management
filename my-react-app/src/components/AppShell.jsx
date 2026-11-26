import { useState } from 'react'
import { LogOut, Menu, Wrench, X } from 'lucide-react'
import { cn, initials } from '../lib/format'
import { IS_MOCK } from '../lib/api'
import { ALL_NAV_ITEMS, isAdminUser, isPageAllowed, NAV_GROUPS } from '../lib/navigation'
import { useLanguage } from '../context/LanguageContext'
import LanguageSwitcher from './LanguageSwitcher'

export default function AppShell({ user, page, onNavigate, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { t, ui } = useLanguage()
  const isAdmin = isAdminUser(user)
  const active = ALL_NAV_ITEMS.find((item) => item.key === page) || ALL_NAV_ITEMS[0]
  const visibleGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isPageAllowed(item.key, user)),
    }))
    .filter((group) => group.items.length > 0)
  const displayName = [user?.name, user?.lastName].filter(Boolean).join(' ')
    || user?.userId || t('ผู้ใช้', 'User')

  const navigate = (key) => {
    setMobileOpen(false)
    onNavigate(key)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileOpen ? (
        <button
          type="button"
          aria-label={t('ปิดเมนูนำทาง', 'Close navigation')}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:translate-x-0',
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 px-5 pb-6 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            <Wrench className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-slate-900">
              {t('บริหารจัดการ Fixture', 'Fixture Management')}
            </p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
              {t('FAN2 · ระบบ Fixture MM', 'FAN2 · Fixture MM')}
            </p>
            {IS_MOCK ? (
              <span className="mt-1 inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700">
                {ui('mockData')}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label={t('ปิดแถบด้านข้าง', 'Close sidebar')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.labelEn}>
              <div className="px-3 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {t(group.labelTh, group.labelEn)}
                </span>
              </div>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = item.key === page
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => navigate(item.key)}
                        aria-current={isActive ? 'page' : undefined}
                        title={t(item.hintTh, item.hintEn)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/70 ${isActive ? 'border-blue-100 bg-blue-50 text-blue-600' : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                      >
                        <span className={`shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                        </span>
                        <span className="flex-1 truncate text-sm font-semibold">
                          {t(item.labelTh, item.labelEn)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="m-3 rounded-2xl bg-slate-50 p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-[11px] font-black text-white">
              {initials(user?.name || user?.userId || 'U')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-800">{displayName}</p>
              <p className="truncate text-[10px] font-medium text-slate-400">
                {user?.userId || '-'}
                {user?.dept ? ` · ${user.dept}` : ''}
                {isAdmin ? ` · ${t('ผู้ดูแลระบบ', 'ADMIN')}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title={t('ออกจากระบบ', 'Log out')}
              aria-label={t('ออกจากระบบ', 'Log out')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t('เปิดเมนูนำทาง', 'Open navigation')}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-slate-900">
                {t('บริหารจัดการ Fixture', 'Fixture Management')}
              </p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
                {t(active?.labelTh, active?.labelEn)}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[10px] font-black text-blue-700">
              {initials(user?.name || user?.userId || 'U')}
            </div>
          </div>
        </header>

        <main className="w-full max-w-none px-3 pb-16 pt-6 sm:px-5 lg:pl-5 lg:pr-8 lg:pt-8">
          <div className="animate-fade-up">{children}</div>
        </main>
      </div>

      <LanguageSwitcher />
    </div>
  )
}
