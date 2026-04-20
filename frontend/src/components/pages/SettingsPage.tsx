import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PasswordForm from '../settings/PasswordForm';
import DangerZone from '../settings/DangerZone';
import { useAuth, authFetch } from '../../context/AuthContext';
import { Mail, Smartphone, ShieldCheck, User, Save, Loader2, CheckCircle, AlertTriangle, Lock, X, QrCode } from 'lucide-react';

export default function SettingsPage() {
  const { user, updateProfile, token, refreshMe } = useAuth();
  
  const isGoogleAuth = !!user?.googleId;
  const hasPassword = !!user?.hasPassword;
  const isPhoneAuth = !isGoogleAuth && !hasPassword && !!user?.phone;

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phonePass, setPhonePass] = useState('');

  // ---------- 2FA States ----------
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const is2FA = !!user?.twoFactorEnabled;

  // Sync state if user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const showMsg = (type: 'err' | 'ok', msg: string) => {
    if (type === 'err') { setErr(msg); setOk(''); }
    else { setOk(msg); setErr(''); }
    setTimeout(() => { setErr(''); setOk(''); }, 5000);
  };

  const handleUpdateInfo = async () => {
    if (name.trim().length < 2) {
      showMsg('err', 'Họ và tên phải có ít nhất 2 ký tự.');
      return;
    }
    const PHONE_REGEX = /^(0|\+84)(3[2-9]|5[6-9]|7[06-9]|8[1-9]|9[0-9])\d{7}$/;
    if (phone && !PHONE_REGEX.test(phone)) {
      showMsg('err', 'Số điện thoại không đúng định dạng Việt Nam.');
      return;
    }
    
    // Yêu cầu mật khẩu nếu sửa số ĐT & là tài khoản có Pass
    if (phone !== user?.phone && hasPassword) {
      setShowPhoneModal(true);
      return;
    }

    await performUpdate();
  };

  const performUpdate = async (password?: string) => {
    try {
      setLoading(true);
      await updateProfile({ name, phone, currentPassword: password });
      showMsg('ok', password ? 'Số điện thoại đã được cập nhật bảo mật thành công' : 'Cập nhật thông tin thành công!');
      setShowPhoneModal(false);
      setPhonePass('');
    } catch (e: any) {
      showMsg('err', e.message || 'Mật khẩu xác nhận không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle2FA = async (enable: boolean) => {
    if (enable) {
      try {
        setLoading(true);
        const res = await authFetch<{qrCode: string, secret: string}>('/auth/2fa/generate', { method: 'POST' }, token);
        setQrCode(res.qrCode);
        setIs2faModalOpen(true);
      } catch(e: any) {
        showMsg('err', e.message);
      } finally {
        setLoading(false);
      }
    } else {
      try {
        setLoading(true);
        await authFetch('/auth/2fa/disable', { method: 'POST' }, token);
        await refreshMe();
        showMsg('ok', 'Đã tắt bảo mật 2 lớp.');
      } catch(e: any) {
        showMsg('err', e.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleVerify2FA = async () => {
    try {
      setLoading(true);
      await authFetch('/auth/2fa/enable', { 
        method: 'POST', 
        body: JSON.stringify({ token: otpInput }) 
      }, token);
      await refreshMe();
      showMsg('ok', 'Kích hoạt bảo mật 2 lớp thành công!');
      setIs2faModalOpen(false);
    } catch(e: any) {
      showMsg('err', e.message);
    } finally {
      setLoading(false);
      setOtpInput('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto flex flex-col pb-10 gap-6"
    >
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Cài đặt Tài khoản</h1>

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

      {/* Thông tin Cá nhân */}
      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl">
        <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--text-primary)] mb-4">
          <User className="text-blue-400" /> Thông tin Cá nhân
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] pl-1">Họ và Tên</label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Nhập họ và tên..."
                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl py-3 pl-12 pr-4 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] pl-1">Số điện thoại</label>
            <div className="relative">
              <Smartphone className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="09xx..."
                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl py-3 pl-12 pr-4 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={handleUpdateInfo}
            disabled={loading || (name === user?.name && phone === (user?.phone || ''))}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Cập nhật
          </motion.button>
        </div>
      </div>

      {/* Thông tin Đăng nhập */}
      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl">
        <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--text-primary)] mb-4">
          <ShieldCheck className="text-green-400" /> Phương thức Đăng nhập
        </h3>
        
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-[var(--bg-base)] border border-[var(--border)] p-4 rounded-xl">
            <div className="flex items-center gap-4 flex-1">
              <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${isGoogleAuth ? 'bg-blue-500/10 text-blue-400' : isPhoneAuth ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {isGoogleAuth ? <ShieldCheck size={20} /> : isPhoneAuth ? <Smartphone size={20} /> : <Mail size={20} />}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[var(--text-primary)]">
                  {isPhoneAuth ? 'Số điện thoại đăng nhập' : 'Email đăng nhập'}
                </p>
                <p className="text-sm text-[var(--text-muted)] truncate">
                  {isPhoneAuth ? user?.phone : user?.email}
                </p>
              </div>
            </div>
            <div className={`sm:ml-auto px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit border ${
              isGoogleAuth 
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                : isPhoneAuth
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}>
              {isGoogleAuth ? <ShieldCheck size={12} /> : isPhoneAuth ? <Smartphone size={12} /> : <Mail size={12} />}
              {isGoogleAuth ? 'Tài khoản Google' : isPhoneAuth ? 'Tài khoản Số điện thoại' : 'Tài khoản Mật khẩu'}
            </div>
          </div>
        </div>
      </div>

      {/* Đổi Mật khẩu */}
      {hasPassword && <PasswordForm />}

      {/* Bảo mật nâng cao (2FA) */}
      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl mb-6">
        <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--text-primary)] mb-6">
          <QrCode className="text-indigo-400" /> Bảo mật Nâng cao
        </h3>
        <div className="flex items-center justify-between bg-[var(--bg-base)] border border-[var(--border)] p-4 rounded-xl">
          <div className="min-w-0 pr-4">
            <h4 className="font-bold text-sm text-[var(--text-primary)]">Xác thực 2 yếu tố (2FA)</h4>
            <p className="text-xs text-[var(--text-muted)] mt-1 hidden sm:block">Bảo vệ tài khoản với một mã xác nhận sinh ngẫu nhiên từ ứng dụng Authenticator.</p>
          </div>
          <button 
            disabled={loading}
            onClick={() => handleToggle2FA(!is2FA)}
            className={`w-12 h-6 rounded-full flex items-center transition-colors shrink-0 disabled:opacity-50 ${is2FA ? 'bg-indigo-500' : 'bg-gray-500'} px-1`}
          >
            <motion.div 
              layout transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`w-4 h-4 bg-white rounded-full ${is2FA ? 'ml-auto' : 'mr-auto'}`}
            />
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <DangerZone />

      {/* Modal báo mật khẩu đối với số điện thoại */}
      <AnimatePresence>
        {showPhoneModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 rounded-3xl shadow-2xl max-w-sm w-full relative"
            >
              <button 
                onClick={() => { setShowPhoneModal(false); setPhonePass(''); }}
                className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4 border border-amber-500/20">
                <Lock size={24} />
              </div>
              
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Bảo mật thông tin</h3>
              <p className="text-sm text-[var(--text-muted)] mb-5">
                Nhập mật khẩu của bạn để xác nhận thay đổi số điện thoại.
              </p>
              
              <input 
                type="password"
                placeholder="Mật khẩu của bạn"
                value={phonePass}
                onChange={e => setPhonePass(e.target.value)}
                autoFocus
                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-amber-500/50 transition-all mb-4"
              />
              
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => performUpdate(phonePass)}
                disabled={loading || !phonePass}
                className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 rounded-xl flex items-center justify-center disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Xác nhận thay đổi'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {/* Modal Cài đặt 2FA */}
        {is2faModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 rounded-3xl shadow-2xl max-w-sm w-full relative flex flex-col items-center"
            >
              <button 
                onClick={() => { setIs2faModalOpen(false); setOtpInput(''); }}
                className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/20">
                <QrCode size={24} />
              </div>
              
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2 text-center">Cài đặt 2FA</h3>
              <p className="text-sm text-[var(--text-muted)] mb-5 text-center">
                Sử dụng ứng dụng Authy hoặc Google Authenticator quét mã QR dưới đây.
              </p>

              {qrCode ? (
                <div className="bg-white p-2 rounded-xl mb-5 shadow-inner">
                  <img src={qrCode} alt="2FA QR Code" className="w-40 h-40" />
                </div>
              ) : (
                <div className="w-40 h-40 bg-gray-200/20 rounded-xl mb-5 animate-pulse" />
              )}
              
              <div className="w-full">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider text-center">Mã xác nhận 6 số</label>
                <input 
                  type="text"
                  maxLength={6}
                  placeholder="000 000"
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-center text-xl tracking-widest font-mono text-[var(--text-primary)] outline-none focus:border-indigo-500/50 transition-all mb-4"
                />
              </div>
              
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleVerify2FA}
                disabled={loading || otpInput.length !== 6}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl flex items-center justify-center disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Xác minh & Kích hoạt'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
