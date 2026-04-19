import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CreditCard, PiggyBank, Bot,
  Trophy, Settings, LogOut, ChevronLeft,
  Landmark, Target
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

const NAV = [
  { label: 'Dashboard',      icon: <LayoutDashboard size={18} />, path: '/dashboard' },
  { label: 'Giao dịch',      icon: <CreditCard size={18} />,      path: '/transactions' },
  { label: 'Hũ Tài Chính',   icon: <PiggyBank size={18} />,       path: '/pockets' },
  { label: 'Mục Tiêu',       icon: <Target size={18} />,          path: '/goals' },
  { label: 'Gamification',   icon: <Trophy size={18} />,          path: '/rewards' },
  { label: 'AI Trợ lý',      icon: <Bot size={18} />,             path: '/ai' },
];

interface Props { collapsed: boolean; onToggle: () => void; }

export default function FintechSidebar({ collapsed, onToggle }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 230 }}
      transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col shrink-0 h-screen overflow-hidden border-r select-none z-20"
      style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 mb-1">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-violet-600 flex items-center justify-center font-black text-white text-sm shrink-0 shadow-lg">
          <Landmark size={16} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }}
            >
              <p className="font-extrabold text-sm tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Montserrat, sans-serif' }}>
                FinanceAI
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>v4.5 Stable</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1 px-2">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-2" style={{ color: 'var(--text-muted)' }}>
            Menu Chính
          </p>
        )}
        {NAV.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) => `sidebar-item relative group ${isActive ? 'active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className={`shrink-0 transition-colors ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'}`}>
                  {item.icon}
                </span>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="ml-3 font-medium text-sm"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-highlight"
                    className="absolute inset-0 rounded-xl bg-sky-400/10 border border-sky-400/20 -z-10"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Actions */}
      <div className="px-2 pb-4 flex flex-col gap-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <NavLink 
          to="/profile"
          className={({ isActive }) => `flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all ${isActive ? 'bg-white/10 ring-1 ring-white/10' : 'hover:bg-white/5'}`}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {initial}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-bold truncate text-[var(--text-primary)]">{user?.name || 'Hồ sơ'}</p>
              <p className="text-[10px] truncate text-[var(--text-muted)]">Thông tin cá nhân</p>
            </div>
          )}
        </NavLink>

        <div className="grid grid-cols-2 gap-1 px-1">
          <NavLink
            to="/settings"
            className={({ isActive }) => `flex flex-col items-center justify-center p-2 rounded-xl transition-all ${isActive ? 'bg-[var(--primary)] text-black' : 'bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/10'}`}
          >
            <Settings size={16} />
            {!collapsed && <span className="text-[9px] font-bold mt-1">Cài đặt</span>}
          </NavLink>

          <button
            onClick={() => { logout({ queryClientRef: queryClient }); navigate('/login'); }}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={16} />
            {!collapsed && <span className="text-[9px] font-bold mt-1">Thoát</span>}
          </button>
        </div>
      </div>

      {/* Collapse Toggle */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        onClick={onToggle}
        aria-label={collapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
        className="absolute top-5 -right-3 w-6 h-6 rounded-full flex items-center justify-center shadow-lg z-30"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronLeft size={12} />
        </motion.span>
      </motion.button>
    </motion.aside>
  );
}
