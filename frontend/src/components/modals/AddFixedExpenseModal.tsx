import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarClock, Loader2, Landmark } from 'lucide-react';
import { authFetch, useAuth } from '../../context/AuthContext';

interface Pocket {
  id: string;
  name: string;
  isEssential: boolean;
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
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [pocketId, setPocketId] = useState('');
  const [autoDeduct, setAutoDeduct] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setAmount('');
      setAutoDeduct(true);
      if (pockets.length === 0) {
        authFetch<Pocket[]>('/pockets', {}, token).then(data => {
          setPockets(data);
          const nec = data.find((p) => p.isEssential || p.name.includes('Thiết'));
          if (nec) setPocketId(nec.id);
          else if (data.length > 0) setPocketId(data[0].id);
        });
      }
    }
  }, [isOpen, token, pockets.length]);

  const handleSubmit = async () => {
    if (!title || !amount || !pocketId) return;
    setLoading(true);
    try {
      await authFetch('/profile/fixed-expenses', {
        method: 'POST',
        body: JSON.stringify({ title, amount: Number(amount), autoDeduct, pocketId })
      }, token);
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#050d18]/80 backdrop-blur-md" />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-[#0c1624] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><CalendarClock size={20} className="text-pink-400" /> Thêm Phí Tiêu Chuẩn</h2>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"><X size={20} /></button>
           </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Tên khoản phí</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiền nhà, Netflix..." className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-pink-500 outline-none" />
            </div>
            <div>
               <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Số tiền định kỳ (VNĐ)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-pink-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Nguồn trừ tiền (Hũ tài chính)</label>
              <div className="relative">
                <select value={pocketId} onChange={e => setPocketId(e.target.value)} className="w-full appearance-none bg-black/30 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white focus:border-pink-500 outline-none">
                  <option value="" disabled className="bg-slate-900">-- Chọn hũ để trừ --</option>
                  {pockets.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                </select>
                <Landmark size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <input type="checkbox" id="auto_deduct" checked={autoDeduct} onChange={e => setAutoDeduct(e.target.checked)} className="w-5 h-5 accent-pink-500 cursor-pointer" />
              <label htmlFor="auto_deduct" className="text-sm font-bold text-slate-300 select-none cursor-pointer">Cho phép AI tự động trừ định kỳ hàng tháng</label>
            </div>
            <button onClick={handleSubmit} disabled={loading} className="w-full mt-4 py-3.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)]">
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Xác Nhận Thiết Lập'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
