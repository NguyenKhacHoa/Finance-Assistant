import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { KeyRound, Loader2 } from 'lucide-react';
import { api } from '../../services/api.service';
import toast from 'react-hot-toast';

export default function PasswordForm() {
  const { token } = useAuth();
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 6) {
      toast.error('Mật khẩu mới phải từ 6 ký tự trở lên.');
      return;
    }
    if (newPass !== confirmPass) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/profile/change-password', { oldPass, newPass }, token);
      toast.success('Đổi mật khẩu thành công!');
      setOldPass(''); setNewPass(''); setConfirmPass('');
    } catch (e: any) {
      // Error handled by api.service toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl mb-6">
      <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--text-primary)] mb-6">
        <KeyRound className="text-sky-400" /> Đổi Mật Khẩu
      </h3>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Mật khẩu hiện tại</label>
            <input 
              type="password" required value={oldPass} onChange={e => setOldPass(e.target.value)}
              aria-label="Mật khẩu hiện tại"
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-sky-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Mật khẩu mới</label>
            <input 
              type="password" required value={newPass} onChange={e => setNewPass(e.target.value)}
              aria-label="Mật khẩu mới"
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-sky-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Xác nhận mật khẩu mới</label>
            <input 
              type="password" required value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              aria-label="Xác nhận mật khẩu mới"
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-sky-500/50 transition-all"
            />
          </div>
          <button 
            type="submit" disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 hover:scale-[1.01] active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Cập nhật Mật khẩu'}
          </button>
        </form>
    </div>
  );
}
