import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { Camera, Save, Loader2 } from 'lucide-react';

export default function ProfileHeader() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);

  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  const handleSave = async () => {
    // API logic to save profile
    setLoading(true);
    setTimeout(() => setLoading(false), 800);
  };

  return (
    <div className="glass-card rounded-2xl p-6 border shadow-lg relative overflow-hidden transition-all" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
        {/* Avatar */}
        <div className="relative group cursor-pointer shrink-0">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-lg overflow-hidden">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : initial}
          </div>
          <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Camera className="text-white" />
          </div>
        </div>

        {/* Info Form */}
        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Họ và Tên</label>
            <input 
              value={name} onChange={e => setName(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 outline-none transition-all focus:border-cyan-500"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Email (Khóa)</label>
            <input 
              value={user?.email || ''} disabled
              className="w-full border rounded-xl px-4 py-3 cursor-not-allowed opacity-60"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            />
          </div>
          <div>
             <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Số điện thoại</label>
            <input 
              value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="Chưa cập nhật"
              className="w-full border rounded-xl px-4 py-3 outline-none transition-all focus:border-cyan-500"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex items-end">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.2)] font-black py-3 rounded-xl h-[48px] transition-all"
            >
              {loading ? <Loader2 className="animate-spin text-slate-900" size={18} /> : <><Save size={18} /> Lưu thay đổi</>}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
