import { useState } from 'react';
import { useAuth, authFetch } from '../../context/AuthContext';
import { TriangleAlert, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DangerZone() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await authFetch('/profile/account', { method: 'DELETE' }, token);
      logout();
      navigate('/login');
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-red-950/20 backdrop-blur-md rounded-3xl p-6 border border-red-500/20 shadow-xl mt-6">
      <h3 className="text-lg font-bold flex items-center gap-2 text-red-500 mb-2">
        <TriangleAlert className="text-red-500" /> Vùng Nguy Hiểm (Danger Zone)
      </h3>
      <p className="text-sm text-red-400/80 mb-6">
        Khi bạn xóa tài khoản, toàn bộ dữ liệu tài chính (Giao dịch, Hũ, Huy hiệu...) sẽ bị xóa vĩnh viễn và không thể khôi phục.
      </p>

      {!showConfirm ? (
        <button 
          onClick={() => setShowConfirm(true)}
          className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 font-bold px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2"
        >
          <Trash2 size={18} /> Xóa Tài Khoản
        </button>
      ) : (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
          <p className="font-bold text-red-400 mb-4">Bạn có CHẮC CHẮN muốn xóa vĩnh viễn không?</p>
          <div className="flex gap-3">
            <button 
              onClick={handleDelete} disabled={loading}
              className="bg-red-500 text-white font-bold px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : 'Vâng, Xóa ngay'}
            </button>
            <button 
              onClick={() => setShowConfirm(false)}
              className="bg-white/10 text-white font-bold px-6 py-2 rounded-lg hover:bg-white/20"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
