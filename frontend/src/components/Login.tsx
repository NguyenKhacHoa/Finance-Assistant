import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, User,
  Sparkles, TrendingUp, Shield, Zap, CheckCircle, RefreshCw, Smartphone, KeyRound
} from 'lucide-react';

type Mode = 'login' | 'register' | 'forgot' | 'reset-sent' | 'phone';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const FEATURES = [
  { icon: <TrendingUp className="w-4 h-4 text-cyan-400"   />, label: 'Dự báo ngày hết tiền bằng Gemini AI' },
  { icon: <Shield      className="w-4 h-4 text-green-400" />, label: 'Mã hóa AES-256-GCM cấp Ngân hàng' },
  { icon: <Zap         className="w-4 h-4 text-yellow-400"/>, label: 'Chế độ Sinh Tồn – tự động chặn chi tiêu' },
];

const REMEMBER_KEY = 'fa_v4_email';

interface Props { initialMode?: Mode }

export default function CustomLogin({ initialMode = 'login' }: Props) {
  const navigate   = useNavigate();
  const { login, register, loginWithToken, sendOtp, verifyOtp } = useAuth();

  const [mode,     setMode]    = useState<Mode>(initialMode);
  const [loading,  setLoading] = useState(false);
  const [err,      setErr]     = useState('');
  const [ok,       setOk]      = useState('');

  /* login fields */
  const [email,    setEmail]   = useState('');
  const [pw,       setPw]      = useState('');
  const [remember, setRemember]= useState(false);
  const [showPw,   setShowPw]  = useState(false);

  /* register fields */
  const [name,     setName]    = useState('');
  const [phone,    setPhone]   = useState('');
  const [pwC,      setPwC]     = useState('');
  const [showPwC,  setShowPwC] = useState(false);

  /* phone fields */
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  /* user count */
  const [count, setCount] = useState<number | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    const s = localStorage.getItem(REMEMBER_KEY);
    if (s) { setEmail(s); setRemember(true); }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cbToken = params.get('token');
    if (cbToken) {
      setLoading(true);
      loginWithToken(cbToken)
        .then(() => navigate('/dashboard'))
        .catch(() => { setErr('Xác thực Google thất bại.'); setLoading(false); });
    }
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = `${API}/auth/google`;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); clear();
    try {
      await sendOtp(phone);
      setOk('Đã gửi mã OTP, vui lòng kiểm tra Console (Backend) nha.');
      setOtpSent(true);
    } catch (e: any) {
      setErr(e.message || 'Không thể gửi mã OTP.');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); clear();
    try {
      await verifyOtp(phone, otp);
      navigate('/dashboard');
    } catch (e: any) {
      setErr(e.message || 'Mã OTP không hợp lệ.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetch(`${API}/admin/dashboard`, { signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.overview?.totalUsers != null && setCount(d.overview.totalUsers))
      .catch(() => {});
  }, []);

  const clear = () => { setErr(''); setOk(''); };
  const go    = (m: Mode) => { clear(); setMode(m); };

  // ── LOGIN ─────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); clear();
    try {
      await login(email, pw, remember);
      navigate('/dashboard');
    } catch (e: any) {
      setErr(e.message || 'Đăng nhập thất bại. Kiểm tra lại email và mật khẩu.');
    } finally { setLoading(false); }
  };

  // ── REGISTER ──────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pwC)    { setErr('Mật khẩu xác nhận không khớp.'); return; }
    if (pw.length < 8) { setErr('Mật khẩu phải có ít nhất 8 ký tự.'); return; }
    setLoading(true); clear();
    try {
      await register({ name, email, password: pw, phone: phone || undefined });
      navigate('/dashboard');
    } catch (e: any) {
      setErr(e.message || 'Đăng ký thất bại. Email có thể đã được sử dụng.');
    } finally { setLoading(false); }
  };

  // ── FORGOT PASSWORD ───────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); clear();
    try {
      await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setOk('Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.');
      go('reset-sent');
    } catch {
      setErr('Không thể gửi email. Vui lòng thử lại sau.');
    } finally { setLoading(false); }
  };

  // ── STYLES ────────────────────────────────────────────
  const inp = [
    'w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4',
    'text-white placeholder-slate-500 text-sm',
    'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40',
    'transition-all duration-200',
  ].join(' ');

  const btnPrimary = [
    'w-full bg-gradient-to-r from-indigo-600 to-cyan-600',
    'hover:from-indigo-500 hover:to-cyan-500 text-white font-bold py-3.5 rounded-xl',
    'transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50',
    'shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.45)]',
  ].join(' ');

  const Spinner = () => <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />;

  const pwLen = pw.length;
  const str   = pwLen === 0 ? 0 : pwLen < 8 ? 1 : pwLen < 12 ? 2 : pw.match(/[A-Z]/) && pw.match(/\d/) ? 4 : 3;
  const strColor = ['', 'bg-red-500', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'][str];
  const strLabel = ['', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'][str];

  return (
    <div className="min-h-screen w-full flex bg-[#080d1a] overflow-hidden">

      {/* ── HERO (desktop) ─── */}
      <motion.aside initial={{ opacity: 0, x: -60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}
        className="hidden lg:flex flex-col justify-between w-[48%] relative p-16 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center font-black text-white">✦</div>
            <span className="text-white font-black text-lg">Finance Assistant</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            Version 4.0 — AI Powered
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <h1 className="text-6xl font-black text-white leading-tight mb-6">
            Quản lý
            <span className="block bg-gradient-to-r from-indigo-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Tài Chính
            </span>
            Thông Minh
          </h1>
          <p className="text-slate-400 text-base leading-relaxed mb-10 max-w-md">
            Hệ sinh thái All-in-One với AI dự báo ngày hết tiền, phân bổ 6 hũ và Chế độ Sinh Tồn.
          </p>
          <div className="flex flex-col gap-3">
            {FEATURES.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.15 }}
                className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl p-3">
                <div className="p-2 rounded-lg bg-white/5">{f.icon}</div>
                <span className="text-slate-300 font-medium text-sm">{f.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* User count */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex -space-x-2">
            {['🧑‍💼','👩‍💻','🧑‍🎓'].map((e,i) => (
              <div key={i} className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-[#080d1a] flex items-center justify-center text-sm">{e}</div>
            ))}
          </div>
          <div>
            <p className="text-white font-bold text-sm">
              {count !== null ? `${count.toLocaleString('vi-VN')} người dùng` : 'Finance Assistant'}
            </p>
            <p className="text-slate-500 text-xs">hệ thống quản lý tài chính thông minh</p>
          </div>
        </div>
      </motion.aside>

      {/* ── AUTH PANEL ─── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="w-full max-w-md">
          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_25px_60px_rgba(0,0,0,0.5)]">

            {/* Title */}
            <AnimatePresence mode="wait">
              <motion.div key={mode} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mb-7">
                <h2 className="text-2xl font-black text-white mb-1">
                  {mode === 'login'      && 'Chào mừng trở lại 👋'}
                  {mode === 'phone'      && 'Đăng nhập bằng Số điện thoại 📱'}
                  {mode === 'register'   && 'Tạo tài khoản mới ✨'}
                  {mode === 'forgot'     && 'Lấy lại mật khẩu 🔑'}
                  {mode === 'reset-sent' && 'Kiểm tra email của bạn 📬'}
                </h2>
                <p className="text-slate-400 text-sm">
                  {mode === 'login'      && 'Đăng nhập để quản lý tài chính của bạn'}
                  {mode === 'phone'      && 'Nhận mã OTP thông qua Console Backend'}
                  {mode === 'register'   && 'Điền thông tin để bắt đầu hành trình'}
                  {mode === 'forgot'     && 'Nhập email để nhận hướng dẫn đặt lại mật khẩu'}
                  {mode === 'reset-sent' && 'Chúng tôi đã gửi email về cho bạn'}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Alerts */}
            <AnimatePresence>
              {err && (
                <motion.div key="e" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">⚠</span><span>{err}</span>
                </motion.div>
              )}
              {ok && (
                <motion.div key="o" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-300 text-sm flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{ok}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">

              {/* ═══ LOGIN ═══ */}
              {mode === 'login' && (
                <motion.form key="login" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                  onSubmit={handleLogin} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input type="email" value={email} onChange={e => { setEmail(e.target.value); clear(); }}
                      placeholder="email@example.com" className={inp} required />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => { setPw(e.target.value); clear(); }}
                      placeholder="Mật khẩu" className={inp + ' pr-11'} required />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none group" onClick={() => setRemember(!remember)}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${remember ? 'bg-indigo-500 border-indigo-500' : 'border-white/25 bg-white/5 group-hover:border-white/50'}`}>
                        {remember && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                      </div>
                      <span className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors">Ghi nhớ đăng nhập</span>
                    </label>
                    <button type="button" onClick={() => go('forgot')} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
                      Quên mật khẩu?
                    </button>
                  </div>
                  <button type="submit" disabled={loading} className={btnPrimary}>
                    {loading ? <Spinner /> : <>Đăng Nhập <ArrowRight className="w-4 h-4" /></>}
                  </button>

                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="shrink-0 mx-4 text-slate-500 text-xs uppercase tracking-wider">Hoặc</span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={handleGoogleLogin} className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-sm font-medium py-3 rounded-xl transition-all shadow-sm">
                      <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                      Google
                    </button>
                    <button type="button" onClick={() => go('phone')} className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-sm font-medium py-3 rounded-xl transition-all shadow-sm">
                      <Smartphone className="w-4 h-4" />
                      Điện thoại
                    </button>
                  </div>

                  <p className="text-center text-slate-500 text-sm pt-2">
                    Chưa có tài khoản?{' '}
                    <button type="button" onClick={() => go('register')} className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">Đăng ký miễn phí →</button>
                  </p>
                </motion.form>
              )}

              {/* ═══ PHONE OTP ═══ */}
              {mode === 'phone' && (
                <motion.div key="phone" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                  {!otpSent ? (
                    <form onSubmit={handleSendOtp} className="space-y-4">
                      <div className="relative">
                        <Smartphone className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                        <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); clear(); }}
                          placeholder="Số điện thoại của bạn" className={inp} required />
                      </div>
                      <button type="submit" disabled={loading} className={btnPrimary}>
                        {loading ? <Spinner /> : <>Nhận Mã OTP qua Zalo/SMS <ArrowRight className="w-4 h-4" /></>}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div className="relative">
                        <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                        <input type="text" value={otp} onChange={e => { setOtp(e.target.value); clear(); }}
                          placeholder="Mã OTP 6 số" className={inp} required autoFocus maxLength={6} />
                      </div>
                      <button type="submit" disabled={loading} className={btnPrimary}>
                        {loading ? <Spinner /> : <>Xác Nhận OTP <Sparkles className="w-4 h-4" /></>}
                      </button>
                    </form>
                  )}
                  <p className="text-center text-slate-500 text-sm pt-2">
                    <button type="button" onClick={() => { setOtpSent(false); go('login'); }} className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">← Trở về đăng nhập bằng Email</button>
                  </p>
                </motion.div>
              )}

              {/* ═══ REGISTER ═══ */}
              {mode === 'register' && (
                <motion.form key="reg" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                  onSubmit={handleRegister} className="space-y-3.5">
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input value={name} onChange={e => { setName(e.target.value); clear(); }}
                      placeholder="Họ và tên" className={inp} required />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input type="email" value={email} onChange={e => { setEmail(e.target.value); clear(); }}
                      placeholder="email@example.com" className={inp} required />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-slate-500 text-sm">📱</span>
                    <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); clear(); }}
                      placeholder="Số điện thoại (tuỳ chọn)" className={inp} />
                  </div>
                  <div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                      <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => { setPw(e.target.value); clear(); }}
                        placeholder="Mật khẩu (ít nhất 8 ký tự)" className={inp + ' pr-11'} required />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {pw && (
                      <div className="mt-1.5 space-y-1">
                        <div className="flex gap-1">
                          {[1,2,3,4].map(i => <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= str ? strColor : 'bg-white/10'}`} />)}
                        </div>
                        <p className="text-xs text-slate-600">
                          Độ mạnh: <span className={`font-semibold ${str >= 3 ? 'text-green-400' : str === 2 ? 'text-yellow-400' : 'text-red-400'}`}>{strLabel}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input type={showPwC ? 'text' : 'password'} value={pwC} onChange={e => { setPwC(e.target.value); clear(); }}
                      placeholder="Nhập lại mật khẩu" className={inp + ' pr-11'} required />
                    <button type="button" onClick={() => setShowPwC(!showPwC)} className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300">
                      {showPwC ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button type="submit" disabled={loading} className={btnPrimary}>
                    {loading ? <Spinner /> : <>Tạo Tài Khoản Miễn Phí <Sparkles className="w-4 h-4" /></>}
                  </button>
                  <p className="text-center text-slate-500 text-sm pt-1">
                    Đã có tài khoản?{' '}
                    <button type="button" onClick={() => go('login')} className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">← Đăng nhập</button>
                  </p>
                </motion.form>
              )}

              {/* ═══ FORGOT PASSWORD ═══ */}
              {mode === 'forgot' && (
                <motion.form key="fp" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                  onSubmit={handleForgot} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input type="email" value={email} onChange={e => { setEmail(e.target.value); clear(); }}
                      placeholder="Email đã đăng ký" className={inp} required autoFocus />
                  </div>
                  <button type="submit" disabled={loading} className={btnPrimary}>
                    {loading ? <Spinner /> : <>Gửi Hướng Dẫn Đặt Lại <ArrowRight className="w-4 h-4" /></>}
                  </button>
                  <button type="button" onClick={() => go('login')} className="w-full text-slate-500 hover:text-slate-300 text-sm py-1 transition-colors">← Quay lại đăng nhập</button>
                </motion.form>
              )}

              {/* ═══ RESET SENT ═══ */}
              {mode === 'reset-sent' && (
                <motion.div key="rs" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center space-y-6 py-4">
                  <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">📬</div>
                  <div>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Chúng tôi đã gửi link đặt lại mật khẩu đến <strong className="text-white">{email}</strong>.
                      Kiểm tra hộp thư đến (và thư mục Spam) của bạn nhé!
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button onClick={handleForgot} disabled={loading}
                      className="flex items-center justify-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm transition-colors disabled:opacity-50">
                      <RefreshCw className="w-3 h-3" /> Gửi lại email
                    </button>
                    <button onClick={() => go('login')} className="w-full text-slate-500 hover:text-slate-300 text-sm transition-colors">← Quay lại đăng nhập</button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
          <p className="text-center text-slate-700 text-xs mt-6">© 2026 Finance Assistant V.4.0 — Không dùng bên thứ 3</p>
        </motion.div>
      </div>
    </div>
  );
}
