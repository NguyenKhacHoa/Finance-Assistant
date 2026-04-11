import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Save, AlertCircle, CheckCircle, Wallet, List, Tag } from 'lucide-react';
import { useAuth, authFetch } from '../../context/AuthContext';
import OCRProcessingOverlay from '../ai/OCRProcessingOverlay';
import { formatVND, formatInputVND, parseVNDToNumber } from '../../utils/format';
import { notificationBus } from '../../utils/notificationBus';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  { id: 'Food', name: 'Ăn uống' },
  { id: 'Entertainment', name: 'Giải trí' },
  { id: 'Utility', name: 'Tiện ích' },
  { id: 'Education', name: 'Giáo dục' },
  { id: 'Transport', name: 'Di chuyển' },
  { id: 'Healthcare', name: 'Sức khỏe' },
  { id: 'Salary', name: 'Lương' },
  { id: 'Other', name: 'Khác' },
];

export default function AddTransactionModal({ isOpen, onClose, onSuccess }: AddTransactionModalProps) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [category, setCategory] = useState('Other');
  const [type, setType] = useState<'EXPENSE' | 'INCOME' | 'LUONG'>('EXPENSE');
  const [metadata, setMetadata] = useState<any>(null);
  const [pockets, setPockets] = useState<any[]>([]);
  const [pocketId, setPocketId] = useState('');

  useEffect(() => {
    const fetchPockets = async () => {
      try {
        const data = await authFetch<any[]>('/pockets', {}, token);
        setPockets(data);
        if (data.length > 0) setPocketId(data[0].id);
      } catch (e) {
        console.error(e);
      }
    };
    if (isOpen && token) fetchPockets();
  }, [isOpen, token]);

  useEffect(() => {
    if (category === 'Salary') {
      setType('INCOME');
      const essential = pockets.find(p => p.isEssential);
      if (essential) setPocketId(essential.id);
    }
  }, [category, pockets]);

  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:3000/ai/scan-receipt', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Không thể quét hóa đơn. Vui lòng thử lại.');
      
      const result = await res.json();
      const data = result.data;

      // Auto-fill Logic
      setTitle(data.vendor || 'Hóa đơn mới');
      setAmountDisplay(formatInputVND(String(data.totalAmount || '')));
      setMetadata({ 
        vendor: data.vendor,
        tax: data.tax,
        itemsCount: data.items?.length,
        items: data.items,
        scanDate: new Date().toISOString()
      });
      
      // Map AI category to our categories
      const aiCat = data.categorySuggestion || '';
      const matched = CATEGORIES.find(c => c.name.toLowerCase() === aiCat.toLowerCase() || c.id.toLowerCase() === aiCat.toLowerCase());
      if (matched) setCategory(matched.id);
      
      // Auto-select pocket based on name or isEssential if AI suggests "Thiết yếu"
      if (aiCat.includes('Thiết yếu')) {
        const essential = pockets.find(p => p.isEssential);
        if (essential) setPocketId(essential.id);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseVNDToNumber(amountDisplay);
    if (!title || !amountNum || !pocketId) {
      setError('Vui lòng điền đầy đủ thông tin và số tiền hợp lệ.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:3000/transactions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          amount: amountNum,
          category,
          type,
          pocketId,
          metadata
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || `Đã xảy ra lỗi (HTTP ${res.status}). Vui lòng thử lại.`);
      }

      // Push to notification feed
      notificationBus.push({
        type: type === 'INCOME' ? 'income' : 'expense',
        message: `${type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu'}: ${title}.`,
        amount: amountNum,
      });

      // Emitting global event to force Dashboard/Charts to reload
      window.dispatchEvent(new CustomEvent('finance_update'));

      onSuccess();
      onClose();
      // Reset form
      setTitle(''); setAmountDisplay(''); setType('EXPENSE'); setMetadata(null);
    } catch (err: any) {
      setError(err?.message ?? 'Lỗi không xác định. Vui lòng kiểm tra kết nối.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#050d18]/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-[#0c1624] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Thêm Giao Dịch</h2>
              <p className="text-xs text-sky-200/50 mt-1">Ghi lại các khoản thu chi của bạn</p>
            </div>
            <button
              onClick={onClose}
              title="Đóng cửa sổ"
              aria-label="Đóng cửa sổ"
              className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {pockets.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center mb-5">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Chưa có hũ tài chính</h3>
              <p className="text-sm text-sky-200/50 mb-8">Vui lòng thiết lập hũ tài chính trước khi ghi chép.</p>
              <button
                onClick={onClose}
                className="px-8 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white font-bold text-sm"
              >
                Đóng
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* AI Scan Button */}
            <div className="relative group">
              <button
                type="button"
                onClick={handleScanClick}
                className="w-full py-4 rounded-2xl border-2 border-dashed border-sky-500/30 bg-sky-500/5 flex flex-col items-center gap-2 hover:bg-sky-500/10 hover:border-sky-500/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                  <Camera size={24} />
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-white">Quét hóa đơn bằng AI</span>
                  <p className="text-[10px] text-sky-200/40 uppercase tracking-widest mt-1">Gemini 2.5 Flash OCR 2.0</p>
                </div>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
                aria-label="Upload ảnh hóa đơn"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm"
              >
                <AlertCircle size={18} />
                <span>{error}</span>
              </motion.div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType('EXPENSE')}
                className={`py-3 rounded-xl font-bold text-sm transition-all ${
                  type === 'EXPENSE' 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                    : 'bg-white/5 text-white/40 border border-transparent'
                }`}
              >
                Chi tiêu
              </button>
              <button
                type="button"
                onClick={() => setType('INCOME')}
                className={`py-3 rounded-xl font-bold text-sm transition-all ${
                  type === 'INCOME' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-white/5 text-white/40 border border-transparent'
                }`}
              >
                Thu nhập
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-sky-200/40 uppercase tracking-wider ml-1">Tiêu đề giao dịch</label>
                <div className="relative">
                  <List size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-200/20" />
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Ăn trưa, Lương tháng..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-white/10 focus:border-sky-500/50 focus:bg-white/10 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-sky-200/40 uppercase tracking-wider ml-1">Số tiền (VNĐ)</label>
                  <input
                    type="text"
                    required
                    value={amountDisplay}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setAmountDisplay(formatInputVND(raw));
                    }}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-white/10 focus:border-sky-500/50 focus:bg-white/10 outline-none transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-sky-200/40 uppercase tracking-wider ml-1">Phân loại</label>
                  <div className="relative">
                    <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-200/20" />
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      title="Chọn phân loại"
                      aria-label="Chọn phân loại"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:border-sky-500/50 outline-none appearance-none transition-all"
                    >
                      {CATEGORIES.map(c => <option key={c.id} value={c.id} className="bg-[#0c1624]">{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-sky-200/40 uppercase tracking-wider ml-1">Hũ tài chính</label>
                <div className="relative">
                  <Wallet size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-200/20" />
                  <select
                    value={pocketId}
                    onChange={(e) => setPocketId(e.target.value)}
                    title="Chọn hũ tài chính"
                    aria-label="Chọn hũ tài chính"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:border-sky-500/50 outline-none appearance-none transition-all"
                  >
                    {pockets.map(p => <option key={p.id} value={p.id} className="bg-[#0c1624]">{p.name} - ({formatVND(Number(p.balance))})</option>)}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving ? <CheckCircle size={20} className="animate-spin" /> : <Save size={20} />}
              {isSaving ? 'Đang lưu...' : 'Lưu Giao Dịch'}
            </button>
          </form>
          )}

          <AnimatePresence>
            {isScanning && <OCRProcessingOverlay />}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
