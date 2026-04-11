import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, User, Settings, LogOut, Sun, Moon, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import type { ThemeId } from '../../theme-config';
import NotificationBell from './NotificationBell';


const THEME_ICONS: Record<string, React.ReactNode> = {
  'dark-night':     <Moon size={14} />,
  'light-minimal':  <Sun size={14} />,
  'amoled':         <Zap size={14} />,
};

export default function FintechHeader() {
  const { user, logout } = useAuth();
  const { themeId, setTheme, themes } = useTheme();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [search, setSearch] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-4 px-6 py-3.5 border-b"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--border)', backdropFilter: 'blur(16px)' }}
    >
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm kiếm giao dịch, báo cáo..."
          className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none"
          style={{
            background: 'var(--border)',
            color: 'var(--text-primary)',
            border: '1px solid transparent',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notification Bell with Popover */}
        <NotificationBell />

        {/* Theme Toggle */}
        <div ref={themeRef} className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setThemeOpen((p) => !p)}
            aria-label="Đổi theme"
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--border)', color: 'var(--primary)' }}
          >
            <motion.span animate={{ rotate: themeOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
              {THEME_ICONS[themeId]}
            </motion.span>
          </motion.button>
          <AnimatePresence>
            {themeOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-44 rounded-2xl overflow-hidden z-50 py-1"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
              >
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t.id as ThemeId); setThemeOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors"
                    style={{
                      color: themeId === t.id ? 'var(--primary)' : 'var(--text-secondary)',
                      background: themeId === t.id ? 'var(--primary-glow)' : 'transparent',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{THEME_ICONS[t.id]}</span>
                    {t.label}
                    {themeId === t.id && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary)' }} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile Dropdown */}
        <div ref={profileRef} className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => setProfileOpen((p) => !p)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl"
            style={{ background: 'var(--border)', border: '1px solid var(--border-hover)' }}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
              {initial}
            </div>
            <span className="text-sm font-medium hidden sm:block max-w-[120px] truncate" style={{ color: 'var(--text-primary)' }}>
              {user?.name || user?.email?.split('@')[0]}
            </span>
            <motion.span animate={{ rotate: profileOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </motion.span>
          </motion.button>
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden z-50"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user?.name || 'Người dùng'}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                </div>
                <div className="py-1">
                  {[
                    { label: 'Hồ sơ', icon: <User size={14} />, action: () => navigate('/profile') },
                    { label: 'Cài đặt', icon: <Settings size={14} />, action: () => navigate('/settings') },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { item.action(); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      {item.icon} {item.label}
                    </button>
                  ))}
                  <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />
                  <button
                    onClick={() => { logout(); navigate('/login'); setProfileOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400"
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <LogOut size={14} /> Đăng xuất
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
