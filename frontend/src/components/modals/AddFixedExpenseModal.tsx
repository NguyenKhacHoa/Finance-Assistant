import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarClock, Loader2, Landmark, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { authFetch, useAuth } from '../../context/AuthContext';

interface Pocket {
  id: string;
  name: string;
  isEssential: boolean;
  balance: number;
  lockedAmount: number;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddFixedExpenseModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const { token } = useAuth();
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingPockets, setFetchingPockets] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [pocketId, setPocketId] = useState('');
  const [autoDeduct, setAutoDeduct] = useState(true);
  const [serverError, setServerError] = useState('');

  // Fetch lại pockets mỗi khi modal mở (không cache cũ)
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setAmount('');
      setAutoDeduct(true);
      setServerError('');
      setFetchingPockets(true);
      authFetch<Pocket[]>('/pockets', {}, token)
        .then(data => {
          setPockets(data);
          const nec = data.find((p) => p.isEssential || p.name.includes('Thiết'));
          if (nec) setPocketId(nec.id);
          else if (data.length > 0) setPocketId(data[0].id);
        })
        .catch(() => {})
        .finally(() => setFetchingPockets(false));
    }
  }, [isOpen, token]);

  const handleSubmit = async () => {
    if (!title || !amount || !pocketId) return;
    setLoading(true);
    setServerError('');
    try {
      await authFetch('/profile/fixed-expenses', {
        method: 'POST',
        body: JSON.stringify({ title, amount: Number(amount), autoDeduct, pocketId })
      }, token);
      onSuccess();
      onClose();
    } catch (e: any) {
      // Hiển thị lỗi từ server (400 BadRequest) cho user
      const msg = e?.message || e?.toString() || '';
      const parsed = msg.includes('{') ? (() => { try { return JSON.parse(msg.slice(msg.indexOf('{'))); } catch { return null; } })() : null;
      setServerError(parsed?.message || msg || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPocket = pockets.find(p => p.id === pocketId);
  const availableBalance = selectedPocket
    ? Math.max(0, Number(selectedPocket.balance) - Number(selectedPocket.lockedAmount))
    : 0;
  const numAmount = Number(amount) || 0;
  const isInsufficient = numAmount > 0 && numAmount > availableBalance;
  const isSufficient = numAmount > 0 && !isInsufficient;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#050d18]/80 backdrop-blur-md" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-[#0c1624] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CalendarClock size={20} className="text-pink-400" /> Thêm Phí Tiêu Chuẩn
            </h2>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"><X size={20} /></button>
          </div>

          <div className="p-6 space-y-4">
            {/* Tên khoản phí */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Tên khoản phí</label>
              <input
                value={title}
                onChange={e => { setTitle(e.target.value); setServerError(''); }}
                placeholder="Tiền nhà, Netflix..."
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-pink-500 outline-none"
              />
            </div>

            {/* Số tiền */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Số tiền định kỳ (VNĐ)</label>
              <input
                type="number"
                value={amount}
                onChange={e => { setAmount(e.target.value); setServerError(''); }}
                placeholder="0"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-pink-500 outline-none"
              />
            </div>

            {/* Chọn hũ — hiển thị available balance */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Nguồn trừ tiền (Hũ tài chính)</label>
              <div className="relative">
                {fetchingPockets ? (
                  <div className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-slate-500 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Đang tải...
                  </div>
                ) : (
                  <select
                    value={pocketId}
                    onChange={e => { setPocketId(e.target.value); setServerError(''); }}
                    className="w-full appearance-none bg-black/30 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white focus:border-pink-500 outline-none"
                  >
                    <option value="" disabled className="bg-slate-900">-- Chọn hũ để trừ --</option>
                    {pockets.map(p => {
                      const avail = Math.max(0, Number(p.balance) - Number(p.lockedAmount));
                      const locked = Number(p.lockedAmount);
                      return (
                        <option key={p.id} value={p.id} className="bg-slate-900">
                          {p.name} | Khả dụng: {avail.toLocaleString('de-DE')} VNĐ{locked > 0 ? ` (đã khóa ${locked.toLocaleString('de-DE')})` : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
                <Landmark size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>

              {/* Hiển thị số dư khả dụng của hũ đã chọn */}
              <AnimatePresence>
                {selectedPocket && numAmount === 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Lock size={12} className="text-amber-400" />
                      Đang khóa: <strong className="text-amber-400">{Number(selectedPocket.lockedAmount).toLocaleString('de-DE')} VNĐ</strong>
                    </span>
                    <span className="text-slate-400">
                      Khả dụng: <strong className="text-emerald-400">{availableBalance.toLocaleString('de-DE')} VNĐ</strong>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Checkbox auto-deduct */}
            <div className="flex items-center gap-3 pt-1">
              <input type="checkbox" id="auto_deduct" checked={autoDeduct} onChange={e => setAutoDeduct(e.target.checked)} className="w-5 h-5 accent-pink-500 cursor-pointer" />
              <label htmlFor="auto_deduct" className="text-sm font-bold text-slate-300 select-none cursor-pointer">Cho phép AI tự động trừ định kỳ hàng tháng</label>
            </div>

            {/* Cảnh báo thiếu số dư (client-side) */}
            <AnimatePresence>
              {isInsufficient && !serverError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2 text-red-400"
                >
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed">
                    Hũ <strong>"{selectedPocket?.name}"</strong> chỉ còn{' '}
                    <strong>{availableBalance.toLocaleString('de-DE')} VNĐ</strong> khả dụng
                    {Number(selectedPocket?.lockedAmount) > 0 && (
                      <> (đang khóa <strong className="text-amber-400">{Number(selectedPocket?.lockedAmount).toLocaleString('de-DE')} VNĐ</strong>)</>
                    )}.
                    Vui lòng giảm số tiền hoặc chọn hũ khác.
                  </p>
                </motion.div>
              )}

              {/* Xác nhận đủ số dư */}
              {isSufficient && !serverError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2 text-emerald-400"
                >
                  <CheckCircle2 size={16} className="shrink-0" />
                  <p className="text-xs">
                    Hũ đủ số dư. Sau khi thiết lập,{' '}
                    <strong>{numAmount.toLocaleString('de-DE')} VNĐ</strong> sẽ được khóa trong hũ này.
                  </p>
                </motion.div>
              )}

              {/* Lỗi từ server */}
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2 text-red-400"
                >
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed">{serverError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleSubmit}
              disabled={loading || isInsufficient || !title || !amount || !pocketId}
              className="w-full mt-4 py-3.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <><Lock size={16} /> Xác Nhận & Khóa Tiền</>}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
