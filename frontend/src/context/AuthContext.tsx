import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { notificationBus } from '../utils/notificationBus';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'fa_v4_token';
const REMEMBER_KEY = 'fa_v4_email';

// ─── Storage keys cần xóa khi logout ────────────────────────────────────────
// Tập trung tất cả storage keys ở đây để không bỏ sót khi thêm key mới.
const CLEAR_ON_LOGOUT_KEYS = [
  TOKEN_KEY,
  'fa_notifications',  // notificationBus localStorage key
];

/**
 * Xóa sạch toàn bộ trạng thái phía client:
 *  - Các localStorage keys của app (giữ REMEMBER_KEY nếu người dùng tick "ghi nhớ")
 *  - sessionStorage (không có data nhạy cảm nhưng xóa để sạch)
 *  - External queryClient cache — phải được truyền vào từ ngoài
 *
 * Hàm này được gọi trong logout() VÀ sau khi deleteAccount thành công.
 * Export để DangerZone.tsx có thể gọi trực tiếp.
 */
export function clearAllClientState(opts?: {
  keepRememberEmail?: boolean;
  queryClientRef?: { clear: () => void };
}) {
  // 1. Xóa các localStorage key thuộc app
  const rememberEmail = localStorage.getItem(REMEMBER_KEY);
  CLEAR_ON_LOGOUT_KEYS.forEach((key) => localStorage.removeItem(key));

  // 2. Khôi phục email "ghi nhớ" nếu cần
  if (opts?.keepRememberEmail && rememberEmail) {
    localStorage.setItem(REMEMBER_KEY, rememberEmail);
  }

  // 3. Xóa sessionStorage (token ngắn hạn, draft state, v.v.)
  sessionStorage.clear();

  // 4. Reset notificationBus (xóa cache thông báo của account cũ)
  notificationBus.clear();

  // 5. Reset React Query cache — tránh data cũ nhảy sang account mới
  opts?.queryClientRef?.clear();
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  avatarUrl?: string;
  role: string;
  isVerified: boolean;
  rewardPoints?: number;
  loginStreak?: number;
  googleId?: string | null;
  hasPassword?: boolean;
  twoFactorEnabled?: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isServerAlive: boolean;
  login:          (email: string, password: string, remember?: boolean) => Promise<void>;
  register:       (data: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout:         (opts?: { queryClientRef?: { clear: () => void } }) => void;
  refreshMe:      () => Promise<void>;
  loginWithToken: (t: string) => Promise<void>;
  sendOtp:        (phone: string) => Promise<{ message: string }>;
  verifyOtp:      (phone: string, otp: string) => Promise<void>;
  updateProfile:  (dto: { name?: string; phone?: string; currentPassword?: string }) => Promise<void>;
  changePassword: (dto: { currentPassword: string; newPassword: string }) => Promise<{ message: string }>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export async function authFetch<T>(path: string, opts?: RequestInit, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...opts, headers });
  } catch (error) {
    throw new Error('Không thể kết nối đến server (Failed to fetch). Vui lòng kiểm tra lại mạng hoặc server.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message;
    throw new Error(Array.isArray(message) ? message.join(', ') : (message || 'Lỗi không xác định'));
  }
  return data as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [isServerAlive, setIsServerAlive] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    
    fetch(`${API}/auth/health`)
      .then(res => {
        if (!res.ok) throw new Error('Dead');
        setIsServerAlive(true);
        if (!saved) { setLoading(false); return; }
        authFetch<AuthUser>('/auth/me', {}, saved)
          .then(u => { setUser(u); setToken(saved); })
          .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null); })
          .finally(() => setLoading(false));
      })
      .catch(() => {
        setIsServerAlive(false);
        setLoading(false);
      });
  }, []);

  const persist = (t: string) => {
    setToken(t);
    localStorage.setItem(TOKEN_KEY, t);
  };

  const loginWithToken = async (t: string) => {
    persist(t);
    const me = await authFetch<AuthUser>('/auth/me', {}, t);
    setUser(me);
  };

  const login = async (email: string, password: string, remember = false) => {
    const data = await authFetch<{ access_token: string; user: AuthUser }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
    );
    persist(data.access_token);
    setUser(data.user);
    if (remember) localStorage.setItem(REMEMBER_KEY, email);
    else          localStorage.removeItem(REMEMBER_KEY);
    try {
      const me = await authFetch<AuthUser>('/auth/me', {}, data.access_token);
      setUser(me);
    } catch {}
  };

  const register = async (dto: { name: string; email: string; password: string; phone?: string }) => {
    const data = await authFetch<{ access_token: string; user: AuthUser }>(
      '/auth/register', { method: 'POST', body: JSON.stringify(dto) }
    );
    persist(data.access_token);
    // Set user ngay từ response (đã có name + phone từ signToken)
    setUser(data.user);
    // Sau đó fetch /auth/me để lấy đầy đủ các field (rewardPoints, loginStreak, avatarUrl...)
    try {
      const me = await authFetch<AuthUser>('/auth/me', {}, data.access_token);
      setUser(me);
    } catch {}
  };

  const logout = useCallback((opts?: { queryClientRef?: { clear: () => void } }) => {
    clearAllClientState({
      keepRememberEmail: true,
      queryClientRef: opts?.queryClientRef,
    });
    setToken(null);
    setUser(null);
  }, []);

  const refreshMe = async () => {
    if (!token) return;
    const me = await authFetch<AuthUser>('/auth/me', {}, token);
    setUser(me);
  };

  const sendOtp = async (phone: string) => {
    return authFetch<{ message: string }>('/auth/send-otp', {
      method: 'POST', body: JSON.stringify({ phone })
    });
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const data = await authFetch<{ access_token: string; user: AuthUser }>(
      '/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp }) }
    );
    persist(data.access_token);
    setUser(data.user);
  };

  const updateProfile = async (dto: { name?: string; phone?: string; currentPassword?: string }) => {
    if (!token) return;
    const updatedUser = await authFetch<AuthUser>('/profile/info', {
      method: 'PUT',
      body: JSON.stringify(dto),
    }, token);
    setUser(prev => prev ? { ...prev, ...updatedUser } : updatedUser);
  };

  const changePassword = async (dto: { currentPassword: string; newPassword: string }) => {
    if (!token) throw new Error('Không có quyền thay đổi mật khẩu.');
    return authFetch<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(dto),
    }, token);
  };

  return (
    <Ctx.Provider value={{
      user, token, loading, isServerAlive,
      login, register, logout, refreshMe,
      loginWithToken, sendOtp, verifyOtp,
      updateProfile, changePassword
    }}>
      {children}
    </Ctx.Provider>
  );
}
