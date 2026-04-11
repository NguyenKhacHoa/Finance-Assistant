import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';

interface AlertMessage {
  id: number;
  title: string;
  reason?: string;
  message?: string;
  attemptedAmount?: number;
}

export default function SocketAlerts() {
  const [alerts, setAlerts] = useState<AlertMessage[]>([]);

  useEffect(() => {
    // Kết nối tới Socket.IO server của backend
    // Gắn userId cứng để test (hoặc từ Clerk JWT)
    const socket = io('http://localhost:3000', {
      query: { userId: 'simulated-user-id' }
    });

    socket.on('survival-alert', (data) => {
      setAlerts(prev => [...prev, { id: Date.now(), ...data }]);
    });

    socket.on('transaction-blocked', (data) => {
      setAlerts(prev => [...prev, { id: Date.now(), ...data }]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const removeAlert = (id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-4">
      <AnimatePresence>
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            className="w-96 bg-red-950/80 backdrop-blur-xl border-l-4 border-l-red-500 border border-red-900/50 p-4 rounded-xl shadow-[0_10px_30px_rgba(239,68,68,0.3)] flex text-white"
          >
            <div className="mr-4 mt-1">
              <ShieldAlert className="h-8 w-8 text-red-500 animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-red-400 text-lg leading-tight">{alert.title}</h3>
                <button onClick={() => removeAlert(alert.id)} className="text-red-300 hover:text-white transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-red-200 mt-2 text-sm leading-relaxed">
                {alert.reason || alert.message}
              </p>
              {alert.attemptedAmount && (
                <div className="mt-3 inline-block bg-red-900/50 border border-red-800 px-3 py-1 rounded-lg text-sm text-red-300">
                  Số tiền bị chặn: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(alert.attemptedAmount)}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
