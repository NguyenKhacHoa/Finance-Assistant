import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight } from 'lucide-react';

import ProfileHeader from '../profile/ProfileHeader';
import FixedExpenseList from '../profile/FixedExpenseList';

export default function ProfilePage() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto flex flex-col pb-10 w-full"
    >
      {/* Navigation Breadcrumb */}
      <div className="flex flex-col mb-8 gap-4">
        <div className="flex items-center text-xs font-bold uppercase tracking-widest gap-2" style={{ color: 'var(--text-muted)' }}>
          <span className="cursor-pointer transition-colors hover:text-cyan-500" onClick={() => navigate('/dashboard')}>
            Dashboard
          </span>
          <ChevronRight size={14} />
          <span className="text-cyan-500">Hồ sơ cá nhân</span>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2.5 rounded-full border transition-all hover:bg-black/5 dark:hover:bg-white/5"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Hồ sơ Cá nhân</h1>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Cập nhật thông tin cơ bản */}
        <ProfileHeader />

        {/* Quản lý Chi phí Cố định */}
        <FixedExpenseList />
      </div>
    </motion.div>
  );
}
