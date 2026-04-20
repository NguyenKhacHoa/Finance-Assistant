import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Landmark, Wallet, Loader2, ArrowDownToLine, History } from 'lucide-react';
import { authFetch, useAuth } from '../../context/AuthContext';
import { formatVND } from '../../utils/format';

interface Transaction {
  id: string;
  amount: number;
  type: string;     // 'INCOME' | 'EXPENSE' | 'SYSTEM'
  source: string;   // 'BANK' | 'CASH' | 'SYSTEM'
  title: string;
  createdAt: string;
}

export default function DepositHistory() {
  const { token } = useAuth();

  const { data: allTransactions, isLoading, isError } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => authFetch<Transaction[]>('/transactions', {}, token),
    enabled: !!token,
    refetchInterval: 15 * 1000, // Tự động refetch mỗi 15s để xem khoản vừa nạp
  });

  const depositList = Array.isArray(allTransactions)
    ? allTransactions
        .filter((t) => t.type === 'INCOME' && (t.source === 'BANK' || t.source === 'CASH'))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8) // Lấy 8 giao dịch gần nhất
    : [];

  return (
    <div className="rounded-3xl p-6 border shadow-xl relative min-h-[400px] overflow-hidden bg-[var(--bg-surface)]/50 backdrop-blur-md" 
         style={{ borderColor: 'var(--border)' }}>
      {/* Tiêu đề */}
      <h2 className="text-lg font-bold flex items-center gap-2 tracking-wide mb-6" style={{ color: 'var(--text-primary)' }}>
        <History className="w-5 h-5 text-emerald-400" />
        Lịch sử dòng tiền
      </h2>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-emerald-400/50">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="text-sm font-bold uppercase tracking-widest text-[#8b9bb4]">Đang tải dữ liệu...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-sm font-bold text-rose-500">Lỗi khi tải lịch sử giao dịch.</p>
        </div>
      ) : depositList.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 opacity-40"
        >
          <ArrowDownToLine className="w-12 h-12 mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>Chưa có dòng tiền nào đổ về</p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence>
            {depositList.map((tx, idx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08, type: 'spring', stiffness: 300, damping: 24 }}
                className="flex justify-between items-center group relative p-3 -mx-3 rounded-2xl transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-full flex items-center justify-center bg-blue-500/10 text-blue-400 shrink-0 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)] group-hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all">
                    {tx.source === 'BANK' ? <Landmark size={20} /> : <Wallet size={20} />}
                  </div>
                  
                  {/* Title & Time */}
                  <div className="flex flex-col">
                    <h4 className="font-bold text-sm tracking-wide line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                      {tx.title || 'Nạp tiền vào tài khoản'}
                    </h4>
                    <p className="text-[12px] mt-0.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                      {new Date(tx.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                
                {/* Amount */}
                <div className="text-right shrink-0 ml-3">
                  <span className="font-black text-[15px] tracking-tight text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                    +{formatVND(tx.amount)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
