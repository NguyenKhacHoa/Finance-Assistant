import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import {
  LayoutDashboard, PiggyBank, GraduationCap, Heart, Wallet,
  Gift, TrendingUp, TrendingDown, Target, ArrowUpRight,
  ArrowDownRight, Landmark, Trophy, Settings, LogOut,
  ChevronLeft, Menu, X, Plus, DollarSign, Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import { useNavigate } from 'react-router-dom';
import SalaryWidget from './widgets/SalaryWidget';
import { formatVND } from '../utils/format';
import { notificationBus } from '../utils/notificationBus';
import { authFetch } from '../context/AuthContext';

// ── Types ──────────────────────────────────────────────────────
interface Pocket {
  id: string;
  name: string;
  shortName: string;
  percentage: number;
  balance: number;
  color: string;
  gradient: string;
  meshColor: string;
  icon: React.ReactNode;
  target: number;
}

interface SummaryCard {
  label: string;
  value: number;
  change: number;
  color: string;
  meshColor: string;
  icon: React.ReactNode;
  sparkData: { v: number }[];
}

// ── Mock Data ──────────────────────────────────────────────────
const POCKETS: Pocket[] = [
  {
    id: '1', name: 'Thiết Yếu (NEC)', shortName: 'NEC',
    percentage: 55, balance: 12500000, target: 15000000,
    color: '#f87171', gradient: 'from-red-500 to-rose-600',
    meshColor: 'rgba(248,113,113,0.15)',
    icon: <Landmark size={18} />,
  },
  {
    id: '2', name: 'Tự Do Tài Chính (FFA)', shortName: 'FFA',
    percentage: 10, balance: 4500000, target: 10000000,
    color: '#38bdf8', gradient: 'from-sky-400 to-blue-600',
    meshColor: 'rgba(56,189,248,0.15)',
    icon: <TrendingUp size={18} />,
  },
  {
    id: '3', name: 'Giáo Dục (EDU)', shortName: 'EDU',
    percentage: 10, balance: 2000000, target: 5000000,
    color: '#facc15', gradient: 'from-yellow-400 to-amber-500',
    meshColor: 'rgba(250,204,21,0.12)',
    icon: <GraduationCap size={18} />,
  },
  {
    id: '4', name: 'Tích Lũy Dài Hạn (LTS)', shortName: 'LTS',
    percentage: 10, balance: 3500000, target: 8000000,
    color: '#a78bfa', gradient: 'from-violet-400 to-purple-600',
    meshColor: 'rgba(167,139,250,0.15)',
    icon: <PiggyBank size={18} />,
  },
  {
    id: '5', name: 'Hưởng Thụ (PLY)', shortName: 'PLY',
    percentage: 10, balance: 1500000, target: 3000000,
    color: '#34d399', gradient: 'from-emerald-400 to-green-600',
    meshColor: 'rgba(52,211,153,0.15)',
    icon: <Heart size={18} />,
  },
  {
    id: '6', name: 'Từ Thiện (GIV)', shortName: 'GIV',
    percentage: 5, balance: 500000, target: 2000000,
    color: '#f472b6', gradient: 'from-pink-400 to-fuchsia-600',
    meshColor: 'rgba(244,114,182,0.15)',
    icon: <Gift size={18} />,
  },
];

const AREA_DATA_EMPTY = [
  { month: 'Thứ 2', income: 0, expense: 0 },
  { month: 'Thứ 3', income: 0, expense: 0 },
  { month: 'Thứ 4', income: 0, expense: 0 },
  { month: 'Thứ 5', income: 0, expense: 0 },
  { month: 'Thứ 6', income: 0, expense: 0 },
  { month: 'Thứ 7', income: 0, expense: 0 },
  { month: 'CN', income: 0, expense: 0 },
];

// SUMMARY_CARDS skeleton – values filled dynamically from API
const makeSummaryCards = (income: number, expense: number, savings: number): SummaryCard[] => [
  {
    label: 'Thu Nhập', value: income, change: 0,
    color: '#34d399', meshColor: 'rgba(52,211,153,0.18)',
    icon: <TrendingUp size={16} />,
    sparkData: [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: income / 1_000_000 }],
  },
  {
    label: 'Chi Tiêu', value: expense, change: 0,
    color: '#f87171', meshColor: 'rgba(248,113,113,0.18)',
    icon: <TrendingDown size={16} />,
    sparkData: [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: expense / 1_000_000 }],
  },
  {
    label: 'Tiết Kiệm', value: savings, change: 0,
    color: '#38bdf8', meshColor: 'rgba(56,189,248,0.18)',
    icon: <Wallet size={16} />,
    sparkData: [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: savings / 1_000_000 }],
  },
  {
    label: 'Mục Tiêu', value: 0, change: 0,
    color: '#a78bfa', meshColor: 'rgba(167,139,250,0.18)',
    icon: <Target size={16} />,
    sparkData: [{ v: 0 }],
  },
];

