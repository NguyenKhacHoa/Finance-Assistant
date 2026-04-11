import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Wallet, BrainCircuit, Sparkles, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { authFetch, useAuth } from '../../context/AuthContext';
import confetti from 'canvas-confetti';
import { formatVND, formatInputVND, parseVNDToNumber } from '../../utils/format';
import { notificationBus } from '../../utils/notificationBus';

interface Pocket {
  id: string;
  name: string;
  balance: number;
  percentage: number;
}

interface Allocation {
  pocketId: string;
  amount: number;
}

interface SalaryHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pockets: Pocket[];
}

export default function SalaryHubModal({ isOpen, onClose, onSuccess, pockets }: SalaryHubModalProps) {
  const { token } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amountInputDisplay, setAmountInputDisplay] = useState('');
  const [mode, setMode] = useState<'MANUAL' | 'AI'>('MANUAL');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset state when opening modal
  useEffect(() => {
    if (isOpen) {
      setAmountInputDisplay('');
      setMode('MANUAL');
      setAllocations([]);
      setIsPreviewMode(false);
      setIsSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  const handleGeneratePreview = async () => {
    const amountNum = parseVNDToNumber(amountInputDisplay);
    if (!amountNum || amountNum <= 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      if (mode === 'MANUAL') {
        // Tóm tắt chia tay theo tỷ lệ % mặc định
        const totalPct = pockets.reduce((acc, p) => acc + Number(p.percentage), 0);
        let calculated = pockets.map((p) => {
          const ratio = Number(p.percentage) / (totalPct || 100);
          return { pocketId: p.id, amount: Math.floor(amountNum * ratio) };
        });
        
        // Điều chỉnh sai số làm tròn cho khớp totalAmount
        const sumCalc = calculated.reduce((a,c) => a + c.amount, 0);
        if (sumCalc !== amountNum && calculated.length > 0) {
          calculated[0].amount += (amountNum - sumCalc);
        }

        setAllocations(calculated);
        setIsPreviewMode(true);
      } else {
        // AI Smart Split
        const aiData = await authFetch<Allocation[]>('/finance/ai-preview', {
          method: 'POST',
          body: JSON.stringify({ amount: amountNum })
        }, token);
        
        setAllocations(aiData);
        setIsPreviewMode(true);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo Preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDistribution = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const res = await authFetch<any>('/finance/distribute-salary', {
        method: 'POST',
        body: JSON.stringify({
          totalAmount: parseVNDToNumber(amountInputDisplay),
          allocations
        })
      }, token);

      // Push to notification bell
      const totalDistributed = parseVNDToNumber(amountInputDisplay);
      notificationBus.push({
        type: 'income',
        message: `Đã phân bổ lương vào ${allocations.length} hũ thành công.`,
        amount: totalDistributed,
      });

      if (res?.newlyUnlocked?.length > 0) {
        res.newlyUnlocked.forEach((badgeName: string) => {
          notificationBus.push({
            type: 'badge',
            message: `🎉 Chúc mừng! Bạn đã mở khóa huy hiệu: ${badgeName}`,
          });
        });
      }

      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#14b8a6', '#d946ef', '#8b5cf6']
      });

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra trong lúc nạp tiền');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#050d18]/80 backdrop-blur-md"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative w-full ${isPreviewMode ? 'max-w-3xl' : 'max-w-md'} bg-[#0c1624] border border-white/10 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300`}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 to-transparent">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Wallet size={20} className="text-emerald-400" />
              Trung Tâm Nhận Lương
            </h2>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm">
                <AlertCircle size={18} /> <span>{error}</span>
              </div>
            )}

            {!isPreviewMode ? (
              // BƯỚC 1: NHẬP VÀ CHỌN MODE
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-emerald-200/50 uppercase tracking-wide mb-3 block text-center">Tổng thu nhập tháng này (VNĐ)</label>
                  <input
                    type="text"
                    value={amountInputDisplay}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      const num = Number(raw);
                      setAmountInputDisplay(num === 0 && !raw ? '' : formatInputVND(num.toString()));
                    }}
                    placeholder="VD: 30.000.000"
                    className="w-full text-center text-4xl font-black tracking-tighter bg-transparent border-b-2 border-emerald-500/30 pb-4 text-emerald-400 placeholder:text-emerald-400/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <button
                    onClick={() => setMode('MANUAL')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      mode === 'MANUAL' 
                      ? 'bg-sky-500/10 border-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.15)] ring-1 ring-sky-500/20' 
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <SlidersHorizontal size={24} className={`mb-3 ${mode === 'MANUAL' ? 'text-sky-400' : 'text-slate-400'}`} />
                    <h3 className={`font-bold text-sm ${mode === 'MANUAL' ? 'text-sky-300' : 'text-slate-300'}`}>Tự Động (Cổ Điển)</h3>
                    <p className="text-xs text-slate-500 mt-1">Sử dụng tỷ lệ % cứng thiết lập trong 6 hũ</p>
                  </button>

                  <button
                    onClick={() => setMode('AI')}
                    className={`relative overflow-hidden p-4 rounded-2xl border text-left transition-all group ${
                      mode === 'AI' 
                      ? 'bg-fuchsia-500/10 border-fuchsia-500/50 shadow-[0_0_20px_rgba(217,70,239,0.2)] ring-1 ring-fuchsia-500/30' 
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {mode === 'AI' && (
                      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/20 via-transparent to-transparent opacity-50" />
                    )}
                    <BrainCircuit size={24} className={`mb-3 relative z-10 ${mode === 'AI' ? 'text-fuchsia-400' : 'text-slate-400'}`} />
                    <h3 className={`font-bold text-sm relative z-10 flex items-center gap-2 ${mode === 'AI' ? 'text-fuchsia-300' : 'text-slate-300'}`}>
                      AI Smart Split <Sparkles size={12} className={mode === 'AI' ? 'text-fuchsia-400 animate-pulse' : 'text-slate-500'} />
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 relative z-10">AI tự phân tích và tối ưu lại quỹ</p>
                  </button>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleGeneratePreview}
                    disabled={isProcessing || !amountInputDisplay}
                    className={`w-full py-4 rounded-2xl font-black tracking-wide flex items-center justify-center gap-2 transition-all disabled:opacity-50
                      ${mode === 'AI' 
                        ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/40' 
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40'
                      }
                    `}
                  >
                    {isProcessing ? 'Đang Phân Tích...' : mode === 'AI' ? 'Khởi Động AI Gemini' : 'Xem Trước Tỷ Lệ'}
                  </button>
                </div>
              </div>
            ) : (
              // BƯỚC 2: PREVIEW VÀ CONFIRM
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Xem Trước & Tùy Chỉnh Phân Bổ</h3>
                    <p className="text-xs text-sky-200/50">Cơ chế: {mode === 'AI' ? 'AI Tối Ưu Hóa (Gemini 2.5)' : 'Chỉ định thủ công dựa trên % hũ'}</p>
                  </div>
                  <button onClick={() => setIsPreviewMode(false)} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 px-3 py-1.5 rounded-lg">
                    Quay lại
                  </button>
                </div>

                {isSuccess ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <CheckCircle2 size={64} className="text-emerald-500 mb-4 animate-bounce" />
                    <h2 className="text-2xl font-black text-white">Phân Bổ Thành Công!</h2>
                    <p className="text-slate-400 mt-2">Dòng tiền đã được rót vào các hũ an toàn.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                      {allocations.map((alloc, idx) => {
                        const pocket = pockets.find(p => p.id === alloc.pocketId);
                        if (!pocket) return null;
                        const oldBalance = Number(pocket.balance);
                        const newBalance = oldBalance + alloc.amount;

                        return (
                          <div key={alloc.pocketId} className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3 relative overflow-hidden group">
                            {mode === 'AI' && <div className="absolute top-0 left-0 w-1.5 h-full bg-fuchsia-500" />}
                            
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-slate-200 truncate pr-2">
                                {pocket.name} ({pocket.percentage}%) {(pocket as any).isEssential && '⭐'}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400 font-bold text-sm">+</span>
                              <input 
                                type="text" 
                                value={alloc.amount === 0 ? '' : formatInputVND(alloc.amount.toString())}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, '');
                                  const newVal = Number(raw);
                                  const cloned = [...allocations];
                                  cloned[idx].amount = newVal;
                                  setAllocations(cloned);
                                }}
                                className="w-full bg-black/40 border border-emerald-500/30 rounded-xl py-2 px-3 text-emerald-400 font-bold font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                              />
                            </div>

                            <div className="flex justify-between items-center text-xs mt-1 border-t border-white/5 pt-3">
                              <span className="text-slate-500 line-through decoration-red-500/50">{formatVND(oldBalance)}</span>
                              <span className="text-slate-500">➔</span>
                              <span className="text-white font-bold bg-white/10 px-2 py-0.5 rounded">{formatVND(newBalance)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-4 border-t border-white/10">
                      {allocations.reduce((a,c)=>a+c.amount,0) !== parseVNDToNumber(amountInputDisplay) && (
                        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-center gap-2">
                          <AlertCircle size={16} /> Tổng phân bổ ({formatVND(allocations.reduce((a,c)=>a+c.amount,0))}) đang lệch so với quỹ lương!
                        </div>
                      )}
                      <div className="flex justify-between items-center mb-4 text-sm font-bold text-slate-300">
                        <span>Tổng tiền theo khung:</span>
                        <span className={allocations.reduce((a,c)=>a+c.amount,0) === parseVNDToNumber(amountInputDisplay) ? 'text-emerald-400' : 'text-amber-400'}>
                          {formatVND(allocations.reduce((a,c)=>a+c.amount,0))} / {formatVND(parseVNDToNumber(amountInputDisplay))}
                        </span>
                      </div>
                      <button
                        onClick={handleConfirmDistribution}
                        disabled={isProcessing || isSuccess || allocations.reduce((a,c)=>a+c.amount,0) !== parseVNDToNumber(amountInputDisplay)}
                        className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black tracking-wide flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
                      >
                        {isProcessing ? 'Đang Thực Thi...' : 'Xác Nhận & Nạp Tiền'}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
