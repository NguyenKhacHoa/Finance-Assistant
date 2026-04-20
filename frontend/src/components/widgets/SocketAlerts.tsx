import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X, TrendingUp, TrendingDown, Sparkles, BotMessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { formatVND } from '../../utils/format';

interface AlertMessage {
  id: number;
  title: string;
  reason?: string;
  message?: string;
  description?: string;
  summary?: string;
  attemptedAmount?: number;
  amount?: number;
  type?: 'INCOME' | 'EXPENSE';
  actionType?: 'create_transaction' | 'update_pocket_percentage' | 'manage_goal';
  event?: 'SURVIVAL' | 'BLOCKED' | 'BANK_TRANSACTION' | 'AI_ACTION';
}

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function SocketAlerts() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [alerts, setAlerts] = useState<AlertMessage[]>([]);

  useEffect(() => {
    // Không kết nối nếu chưa đăng nhập
    if (!user?.id || !token) {
      // Nếu có socket cũ đang chạy (ví dụ từ account cũ), disconnect ngay
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      // Xóa alerts còn sót của account cũ
      setAlerts([]);
      return;
    }

    // Disconnect socket cũ trước khi tạo mới (tránh duplicate listeners)
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Tạo socket mới với token JWT của user hiện tại
    const socket = io(SOCKET_URL, {
      auth: { token },           // gửi token qua auth handshake (an toàn hơn query string)
      query: { userId: user.id }, // fallback cho backend nếu chưa parse auth.token
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.debug(`[Socket] Connected: socketId=${socket.id}, userId=${user.id}`);
    });

    socket.on('disconnect', (reason) => {
      console.debug(`[Socket] Disconnected: ${reason}`);
    });

    socket.on('survival-alert', (data) => {
      setAlerts((prev) => [...prev, { id: Date.now(), event: 'SURVIVAL', ...data }]);
    });

    socket.on('transaction-blocked', (data) => {
      setAlerts((prev) => [...prev, { id: Date.now(), event: 'BLOCKED', ...data }]);
    });

    socket.on('new_bank_transaction', (data) => {
      // 1. Cập nhật dữ liệu ngầm cho Dashboard và Pockets
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      // Cập nhật mảng alerts để hiển thị Toast
      setAlerts((prev) => [...prev, { id: Date.now(), event: 'BANK_TRANSACTION', ...data }]);

      // 2. Kích hoạt Floating AI để nói chuyện
      const event = new CustomEvent('bank_transaction_ai_msg', { detail: data });
      window.dispatchEvent(event);
    });

    // ── AI Action Alert: khi Agent thực thi lệnh thành công ────────────────
    socket.on('ai_action', (data) => {
      // Invalidate cache để Dashboard cập nhật real-time
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });

      setAlerts((prev) => [...prev, { id: Date.now(), event: 'AI_ACTION', ...data }]);

      // Tự động tắt sau 5 giây
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== Date.now()));
      }, 5000);
    });

    // Cleanup: disconnect và xóa alerts khi user thay đổi hoặc logout
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setAlerts([]); // xóa alerts của session cũ
    };
  // Re-run khi user.id thay đổi (login/logout/switch account)
  }, [user?.id, token]);

  const removeAlert = (id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-4 pointer-events-none">
      <AnimatePresence>
        {alerts.map((alert) => {
          const isBank = alert.event === 'BANK_TRANSACTION';
          const isAiAction = alert.event === 'AI_ACTION';
          const isIncome = alert.type === 'INCOME';

          // ── AI Action Toast ──────────────────────────────────────────────
          if (isAiAction) {
            const isExpenseAction = alert.type === 'EXPENSE';
            const isIncomeAction = alert.type === 'INCOME';
            const accentColor = isExpenseAction ? '#f87171' : isIncomeAction ? '#34d399' : '#a78bfa';
            const bgColor = isExpenseAction
              ? 'rgba(127,29,29,0.9)'
              : isIncomeAction
                ? 'rgba(6,78,59,0.9)'
                : 'rgba(49,10,90,0.9)';

            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                className="pointer-events-auto w-96 backdrop-blur-xl border border-violet-700/40 p-4 rounded-xl shadow-[0_10px_30px_rgba(139,92,246,0.35)] flex text-white"
                style={{ background: bgColor, borderLeft: `4px solid ${accentColor}` }}
              >
                <div className="mr-3 mt-0.5 shrink-0">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-violet-300 animate-pulse" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-violet-200 text-sm leading-tight">{alert.title}</h3>
                    <button
                      onClick={() => removeAlert(alert.id)}
                      className="text-white/40 hover:text-white transition-colors shrink-0"
                      aria-label="Đóng thông báo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-violet-200/80 mt-1.5 text-xs leading-relaxed">
                    {alert.summary || alert.message}
                  </p>
                  {alert.amount && (
                    <div
                      className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black"
                      style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}
                    >
                      {isExpenseAction ? '-' : isIncomeAction ? '+' : ''}{formatVND(alert.amount)}
                    </div>
                  )}
                  <p className="text-violet-400/60 text-[10px] mt-1.5 flex items-center gap-1">
                    <BotMessageSquare size={10} /> ARIA Agent
                  </p>
                </div>
              </motion.div>
            );
          }

          // ── Bank / Survival / Blocked Toast ─────────────────────────────
          const bgClass = isBank ? (isIncome ? 'rgba(6,78,59,0.9)' : 'rgba(127,29,29,0.9)') : 'rgba(60,10,10,0.85)';
          const borderClass = isBank ? (isIncome ? 'border-l-emerald-500 border-emerald-900/50' : 'border-l-rose-500 border-rose-900/50') : 'border-l-red-500 border-red-900/50';
          const shadowClass = isBank ? (isIncome ? 'shadow-[0_10px_30px_rgba(16,185,129,0.3)]' : 'shadow-[0_10px_30px_rgba(244,63,94,0.3)]') : 'shadow-[0_10px_30px_rgba(239,68,68,0.3)]';
          const textClass = isBank ? (isIncome ? 'text-emerald-400' : 'text-rose-400') : 'text-red-400';
          const subTextClass = isBank ? (isIncome ? 'text-emerald-200' : 'text-rose-200') : 'text-red-200';
          const Icon = isBank ? (isIncome ? TrendingUp : TrendingDown) : ShieldAlert;

          return (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            className={`pointer-events-auto w-96 backdrop-blur-xl border-l-4 border ${borderClass} p-4 rounded-xl ${shadowClass} flex text-white`}
            style={{ background: bgClass }}
          >
            <div className="mr-4 mt-1 shrink-0">
              <Icon className={`h-8 w-8 ${textClass} animate-pulse`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <h3 className={`font-bold ${textClass} text-base leading-tight`}>{alert.title}</h3>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className={`text-white/50 hover:text-white transition-colors shrink-0`}
                  aria-label="Đóng thông báo"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className={`${subTextClass} mt-2 text-sm leading-relaxed`}>
                {alert.reason || alert.message || alert.description}
              </p>
              
              {isBank && alert.amount && (
                <div className="mt-3 font-mono font-bold text-lg" style={{ color: isIncome ? '#34d399' : '#f43f5e' }}>
                   {isIncome ? '+' : '-'}{formatVND(alert.amount)}
                </div>
              )}

              {alert.attemptedAmount && !isBank && (
                <div className="mt-3 inline-block bg-red-900/50 border border-red-800 px-3 py-1 rounded-lg text-sm text-red-300">
                  Số tiền bị chặn: {formatVND(alert.attemptedAmount)}
                </div>
              )}
            </div>
          </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