const RECENT_TX = [
  { id: 1, name: 'Siêu thị Big C',    amount: -350000,  cat: 'NEC', time: '2 giờ trước',  color: '#f87171' },
  { id: 2, name: 'Lương tháng',       amount: 24500000, cat: 'INC', time: '1 ngày trước', color: '#34d399' },
  { id: 3, name: 'Học phí khóa React',amount: -1200000, cat: 'EDU', time: '2 ngày trước', color: '#facc15' },
  { id: 4, name: 'Đầu tư quỹ ETF',    amount: -2000000, cat: 'FFA', time: '2 ngày trước', color: '#38bdf8' },
  { id: 5, name: 'Ủng hộ từ thiện',   amount: -200000,  cat: 'GIV', time: '3 ngày trước', color: '#f472b6' },
];

const fmt = (n: number) => formatVND(n, false);
const fmtFull = (n: number) => formatVND(n, false);

// ── Sub-components ─────────────────────────────────────────────

/** Sparkline mini chart */
function Sparkline({ data, color }: { data: { v: number }[]; color: string }) {
  return (
    <ResponsiveContainer width={70} height={32}>
      <LineChart data={data}>
        <Line
          type="monotone" dataKey="v" dot={false}
          stroke={color} strokeWidth={1.8}
          isAnimationActive
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Summary card */
function SummaryCardComp({ card, delay }: { card: SummaryCard; delay: number }) {
  const isUp = card.change >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="glass-card relative overflow-hidden p-5 flex flex-col gap-2 hover:-translate-y-1 cursor-default"
    >
      {/* Mesh gradient blur */}
      <div
        className="absolute -top-6 -right-6 w-32 h-32 rounded-full blur-2xl pointer-events-none"
        style={{ background: card.meshColor }}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
          <span style={{ color: card.color }}>{card.icon}</span>
          {card.label}
        </div>
        <Sparkline data={card.sparkData} color={card.color} />
      </div>
      <p className="text-2xl font-extrabold tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>
        {fmt(card.value)}
      </p>
      <div className="flex items-center gap-1 text-xs font-medium" style={{ color: isUp ? '#34d399' : '#f87171' }}>
        {isUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
        {Math.abs(card.change)}% so tháng trước
      </div>
    </motion.div>
  );
}

/** Pocket card */
function PocketCard({ pocket, index }: { pocket: Pocket; index: number }) {
  const pct = Math.min(100, (pocket.balance / pocket.target) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index + 0.3, duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -5 }}
      className="glass-card relative overflow-hidden p-5 flex flex-col gap-3 cursor-default"
      style={{ '--hover-glow': pocket.color } as React.CSSProperties}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${pocket.color}30`;
        (e.currentTarget as HTMLElement).style.borderColor = `${pocket.color}50`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '';
        (e.currentTarget as HTMLElement).style.borderColor = '';
      }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: pocket.color }} />
      {/* Mesh gradient corner */}
      <div
        className="absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl pointer-events-none"
        style={{ background: pocket.meshColor }}
      />

      <div className="flex items-start justify-between">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl"
          style={{ background: `${pocket.color}1a`, color: pocket.color }}
        >
          {pocket.icon}
        </div>
        <span className="text-2xl font-black" style={{ color: pocket.color }}>
          {pocket.percentage}%
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{pocket.name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Mục tiêu: {fmtFull(pocket.target)}
        </p>
      </div>

      <p className="text-xl font-extrabold font-mono" style={{ color: 'var(--text-primary)' }}>
        {fmtFull(pocket.balance)}
      </p>

      {/* Progress bar */}
      <div className="progress-track h-1.5 w-full">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${pocket.color}aa, ${pocket.color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.05 * index + 0.5 }}
        />
      </div>
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{pct.toFixed(0)}% đạt mục tiêu</span>
        <span>{fmtFull(pocket.target - pocket.balance)} còn lại</span>
      </div>
    </motion.div>
  );
}

/** Sidebar nav items */
const NAV_ITEMS = [
  { label: 'Tổng Quan',    icon: <LayoutDashboard size={18} />, path: '/dashboard' },
  { label: 'Hũ Tài Chính',  icon: <PiggyBank size={18} />,       path: '/dashboard' },
  { label: 'Gamification', icon: <Trophy size={18} />,          path: '/rewards' },
  { label: 'Admin',        icon: <Settings size={18} />,        path: '/admin', adminOnly: true },
];

// ── Main Dashboard ─────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [pockets, setPockets] = useState<Pocket[]>(POCKETS);
  const [incomeInput, setIncomeInput] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);
  const [activeNav, setActiveNav] = useState('/dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showIncomeBar, setShowIncomeBar] = useState(false);

  // ── Live stats from API ──
  const [summaryCards, setSummaryCards] = useState<SummaryCard[]>(makeSummaryCards(0, 0, 0));
  const [areaData, setAreaData] = useState<{ month: string; income: number; expense: number }[]>(AREA_DATA_EMPTY);
  const [unallocatedBalance, setUnallocatedBalance] = useState(0);
  const [totalBalanceApi, setTotalBalanceApi] = useState(0);

  const totalBalance = totalBalanceApi || pockets.reduce((s, p) => s + p.balance, 0);

  // ── Fetch live stats + chart ──
  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    try {
      const [stats, chart] = await Promise.all([
        authFetch<{ income: number; expense: number; totalBalance: number; unallocatedBalance: number }>('/transactions/stats', {}, token),
        authFetch<{ label: string; income: number; expense: number }[]>('/transactions/chart?period=7d', {}, token),
      ]);
      const savings = Math.max(0, stats.income - stats.expense);
      setSummaryCards(makeSummaryCards(stats.income, stats.expense, savings));
      setUnallocatedBalance(stats.unallocatedBalance || 0);
      setTotalBalanceApi(stats.totalBalance || 0);
      setAreaData(chart.map(d => ({ month: d.label, income: d.income, expense: d.expense })));
    } catch (e) {
      console.warn('[Dashboard] Failed to fetch live stats', e);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboardData();
    const unsub = notificationBus.subscribe(() => {
      fetchDashboardData();
    });
    return () => unsub();
  }, [fetchDashboardData]);

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    const handle = () => setSidebarCollapsed(window.innerWidth < 1024);
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  const handleDistribute = useCallback(async () => {
    const amount = Number(incomeInput.replace(/[^0-9]/g, ''));
    if (!amount || amount <= 0) return;
    setIsDistributing(true);
    await new Promise((r) => setTimeout(r, 700));
    setPockets((prev) => prev.map((p) => ({ ...p, balance: p.balance + (amount * p.percentage) / 100 })));
    setIncomeInput('');
    setIsDistributing(false);
    setShowIncomeBar(false);
  }, [incomeInput]);

  // ── Sidebar ──
  const SidebarContent = () => (
    <div className="flex flex-col h-full py-4 px-3 gap-1.5">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 py-3 mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm bg-gradient-to-br from-sky-400 to-indigo-600 text-white shrink-0">
          ✦
        </div>
        {!sidebarCollapsed && (
          <motion.span
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="font-extrabold text-sm tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Finance v4.0
          </motion.span>
        )}
      </div>

      {/* Nav */}
      <div className="flex flex-col gap-0.5 flex-1">
        {NAV_ITEMS.filter((n) => !n.adminOnly || user?.role === 'ADMIN').map((item) => (
          <button
            key={item.label}
            className={`sidebar-item ${activeNav === item.path ? 'active' : ''}`}
            onClick={() => { setActiveNav(item.path); navigate(item.path); setMobileSidebarOpen(false); }}
            title={sidebarCollapsed ? item.label : undefined}
          >
            <span className="shrink-0">{item.icon}</span>
            {!sidebarCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{item.label}</motion.span>
            )}
          </button>
        ))}
      </div>

      {/* Bottom */}
      <div className="flex flex-col gap-0.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
        <ThemeToggle />
        <button
          className="sidebar-item mt-1"
          onClick={() => { logout(); navigate('/'); }}
          title={sidebarCollapsed ? 'Đăng xuất' : undefined}
        >
          <LogOut size={17} className="shrink-0 text-red-400" />
          {!sidebarCollapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400">
              Đăng xuất
            </motion.span>
          )}
        </button>
      </div>
    </div>
  );

  // ── Main Content ──
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* ── Desktop Sidebar ── */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 220 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="hidden md:flex flex-col shrink-0 relative overflow-hidden border-r"
        style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}
      >
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed((v) => !v)}
          title="Thu gọn Menu"
          aria-label="Thu gọn Menu"
          className="absolute top-4 -right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs z-10 shadow-md text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-surface)]"
        >
          <motion.span animate={{ rotate: sidebarCollapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronLeft size={12} />
          </motion.span>
        </button>
      </motion.aside>

      {/* ── Mobile Sidebar Overlay ── */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 h-full w-56 z-50 md:hidden"
              style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}
              initial={{ x: -220 }} animate={{ x: 0 }} exit={{ x: -220 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <div className="absolute top-3 right-3">
                <button 
                  title="Đóng Menu" aria-label="Đóng Menu" 
                  onClick={() => setMobileSidebarOpen(false)} 
                  className="text-[var(--text-secondary)]"
                >
                  <X size={18} />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Scroll Area ── */}
      <div className="flex-1 flex flex-col overflow-y-auto">

        {/* Top Header */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-5 py-3.5 border-b"
          style={{
            background: 'var(--bg-sidebar)',
            borderColor: 'var(--border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden text-[var(--text-secondary)]" 
              title="Mở Menu" aria-label="Mở Menu"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                Xin chào, {user?.name || user?.email?.split('@')[0] || 'Bạn'} 👋
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Quản lý tài chính thông minh
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowIncomeBar((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-95"
            style={{ background: 'var(--primary)', color: '#000' }}
          >
            <Plus size={15} /> Nhập Lương
          </button>
        </header>

        {/* Income input bar */}
        <AnimatePresence>
          {showIncomeBar && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden border-b"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
            >
              <div className="flex items-center gap-3 px-5 py-3">
                <DollarSign size={17} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDistribute()}
                  placeholder="Nhập số tiền phân bổ (VNĐ)..."
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text-primary)' }}
                  autoFocus
                />
                <button
                  onClick={handleDistribute}
                  disabled={isDistributing || !incomeInput}
                  className="px-5 py-1.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
                  style={{ background: 'var(--primary)', color: '#000' }}
                >
                  {isDistributing ? 'Đang Chia...' : 'Phân Bổ Ngay'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <main className="flex-1 p-5 md:p-6 flex flex-col gap-6">

          {/* Total Balance Hero */}
          <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col md:flex-row gap-6 md:items-end mb-2"
          >
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Tổng Tài Sản</p>
              <p className="text-4xl md:text-5xl font-extrabold tracking-tight text-gradient-cyan">
                {fmtFull(totalBalance)}
              </p>
            </div>
            
            <div className="glass-card p-4 rounded-xl border flex flex-col justify-center min-w-[200px]" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Tiền chưa vào hũ (Thừa 30%)</p>
              <p className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                {unallocatedBalance > 0 ? <Sparkles size={16} className="text-yellow-400" /> : <Wallet size={16} />}
                {fmtFull(unallocatedBalance)}
              </p>
            </div>
          </motion.div>

          {/* Salary Component */}
          <div className="mb-2 lg:w-1/2">
            <SalaryWidget onStartDistribution={(_amount: number) => {
              // Refresh live stats after salary distribution
              fetchDashboardData();
            }} />
          </div>

          {/* Summary Cards — 4 col */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map((card, i) => (
              <SummaryCardComp key={card.label} card={card} delay={i * 0.08} />
            ))}
          </div>

          {/* 6 Pockets Grid */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                Hệ Thống Hũ Tài Chính
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                Phân bổ tự động
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {pockets.map((p, i) => <PocketCard key={p.id} pocket={p} index={i} />)}
            </div>
          </section>

          {/* Charts + Transactions — 2 col on big screen */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

            {/* Area Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="glass-card p-5 xl:col-span-3"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Xu Hướng 7 Ngày Qua
                </h3>
                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Thu nhập
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Chi tiêu
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={areaData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="tr" />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-secondary)' }}
                    formatter={(v: number) => [formatVND(v)]}
                  />
                  <Area type="monotone" dataKey="income" stroke="#34d399" strokeWidth={2} fill="url(#incomeGrad)" dot={false} />
                  <Area type="monotone" dataKey="expense" stroke="#f87171" strokeWidth={2} fill="url(#expenseGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Recent Transactions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="glass-card p-5 xl:col-span-2 flex flex-col"
            >
              <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
                Giao Dịch Gần Đây
              </h3>
              <div className="flex flex-col gap-3 flex-1">
                {RECENT_TX.map((tx, i) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.07 }}
                    className="flex items-center gap-3"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: `${tx.color}1a`, color: tx.color }}
                    >
                      {tx.cat}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{tx.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tx.time}</p>
                    </div>
                    <span className="text-sm font-bold shrink-0" style={{ color: tx.amount > 0 ? '#34d399' : '#f87171' }}>
                      {tx.amount > 0 ? '+' : ''}{fmt(tx.amount)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav
          className="md:hidden sticky bottom-0 z-30 flex items-center justify-around py-2 border-t"
          style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}
        >
          {NAV_ITEMS.filter((n) => !n.adminOnly || user?.role === 'ADMIN').map((item) => (
            <button
              key={item.label}
              onClick={() => { setActiveNav(item.path); navigate(item.path); }}
              className="flex flex-col items-center gap-0.5 px-4 py-1 text-xs font-medium"
              style={{ color: activeNav === item.path ? 'var(--primary)' : 'var(--text-muted)' }}
            >
              {item.icon}
              <span className="text-[10px]">{item.label.split(' ')[0]}</span>
            </button>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </div>
  );
}
