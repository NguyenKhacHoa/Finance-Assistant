import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertCircle } from 'lucide-react';
import { authFetch, useAuth } from '../../context/AuthContext';

interface Pocket {
  id: string;
  name: string;
  percentage: number;
  isEssential: boolean;
}

interface EditJarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pocket: Pocket | null;
}

export default function EditJarModal({ isOpen, onClose, onSuccess, pocket }: EditJarModalProps) {
  const { token } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [percentage, setPercentage] = useState('');
  const [isEssential, setIsEssential] = useState(false);

  useEffect(() => {
    if (pocket && isOpen) {
      setName(pocket.name);
      setPercentage(String(pocket.percentage));
      setIsEssential(pocket.isEssential);
      setError(null);
    }
  }, [pocket, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !percentage || !pocket) return;

    setIsSaving(true);
    setError(null);

    try {
      await authFetch(`/pockets/${pocket.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          percentage: Number(percentage),
          isEssential
        })
      }, token);

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi cập nhật hũ');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !pocket) return null;

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
          className="relative w-full max-w-md bg-[#0c1624] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Chỉnh Sửa Hũ Tài Chính</h2>
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

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-sky-200/40 uppercase tracking-wide mb-1 block">Tên hũ</label>
                <input
                  type="text" required value={name} onChange={e => setName(e.target.value)}
                  placeholder="VD: Hũ Đầu Tư"
                  className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:border-sky-500/50 focus:bg-slate-800 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-sky-200/40 uppercase tracking-wide mb-1 block">Tỷ lệ % phân bổ</label>
                <input
                  type="number" required value={percentage} onChange={e => setPercentage(e.target.value)}
                  placeholder="VD: 10"
                  className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:border-sky-500/50 focus:bg-slate-800 outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-3 mt-4">
                <input
                  type="checkbox" id="edit-essential" checked={isEssential} onChange={e => setIsEssential(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-slate-800/50 text-sky-500 focus:ring-sky-500"
                />
                <label htmlFor="edit-essential" className="text-sm text-gray-300">Đánh dấu là Hũ Thiết Yếu (Quan trọng)</label>
              </div>
            </div>

            <button type="submit" disabled={isSaving} className="w-full py-3.5 mt-2 rounded-xl bg-[var(--primary)] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={18} /> {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
