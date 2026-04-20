import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight, ArrowDownRight, Loader2, Filter,
  Camera, Save, AlertCircle, CheckCircle2, Receipt,
  Utensils, Gamepad2, Zap, GraduationCap, Car,
  HeartPulse, ShoppingBag, TrendingUp, Banknote,
  Wallet, Clock, Search, X, Tag, ChevronDown,
  Sparkles, PiggyBank, CreditCard,
} from 'lucide-react';
import { useAuth, authFetch } from '../../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NumericFormat } from 'react-number-format';
import { formatVND } from '../../utils/format';
import { notificationBus } from '../../utils/notificationBus';
import OCRProcessingOverlay from '../ai/OCRProcessingOverlay';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Pocket {
  id: string;
  name: string;
  balance: number;
  percentage: number;
  isEssential: boolean;
}

interface Transaction {
  id: string;
  title: string;
  category: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'LUONG' | 'TRANSFER' | 'SYSTEM';
  createdAt: string;
  pocket?: { name: string } | null;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'Food',          name: 'Ăn uống',    Icon: Utensils,      color: '#f87171' },
  { id: 'Entertainment', name: 'Giải trí',   Icon: Gamepad2,      color: '#a78bfa' },
  { id: 'Utility',       name: 'Tiện ích',   Icon: Zap,           color: '#38bdf8' },
  { id: 'Education',     name: 'Giáo dục',   Icon: GraduationCap, color: '#facc15' },
  { id: 'Transport',     name: 'Di chuyển',  Icon: Car,           color: '#fb923c' },
  { id: 'Healthcare',    name: 'Sức khỏe',   Icon: HeartPulse,    color: '#34d399' },
  { id: 'Shopping',      name: 'Mua sắm',    Icon: ShoppingBag,   color: '#f472b6' },
  { id: 'Investment',    name: 'Đầu tư',     Icon: TrendingUp,    color: '#818cf8' },
  { id: 'Salary',        name: 'Lương',      Icon: Banknote,      color: '#34d399' },
  { id: 'Other',         name: 'Khác',       Icon: Tag,           color: '#94a3b8' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

function getCatMeta(cat: string, type: string) {
  if (type === 'INCOME' || type === 'LUONG') return { Icon: ArrowUpRight, color: '#34d399', label: 'Thu nhập' };
  if (type === 'TRANSFER') return { Icon: Wallet, color: '#38bdf8', label: 'Chuyển khoản' };
  const meta = CAT_MAP[cat];
  if (meta) return { Icon: meta.Icon, color: meta.color, label: meta.name };
  return { Icon: Tag, color: '#94a3b8', label: cat };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const QUICK_AMOUNTS = [50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000];

// ─────────────────────────────────────────────────────────────
// TransactionForm (left panel — inline, no modal)
// ─────────────────────────────────────────────────────────────
interface FormProps {
  pockets: Pocket[];
  onSuccess: () => void;
  token: string | null;
}

function TransactionForm({ pockets, onSuccess, token }: FormProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType]         = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [title, setTitle]       = useState('');
  const [amount, setAmount]     = useState(0);
  const [category, setCategory] = useState('Other');
  const [pocketId, setPocketId] = useState('');
  const [source, setSource]     = useState<'CASH' | 'BANK'>('CASH');
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 16));

  const [isSaving, setIsSaving]   = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  // Init pocketId
  useEffect(() => {
    if (pockets.length > 0 && !pocketId) {
      setPocketId(pockets[0].id);
    }
  }, [pockets]);

  // Auto-match: Salary → INCOME + pocket essential
  useEffect(() => {
    if (category === 'Salary') {
      setType('INCOME');
      const essential = pockets.find(p => p.isEssential);
      if (essential) setPocketId(essential.id);
    }
  }, [category, pockets]);

  const handleScan = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/ai/scan-receipt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error('Không thể quét hóa đơn.');
      const { data } = await res.json();
      setTitle(data.vendor || 'Hóa đơn mới');
      setAmount(Number(data.totalAmount) || 0);
      const matched = CATEGORIES.find(c =>
        c.name.toLowerCase() === (data.categorySuggestion || '').toLowerCase() ||
        c.id.toLowerCase() === (data.categorySuggestion || '').toLowerCase()
      );
      if (matched) setCategory(matched.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const reset = () => {
    setTitle(''); setAmount(0); setCategory('Other');
    setType('EXPENSE'); setSource('CASH');
    setDate(new Date().toISOString().slice(0, 16));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0 || !pocketId) {
      setError('Vui lòng điền đầy đủ thông tin và số tiền hợp lệ.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/transactions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), amount, category, type, source, pocketId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || `Lỗi HTTP ${res.status}`);
      }
      notificationBus.push({
        type: type === 'INCOME' ? 'income' : 'expense',
        message: `${type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu'}: ${title}`,
        amount,
      });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
      queryClient.invalidateQueries({ queryKey: ['chart'] });
      setSuccess(true);
      reset();
      onSuccess();
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      setError(err?.message ?? 'Lỗi không xác định.');
    } finally {
      setIsSaving(false);
    }
  };

  const isIncome = type === 'INCOME';
  const accentColor = isIncome ? '#34d399' : '#f87171';
  const selectedPocket = pockets.find(p => p.id === pocketId);

  return (
    <div
      className="relative overflow-hidden rounded-3xl"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* ambient glow */}
      <div
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] opacity-[0.12] pointer-events-none transition-all duration-700"
        style={{ background: accentColor }}
      />
      <div
        className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-[64px] opacity-[0.08] pointer-events-none"
        style={{ background: isIncome ? '#3b82f6' : '#7c3aed' }}
      />

      {/* Header */}
      <div className="relative px-7 py-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: `${accentColor}18` }}
          >
            <Receipt size={18} style={{ color: accentColor }} />
          </div>
          <div>
            <h2 className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
              Thêm Giao Dịch
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Ghi lại chi tiêu & thu nhập
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative p-7 space-y-5">
        {/* Scan Receipt */}
        <motion.button
          type="button"
          onClick={handleScan}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2.5 text-sm font-bold transition-all"
          style={{
            borderColor: 'rgba(56,189,248,0.3)',
            background: 'rgba(56,189,248,0.04)',
            color: 'var(--primary)',
          }}
        >
          <Camera size={16} />
          Quét hóa đơn AI
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{
            background: 'rgba(56,189,248,0.15)', color: 'var(--primary)',
          }}>
            Gemini 2.5
          </span>
        </motion.button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} aria-label="Upload ảnh hóa đơn" />

        {/* Type toggle */}
        <div
          className="grid grid-cols-2 p-1 gap-1 rounded-2xl"
          style={{ background: 'var(--bg-base)' }}
        >
          {[
            { val: 'EXPENSE', label: 'Chi Tiêu', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
            { val: 'INCOME',  label: 'Thu Nhập', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
          ].map(({ val, label, color, bg }) => (
            <button
              key={val}
              type="button"
              onClick={() => setType(val as 'EXPENSE' | 'INCOME')}
              className="relative py-2.5 rounded-xl text-sm font-black transition-all"
              style={{ color: type === val ? color : 'var(--text-muted)' }}
            >
              {type === val && (
                <motion.div
                  layoutId="type-bg"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: bg, border: `1px solid ${color}30` }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Tiêu đề
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ví dụ: Ăn trưa, Lương tháng 4..."
            className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => (e.target.style.borderColor = accentColor + '80')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Số tiền (VNĐ)
          </label>
          <div
            className="px-4 py-3 rounded-2xl flex items-center gap-2 transition-all"
            style={{
              background: 'var(--bg-base)',
              border: `1px solid ${amount > 0 ? accentColor + '50' : 'var(--border)'}`,
            }}
          >
            <span className="text-sm font-bold" style={{ color: accentColor }}>₫</span>
            <NumericFormat
              value={amount || ''}
              onValueChange={v => setAmount(v.floatValue ?? 0)}
              thousandSeparator="."
              decimalSeparator=","
              allowNegative={false}
              placeholder="0"
              className="flex-1 bg-transparent outline-none text-sm font-bold"
              style={{ color: 'var(--text-primary)' }}
            />
            {amount > 0 && (
              <button type="button" onClick={() => setAmount(0)}>
                <X size={13} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>
          {/* Quick amounts */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_AMOUNTS.map(q => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(q)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105"
                style={{
                  background: amount === q ? accentColor + '20' : 'var(--bg-base)',
                  border: `1px solid ${amount === q ? accentColor + '50' : 'var(--border)'}`,
                  color: amount === q ? accentColor : 'var(--text-muted)',
                }}
              >
                {q >= 1_000_000 ? `${q / 1_000_000}tr` : `${q / 1_000}k`}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Danh mục
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {CATEGORIES.map(({ id, name, Icon, color }) => (
              <button
                key={id}
                type="button"
                title={name}
                onClick={() => setCategory(id)}
                className="flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-all hover:scale-105"
                style={{
                  background: category === id ? `${color}18` : 'var(--bg-base)',
                  border: `1px solid ${category === id ? color + '60' : 'var(--border)'}`,
                  color: category === id ? color : 'var(--text-muted)',
                }}
              >
                <Icon size={13} />
                <span className="truncate w-full text-center">{name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pocket */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Hũ tài chính
          </label>
          {pockets.length === 0 ? (
            <div className="px-4 py-3 rounded-2xl text-xs text-center" style={{ background: 'var(--bg-base)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Chưa có hũ nào
            </div>
          ) : (
            <div className="relative">
              <Wallet size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <select
                value={pocketId}
                onChange={e => setPocketId(e.target.value)}
                title="Chọn hũ tài chính"
                aria-label="Chọn hũ tài chính"
                className="w-full pl-8 pr-8 py-3 rounded-2xl text-sm font-bold outline-none appearance-none transition-all"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                {pockets.map(p => (
                  <option key={p.id} value={p.id} className="bg-[#0c1624]">
                    {p.name} — {formatVND(Number(p.balance))}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedPocket && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Số dư hiện tại</span>
              <span className="font-black" style={{ color: 'var(--primary)' }}>
                {formatVND(Number(selectedPocket.balance))}
              </span>
            </div>
          )}
        </div>

        {/* Source */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { val: 'CASH', label: '💵 Tiền mặt', color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
            { val: 'BANK', label: '🏦 Ngân hàng', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
          ].map(({ val, label, color, bg }) => (
            <button
              key={val}
              type="button"
              onClick={() => setSource(val as 'CASH' | 'BANK')}
              className="py-2.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: source === val ? bg : 'var(--bg-base)',
                border: `1px solid ${source === val ? color + '50' : 'var(--border)'}`,
                color: source === val ? color : 'var(--text-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Thời gian
          </label>
          <div className="relative">
            <Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input
              type="datetime-local"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full pl-8 pr-4 py-3 rounded-2xl text-sm outline-none transition-all"
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                colorScheme: 'dark',
              }}
            />
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2.5 p-3 rounded-2xl text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={isSaving || amount <= 0}
          whileHover={!isSaving && amount > 0 ? { scale: 1.01 } : {}}
          whileTap={!isSaving && amount > 0 ? { scale: 0.98 } : {}}
          className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all disabled:opacity-40"
          style={{
            background: success
              ? 'linear-gradient(135deg,#34d399,#059669)'
              : `linear-gradient(135deg, ${accentColor}, ${isIncome ? '#3b82f6' : '#7c3aed'})`,
            color: '#050d18',
          }}
        >
          {isSaving ? (
            <><Loader2 size={18} className="animate-spin" />Đang lưu...</>
          ) : success ? (
            <><CheckCircle2 size={18} />Đã lưu!</>
          ) : (
            <><Save size={18} />Lưu Giao Dịch</>
          )}
        </motion.button>

        {/* OCR overlay */}
        <AnimatePresence>{isScanning && <OCRProcessingOverlay />}</AnimatePresence>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TransactionList (right panel)
// ─────────────────────────────────────────────────────────────
interface ListProps {
  transactions: Transaction[];
  loading: boolean;
}

function TransactionList({ transactions, loading }: ListProps) {
  const [query, setQuery]           = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [filterPocket, setFilterPocket] = useState<string>('ALL');

  const filtered = transactions.filter(t => {
    const q = query.toLowerCase();
    const matchSearch = t.title.toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q);
    const matchType   = filterType === 'ALL'   || t.type === filterType;
    const matchPocket = filterPocket === 'ALL' || t.pocket?.name === filterPocket;
    return matchSearch && matchType && matchPocket;
  });

  const totalIncome  = filtered.filter(t => t.type === 'INCOME' || t.type === 'LUONG').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = filtered.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);

  const pocketNames = Array.from(new Set(transactions.map(t => t.pocket?.name).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Tổng thu', value: totalIncome,  color: '#34d399', Icon: ArrowUpRight,   bg: 'rgba(52,211,153,0.08)'  },
          { label: 'Tổng chi', value: totalExpense, color: '#f87171', Icon: ArrowDownRight, bg: 'rgba(248,113,113,0.08)' },
        ].map(({ label, value, color, Icon, bg }) => (
          <div
            key={label}
            className="rounded-2xl px-5 py-4 flex items-center gap-3"
            style={{ background: bg, border: `1px solid ${color}25` }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: color + '99' }}>{label}</p>
              <p className="text-base font-black" style={{ color }}>{formatVND(value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div
        className="p-4 rounded-2xl space-y-3"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm kiếm giao dịch..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {query && (
            <button className="absolute right-3.5 top-1/2 -translate-y-1/2" onClick={() => setQuery('')}>
              <X size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>

        {/* Type filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={13} style={{ color: 'var(--text-muted)' }} />
          {(['ALL', 'INCOME', 'EXPENSE'] as const).map(ft => (
            <button
              key={ft}
              onClick={() => setFilterType(ft)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border transition-all"
              style={{
                background: filterType === ft ? 'var(--primary-glow)' : 'var(--bg-base)',
                borderColor: filterType === ft ? 'var(--primary)' : 'var(--border)',
                color: filterType === ft ? 'var(--primary)' : 'var(--text-muted)',
              }}
            >
              {ft === 'ALL' ? 'Tất cả' : ft === 'INCOME' ? '↑ Thu' : '↓ Chi'}
            </button>
          ))}

          {/* Pocket filters */}
          {pocketNames.length > 0 && (
            <div className="relative ml-auto">
              <PiggyBank size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <select
                value={filterPocket}
                onChange={e => setFilterPocket(e.target.value)}
                title="Lọc theo hũ"
                aria-label="Lọc theo hũ"
                className="pl-7 pr-6 py-1.5 rounded-xl text-xs font-bold outline-none appearance-none transition-all"
                style={{
                  background: filterPocket !== 'ALL' ? 'var(--primary-glow)' : 'var(--bg-base)',
                  border: `1px solid ${filterPocket !== 'ALL' ? 'var(--primary)' : 'var(--border)'}`,
                  color: filterPocket !== 'ALL' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                <option value="ALL" className="bg-[#0c1624]">Tất cả hũ</option>
                {pocketNames.map(n => (
                  <option key={n} value={n} className="bg-[#0c1624]">{n}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2 min-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <CreditCard size={40} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Không tìm thấy giao dịch</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((tx, i) => {
              const { Icon, color, label } = getCatMeta(tx.category, tx.type);
              const isUp = tx.type === 'INCOME' || tx.type === 'LUONG';

              return (
                <motion.div
                  layout
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i < 6 ? i * 0.03 : 0 } }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                  className="flex items-center gap-3.5 px-5 py-3.5 rounded-2xl transition-all cursor-pointer group"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                  }}
                  whileHover={{ borderColor: color + '40', y: -1 }}
                >
                  {/* Icon */}
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all group-hover:scale-105"
                    style={{
                      background: `${color}14`,
                      boxShadow: `0 0 0 0 ${color}40`,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 12px 2px ${color}25`)}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                  >
                    <Icon size={16} style={{ color }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {tx.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: `${color}14`, color }}
                      >
                        {label}
                      </span>
                      {tx.pocket && (
                        <>
                          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>·</span>
                          <span className="text-[10px] font-medium truncate" style={{ color: 'var(--text-muted)' }}>
                            {tx.pocket.name}
                          </span>
                        </>
                      )}
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>·</span>
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(tx.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className="text-base font-black"
                      style={{ color: isUp ? '#34d399' : '#f87171' }}
                    >
                      {isUp ? '+' : '-'}{formatVND(Number(tx.amount))}
                    </span>
                    {isUp
                      ? <ArrowUpRight size={15} style={{ color: '#34d399' }} />
                      : <ArrowDownRight size={15} style={{ color: '#f87171' }} />
                    }
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-center text-xs pb-2" style={{ color: 'var(--text-muted)' }}>
          Hiển thị {filtered.length} giao dịch
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function TransactionPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: allPockets = [] } = useQuery({
    queryKey: ['pockets'],
    queryFn: () => authFetch<Pocket[]>('/pockets', {}, token),
    enabled: !!token,
  });
  const pockets = allPockets.filter(p => p.name !== 'Tiền chưa vào hũ');

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

  const handleSuccess = () => {
    fetchTxs();
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="max-w-7xl mx-auto flex flex-col gap-6"
    >
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            className="text-2xl font-black flex items-center gap-3"
            style={{ color: 'var(--text-primary)' }}
          >
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--primary-glow)', border: '1px solid rgba(56,189,248,0.3)' }}
            >
              <Sparkles size={17} style={{ color: 'var(--primary)' }} />
            </div>
            Quản Lý Giao Dịch
          </motion.h1>
          <p className="text-sm mt-1 ml-12" style={{ color: 'var(--text-muted)' }}>
            Ghi lại thu chi — cập nhật thời gian thực
          </p>
        </div>
        <div
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
          style={{ background: 'var(--primary-glow)', border: '1px solid rgba(56,189,248,0.2)', color: 'var(--primary)' }}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Đồng bộ Real-time
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
        {/* Left: Add Transaction Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="lg:sticky lg:top-6"
        >
          <TransactionForm pockets={pockets} onSuccess={handleSuccess} token={token} />
        </motion.div>

        {/* Right: Transaction History */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <TransactionList
            transactions={transactions}
            loading={loading}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
