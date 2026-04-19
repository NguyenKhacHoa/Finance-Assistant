import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, CheckCircle2, AlertCircle, ArrowRight, Sparkles,
  SlidersHorizontal, Info, Loader2, BrainCircuit, RefreshCw,
  X, Clock, Zap, PiggyBank,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authFetch, useAuth } from '../../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NumericFormat } from 'react-number-format';
import confetti from 'canvas-confetti';
import { formatVND } from '../../utils/format';
import { notificationBus } from '../../utils/notificationBus';

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

type PageStep =
  | 'input'           // Bước 1: Nhập số tiền + ghi chú
  | 'depositing'      // Đang xử lý nạp tiền
  | 'deposit_success' // Vừa nạp thành công → hỏi có muốn phân bổ không
  | 'allocating'      // Đang ở UI phân bổ (tab manual / ai)
  | 'distributing'    // Đang xử lý phân bổ
  | 'done';           // Hoàn thành

// ─────────────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────────────
const POCKET_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
];

// ─────────────────────────────────────────────────────────────
// LRM Distribution Helper
// ─────────────────────────────────────────────────────────────
function distributeLRM(
  totalAmount: number,
  pockets: { id: string; percentage: number }[],
): Record<string, number> {
  const safeTotal = Math.round(totalAmount);
  const totalPct = pockets.reduce((s, p) => s + p.percentage, 0);
  if (totalPct === 0 || safeTotal === 0) return {};

  const targetTotal = Math.round(safeTotal * (totalPct / 100));
  const working = pockets.map((p) => {
    const exact = safeTotal * (p.percentage / 100);
    return { id: p.id, floor: Math.floor(exact), rem: exact - Math.floor(exact) };
  });

  const floored = working.reduce((s, w) => s + w.floor, 0);
  const leftover = targetTotal - floored;
  const sorted = [...working].sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < leftover && i < sorted.length; i++) sorted[i].floor += 1;

  return Object.fromEntries(sorted.map((w) => [w.id, w.floor]));
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function IncomePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Step state ────────────────────────────────────────────
  const [step, setStep] = useState<PageStep>('input');

  // ── Step 1: Input ─────────────────────────────────────────
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositNote, setDepositNote] = useState('');
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositedAmount, setDepositedAmount] = useState<number>(0); // amount actually deposited

  // ── Step 2 (allocating) ───────────────────────────────────
  const [allocTab, setAllocTab] = useState<'manual' | 'ai'>('manual');

  // Manual tab
  const [customPct, setCustomPct] = useState<Record<string, number>>({});
  const [directAmounts, setDirectAmounts] = useState<Record<string, number>>({});
  const [editMode, setEditMode] = useState<Record<string, 'pct' | 'amount'>>({});

  // AI tab
  const [aiAmounts, setAiAmounts] = useState<Record<string, number>>({});
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState(false);

  // Distribution submit
  const [distributeError, setDistributeError] = useState<string | null>(null);

  // ── Fetch pockets ─────────────────────────────────────────
  const { data: allPockets = [], isLoading: loadingPockets } = useQuery({
    queryKey: ['pockets'],
    queryFn: () => authFetch<Pocket[]>('/pockets', {}, token),
    enabled: !!token,
  });
  const pockets = allPockets.filter((p) => p.name !== 'Tiền chưa vào hũ');

  // Init percentages from DB
  useEffect(() => {
    if (pockets.length === 0) return;
    const initPct: Record<string, number> = {};
    const initMode: Record<string, 'pct' | 'amount'> = {};
    pockets.forEach((p) => {
      initPct[p.id] = Number(p.percentage);
      initMode[p.id] = 'pct';
    });
    setCustomPct(initPct);
    setEditMode(initMode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pockets.length]);

  // ── Derived amounts (manual) ──────────────────────────────
  const lrmAmounts = distributeLRM(
    depositedAmount,
    pockets.map((p) => ({ id: p.id, percentage: customPct[p.id] ?? 0 })),
  );

  const manualAmounts: Record<string, number> = {};
  pockets.forEach((p) => {
    if (editMode[p.id] === 'amount' && directAmounts[p.id] !== undefined) {
      manualAmounts[p.id] = Math.round(directAmounts[p.id]);
    } else {
      manualAmounts[p.id] = lrmAmounts[p.id] ?? 0;
    }
  });

  const activeAmounts = allocTab === 'ai' && aiReady ? aiAmounts : manualAmounts;
  const totalAllocated = Object.values(activeAmounts).reduce((s, v) => s + v, 0);
  const surplus = Math.max(0, depositedAmount - totalAllocated);
  const totalCustomPct = Object.values(customPct).reduce((s, v) => s + v, 0);

  // ─────────────────────────────────────────────────────────
  // Handler: Deposit (Step 1 → Step deposit_success)
  // ─────────────────────────────────────────────────────────
  const handleDeposit = async () => {
    if (depositAmount <= 0) return;
    setStep('depositing');
    setDepositError(null);

    try {
      const res = await authFetch<any>('/finance/deposit', {
        method: 'POST',
        body: JSON.stringify({
          amount: depositAmount,
          note: depositNote || undefined,
        }),
      }, token);

      setDepositedAmount(res.depositedAmount ?? depositAmount);
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['pockets'] });

      notificationBus.push({
        type: 'income',
        message: `Đã nạp ${formatVND(depositAmount)} vào mục Chưa phân bổ.`,
        amount: depositAmount,
      });

      setStep('deposit_success');
    } catch (err: any) {
      setDepositError(err.message || 'Có lỗi xảy ra khi nạp tiền.');
      setStep('input');
    }
  };

  // ─────────────────────────────────────────────────────────
  // Handler: Fetch AI allocations
  // ─────────────────────────────────────────────────────────
  const handleAIPreview = async () => {
    setIsAiLoading(true);
    setAiError(null);
    setAiReady(false);
    try {
      const data: { pocketId: string; amount: number }[] = await authFetch(
        '/finance/ai-preview',
        { method: 'POST', body: JSON.stringify({ amount: depositedAmount }) },
        token,
      );
      const map: Record<string, number> = {};
      data.forEach((d) => { map[d.pocketId] = Math.round(d.amount); });
      setAiAmounts(map);
      setAiReady(true);
    } catch (err: any) {
      setAiError(err.message || 'AI không thể gợi ý lúc này. Thử lại sau.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleApplyAIToManual = () => {
    if (!aiReady || depositedAmount <= 0) return;
    const newPct: Record<string, number> = {};
    pockets.forEach((p) => {
      const amt = aiAmounts[p.id] ?? 0;
      newPct[p.id] = parseFloat(((amt / depositedAmount) * 100).toFixed(1));
    });
    setCustomPct(newPct);
    setEditMode(Object.fromEntries(pockets.map((p) => [p.id, 'pct'])));
    setAllocTab('manual');
  };

  // ─────────────────────────────────────────────────────────
  // Handler: Distribute (Step allocating → done)
  // ─────────────────────────────────────────────────────────
  const handleDistribute = async () => {
    const allocs = pockets
      .map((p) => ({ pocketId: p.id, amount: activeAmounts[p.id] ?? 0 }))
      .filter((a) => a.amount > 0);

    if (allocs.length === 0) return;
    setStep('distributing');
    setDistributeError(null);

    try {
      const res = await authFetch<any>('/finance/distribute-from-unallocated', {
        method: 'POST',
        body: JSON.stringify({ allocations: allocs }),
      }, token);

      if (res?.newlyUnlocked?.length > 0) {
        res.newlyUnlocked.forEach((badgeName: string) => {
          notificationBus.push({ type: 'badge', message: `🎉 Mở khóa: ${badgeName}` });
        });
      }

      confetti({
        particleCount: 200,
        spread: 120,
        origin: { y: 0.5 },
        colors: ['#10b981', '#14b8a6', '#f59e0b', '#3b82f6', '#8b5cf6'],
      });

      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
      setStep('done');
      setTimeout(() => navigate('/dashboard'), 2500);
    } catch (err: any) {
      setDistributeError(err.message || 'Có lỗi khi phân bổ.');
      setStep('allocating');
    }
  };

  // ─────────────────────────────────────────────────────────
  // Handler: Manual % / amount change
  // ─────────────────────────────────────────────────────────
  const handlePctChange = (id: string, value: number) => {
    const othersSum = Object.entries(customPct)
      .filter(([k]) => k !== id)
      .reduce((s, [, v]) => s + v, 0);
    const safe = Math.min(value, 100 - othersSum);
    setCustomPct((prev) => ({ ...prev, [id]: safe }));
    setEditMode((prev) => ({ ...prev, [id]: 'pct' }));
  };

  const handleDirectAmountChange = (id: string, value: number) => {
    setDirectAmounts((prev) => ({ ...prev, [id]: value }));
    setEditMode((prev) => ({ ...prev, [id]: 'amount' }));
    if (depositedAmount > 0) {
      setCustomPct((prev) => ({ ...prev, [id]: parseFloat(((value / depositedAmount) * 100).toFixed(1)) }));
    }
  };

  // ─────────────────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────────────────
  if (loadingPockets && step === 'input') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto pb-16 relative">

      {/* ══════════════════════════════════════════════════════
          DONE OVERLAY
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {step === 'done' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{ background: 'rgba(5,13,24,0.92)', backdropFilter: 'blur(24px)' }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 14 }}
              className="text-center space-y-5"
            >
              <div className="w-28 h-28 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 size={60} className="text-emerald-400" />
              </div>
              <h2 className="text-3xl font-black text-white">Hoàn thành!</h2>
              <p className="text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Tiền đã được phân bổ vào các hũ tài chính
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Đang chuyển về Dashboard...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          STEP 1: INPUT FORM
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {(step === 'input' || step === 'depositing') && (
          <motion.div
            key="step-input"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.4 }}
            className="pt-4 space-y-6"
          >
            {/* Header */}
            <div className="text-center space-y-2 pb-2">
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center mb-3"
                style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)' }}
              >
                <PiggyBank size={30} color="#020d1a" />
              </motion.div>
              <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Nạp Tiền
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Tiền sẽ được ghi nhận vào mục <span className="font-bold text-yellow-400">"Chưa phân bổ"</span>.
                Bạn có thể chia vào các hũ ngay hoặc để sau.
              </p>
            </div>

            {/* Input card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="relative overflow-hidden rounded-3xl p-8"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              {/* Glow */}
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ background: 'var(--primary)' }} />
              <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full blur-3xl opacity-15 pointer-events-none"
                style={{ background: '#7c3aed' }} />

              <div className="relative z-10 space-y-6">
                {/* Amount */}
                <div>
                  <label className="block text-center text-xs font-bold uppercase tracking-widest mb-4"
                    style={{ color: 'var(--primary)' }}>
                    Số tiền muốn nạp (VNĐ)
                  </label>
                  <NumericFormat
                    value={depositAmount || ''}
                    onValueChange={(vals) => setDepositAmount(vals.floatValue || 0)}
                    thousandSeparator="."
                    decimalSeparator=","
                    suffix=" ₫"
                    allowNegative={false}
                    placeholder="0 ₫"
                    disabled={step === 'depositing'}
                    className="w-full text-center bg-transparent border-0 outline-none font-black tracking-tighter disabled:opacity-50"
                    style={{
                      fontSize: 'clamp(2rem, 7vw, 3.75rem)',
                      color: depositAmount > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  />
                  {/* Progress bar */}
                  <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, var(--primary), #7c3aed)' }}
                      animate={{ width: depositAmount > 0 ? '100%' : '0%' }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>

                  {/* Quick amounts */}
                  <div className="flex flex-wrap gap-2 justify-center mt-5">
                    {[5_000_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000, 50_000_000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setDepositAmount(amt)}
                        disabled={step === 'depositing'}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 disabled:opacity-40"
                        style={{
                          background: depositAmount === amt ? 'var(--primary)' : 'var(--bg-base)',
                          border: `1px solid ${depositAmount === amt ? 'var(--primary)' : 'var(--border)'}`,
                          color: depositAmount === amt ? '#020d1a' : 'var(--text-secondary)',
                        }}
                      >
                        {amt >= 1_000_000 ? `${amt / 1_000_000}tr` : `${amt / 1_000}k`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note input */}
                <div>
                  <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>
                    Ghi chú (tuỳ chọn)
                  </label>
                  <input
                    type="text"
                    value={depositNote}
                    onChange={(e) => setDepositNote(e.target.value)}
                    disabled={step === 'depositing'}
                    placeholder="VD: Lương tháng 4, Thưởng dự án..."
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all disabled:opacity-50"
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                    maxLength={120}
                  />
                </div>

                {/* Info banner */}
                <div
                  className="flex items-start gap-3 p-4 rounded-2xl"
                  style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)' }}
                >
                  <Info size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Sau khi nạp, số tiền sẽ nằm ở mục <span className="font-bold text-yellow-400">"Chưa phân bổ"</span>.
                    Chúng tôi sẽ hỏi bạn có muốn chia ngay vào các hũ hay không.
                  </p>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {depositError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-3 p-4 rounded-2xl"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
                    >
                      <AlertCircle size={16} className="text-red-400 shrink-0" />
                      <p className="text-sm text-red-400">{depositError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <motion.button
                  onClick={handleDeposit}
                  disabled={depositAmount <= 0 || step === 'depositing'}
                  whileHover={depositAmount > 0 ? { scale: 1.01 } : {}}
                  whileTap={depositAmount > 0 ? { scale: 0.98 } : {}}
                  className="w-full py-5 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-2xl"
                  style={{
                    background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)',
                    color: '#020d1a',
                  }}
                >
                  {step === 'depositing' ? (
                    <><Loader2 size={20} className="animate-spin" /> Đang nạp tiền...</>
                  ) : (
                    <><Wallet size={20} /> Nạp Tiền <ArrowRight size={18} /></>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 2: DEPOSIT SUCCESS → CONFIRM MODAL
        ══════════════════════════════════════════════════════ */}
        {step === 'deposit_success' && (
          <motion.div
            key="step-success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="pt-8 space-y-6"
          >
            {/* Success notice */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center space-y-3"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/12 border-2 border-emerald-500/25 flex items-center justify-center mx-auto">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                >
                  <CheckCircle2 size={44} className="text-emerald-400" />
                </motion.div>
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Nạp tiền thành công</p>
                <p className="text-3xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
                  {formatVND(depositedAmount)}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  đã được ghi nhận vào mục <span className="font-bold text-yellow-400">"Chưa phân bổ"</span>
                </p>
              </div>
            </motion.div>

            {/* Question card */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="rounded-3xl overflow-hidden"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <div className="p-7 text-center space-y-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-3">
                  <Wallet size={24} style={{ color: 'var(--primary)' }} />
                </div>
                <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                  Phân bổ vào các hũ ngay bây giờ?
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Bạn có muốn chia {formatVND(depositedAmount)} vào các hũ tài chính không?
                  Hoặc để sau cũng được — tiền vẫn an toàn trong mục Chưa phân bổ.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-0">
                {/* Để sau */}
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex flex-col items-center justify-center gap-2 p-6 transition-all hover:bg-white/[0.03] border-r"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-500/10 flex items-center justify-center text-slate-400">
                    <Clock size={22} />
                  </div>
                  <div>
                    <p className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>Để sau</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Giữ trong Chưa phân bổ
                    </p>
                  </div>
                </button>

                {/* Phân bổ ngay */}
                <button
                  onClick={() => setStep('allocating')}
                  className="flex flex-col items-center justify-center gap-2 p-6 transition-all hover:bg-[var(--primary)]/5"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--primary)/15', color: 'var(--primary)' }}
                  >
                    <Zap size={22} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <p className="font-black text-sm" style={{ color: 'var(--primary)' }}>Phân bổ ngay</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Chia vào các hũ tài chính
                    </p>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 3: ALLOCATION UI
        ══════════════════════════════════════════════════════ */}
        {(step === 'allocating' || step === 'distributing') && (
          <motion.div
            key="step-alloc"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="pt-4 space-y-5"
          >
            {/* Back header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep('deposit_success')}
                disabled={step === 'distributing'}
                className="flex items-center gap-2 text-sm font-bold transition-colors hover:opacity-70 disabled:opacity-40"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} /> Quay lại
              </button>
              <div
                className="px-3 py-1.5 rounded-xl text-xs font-black"
                style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.25)' }}
              >
                Chưa phân bổ: {formatVND(depositedAmount)}
              </div>
            </div>

            {/* Tab switcher */}
            <div
              className="flex p-1 rounded-2xl"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              {[
                { key: 'manual', label: 'Chia thủ công', icon: <SlidersHorizontal size={15} /> },
                { key: 'ai', label: 'AI tự động', icon: <BrainCircuit size={15} /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  disabled={step === 'distributing'}
                  onClick={() => setAllocTab(tab.key as 'manual' | 'ai')}
                  className="flex-1 relative py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  style={{ color: allocTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  {allocTab === tab.key && (
                    <motion.div
                      layoutId="alloc-tab-bg"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: 'var(--bg-base)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {tab.icon}
                    {tab.label}
                    {tab.key === 'ai' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">AI</span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* ── Tab: Manual ───────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {allocTab === 'manual' && (
                <motion.div
                  key="manual-tab"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-3"
                >
                  {pockets.length === 0 ? (
                    <div
                      className="rounded-2xl p-8 text-center"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                    >
                      <Wallet size={36} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
                      <p className="font-bold" style={{ color: 'var(--text-muted)' }}>Bạn chưa có hũ nào.</p>
                      <button
                        onClick={() => navigate('/pockets')}
                        className="mt-4 px-5 py-2 rounded-xl text-sm font-bold"
                        style={{ background: 'var(--primary)', color: '#020d1a' }}
                      >
                        Tạo hũ ngay
                      </button>
                    </div>
                  ) : (
                    pockets.map((p, i) => {
                      const color = POCKET_COLORS[i % POCKET_COLORS.length];
                      const pct = customPct[p.id] ?? 0;
                      const amt = manualAmounts[p.id] ?? 0;
                      const isAmtMode = editMode[p.id] === 'amount';
                      const barW = depositedAmount > 0 ? Math.min(100, (amt / depositedAmount) * 100) : 0;

                      return (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="rounded-2xl overflow-hidden"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                        >
                          <div className="h-0.5" style={{ background: color }} />
                          <div className="p-5 space-y-3">
                            {/* Name + amount */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                  style={{ background: `${color}18` }}
                                >
                                  <Wallet size={15} style={{ color }} />
                                </div>
                                <div>
                                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                  {p.isEssential && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-black border border-red-500/20">
                                      THIẾT YẾU
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="px-3 py-1.5 rounded-xl font-black text-sm"
                                style={{ background: `${color}15`, color }}>
                                {formatVND(amt)}
                              </div>
                            </div>

                            {/* Progress */}
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: color }}
                                animate={{ width: `${barW}%` }}
                                transition={{ duration: 0.4 }}
                              />
                            </div>

                            {/* Slider */}
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={0} max={100} step={1}
                                value={pct}
                                disabled={step === 'distributing'}
                                onChange={(e) => handlePctChange(p.id, Number(e.target.value))}
                                className="flex-1 h-2 rounded-full appearance-none cursor-pointer disabled:opacity-50"
                                style={{ accentColor: color }}
                              />
                              <span className="w-12 text-right font-black text-sm shrink-0" style={{ color }}>
                                {pct.toFixed(0)}%
                              </span>
                            </div>

                            {/* Dual input */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold"
                                  style={{ color: 'var(--text-muted)' }}>%</span>
                                <NumericFormat
                                  value={pct === 0 ? '' : pct}
                                  onValueChange={(v) => handlePctChange(p.id, v.floatValue ?? 0)}
                                  decimalScale={1}
                                  allowNegative={false}
                                  disabled={step === 'distributing'}
                                  placeholder="0"
                                  className="w-full pl-7 pr-3 py-2 rounded-xl text-sm font-bold text-right outline-none disabled:opacity-50"
                                  style={{
                                    background: 'var(--bg-base)',
                                    border: `1px solid ${!isAmtMode ? color + '55' : 'var(--border)'}`,
                                    color: 'var(--text-primary)',
                                  }}
                                />
                              </div>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold"
                                  style={{ color: 'var(--text-muted)' }}>₫</span>
                                <NumericFormat
                                  value={isAmtMode ? (directAmounts[p.id] || '') : (amt || '')}
                                  onValueChange={(v) => handleDirectAmountChange(p.id, v.floatValue ?? 0)}
                                  thousandSeparator="." decimalSeparator=","
                                  allowNegative={false}
                                  disabled={step === 'distributing'}
                                  placeholder="0"
                                  className="w-full pl-7 pr-3 py-2 rounded-xl text-sm font-bold text-right outline-none disabled:opacity-50"
                                  style={{
                                    background: 'var(--bg-base)',
                                    border: `1px solid ${isAmtMode ? color + '55' : 'var(--border)'}`,
                                    color: 'var(--text-primary)',
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </motion.div>
              )}

              {/* ── Tab: AI ───────────────────────────────────────── */}
              {allocTab === 'ai' && (
                <motion.div
                  key="ai-tab"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-4"
                >
                  {/* AI Hero */}
                  <div
                    className="relative overflow-hidden rounded-2xl p-6 text-center"
                    style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))', border: '1px solid rgba(99,102,241,0.25)' }}
                  >
                    <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full blur-3xl opacity-15 bg-indigo-500 pointer-events-none" />
                    <div className="relative z-10 space-y-4">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-500/12 border border-indigo-500/25 flex items-center justify-center mx-auto">
                        <BrainCircuit size={28} className="text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>
                          AI Phân Bổ Thông Minh
                        </h3>
                        <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
                          AI dựa trên tỷ lệ % mặc định của các hũ và lịch sử chi tiêu để đề xuất
                          phân bổ tối ưu nhất cho <strong className="text-indigo-400">{formatVND(depositedAmount)}</strong>.
                        </p>
                      </div>
                      <div className="flex gap-3 justify-center">
                        <button
                          onClick={handleAIPreview}
                          disabled={isAiLoading || step === 'distributing'}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
                          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}
                        >
                          {isAiLoading
                            ? <><Loader2 size={18} className="animate-spin" /> Đang phân tích...</>
                            : aiReady
                              ? <><RefreshCw size={18} /> Tạo gợi ý mới</>
                              : <><Sparkles size={18} /> Nhận gợi ý AI</>
                          }
                        </button>
                        {aiReady && (
                          <button
                            onClick={handleApplyAIToManual}
                            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all border hover:bg-sky-500/10 text-sky-400 border-sky-500/30"
                          >
                            <SlidersHorizontal size={16} /> Chuyển sang thủ công
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AI Error */}
                  <AnimatePresence>
                    {aiError && (
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex items-center gap-3 p-4 rounded-xl"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
                      >
                        <AlertCircle size={16} className="text-red-400 shrink-0" />
                        <p className="text-sm text-red-400">{aiError}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* AI Results */}
                  <AnimatePresence>
                    {aiReady && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                      >
                        <p className="text-xs font-bold uppercase tracking-widest px-1 flex items-center gap-1.5 text-indigo-400">
                          <Sparkles size={12} /> Gợi ý phân bổ từ AI
                        </p>
                        {pockets.map((p, i) => {
                          const color = POCKET_COLORS[i % POCKET_COLORS.length];
                          const amt = aiAmounts[p.id] ?? 0;
                          const pct = depositedAmount > 0 ? ((amt / depositedAmount) * 100).toFixed(1) : '0';
                          const barW = depositedAmount > 0 ? Math.min(100, (amt / depositedAmount) * 100) : 0;

                          return (
                            <motion.div
                              key={p.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex items-center gap-4 p-4 rounded-2xl"
                              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                            >
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: `${color}18` }}>
                                <Wallet size={16} style={{ color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                    {p.name}
                                  </p>
                                  <div className="flex items-center gap-2 ml-2 shrink-0">
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{pct}%</span>
                                    <span className="font-black text-sm" style={{ color }}>{formatVND(amt)}</span>
                                  </div>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                  <motion.div
                                    className="h-full rounded-full"
                                    style={{ background: color }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${barW}%` }}
                                    transition={{ duration: 0.6 }}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Summary bar ───────────────────────────────────────── */}
            <div
              className="grid grid-cols-3 gap-3 rounded-2xl p-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              {[
                { label: 'Tổng nạp', value: depositedAmount, color: 'var(--primary)' },
                { label: 'Sẽ vào hũ', value: totalAllocated, color: '#10b981' },
                { label: 'Vẫn chưa phân bổ', value: surplus, color: '#eab308' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  <p className="font-black text-sm" style={{ color: item.color }}>
                    {formatVND(item.value)}
                  </p>
                </div>
              ))}
            </div>

            {/* Surplus info */}
            {surplus > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 p-4 rounded-2xl"
                style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)' }}
              >
                <Info size={16} className="text-yellow-400 shrink-0" />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="font-bold text-yellow-400">{formatVND(surplus)}</span> sẽ vẫn ở lại mục{' '}
                  <span className="font-bold text-yellow-400">"Chưa phân bổ"</span> sau khi phân bổ.
                </p>
              </motion.div>
            )}

            {/* Distribute error */}
            <AnimatePresence>
              {distributeError && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-3 p-4 rounded-2xl"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  <p className="text-sm text-red-400">{distributeError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              onClick={handleDistribute}
              disabled={
                totalAllocated <= 0 ||
                totalAllocated > depositedAmount ||
                step === 'distributing' ||
                (allocTab === 'ai' && !aiReady)
              }
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-5 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all disabled:opacity-35 shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)',
                color: '#020d1a',
              }}
            >
              {step === 'distributing' ? (
                <><Loader2 size={20} className="animate-spin" /> Đang phân bổ...</>
              ) : (
                <>Xác nhận phân bổ {formatVND(totalAllocated)} <ArrowRight size={18} /></>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
