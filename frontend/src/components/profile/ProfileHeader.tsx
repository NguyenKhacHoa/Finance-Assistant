import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { Camera, Save, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ProfileHeader() {
  const { user, updateProfile } = useAuth();
  
  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loadingProfile, setLoadingProfile] = useState(false);
  
  // Alerts
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  // Sync state if user changes globally
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const showMsg = (type: 'err' | 'ok', msg: string) => {
    if (type === 'err') {
      setErr(msg); setOk('');
    } else {
      setOk(msg); setErr('');
    }
    setTimeout(() => { setErr(''); setOk(''); }, 5000);
  };

  const handleSaveProfile = async () => {
    try {
      const PHONE_REGEX = /^(0|\+84)(3[2-9]|5[6-9]|7[06-9]|8[1-9]|9[0-9])\d{7}$/;
      if (phone && !PHONE_REGEX.test(phone)) {
        showMsg('err', 'Số điện thoại không đúng định dạng Việt Nam.');
        return;
      }
      if (name.trim().length < 2) {
        showMsg('err', 'Họ và tên quá ngắn.');
        return;
      }

      setLoadingProfile(true);
      await updateProfile({ name, phone });
      showMsg('ok', 'Cập nhật hồ sơ thành công!');
    } catch (e: any) {
      showMsg('err', e.message || 'Lỗi cập nhật hồ sơ');
    } finally {
      setLoadingProfile(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Messages */}
      <AnimatePresence>
        {err && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="font-medium pt-0.5">{err}</span>
          </motion.div>
        )}
        {ok && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-sm flex items-start gap-3">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium pt-0.5">{ok}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-card rounded-2xl p-6 border shadow-lg relative overflow-hidden transition-all" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col md:flex-row gap-8 items-start">
          
          {/* Avatar */}
          <div className="flex flex-col items-center gap-4 shrink-0">
            <div className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-lg overflow-hidden">
                {user?.avatarUrl ? <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : initial}
              </div>
              <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="text-white w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Info Form */}
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Họ và Tên</label>
              <input 
                value={name} onChange={e => setName(e.target.value)}
                className="w-full border rounded-xl px-4 py-3 outline-none transition-all focus:border-cyan-500 text-sm"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Email (Khóa)</label>
              <input 
                value={user?.email || ''} disabled
                className="w-full border rounded-xl px-4 py-3 cursor-not-allowed opacity-60 text-sm"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              />
            </div>
            <div>
               <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Số điện thoại</label>
              <input 
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="Chưa cập nhật"
                className="w-full border rounded-xl px-4 py-3 outline-none transition-all focus:border-cyan-500 text-sm"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex items-end">
              <motion.button 
                whileTap={{ scale: 0.97 }}
                onClick={handleSaveProfile}
                disabled={loadingProfile}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-[0_4px_15px_rgba(34,211,238,0.3)] font-bold py-3 rounded-xl h-[48px] transition-all disabled:opacity-70"
              >
                {loadingProfile ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Lưu Thay Đổi</>}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
