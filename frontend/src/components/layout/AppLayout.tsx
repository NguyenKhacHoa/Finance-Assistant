import { useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, CreditCard, PiggyBank, Trophy } from 'lucide-react';
import FintechSidebar from '../dashboard/FintechSidebar';
import FintechHeader from '../dashboard/FintechHeader';
import FloatingAIWidget from '../FloatingAIWidget';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Auto-collapse on small screens
  useEffect(() => {
    const fn = () => setSidebarCollapsed(window.innerWidth < 1100);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-base)]">
      {/* Sidebar */}
      <FintechSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <FintechHeader />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-5 md:p-6">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden flex items-center justify-around py-2 border-t bg-[var(--bg-sidebar)] border-[var(--border)]">
          {[
            { label: 'Dash', icon: <LayoutDashboard size={18} />, path: '/dashboard' },
            { label: 'Giao dịch', icon: <CreditCard size={18} />, path: '/transactions' },
            { label: 'Hũ', icon: <PiggyBank size={18} />, path: '/pockets' },
            { label: 'Rewards', icon: <Trophy size={18} />, path: '/rewards' },
          ].map((item) => {
            const isActive = pathname === item.path;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-bold transition-all ${
                  isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <FloatingAIWidget />
    </div>
  );
}
