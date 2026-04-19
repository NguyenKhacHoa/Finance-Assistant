import { useState } from 'react';
import { useAuth, authFetch, clearAllClientState } from '../../context/AuthContext';
import { TriangleAlert, Trash2, Loader2, AlertCircle, ShieldX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';

export default function DangerZone() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Gọi backend xóa tài khoản và toàn bộ dữ liệu
      await authFetch('/profile/account', { method: 'DELETE' }, token);

      // 2. Xóa sạch toàn bộ trạng thái client TRƯỚC KHI logout
      //    - localStorage (token, notifications, v.v.)
      //    - sessionStorage
      //    - notificationBus cache
      //    - React Query cache (toàn bộ data cũ)
      clearAllClientState({ queryClientRef: queryClient });

      // 3. Reset React Context (user, token state)
      logout();

      // 4. Chuyển về login
      navigate('/login', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Có lỗi xảy ra khi xóa tài khoản. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-3xl p-6 border mt-6"
      style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2">
        <ShieldX size={20} className="text-red-500" />
        <h3 className="text-lg font-bold text-red-500">Vùng Nguy Hiểm</h3>
      </div>
      <p className="text-sm mb-6" style={{ color: 'rgba(239,68,68,0.7)' }}>
        Xóa tài khoản sẽ xóa vĩnh viễn toàn bộ dữ liệu: Giao dịch, Hũ tài chính, Mục tiêu,
        Huy hiệu và tất cả thông tin cá nhân.{' '}
        <strong className="text-red-500">Hành động này không thể hoàn tác.</strong>
      </p>

      <AnimatePresence mode="wait">
        {!showConfirm ? (
          <motion.button
            key="show-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowConfirm(true); setError(null); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border hover:bg-red-500/10"
            style={{ borderColor: 'rgba(239,68,68,0.35)', color: '#ef4444' }}
          >
            <Trash2 size={16} /> Xóa Tài Khoản
          </motion.button>
        ) : (
          <motion.div
            key="confirm-panel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl p-5 border space-y-4"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}
          >
            <div className="flex items-start gap-3">
              <TriangleAlert size={18} className="text-red-500 mt-0.5 shrink-0" />
              <p className="font-bold text-sm text-red-400">
                Bạn có CHẮC CHẮN muốn xóa vĩnh viễn tài khoản và toàn bộ dữ liệu không?
              </p>
            </div>

            {/* Inline error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2.5 p-3 rounded-xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all disabled:opacity-60"
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Đang xóa...</>
                  : <><Trash2 size={16} /> Vâng, xóa ngay</>
                }
              </button>
              <button
                onClick={() => { setShowConfirm(false); setError(null); }}
                disabled={loading}
                className="inline-flex items-center px-5 py-2.5 rounded-xl font-bold text-sm transition-all border disabled:opacity-50"
                style={{
                  background: 'var(--bg-base)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                Hủy
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
