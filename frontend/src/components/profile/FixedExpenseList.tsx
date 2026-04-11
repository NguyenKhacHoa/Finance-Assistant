import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit2, Loader2, CalendarClock, Music, Home, Globe, Car, Shield, CreditCard, Landmark } from 'lucide-react';
import { useAuth, authFetch } from '../../context/AuthContext';
import AddFixedExpenseModal from '../modals/AddFixedExpenseModal';
import { formatVND } from '../../utils/format';

interface PocketSubset {
  id: string;
  name: string;
}

interface FixedExpense {
  id: string;
  title: string;
  amount: number;
  autoDeduct: boolean;
  pocket?: PocketSubset;
}

const getIconForTitle = (title: string, size = 20) => {
  const t = title.toLowerCase();
  if (t.includes('netflix') || t.includes('spotify') || t.includes('youtube') || t.includes('apple')) return <Music size={size} className="text-purple-400" />;
  if (t.includes('nhà') || t.includes('điện') || t.includes('nước') || t.includes('wifi') || t.includes('rent')) return <Home size={size} className="text-amber-400" />;
  if (t.includes('web') || t.includes('hosting') || t.includes('domain') || t.includes('cloud')) return <Globe size={size} className="text-blue-400" />;
  if (t.includes('xe') || t.includes('gas') || t.includes('fuel')) return <Car size={size} className="text-red-400" />;
  if (t.includes('bảo hiểm') || t.includes('insurance')) return <Shield size={size} className="text-emerald-400" />;
  return <CreditCard size={size} className="text-pink-400" />;
};

export default function FixedExpenseList() {
  const { token } = useAuth();
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchExpenses = async () => {
    try {
      const data = await authFetch<FixedExpense[]>('/profile/fixed-expenses', {}, token);
      setExpenses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchExpenses();
  }, [token]);

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn chắc chắn muốn xóa chi phí cố định này?')) return;
    try {
      await authFetch(`/profile/fixed-expenses/${id}`, { method: 'DELETE' }, token);
      fetchExpenses();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 md:p-8 border shadow-sm mt-8 transition-all" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <CalendarClock className="text-pink-400" /> Danh Mục Phí Định Kỳ
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Các khoản phí sẽ tự động khấu trừ vào hũ bạn chọn.
          </p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-pink-500/20 text-pink-400 border border-pink-500/50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(236,72,153,0.15)] hover:bg-pink-500 hover:text-white transition-all"
        >
          <Plus size={16} /> Thiết lập phí mới
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-pink-500" size={32} /></div>
      ) : expenses.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-2xl" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <CalendarClock size={48} className="mx-auto mb-3 opacity-20" />
          Bạn chưa có bất kỳ hóa đơn định kỳ nào.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expenses.map((e, index) => (
            <motion.div 
              key={e.id} 
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
              className="p-5 border rounded-2xl hover:border-pink-500/30 transition-colors group relative overflow-hidden flex items-center gap-4"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}
            >
              <div className="absolute -right-6 -bottom-6 opacity-5 pointer-events-none transform scale-150 grayscale">
                {getIconForTitle(e.title, 100)}
              </div>
              
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                {getIconForTitle(e.title, 24)}
              </div>
              
              <div className="flex-1 min-w-0 z-10">
                <p className="font-bold text-base truncate" style={{ color: 'var(--text-primary)' }}>{e.title}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded flex items-center gap-1.5" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                    <Landmark size={12} /> {e.pocket?.name || 'Mặc định'}
                  </span>
                  {e.autoDeduct && (
                    <span className="text-[10px] uppercase font-black tracking-wider text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded">
                      AUTO
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0 z-10">
                <p className="font-black text-pink-400">
                  {formatVND(e.amount)}
                </p>
                <div className="flex gap-1 justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 rounded hover:bg-cyan-500/20 hover:text-cyan-500 transition-colors" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}><Edit2 size={13}/></button>
                  <button onClick={() => handleDelete(e.id)} className="p-1.5 bg-red-500/10 rounded hover:bg-red-500/30 hover:text-red-300 text-red-500 transition-colors"><Trash2 size={13}/></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AddFixedExpenseModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={fetchExpenses} 
      />
    </div>
  );
}
