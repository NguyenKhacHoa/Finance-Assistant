import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2, Plus, Wallet, Trash2, X, Zap, CheckCircle2, Edit3 } from 'lucide-react';
import { authFetch, useAuth } from '../../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AddJarModal from '../modals/AddJarModal';
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

// ── Custom Tooltip ──────────────────────────────────────────────────────────
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
  const [activePocket, setActivePocket] = useState<Pocket | null>(null);

  // Side Panel edit states
  const [editName, setEditName] = useState('');
  const [editPct, setEditPct] = useState<number | string>('');
  // Preview % dùng để render biểu đồ real-time ngay khi người dùng gõ
  const [previewPct, setPreviewPct] = useState<number | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundSuccess, setFundSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Mở panel — đồng bộ state
  const handleOpenPanel = (pocket: Pocket) => {
    setActivePocket(pocket);
    setEditName(pocket.name);
    setEditPct(pocket.percentage);
    setPreviewPct(null);
    setFundSuccess(false);
  };

  const handleClosePanel = useCallback(() => {
    setActivePocket(null);
    setPreviewPct(null);
  }, []);

  const { data: pockets = [], isLoading: loadingPockets } = useQuery({
    queryKey: ['pockets'],
    queryFn: () => authFetch<Pocket[]>('/pockets', {}, token),
    enabled: !!token,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3000/transactions/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Network error');
      return res.json();
    },
    enabled: !!token,
  });

  const loading = loadingPockets || loadingStats;
  const unallocatedBalance = Number(stats?.unallocatedBalance || 0);

  const realPockets = pockets.filter((p) => p.name !== 'Tiền chưa vào hũ');
  const pocketTotalBalance = realPockets.reduce((sum, p) => sum + Number(p.balance), 0);
  const totalAssets = pocketTotalBalance + unallocatedBalance;

  // ── Biểu đồ: real-time preview khi người dùng đang sửa % ────────────────
  const chartData = (() => {
    const data = realPockets.map((p, i) => {
      // Nếu là pocket đang được edit, dùng previewPct để preview real-time
      const pct = activePocket?.id === p.id && previewPct !== null
        ? previewPct
        : Number(p.percentage);
      return {
        name: p.name,
        balance: Number(p.balance),
        percentage: pct,
        fill: COLORS[i % COLORS.length],
      };
    });
    if (unallocatedBalance > 0) {
      data.push({
        name: 'Chưa phân bổ',
        balance: unallocatedBalance,
        percentage: parseFloat(totalAssets > 0 ? ((unallocatedBalance / totalAssets) * 100).toFixed(1) : '0'),
        fill: '#94a3b8',
      });
    }
    return data;
  })();

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleInitialSetup = async () => {
    try {
      await authFetch<Pocket[]>('/pockets/init', { method: 'POST' }, token);
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePocket = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa hũ này? (Tiền còn trong hũ sẽ đổ về mục Chưa phân bổ)')) return;
    setIsDeleting(id);
    try {
      await authFetch(`/pockets/${id}`, { method: 'DELETE' }, token);
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      if (activePocket?.id === id) handleClosePanel();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa hũ');
    } finally {
      setIsDeleting(null);
    }
  };

  /**
   * Nạp Nhanh: suggestedAmount = unallocatedBalance × (activePocket.percentage / 100)
   * Giới hạn không vượt khoảng còn trống tới maxCapacity
   */
  const handleQuickFund = async () => {
    if (!activePocket) return;
    // Công thức theo spec: unallocatedBalance × (pct / 100)
    const suggested = Math.floor(unallocatedBalance * (activePocket.percentage / 100));
    // Giới hạn không vượt khoảng trống còn lại của hũ
    const maxCap = totalAssets * (activePocket.percentage / 100);
    const gap = Math.max(0, maxCap - Number(activePocket.balance));
    const fundAmount = Math.min(suggested, gap, unallocatedBalance);

    if (fundAmount <= 0) return alert('Không đủ số dư chưa phân bổ hoặc hũ đã đầy');

    setIsFunding(true);
    setFundSuccess(false);
    try {
      await authFetch('/finance/distribute-from-unallocated', {
        method: 'POST',
        body: JSON.stringify({ allocations: [{ pocketId: activePocket.id, amount: fundAmount }] }),
      }, token);
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setActivePocket((prev) => prev ? { ...prev, balance: Number(prev.balance) + fundAmount } : null);
      setFundSuccess(true);
      setTimeout(() => setFundSuccess(false), 2500);
    } catch (err: any) {
      alert(err.message || 'Có lỗi khi nạp nhanh');
    } finally {
      setIsFunding(false);
    }
  };

  /**
   * Save on blur: tự động lưu khi người dùng rời khỏi input percentage
   */
  const handlePctBlur = async () => {
    if (!activePocket) return;
    const newPct = Number(editPct);
    if (newPct < 0 || newPct > 100 || isNaN(newPct)) return;
    if (newPct === activePocket.percentage && editName === activePocket.name) return;
    await handleUpdatePocket();
  };

  const handleNameBlur = async () => {
    if (!activePocket || !editName.trim()) return;
    if (editName === activePocket.name && Number(editPct) === activePocket.percentage) return;
    await handleUpdatePocket();
  };

  const handleUpdatePocket = async () => {
    if (!activePocket) return;
    if (!editName.trim()) return;
    const newPct = Number(editPct);
    if (newPct < 0 || newPct > 100 || isNaN(newPct)) return;

    setIsSaving(true);
    try {
      await authFetch(`/pockets/${activePocket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName, percentage: newPct }),
      }, token);
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
      setActivePocket((prev) => prev ? { ...prev, name: editName, percentage: newPct } : null);
      setPreviewPct(null);
    } catch (err: any) {
      alert(err.message || 'Có lỗi khi lưu');
    } finally {
      setIsSaving(false);
    }
  };

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
            {/* Preview badge */}
            <AnimatePresence>
              {previewPct !== null && activePocket && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-6 right-6 px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1"
                  style={{ background: 'rgba(var(--primary-rgb),0.12)', color: 'var(--primary)', border: '1px solid rgba(var(--primary-rgb),0.25)' }}
                >
                  <Edit3 size={10} /> Preview {previewPct}%
                </motion.div>
              )}
            </AnimatePresence>
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
                  onClick={() => handleOpenPanel(p)}
                  className={`bg-[var(--bg-surface)] border ${activePocket?.id === p.id ? 'border-[var(--primary)] shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-[var(--primary)]' : 'border-[var(--border)] hover:bg-[var(--bg-base)]'} rounded-2xl p-5 flex items-center justify-between transition-all cursor-pointer group`}
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
                    <div className="w-24 h-1.5 bg-[var(--bg-base)] rounded-full mt-2 overflow-hidden mb-1">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.percentage)}%`, background: displayColor }} />
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

      {/* ══════════════════════════════════════════════════
          SIDE PANEL (Drawer) — framer-motion
      ══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {activePocket && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClosePanel}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />

            {/* Drawer slides from right */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-[420px] z-50 flex flex-col shadow-2xl border-l overflow-y-auto"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            >
              {/* ── Header ── */}
              <div className="p-6 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Chi Tiết Hũ</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Nhấp bên ngoài để đóng</p>
                </div>
                <button
                  onClick={handleClosePanel}
                  className="p-2 rounded-xl bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 flex-1 flex flex-col gap-7">

                {/* ── 1. Số dư & Max Capacity ── */}
                {(() => {
                  const maxCapacity = totalAssets * (activePocket.percentage / 100);
                  const currentBalance = Number(activePocket.balance);
                  const fill = maxCapacity > 0 ? Math.min(100, (currentBalance / maxCapacity) * 100) : 0;
                  const isFull = fill >= 100;
                  return (
                    <div
                      className="p-6 rounded-2xl flex flex-col items-center justify-center border relative overflow-hidden"
                      style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}
                    >
                      {/* Fill bar at bottom */}
                      <div
                        className="absolute bottom-0 left-0 h-1 transition-all duration-700 rounded-b"
                        style={{ width: `${fill}%`, background: isFull ? '#f87171' : 'var(--primary)' }}
                      />
                      <p className="text-xs uppercase font-bold tracking-widest text-[var(--text-muted)] mb-2">Số dư hiện tại</p>
                      <p className="text-3xl font-black text-[var(--primary)]">{formatVND(currentBalance)}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <div
                          className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border"
                          style={{
                            background: isFull ? 'rgba(248,113,113,0.08)' : 'var(--bg-surface)',
                            borderColor: isFull ? 'rgba(248,113,113,0.3)' : 'var(--border)',
                            color: isFull ? '#f87171' : 'var(--text-muted)',
                          }}
                        >
                          {isFull ? '🔴' : '🎯'} Tối đa: {formatVND(maxCapacity)}
                        </div>
                        <div
                          className="text-xs font-bold px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(var(--primary-rgb),0.1)', color: 'var(--primary)' }}
                        >
                          {fill.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── 2. Nạp Nhanh (Nạp Siêu Tốc) ── */}
                <div className="space-y-3">
                  <h3 className="font-bold text-sm tracking-wide flex items-center gap-2 text-[var(--text-primary)]">
                    <Zap size={16} className="text-yellow-400" /> Nạp Siêu Tốc
                  </h3>
                  <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 space-y-3">
                    {/* Công thức: suggestedAmount = unallocatedBalance × (pct/100) */}
                    {(() => {
                      const suggested = Math.floor(unallocatedBalance * (activePocket.percentage / 100));
                      const maxCap = totalAssets * (activePocket.percentage / 100);
                      const gap = Math.max(0, maxCap - Number(activePocket.balance));
                      const fundAmount = Math.min(suggested, gap, unallocatedBalance);
                      const isFull = gap <= 0;
                      const isAble = fundAmount > 0 && unallocatedBalance > 0 && !isFull;

                      return (
                        <>
                          <div className="text-[11px] text-[var(--text-muted)] leading-relaxed space-y-1">
                            <p>
                              Gợi ý: <span className="font-bold text-yellow-400">{formatVND(suggested)}</span>
                              <span className="text-[10px]"> = {formatVND(unallocatedBalance)} × {activePocket.percentage}%</span>
                            </p>
                            {!isFull && gap < suggested && (
                              <p className="text-sky-400 text-[10px]">
                                (Hũ còn trống {formatVND(gap)}, sẽ nạp {formatVND(fundAmount)})
                              </p>
                            )}
                            {isFull && (
                              <p className="text-red-400 text-[10px] font-bold">Hũ đã đầy theo tỷ lệ {activePocket.percentage}%</p>
                            )}
                          </div>

                          <AnimatePresence>
                            {fundSuccess && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2 text-xs font-bold text-emerald-400 justify-center py-1"
                              >
                                <CheckCircle2 size={14} /> Nạp thành công!
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <button
                            onClick={handleQuickFund}
                            disabled={!isAble || isFunding}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                            style={
                              isAble
                                ? { background: 'var(--primary)', color: '#000' }
                                : { background: 'var(--bg-base)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                            }
                          >
                            {isFunding ? (
                              <span className="flex items-center gap-2 mx-auto">
                                <Loader2 size={16} className="animate-spin" /> Đang xử lý...
                              </span>
                            ) : (
                              <>
                                <span>{isFull ? 'Hũ đã đầy' : 'Nạp ngay'}</span>
                                <span>{isAble ? `+ ${formatVND(fundAmount)}` : '+ 0 ₫'}</span>
                              </>
                            )}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* ── 3. Chỉnh sửa Tỷ lệ & Tên (Save on blur) ── */}
                <div className="space-y-4">
                  <h3 className="font-bold text-sm tracking-wide text-[var(--text-primary)] border-b pb-2 flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                    <Edit3 size={14} /> Cài đặt Thông số
                    {isSaving && <Loader2 size={12} className="animate-spin text-[var(--primary)] ml-auto" />}
                  </h3>

                  {/* Tên hũ */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase ml-1">Tên Hũ</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={handleNameBlur}
                      className="w-full bg-[var(--bg-base)] border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[var(--primary)] transition-colors"
                      style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                    />
                  </div>

                  {/* Tỷ lệ % — Real-time preview biểu đồ + Save on blur */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase ml-1">
                      Mục tiêu quy mô (%)
                      {previewPct !== null && (
                        <span className="ml-2 text-[var(--primary)] normal-case">— Preview đang cập nhật biểu đồ</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editPct}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditPct(val);
                          const numVal = Number(val);
                          if (!isNaN(numVal) && numVal >= 0 && numVal <= 100) {
                            setPreviewPct(numVal); // real-time preview biểu đồ
                          }
                        }}
                        onBlur={handlePctBlur}
                        className="w-full bg-[var(--bg-base)] border rounded-xl px-4 py-3 pr-10 text-sm font-bold outline-none focus:border-[var(--primary)] transition-colors"
                        style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold">%</span>
                    </div>
                    {/* Preview Max Capacity with new % */}
                    {previewPct !== null && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[11px] text-[var(--text-muted)] ml-1"
                      >
                        Max Capacity mới: <span className="font-bold text-[var(--primary)]">{formatVND(totalAssets * (previewPct / 100))}</span>
                      </motion.p>
                    )}
                  </div>

                  {/* Nút lưu thủ công (vẫn giữ để backup) */}
                  <button
                    onClick={handleUpdatePocket}
                    disabled={isSaving || (editName === activePocket.name && Number(editPct) === activePocket.percentage)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm transition-colors disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Lưu Thay Đổi
                  </button>
                </div>
              </div>

              {/* ── Delete zone ── */}
              {!activePocket.isEssential && (
                <div className="p-6 border-t mt-auto shrink-0" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-[11px] text-red-400/70 mb-2">Số dư còn lại sẽ tự động hoàn về Tiền nhàn rỗi.</p>
                  <button
                    onClick={() => handleDeletePocket(activePocket.id)}
                    disabled={isDeleting === activePocket.id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-colors disabled:opacity-40"
                  >
                    {isDeleting === activePocket.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    Xóa Hũ Này
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
