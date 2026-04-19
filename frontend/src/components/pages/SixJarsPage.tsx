import { useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2, Plus, Wallet, Pencil, Trash2 } from 'lucide-react';
import { authFetch, useAuth } from '../../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AddJarModal from '../modals/AddJarModal';
import EditJarModal from '../modals/EditJarModal';
import { useNavigate } from 'react-router-dom';
import { formatVND } from '../../utils/format';

interface Pocket {
  id: string;
  name: string;
  balance: number;
  percentage: number;
  isEssential: boolean;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

// Customize Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-3 rounded-xl shadow-xl">
        <p className="font-bold text-sm text-[var(--text-primary)]">{data.name}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Số dư: <span className="font-bold text-[var(--primary)]">{formatVND(data.balance)}</span>
        </p>
        <p className="text-xs text-[var(--text-muted)]">Tỷ lệ: {data.percentage}%</p>
      </div>
    );
  }
  return null;
};

export default function SixJarsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPocket, setEditingPocket] = useState<Pocket | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const { data: pockets = [], isLoading: loadingPockets } = useQuery({
    queryKey: ['pockets'],
    queryFn: () => authFetch<Pocket[]>('/pockets', {}, token),
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

  const loading = loadingPockets || loadingStats;
  const unallocatedBalance = stats?.unallocatedBalance || 0;

  const handleInitialSetup = async () => {
    try {
      await authFetch<Pocket[]>('/pockets/init', { method: 'POST' }, token);
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
    } catch(err) {
      console.error(err);
    }
  };

  const handleDeletePocket = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa hũ này? (Chỉ có thể xóa nếu số dư bằng 0)')) return;

    setIsDeleting(id);
    try {
      await authFetch(`/pockets/${id}`, { method: 'DELETE' }, token);
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa hũ');
    } finally {
      setIsDeleting(null);
    }
  };

  const realPockets = pockets.filter(p => p.name !== 'Tiền chưa vào hũ');

  // "Tổng Số Dư Các Hũ" chỉ tính từ pockets thật, KHÔNG cộng unallocatedBalance
  const pocketTotalBalance = realPockets.reduce((sum, p) => sum + Number(p.balance), 0);

  // "Tổng tài sản" (trung tâm biểu đồ) = pockets + tiền chưa vào hũ
  const totalAssets = pocketTotalBalance + unallocatedBalance;

  // Biểu đồ tròn: mỗi hũ thật + phần "Chưa phân bổ" từ số dư thực tế
  let chartData: any[] = realPockets.map((p) => ({
    name: p.name,
    balance: Number(p.balance),
    percentage: Number(p.percentage),
    fill: undefined // defaults to cycle via colors array
  }));

  // Phần "Chưa phân bổ" trong biểu đồ = unallocatedBalance thực tế (từ backend)
  if (unallocatedBalance > 0) {
    chartData.push({
      name: 'Chưa phân bổ',
      balance: unallocatedBalance,
      percentage: parseFloat(totalAssets > 0 ? ((unallocatedBalance / totalAssets) * 100).toFixed(1) : '0'),
      fill: '#94a3b8' // Muted grey color for unallocated
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-6xl mx-auto flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Mô Hình Hũ Tài Chính</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Phân bổ tài sản hợp lý theo phương pháp Jars.</p>
        </div>
        <div className="flex gap-3">
          <motion.button
            onClick={() => navigate('/deposit')}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-base)]"
          >
            <Wallet size={16} /> Nạp Tiền
          </motion.button>
          <motion.button
            onClick={() => setIsAddModalOpen(true)}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[var(--primary)]"
            style={{ color: '#050d18' }}
          >
            <Plus size={16} /> Tạo Hũ Mới
          </motion.button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 min-h-[400px]">
          <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
        </div>
      ) : realPockets.length === 0 && unallocatedBalance === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center bg-[var(--bg-surface)] rounded-3xl border border-[var(--border)]">
          <Wallet size={48} className="text-[var(--text-muted)] opacity-50 mb-4" />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Chưa có hũ nào</h3>
          <p className="text-sm text-[var(--text-muted)] mt-1 mb-6">Bạn chưa thiết lập hệ thống hũ tài chính.</p>
          <button onClick={handleInitialSetup} className="px-6 py-2.5 rounded-xl bg-[var(--primary)] text-black font-bold text-sm">Thiết lập ngay</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart Section */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-6 flex flex-col items-center justify-center min-h-[400px] relative">
            <h3 className="text-sm font-bold text-[var(--text-muted)] absolute top-6 left-6">Cơ cấu Tài sản Thực tế</h3>
            <div className="w-full h-[320px] mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} />
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={3}
                    dataKey="balance"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center flex-col mt-4">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Tổng tài sản</p>
              <p className="text-xl font-black text-[var(--text-primary)] mt-0.5">
                {formatVND(totalAssets)}
              </p>
            </div>
          </div>

          {/* Jars List */}
          <div className="flex flex-col gap-3">
            {/* Summary bar: tách biệt Tổng Hũ vs Tiền Chưa Vào Hũ */}
            <div className="grid grid-cols-2 gap-3 mb-1">
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Tổng Số Dư Các Hũ</p>
                <p className="text-base font-black mt-1 text-[var(--primary)]">{formatVND(pocketTotalBalance)}</p>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Tiền Chưa Vào Hũ</p>
                <p className="text-base font-black mt-1 text-yellow-400">{formatVND(unallocatedBalance)}</p>
              </div>
            </div>
            {realPockets.map((p, i) => {
              const displayColor = COLORS[i % COLORS.length];
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 flex items-center justify-between hover:bg-[var(--bg-base)] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${displayColor}15` }}>
                      <Wallet size={20} style={{ color: displayColor }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                        {p.name}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Mục tiêu: {p.percentage}% {p.isEssential && '· Thiết yếu'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="font-black text-lg text-[var(--text-primary)]">
                       {formatVND(Number(p.balance))}
                    </p>
                    <div className="w-24 h-1.5 bg-[var(--bg-base)] rounded-full mt-2 overflow-hidden mb-3">
                      <div className="h-full rounded-full" style={{ width: `${p.percentage}%`, background: displayColor }} />
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingPocket(p); }}
                        className="p-1.5 rounded-lg bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-sky-400 transition-colors"
                        title="Sửa hũ"
                      >
                        <Pencil size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleDeletePocket(e, p.id)}
                        disabled={isDeleting === p.id}
                        className="p-1.5 rounded-lg bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Xóa hũ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <AddJarModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['pockets'] }); queryClient.invalidateQueries({ queryKey: ['stats'] }); }} 
      />

      <EditJarModal 
        isOpen={!!editingPocket} 
        onClose={() => setEditingPocket(null)} 
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['pockets'] }); queryClient.invalidateQueries({ queryKey: ['stats'] }); }} 
        pocket={editingPocket}
      />
    </motion.div>
  );
}
