import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import CustomLogin from '@/components/pages/LoginPage';
import DashboardPage from '@/components/pages/DashboardPage';
import Rewards from '@/components/pages/RewardsPage';
import AdminDashboard from '@/components/pages/AdminDashboardPage';
import SocketAlerts from '@/components/widgets/SocketAlerts';
import AppLayout from '@/components/layout/AppLayout';
import AIAssistant from '@/components/pages/AIAssistantPage';
import TransactionPage from '@/components/pages/TransactionPage';
import SixJarsPage from '@/components/pages/SixJarsPage';
import ProfilePage from '@/components/pages/ProfilePage';
import SettingsPage from '@/components/pages/SettingsPage';

import { Toaster } from 'react-hot-toast';

function AppRoutes() {
  const { user, loading, isServerAlive } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isServerAlive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6" style={{ background: 'var(--bg-base)' }}>
        <h1 className="text-6xl mb-5">🚧</h1>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Hệ Thống Đang Bảo Trì</h2>
        <p className="text-sm max-w-sm mb-6" style={{ color: 'var(--text-muted)' }}>Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại Backend (port 3000).</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: 'var(--primary)', color: '#050d18' }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{
        style: { background: '#0c1624', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
      }} />
      {user && <SocketAlerts />}
      <Routes>
        <Route path="/login"     element={user ? <Navigate to="/dashboard" replace /> : <CustomLogin />} />
        <Route path="/register"  element={user ? <Navigate to="/dashboard" replace /> : <CustomLogin initialMode="register" />} />
        
        {/* Protected Routes wrapped in AppLayout */}
        <Route path="/dashboard" element={user ? <AppLayout><DashboardPage /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/transactions" element={user ? <AppLayout><TransactionPage /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/pockets"   element={user ? <AppLayout><SixJarsPage /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/rewards"   element={user ? <AppLayout><Rewards /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/ai"        element={user ? <AppLayout><AIAssistant /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/profile"   element={user ? <AppLayout><ProfilePage /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/settings"  element={user ? <AppLayout><SettingsPage /></AppLayout> : <Navigate to="/login" replace />} />
        
        <Route path="/admin"     element={user?.role === 'ADMIN' ? <AdminDashboard /> : <Navigate to="/dashboard" replace />} />
        <Route path="*"          element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppRoutes />
      </Router>
    </ThemeProvider>
  );
}
