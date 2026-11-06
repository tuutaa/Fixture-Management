import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Layout from './components/Layout.jsx';
import Main from './pages/Main.jsx';
import Request from './pages/Request.jsx';
import Order from './pages/Order.jsx';
import Issue from './pages/Issue.jsx';
import ReturnPage from './pages/ReturnPage.jsx';
import RegisterFixture from './pages/RegisterFixture.jsx';
import EditFixture from './pages/EditFixture.jsx';
import FixtureList from './pages/FixtureList.jsx';
import TestPrint from './pages/TestPrint.jsx';

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
function AdminProtected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/request" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Navigate to="/main" replace />} />
        <Route path="main" element={<AdminProtected><Main /></AdminProtected>} />
        <Route path="request" element={<Request />} />
        <Route path="order" element={<Order />} />
        <Route path="issue" element={<AdminProtected><Issue /></AdminProtected>} />
        <Route path="return" element={<AdminProtected><ReturnPage /></AdminProtected>} />
        <Route path="register-fixture" element={<AdminProtected><RegisterFixture /></AdminProtected>} />
        <Route path="edit" element={<AdminProtected><EditFixture /></AdminProtected>} />
        <Route path="list" element={<AdminProtected><FixtureList /></AdminProtected>} />
        <Route path="test-print" element={<AdminProtected><TestPrint /></AdminProtected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}