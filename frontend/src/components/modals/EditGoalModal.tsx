import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Star, Car, Plane, Home, Gamepad2, Laptop, Smartphone, X, Loader2, Calendar, Trash2, ArrowRight } from 'lucide-react';
import { authFetch, useAuth } from '../../context/AuthContext';
import { formatVND } from '../../utils/format';
import { NumericFormat } from 'react-number-format';

interface Goal {
  id: string;
  title: string;
  icon: string;
  targetAmount: number | string;
  currentAmount: number | string;
  deadline: string | null;
  status: string;
}

interface EditGoalModalProps {
  goal: Goal | null;
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

export default function EditGoalModal({ goal, onClose, onSuccess }: EditGoalModalProps) {
  const { token } = useAuth();
  
  // Edit Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [deadline, setDeadline] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Target');
  
  // Mode Selection
  const [mode, setMode] = useState<'edit' | 'resolveDelete'>('edit');
  const [pockets, setPockets] = useState<any[]>([]);
  const [refundTarget, setRefundTarget] = useState<string>('unallocated');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setAmount(Number(goal.targetAmount) || 0);
      if (goal.deadline) {
        setDeadline(new Date(goal.deadline).toISOString().split('T')[0]);
      } else {
        setDeadline('');
      }
      setSelectedIcon(goal.icon || 'Target');
      setMode('edit');
      setError(null);
    }
  }, [goal]);

  useEffect(() => {
     if (mode === 'resolveDelete') {
         // Fetch pockets to allow user to pick a target
         authFetch<any[]>('/pockets', {}, token)
            .then(data => setPockets(data))
            .catch(err => console.error(err));
     }
  }, [mode, token]);

  if (!goal) return null;
  const currentBal = Number(goal.currentAmount);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Tên mục tiêu không được để trống.');
    
    const targetAmount = amount;
    if (!targetAmount || targetAmount <= 0) return setError('Giá trị mục tiêu phải lớn hơn 0.');
    if (targetAmount < currentBal) return setError('Mục tiêu không thể nhỏ hơn số tiền hiện có.');

    setIsSubmitting(true);
    setError(null);

    try {
      await authFetch(`/gamification/goals/${goal.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          targetAmount,
          deadline: deadline || null,
          icon: selectedIcon,
        }),
      }, token);
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật mục tiêu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async (target: string) => {
     setIsSubmitting(true);
     setError(null);

     let url = `/gamification/goals/${goal.id}`;
     if (currentBal > 0 && target) {
         url += `?refundTarget=${target}`;
     }

     try {
       await authFetch(url, { method: 'DELETE' }, token);
       onSuccess();
       onClose();
       // Global dispatch because refunding funds updates the Pockets / Dashboard
       if (currentBal > 0) window.dispatchEvent(new CustomEvent('finance_update'));
     } catch(err: any) {
       setError(err.message || 'Lỗi khi xoá mục tiêu');
     } finally {
       setIsSubmitting(false);
     }
  };

  const handleDeleteRequest = async () => {
      if (currentBal === 0) {
          if (window.confirm('Mục tiêu này chưa có tiền. Thao tác này không thể hoàn tác. Quỹ đạo mục tiêu sẽ bị đóng vĩnh viễn.\n\nBạn có chắc chắn muốn xoá?')) {
              await executeDelete('');
          }
      } else {
          setMode('resolveDelete');
      }
  };

  return (
    <AnimatePresence>
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
                 {mode === 'edit' ? 'Quản Lý Mục Tiêu' : 'Hoàn Trả Quỹ Mục Tiêu'}
                 <div className={`absolute -bottom-2 left-0 w-1/2 h-1 rounded-full opacity-50 ${mode === 'edit' ? 'bg-[var(--primary)]' : 'bg-red-500'}`} />
              </h2>
              <button
                onClick={() => mode === 'resolveDelete' ? setMode('edit') : onClose()}
                className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-base)] transition-colors"
                title={mode === 'resolveDelete' ? "Quay lại" : "Đóng"}
              >
                <X size={20} />
              </button>
            </div>

            {mode === 'edit' ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Tên mục tiêu</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Mục tiêu cẩn đạt (VNĐ)</label>
                    <NumericFormat
                      value={amount || ''}
                      onValueChange={(values) => setAmount(values.floatValue || 0)}
                      thousandSeparator="."
                      decimalSeparator=","
                      suffix=" VND"
                      allowNegative={false}
                      className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors font-bold text-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Ngày hoàn thành (Tuỳ chọn)</label>
                    <div className="relative">
                        <input
                        type="date"
                        value={deadline}
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

                  <div className="pt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleDeleteRequest}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 hover:border-red-500/30 border border-transparent transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={16} /> Xoá Mục Tiêu
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-[var(--primary)] text-black hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Lưu Thay Đổi'}
                    </button>
                  </div>
                </form>
            ) : (
                <div className="space-y-4">
                   <div className="p-4 rounded-xl mb-4 border border-red-500/20 bg-red-500/5">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                         Bạn đang xoá mục tiêu <strong>{goal.title}</strong> nhưng bên trong quỹ còn tiền.
                      </p>
                      <div className="mt-3 flex items-center justify-between font-bold text-lg text-emerald-400 font-mono">
                          <span>Số Tiền Hồi Lưu:</span>
                          <span>{formatVND(currentBal)}</span>
                      </div>
                   </div>

                   <div>
                     <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-3">Vui lòng chọn đích đến cho số tiền này</label>
                     <div className="space-y-2 max-h-[30vh] overflow-y-auto custom-scrollbar pr-2">
                       <button
                         onClick={() => setRefundTarget('unallocated')}
                         className={`w-full text-left px-4 py-3 rounded-xl border flex items-center justify-between transition-all ${
                             refundTarget === 'unallocated'
                             ? 'bg-[var(--primary)] border-[var(--primary)] text-black'
                             : 'bg-[var(--bg-base)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--primary)]'
                         }`}
                       >
                         <div className="flex flex-col">
                             <span className="font-bold">Quỹ Tiền Nhàn Rỗi</span>
                             <span className={`text-xs opacity-80 ${refundTarget === 'unallocated' ? 'text-black' : 'text-[var(--text-muted)]'}`}>
                                 (Chưa phân bổ)
                             </span>
                         </div>
                         {refundTarget === 'unallocated' && <ArrowRight size={18} />}
                       </button>

                       {pockets.filter(p => p.name !== 'Tiền chưa vào hũ').map(p => (
                         <button
                            key={p.id}
                            onClick={() => setRefundTarget(p.id)}
                            className={`w-full text-left px-4 py-3 rounded-xl border flex items-center justify-between transition-all ${
                                refundTarget === p.id
                                ? 'bg-[var(--primary)] border-[var(--primary)] text-black'
                                : 'bg-[var(--bg-base)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--primary)]'
                            }`}
                          >
                            <span className="font-bold">{p.name}</span>
                            {refundTarget === p.id && <ArrowRight size={18} />}
                          </button>
                       ))}
                     </div>
                   </div>

                   {error && (
                    <div className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-xl border border-red-400/20">
                      {error}
                    </div>
                  )}

                   <div className="pt-4 flex justify-end gap-3 mt-4">
                        <button
                            type="button"
                            onClick={() => setMode('edit')}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--bg-base)] transition-colors"
                        >
                            Quay Lại
                        </button>
                        <button
                            type="button"
                            onClick={() => executeDelete(refundTarget)}
                            disabled={isSubmitting}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Xác Nhận Xoá & Chuyển Tiền'}
                        </button>
                   </div>
                </div>
            )}
          </motion.div>
        </div>
    </AnimatePresence>
  );
}
