import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'fa_v4_token';
const REMEMBER_KEY = 'fa_v4_email';

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
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isServerAlive: boolean;
  login:    (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout:   () => void;
  refreshMe: () => Promise<void>;
  loginWithToken: (t: string) => Promise<void>;
  sendOtp:  (phone: string) => Promise<{ message: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
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
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

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

  return (
    <Ctx.Provider value={{ user, token, loading, isServerAlive, login, register, logout, refreshMe, loginWithToken, sendOtp, verifyOtp }}>
      {children}
    </Ctx.Provider>
  );
}
