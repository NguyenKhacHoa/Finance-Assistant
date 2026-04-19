import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

interface AlertMessage {
  id: number;
  title: string;
  reason?: string;
  message?: string;
  attemptedAmount?: number;
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
      setAlerts((prev) => [...prev, { id: Date.now(), ...data }]);
    });

    socket.on('transaction-blocked', (data) => {
      setAlerts((prev) => [...prev, { id: Date.now(), ...data }]);
    });

    socket.on('new_bank_transaction', (data) => {
      // 1. Cập nhật dữ liệu ngầm cho Dashboard và Pockets
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['pockets'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      // 2. Kích hoạt Floating AI để nói chuyện
      const event = new CustomEvent('bank_transaction_ai_msg', { detail: data });
      window.dispatchEvent(event);
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
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            className="pointer-events-auto w-96 backdrop-blur-xl border-l-4 border-l-red-500 border border-red-900/50 p-4 rounded-xl shadow-[0_10px_30px_rgba(239,68,68,0.3)] flex text-white"
            style={{ background: 'rgba(60,10,10,0.85)' }}
          >
            <div className="mr-4 mt-1 shrink-0">
              <ShieldAlert className="h-8 w-8 text-red-500 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-red-400 text-base leading-tight">{alert.title}</h3>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="text-red-300 hover:text-white transition-colors shrink-0"
                  aria-label="Đóng thông báo"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-red-200 mt-2 text-sm leading-relaxed">
                {alert.reason || alert.message}
              </p>
              {alert.attemptedAmount && (
                <div className="mt-3 inline-block bg-red-900/50 border border-red-800 px-3 py-1 rounded-lg text-sm text-red-300">
                  Số tiền bị chặn:{' '}
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                    alert.attemptedAmount,
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
