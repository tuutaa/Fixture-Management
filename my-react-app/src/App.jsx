import { useCallback, useMemo, useState } from 'react'
import AppShell from './components/AppShell'
import { ToastProvider } from './components/ui/Toast'
import LanguageSwitcher from './components/LanguageSwitcher'
import { ALL_NAV_ITEMS, DEFAULT_PAGE } from './lib/navigation'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RequestPage from './pages/RequestPage'
import ReturnPage from './pages/ReturnPage'
import OrderPage from './pages/OrderPage'
import FixtureListPage from './pages/FixtureListPage'
import PMPage from './pages/PMPage'
import RegisterFixturePage from './pages/RegisterFixturePage'
import EditFixturePage from './pages/EditFixturePage'
import HistoryPage from './pages/HistoryPage'
import { SESSION, UI_STATE } from './lib/constants'

function readSession() {
  try {
    const userId = localStorage.getItem(SESSION.userId)
    if (!userId) return null
    return {
      userId,
      name: localStorage.getItem(SESSION.user) || userId,
      lastName: localStorage.getItem(SESSION.lastName) || '',
      role: localStorage.getItem(SESSION.role) || '',
      dept: localStorage.getItem(SESSION.dept) || '',
      requestId: localStorage.getItem(SESSION.requestId) || '',
    }
  } catch {
    return null
  }
}

function clearSession() {
  try {
    Object.values(SESSION).forEach((key) => localStorage.removeItem(key))
  } catch {
    /* ignore */
  }
}

function readPage() {
  try {
    const stored = localStorage.getItem(UI_STATE.page)
    if (stored && ALL_NAV_ITEMS.some((item) => item.key === stored)) return stored
  } catch {
    /* ignore */
  }
  return DEFAULT_PAGE
}

function writePage(next) {
  try {
    localStorage.setItem(UI_STATE.page, next)
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [user, setUser] = useState(readSession)
  const [page, setPage] = useState(readPage)

  const validPage = useMemo(
    () => (ALL_NAV_ITEMS.some((item) => item.key === page) ? page : DEFAULT_PAGE),
    [page],
  )

  const handleLogin = useCallback((session) => {
    setUser(session)
    setPage(DEFAULT_PAGE)
    writePage(DEFAULT_PAGE)
  }, [])

  const handleLogout = useCallback(() => {
    clearSession()
    try {
      localStorage.removeItem(UI_STATE.page)
    } catch {
      /* ignore */
    }
    setUser(null)
  }, [])

  const navigate = useCallback((next) => {
    setPage(next)
    writePage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  if (!user) {
    return (
      <ToastProvider>
        <LoginPage onLogin={handleLogin} />
        <LanguageSwitcher />
      </ToastProvider>
    )
  }

  const pages = {
    dashboard: DashboardPage,
    request: RequestPage,
    return: ReturnPage,
    order: OrderPage,
    fixtures: FixtureListPage,
    pm: PMPage,
    register: RegisterFixturePage,
    edit: EditFixturePage,
    history: HistoryPage,
  }

  const PageComponent = pages[validPage] || DashboardPage

  return (
    <ToastProvider>
      <AppShell user={user} page={validPage} onNavigate={navigate} onLogout={handleLogout}>
        <PageComponent user={user} onNavigate={navigate} />
      </AppShell>
    </ToastProvider>
  )
}
