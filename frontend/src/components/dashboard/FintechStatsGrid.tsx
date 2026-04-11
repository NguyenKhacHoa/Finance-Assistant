import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingDown, Landmark, Briefcase, Loader2, Sparkles } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { formatVND } from '../../utils/format';

interface Stats {
  income: number;
  expense: number;
  balance: number;
  totalBalance: number;
  unallocatedBalance: number;
}

const CARD_CONFIG = [
  {
    key: 'income' as const,
    label: 'Thu Nhập Tháng Này',
    color: '#34d399',
    glow: '0 0 40px rgba(52,211,153,0.25)',
    meshColor: 'radial-gradient(circle at top right, rgba(52,211,153,0.2) 0%, transparent 70%)',
    icon: <Wallet size={20} />,
    isPositiveGood: true,
  },
  {
    key: 'expense' as const,
    label: 'Chi Tiêu Tháng Này',
    color: '#f87171',
    glow: '0 0 40px rgba(248,113,113,0.25)',
    meshColor: 'radial-gradient(circle at top right, rgba(248,113,113,0.2) 0%, transparent 70%)',
    icon: <TrendingDown size={20} />,
    isPositiveGood: false,
  },
  {
    key: 'balance' as const,
    label: 'Số Dư Tháng Này',
    color: '#38bdf8',
    glow: '0 0 40px rgba(56,189,248,0.25)',
    meshColor: 'radial-gradient(circle at top right, rgba(56,189,248,0.2) 0%, transparent 70%)',
    icon: <Landmark size={20} />,
    isPositiveGood: true,
  },
  {
    key: 'totalBalance' as const,
    label: 'Tổng Số Dư Các Hũ',
    color: '#a78bfa',
    glow: '0 0 40px rgba(167,139,250,0.25)',
    meshColor: 'radial-gradient(circle at top right, rgba(167,139,250,0.2) 0%, transparent 70%)',
    icon: <Briefcase size={20} />,
    isPositiveGood: true,
  },
  {
    key: 'unallocatedBalance' as const,
    label: 'Tiền Chưa Vào Hũ',
    color: '#eab308', // yellow-500
    glow: '0 0 40px rgba(234,179,8,0.25)',
    meshColor: 'radial-gradient(circle at top right, rgba(234,179,8,0.2) 0%, transparent 70%)',
    icon: <Sparkles size={20} />,
    isPositiveGood: true,
  },
];

// Generate a simple sparkline shape from a single value
function generateSparkData(value: number, points = 7): { v: number }[] {
  const base = value > 0 ? value * 0.8 : 0;
  return Array.from({ length: points }, (_, i) => ({
    v: i === points - 1 ? value : base + Math.random() * (value - base) * 0.6,
  }));
}

export default function FintechStatsGrid() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3000/transactions/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('[FintechStatsGrid] fetch error:', e);
    } finally {
      if (loading) setLoading(false);
    }
  }, [token, loading]);

  useEffect(() => {
    if (token) fetchStats();

    const handleUpdate = () => {
      fetchStats();
    };

    window.addEventListener('finance_update', handleUpdate);
    return () => window.removeEventListener('finance_update', handleUpdate);
  }, [token, fetchStats]);

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {CARD_CONFIG.map((c) => (
          <div key={c.label} className="glass-card p-5 flex items-center justify-center" style={{ minHeight: 140 }}>
            <Loader2 size={22} className="animate-spin" style={{ color: c.color }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {CARD_CONFIG.map((card, i) => {
        const value = stats ? stats[card.key] : 0;
        const sparkData = generateSparkData(value);
        // We don't have previous month data yet, so just show direction from zero
        const isUp = value >= 0;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.45, ease: 'easeOut' }}
            whileHover={{ y: -6, boxShadow: card.glow }}
            className="glass-card relative overflow-hidden p-5 flex flex-col gap-3 cursor-default"
          >
            {/* Mesh gradient background */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: card.meshColor }} />

            {/* Icon + change badge */}
            <div className="flex items-start justify-between relative z-10">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: `${card.color}18`, color: card.color }}
              >
                {card.icon}
              </div>
              <div
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: isUp ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                  color: isUp ? '#34d399' : '#f87171',
                }}
              >
                {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {isUp ? 'Tháng này' : 'Tháng này'}
              </div>
            </div>

            {/* Label + Value */}
            <div className="relative z-10">
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Montserrat, sans-serif' }}>
                {formatVND(value)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Dữ liệu thực từ database
              </p>
            </div>

            {/* Area Sparkline */}
            <div className="absolute bottom-0 left-0 right-0 h-16 opacity-50">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={card.color} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone" dataKey="v"
                    stroke={card.color} strokeWidth={1.5}
                    fill={`url(#spark-${i})`}
                    dot={false} isAnimationActive
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
