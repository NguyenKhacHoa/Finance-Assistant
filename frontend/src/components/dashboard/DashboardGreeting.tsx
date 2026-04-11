import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export default function DashboardGreeting() {
  const { user } = useAuth();
  const name = user?.name || user?.email?.split('@')[0] || 'Bạn';
  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <h1
        className="text-3xl font-extrabold"
        style={{
          color: 'var(--text-primary)',
          fontFamily: 'Montserrat, sans-serif',
          letterSpacing: '-0.02em',
        }}
      >
        👋 {getGreeting()}, <span style={{ color: 'var(--primary)' }}>{name}</span>
      </h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        {today} · Đây là tổng quan tài chính của bạn hôm nay
      </p>
    </motion.div>
  );
}
