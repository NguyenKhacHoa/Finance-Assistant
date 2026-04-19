import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Star, Car, Plane, Home, Gamepad2, Laptop, Smartphone, X, Loader2, Calendar } from 'lucide-react';
import { authFetch, useAuth } from '../../context/AuthContext';
import { NumericFormat } from 'react-number-format';

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ICONS = [
  { name: 'Target', Icon: Target },
  { name: 'Star', Icon: Star },
  { name: 'Home', Icon: Home },
  { name: 'Car', Icon: Car },
  { name: 'Plane', Icon: Plane },
  { name: 'Gamepad2', Icon: Gamepad2 },
  { name: 'Laptop', Icon: Laptop },
  { name: 'Smartphone', Icon: Smartphone },
];

export default function AddGoalModal({ isOpen, onClose, onSuccess }: AddGoalModalProps) {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [deadline, setDeadline] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Target');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Tên mục tiêu không được để trống.');
    
    if (!amount || amount <= 0) return setError('Giá trị mục tiêu phải lớn hơn 0.');

    if (deadline && new Date(deadline) <= new Date()) {
        return setError('Hạn định phải là một ngày trong tương lai.');
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await authFetch('/gamification/goals', {
        method: 'POST',
        body: JSON.stringify({
          title,
          targetAmount: amount,
          deadline: deadline || undefined,
          icon: selectedIcon,
        }),
      }, token);
      
      onSuccess();
      onClose();
      // Reset state for next time
      setTitle('');
      setAmount(0);
      setDeadline('');
      setSelectedIcon('Target');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo mục tiêu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-6 shadow-2xl z-10"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)] relative">
                 Tạo Mục Tiêu Mới
                 <div className="absolute -bottom-2 left-0 w-1/2 h-1 bg-[var(--primary)] rounded-full opacity-50" />
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-base)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Tên mục tiêu</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Mua Macbook M4"
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Mục tiêu cần đạt (VNĐ)</label>
                <NumericFormat
                  value={amount || ''}
                  onValueChange={(values) => setAmount(values.floatValue || 0)}
                  thousandSeparator="."
                  decimalSeparator=","
                  suffix=" VND"
                  allowNegative={false}
                  placeholder="Ví dụ: 50.000.000 VND"
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors font-bold text-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Ngày hoàn thành (Tuỳ chọn)</label>
                <div className="relative">
                    <input
                    type="date"
                    value={deadline}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 pl-11 text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors"
                    />
                    <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Icon Đại Diện</label>
                <div className="grid grid-cols-4 gap-2">
                    {ICONS.map(({ name, Icon }) => {
                        const isSelected = selectedIcon === name;
                        return (
                            <button
                                key={name}
                                type="button"
                                onClick={() => setSelectedIcon(name)}
                                className={`flex items-center justify-center p-3 rounded-xl border transition-all ${
                                    isSelected 
                                    ? 'bg-[var(--primary)] text-black border-transparent shadow-lg scale-105' 
                                    : 'bg-[var(--bg-base)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                                }`}
                            >
                                <Icon size={24} />
                            </button>
                        )
                    })}
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-xl border border-red-400/20">
                  {error}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--bg-base)] transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-[var(--primary)] text-black hover:brightness-110 transition-all disabled:opacity-50 min-w-[120px]"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Tạo Mục Tiêu'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
