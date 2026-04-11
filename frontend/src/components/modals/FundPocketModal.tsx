import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertCircle, Wallet } from 'lucide-react';
import { authFetch, useAuth } from '../../context/AuthContext';

interface FundPocketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FundPocketModal({ isOpen, onClose, onSuccess }: FundPocketModalProps) {
  const { token } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    setIsSaving(true);
    setError(null);

    try {
      await authFetch('/pockets/distribute', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount)
        })
      }, token);

      onSuccess();
      onClose();
      setAmount('');
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra trong lúc nạp tiền');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#050d18]/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-sm bg-[#0c1624] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Wallet size={18} className="text-emerald-400" />
              Nạp Thu Nhập (Lương)
            </h2>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle size={16} /> <span>{error}</span>
              </div>
            )}

            <div className="space-y-2 text-center mb-4">
               <p className="text-xs text-sky-200/50">Hệ thống sẽ tự động phân bổ thu nhập này vào các Hũ với tỷ lệ % bạn đã cấu hình.</p>
            </div>

            <div>
              <label className="text-xs text-center font-bold text-sky-200/40 uppercase tracking-wide mb-2 block">Số tiền cần nạp (VNĐ)</label>
              <input
                type="number" required value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="VD: 20000000"
                className="w-full text-center text-xl font-mono bg-slate-800/50 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:bg-slate-800 outline-none transition-all"
              />
            </div>

            <button type="submit" disabled={isSaving || !amount} className="w-full py-3.5 mt-4 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-600 text-[#0c1624] font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={18} /> {isSaving ? 'Đang Nạp...' : 'Bơm Tiền Vào Hũ'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
