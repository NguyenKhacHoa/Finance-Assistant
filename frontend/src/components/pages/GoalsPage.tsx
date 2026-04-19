import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, Star, Car, Plane, Home as HomeIcon, Gamepad2, Laptop, Smartphone, Settings2 } from 'lucide-react';
import { formatVND } from '../../utils/format';
import { authFetch, useAuth } from '../../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NumericFormat } from 'react-number-format';
import AddGoalModal from '../modals/AddGoalModal';
import EditGoalModal from '../modals/EditGoalModal';

const ICONS: Record<string, any> = {
  Target: Target,
  Star: Star,
  Home: HomeIcon,
  Car: Car,
  Plane: Plane,
  Gamepad2: Gamepad2,
  Laptop: Laptop,
  Smartphone: Smartphone,
};

export default function GoalsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any | null>(null);

  // Funding states
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});

  const { data: activeGoals = [], isLoading: loadingGoals } = useQuery({
    queryKey: ['goals'],
    queryFn: () => authFetch<any[]>('/gamification/goals', {}, token),
    enabled: !!token,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3000/transactions/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Network error');
      return res.json();
    },
    enabled: !!token,
  });

  const isLoading = loadingGoals || loadingStats;
  const unallocatedBalance = stats?.unallocatedBalance || 0;

  const handleFundGoal = async (id: string, amount: number) => {
    if (amount <= 0 || amount > unallocatedBalance) return;
    
    try {
      await authFetch('/gamification/goals/fund', {
        method: 'POST',
        body: JSON.stringify({ goalId: id, amount })
      }, token);
      await authFetch('/gamification/evaluate', { method: 'POST' }, token);
      
      // Cleanup field and refresh
      setCustomAmounts(prev => ({ ...prev, [id]: 0 }));
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    } catch (e) { console.error(e); }
  };

  const handleCustomAmountChange = (id: string, value: number) => {
      setCustomAmounts(prev => ({ ...prev, [id]: value }));
  };

  const getCustomAmountNumber = (id: string) => {
     return customAmounts[id] || 0;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-6xl mx-auto space-y-8 pb-12"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Mục Tiêu Tài Chính
          </h1>
          <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
            Thiết lập và theo dõi tiến độ các mục tiêu gom tiền của bạn
          </p>
        </div>
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
             <Target size={20} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-600/70">Số dư "Chưa Phân Bổ"</p>
            <p className="text-lg font-black text-yellow-500">{formatVND(unallocatedBalance)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        
        {/* Header Action */}
        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Target size={18} style={{ color: 'var(--primary)' }} /> Quản Lý Mục Tiêu
          </h2>
          <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all hover:brightness-110 active:scale-95 shadow-xl"
              style={{ background: 'var(--primary)', color: '#000' }}
          >
              <Plus size={16} /> Tạo Mục Tiêu Mới
          </button>
        </div>

        {/* Goal List */}
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          <AnimatePresence mode="popLayout">
            {activeGoals.map((g) => {
              const current = Number(g.currentAmount ?? 0);
              const target = Number(g.targetAmount ?? 1);
              const pct = Math.min(100, Math.round((current / target) * 100));
              const isDone = g.status === 'COMPLETED';
              const daysLeft = g.deadline ? Math.max(0, Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000)) : null;

              const activeCustomAmount = getCustomAmountNumber(g.id);
              const customNotEnough = activeCustomAmount > unallocatedBalance;

              const IconComponent = ICONS[g.icon || 'Target'] || Target;

              return (
                <motion.div
                  layout key={g.id}
                  initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="p-6 flex flex-col gap-3 hover:bg-white/[0.02] transition-colors relative group"
                >
                  <button 
                    onClick={() => setEditingGoal(g)}
                    className="absolute top-6 right-6 p-2 rounded-xl text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--bg-base)] hover:text-[var(--primary)]"
                    title="Chỉnh sửa mục tiêu"
                  >
                     <Settings2 size={18} />
                  </button>

                  <div className="flex items-start justify-between pr-12">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-base)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]">
                            <IconComponent size={24} />
                        </div>
                        <div>
                        <h4 
                            onClick={() => setEditingGoal(g)}
                            className="font-bold text-lg cursor-pointer hover:underline" style={{ color: 'var(--text-primary)' }}
                        >
                            {g.title}
                        </h4>
                        <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                            {isDone ? '🌟 Đã hoàn thành' : daysLeft !== null ? `📅 Còn ${daysLeft} ngày` : 'Mục tiêu không kỳ hạn'}
                        </p>
                        </div>
                    </div>
                    <span className={`text-xl font-black ${isDone ? 'text-emerald-400' : ''}`} style={!isDone ? { color: 'var(--primary)' } : {}}>
                      {pct}%
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full overflow-hidden mt-2" style={{ background: 'var(--border)' }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${isDone ? 'bg-emerald-400' : 'bg-[var(--primary)]'}`}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{formatVND(current)}</span>
                      {' / '}{formatVND(target)}
                    </span>
                    {isDone && (
                      <div className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20">
                        Hoàn thành
                      </div>
                    )}
                  </div>
                  
                  {!isDone && (
                    <div className="mt-3 pt-4 border-t border-dashed" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 mb-3">
                          <NumericFormat 
                            value={customAmounts[g.id] || ''}
                            onValueChange={(values) => handleCustomAmountChange(g.id, values.floatValue || 0)}
                            thousandSeparator="."
                            decimalSeparator=","
                            suffix=" VND"
                            allowNegative={false}
                            placeholder="Nhập số tiền VNĐ..."
                            className="flex-1 max-w-[200px] px-3 py-2 rounded-xl text-sm outline-none border transition-colors"
                            style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: customNotEnough ? '#ef4444' : 'var(--border)' }}
                          />
                          <button
                            onClick={() => handleFundGoal(g.id, activeCustomAmount)}
                            disabled={activeCustomAmount <= 0 || customNotEnough}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'var(--primary)', color: '#000' }}
                            title={customNotEnough ? 'Bạn không đủ số dư Chưa phân bổ để thực hiện' : ''}
                          >
                            Nạp
                          </button>
                          {customNotEnough && (
                            <span className="text-xs text-red-500 font-medium">Không đủ số dư</span>
                          )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                          {[50000, 100000, 200000, 500000].map(amt => {
                            const notEnough = amt > unallocatedBalance;
                            return (
                              <button
                                key={amt}
                                onClick={() => handleFundGoal(g.id, amt)}
                                disabled={notEnough}
                                title={notEnough ? 'Bạn không đủ số dư để thực hiện' : `Nạp nhanh ${amt / 1000}k`}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border outline-none disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-base)] focus:bg-[var(--bg-base)] active:bg-[var(--bg-base)]"
                                style={{ 
                                  background: 'transparent', 
                                  color: 'var(--text-primary)', 
                                  borderColor: 'var(--border)' 
                                }}
                              >
                                +{amt / 1000}k
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {activeGoals.length === 0 && !isLoading && (
            <div className="py-16 text-center">
              <Target size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Chưa có mục tiêu nào. Hãy tạo mục tiêu đầu tiên!</p>
            </div>
          )}
        </div>
      </div>

      <AddGoalModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['goals'] }); queryClient.invalidateQueries({ queryKey: ['stats'] }); }} 
      />

      <EditGoalModal 
        goal={editingGoal} 
        onClose={() => setEditingGoal(null)} 
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['goals'] }); queryClient.invalidateQueries({ queryKey: ['stats'] }); queryClient.invalidateQueries({ queryKey: ['pockets'] }); }} 
      />
    </motion.div>
  );
}
