import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, TrendingUp, TrendingDown, Trophy, Info, Trash2, CheckCheck } from 'lucide-react';
import { notificationBus, type Notification } from '../../utils/notificationBus';
import { formatVND } from '../../utils/format';

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff} giây trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

const TYPE_CONFIG = {
  income:  { icon: TrendingUp,   color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'Thu nhập' },
  expense: { icon: TrendingDown, color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Chi tiêu' },
  badge:   { icon: Trophy,       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Huy hiệu' },
  info:    { icon: Info,         color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  label: 'Thông báo' },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Subscribe to bus changes
  useEffect(() => {
    const refresh = () => setNotifs(notificationBus.load());
    refresh();
    const unsub = notificationBus.subscribe(refresh);
    return unsub;
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) notificationBus.markAllRead();
  };

  return (
    <div ref={popoverRef} className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleOpen}
        aria-label="Thông báo"
        className="relative w-9 h-9 flex items-center justify-center rounded-xl"
        style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-400 text-[9px] font-black text-slate-900 flex items-center justify-center ring-2 ring-[var(--bg-surface)]"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden z-50 flex flex-col"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              maxHeight: '420px',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Dòng thời gian
              </span>
              <div className="flex items-center gap-1">
                {notifs.length > 0 && (
                  <>
                    <button
                      onClick={() => notificationBus.markAllRead()}
                      title="Đánh dấu đã đọc"
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <CheckCheck size={14} />
                    </button>
                    <button
                      onClick={() => notificationBus.clear()}
                      title="Xóa tất cả"
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Feed */}
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Bell size={32} className="opacity-20" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Chưa có thông báo nào
                  </p>
                </div>
              ) : (
                    notifs.map((n) => {
                  const cfg = TYPE_CONFIG[n.type];
                  const Icon = cfg.icon;

                  // Prefix & màu cho amount
                  const amountPrefix = n.type === 'income' ? '+' : n.type === 'expense' ? '-' : '';
                  const amountColor = n.type === 'income' ? '#34d399' : n.type === 'expense' ? '#f87171' : cfg.color;

                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3 p-3 rounded-xl transition-colors cursor-default"
                      style={{
                        background: n.read ? 'transparent' : cfg.bg,
                        border: `1px solid ${n.read ? 'transparent' : cfg.color + '25'}`,
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-snug" style={{ color: 'var(--text-primary)' }}>
                          {n.message}
                        </p>
                        {n.amount !== undefined && (
                          <div
                            className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-lg text-[11px] font-black"
                            style={{
                              background: `${amountColor}15`,
                              color: amountColor,
                              border: `1px solid ${amountColor}30`,
                            }}
                          >
                            {amountPrefix}{formatVND(n.amount)}
                          </div>
                        )}
                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                          {timeAgo(n.ts)}
                        </p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
