import { motion } from 'framer-motion';
import PasswordForm from '../settings/PasswordForm';
import DangerZone from '../settings/DangerZone';
import { useAuth } from '../../context/AuthContext';
import { Mail, Smartphone, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  
  const isGoogleAuth = user?.email?.endsWith('@gmail.com');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto flex flex-col pb-10"
    >
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Cài đặt Tài khoản</h1>

      {/* Thông tin Đăng nhập */}
      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl mb-6">
        <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--text-primary)] mb-4">
          <ShieldCheck className="text-green-400" /> Phương thức Đăng nhập
        </h3>
        
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 bg-[var(--bg-base)] border border-[var(--border)] p-4 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Mail size={20} />
            </div>
            <div>
              <p className="font-bold text-[var(--text-primary)]">Email</p>
              <p className="text-sm text-[var(--text-muted)]">{user?.email}</p>
            </div>
            {isGoogleAuth && (
              <span className="ml-auto px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold border border-green-500/30">
                Qua Google
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 bg-[var(--bg-base)] border border-[var(--border)] p-4 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Smartphone size={20} />
            </div>
            <div>
              <p className="font-bold text-[var(--text-primary)]">Số điện thoại</p>
              <p className="text-sm text-[var(--text-muted)]">{user?.phone || 'Chưa liên kết'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Đổi Mật khẩu */}
      <PasswordForm />

      {/* Danger Zone */}
      <DangerZone />

    </motion.div>
  );
}
