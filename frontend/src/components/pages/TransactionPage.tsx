import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, ArrowUpRight, ArrowDownRight, Loader2, Filter } from 'lucide-react';
import { useAuth, authFetch } from '../../context/AuthContext';
import AddTransactionModal from '../modals/AddTransactionModal';
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

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#f87171', Entertainment: '#a78bfa', Utility: '#38bdf8',
  Education: '#facc15', Transport: '#fb923c', Healthcare: '#34d399',
  Other: '#94a3b8', INCOME: '#34d399',
};

function getColor(tx: Transaction): string {
  if (tx.type === 'INCOME') return '#34d399';
  return CATEGORY_COLORS[tx.category] ?? '#94a3b8';
}

function getInitials(title: string): string {
  return title.split(' ').slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const fmt = (n: number, type: 'INCOME' | 'EXPENSE') =>
  (type === 'INCOME' ? '+' : '-') + formatVND(n);

const CATEGORY_VI: Record<string, string> = {
  Food: 'Ăn uống', Entertainment: 'Giải trí', Utility: 'Tiện ích',
  Education: 'Giáo dục', Transport: 'Di chuyển', Healthcare: 'Sức khỏe', Other: 'Khác',
};

export default function TransactionPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTxs = async () => {
    try {
      const data = await authFetch<Transaction[]>('/transactions', {}, token);
      setTransactions(data);
    } catch (e) {
      console.error('[TransactionPage] fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchTxs();
  }, [token]);

  const filtered = transactions.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(query.toLowerCase()) || (t.category ?? '').toLowerCase().includes(query.toLowerCase());
    const matchType = filterType === 'ALL' || t.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto flex flex-col gap-6"
    >
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Lịch sử Giao dịch</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Quản lý và thống kê mọi biến động số dư của bạn.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: 'var(--primary)', color: '#050d18' }}
        >
          <Plus size={16} /> Thêm Giao Dịch
        </motion.button>
      </div>

      <AddTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchTxs} 
      />

      {/* Toolbar */}
      <div className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 bg-[var(--bg-surface)] border border-[var(--border)]">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm giao dịch (Tên, Category)..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--primary)]"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['ALL', 'INCOME', 'EXPENSE'] as const).map((ft) => (
            <button
              key={ft}
              onClick={() => setFilterType(ft)}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                filterType === ft 
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-glow)]' 
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-base)]'
              }`}
            >
              {ft === 'ALL' ? 'Tất cả' : ft === 'INCOME' ? 'Thu nhập' : 'Chi tiêu'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2 min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--text-muted)]">
            <Filter size={48} className="opacity-20" />
            <p className="font-medium text-sm">Không tìm thấy giao dịch nào phù hợp</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((tx) => {
              const isUp = tx.type === 'INCOME';
              const color = getColor(tx);
              const initials = getInitials(tx.title);
              const catLabel = isUp ? 'Thu nhập' : (CATEGORY_VI[tx.category] ?? tx.category);

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  key={tx.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-base)] transition-colors cursor-pointer"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: `${color}18`, color, boxShadow: isUp ? `0 0 12px ${color}40` : undefined }}
                  >
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-base font-semibold truncate text-[var(--text-primary)]">{tx.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
                      <span className="px-2 py-0.5 rounded flex items-center bg-[var(--bg-base)] border border-[var(--border)]">
                        {catLabel}
                      </span>
                      <span>·</span>
                      <span>{formatDate(tx.createdAt)}</span>
                      {tx.pocket && (
                        <>
                          <span>·</span>
                          <span>Hũ: {tx.pocket.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-base font-bold tracking-tight" style={{ color: isUp ? '#34d399' : '#f87171' }}>
                      {fmt(Number(tx.amount), tx.type)}
                    </span>
                    {isUp
                      ? <ArrowUpRight size={18} style={{ color: '#34d399' }} />
                      : <ArrowDownRight size={18} style={{ color: '#f87171' }} />
                    }
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
