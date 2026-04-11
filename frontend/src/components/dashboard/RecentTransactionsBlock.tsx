import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, ArrowUpRight, ArrowDownRight, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatVND } from '../../utils/format';

interface Transaction {
  id: string;
  title: string;
  category: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  createdAt: string;
  pocket?: { name: string } | null;
}

// Map category to color
const CATEGORY_COLORS: Record<string, string> = {
  Food: '#f87171',
  Entertainment: '#a78bfa',
  Utility: '#38bdf8',
  Education: '#facc15',
  Transport: '#fb923c',
  Healthcare: '#34d399',
  Other: '#94a3b8',
  INCOME: '#34d399',
};

function getColor(tx: Transaction): string {
  if (tx.type === 'INCOME') return '#34d399';
  return CATEGORY_COLORS[tx.category] ?? '#94a3b8';
}

function getInitials(title: string): string {
  return title
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return `Hôm nay, ${timeStr}`;
  if (diffDays === 1) return `Hôm qua, ${timeStr}`;
  return `${diffDays} ngày trước, ${timeStr}`;
}

const fmt = (n: number, type: 'INCOME' | 'EXPENSE') =>
  (type === 'INCOME' ? '+' : '-') + formatVND(n, true);

const CATEGORY_VI: Record<string, string> = {
  Food: 'Ăn uống',
  Entertainment: 'Giải trí',
  Utility: 'Tiện ích',
  Education: 'Giáo dục',
  Transport: 'Di chuyển',
  Healthcare: 'Sức khỏe',
  Other: 'Khác',
};

export default function RecentTransactionsBlock() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTxs = async () => {
      try {
        const res = await fetch('http://localhost:3000/transactions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      } catch (e) {
        console.error('[RecentTransactionsBlock] fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchTxs();
  }, [token]);

  const filtered = transactions.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      (t.category ?? '').toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.45 }}
      className="glass-card p-5 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'Montserrat, sans-serif' }}>
            Giao Dịch Gần Đây
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {loading ? 'Đang tải...' : `${transactions.length} giao dịch gần nhất`}
          </p>
        </div>
        {/* Add Button - placeholder for now */}
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          aria-label="Thêm giao dịch"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
          style={{ background: 'var(--primary)', color: '#050d18' }}
        >
          <Plus size={14} /> Thêm
        </motion.button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm giao dịch..."
          className="w-full pl-9 pr-4 py-2 text-xs rounded-xl outline-none"
          style={{ background: 'var(--border)', color: 'var(--text-primary)', border: '1px solid transparent' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
        />
      </div>

      {/* List */}
      <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: '320px' }}>
        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-sky-400" />
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="py-10 flex flex-col items-center gap-2"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="8" y="14" width="40" height="30" rx="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
                  <path d="M18 28h20M18 34h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="28" cy="22" r="4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <p className="text-sm font-medium">
                  {query ? 'Không tìm thấy giao dịch' : 'Chưa có giao dịch nào'}
                </p>
              </motion.div>
            ) : (
              filtered.map((tx, i) => {
                const isUp = tx.type === 'INCOME';
                const color = getColor(tx);
                const initials = getInitials(tx.title);
                const catLabel = isUp ? 'Thu nhập' : (CATEGORY_VI[tx.category] ?? tx.category);

                return (
                  <motion.div
                    key={tx.id}
                    layout
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                    style={{ transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Avatar icon */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: `${color}18`,
                        color,
                        boxShadow: isUp ? `0 0 12px ${color}40` : undefined,
                      }}
                    >
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{tx.title}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{catLabel} · {formatDate(tx.createdAt)}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-sm font-bold" style={{ color: isUp ? '#34d399' : '#f87171' }}>
                        {fmt(Number(tx.amount), tx.type)}
                      </span>
                      {isUp
                        ? <ArrowUpRight size={13} style={{ color: '#34d399' }} />
                        : <ArrowDownRight size={13} style={{ color: '#f87171' }} />
                      }
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        )}
      </div>

      {/* View all */}
      <button
        className="flex items-center justify-center gap-1 text-xs font-semibold py-1 rounded-lg w-full"
        style={{ color: 'var(--primary)', background: 'var(--primary-glow)' }}
      >
        Xem tất cả <ChevronRight size={13} />
      </button>
    </motion.div>
  );
}
