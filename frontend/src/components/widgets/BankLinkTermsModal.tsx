import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowRight, X, Lock, Eye, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface BankLinkTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export default function BankLinkTermsModal({ isOpen, onClose, onAccept }: BankLinkTermsModalProps) {
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      onAccept();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden rounded-3xl"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10">
                <ShieldCheck className="text-blue-500" size={24} />
              </div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Điều khoản bảo mật dữ liệu
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 transition-colors rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Để tính năng tự động hóa trên <strong>FinanceAI</strong> diễn ra trơn tru, chúng tôi 
              cần cập nhật biến động số dư theo thời gian thực từ ngân hàng của bạn.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-2xl" style={{ background: 'var(--bg-base)' }}>
                <Eye className="mt-0.5 text-blue-500 shrink-0" size={20} />
                <div>
                  <h4 className="font-semibold text-[var(--text-primary)]">Chỉ đọc dữ liệu giao dịch</h4>
                  <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                    Hệ thống chỉ tiếp nhận các thông báo biến động số dư (biến động tăng/giảm), bao gồm số tiền và nội dung chuyển khoản.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl" style={{ background: 'var(--bg-base)' }}>
                <Lock className="mt-0.5 text-emerald-500 shrink-0" size={20} />
                <div>
                  <h4 className="font-semibold text-[var(--text-primary)]">Không lưu mật khẩu ngân hàng</h4>
                  <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                    FinanceAI hoạt động thông qua Webhook. Chúng tôi <strong>tuyệt đối không yêu cầu</strong> tên đăng nhập, 
                    mật khẩu, mã OTP, hay bất kỳ thông tin truy cập ngân hàng nào.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl" style={{ background: 'var(--bg-base)' }}>
                <AlertTriangle className="mt-0.5 text-amber-500 shrink-0" size={20} />
                <div>
                  <h4 className="font-semibold text-[var(--text-primary)]">Không có quyền giao dịch</h4>
                  <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                    FinanceAI <strong>không thể và sẽ không bao giờ</strong> tự ý thực hiện chuyển tiền, 
                    thanh toán, hay bất kì hành động nào tác động tới tài sản của bạn.
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Bằng cách nhấn Đồng ý, bạn xác nhận đã hiểu rõ cơ chế hoạt động, cũng như 
              sẽ cấp quyền cho cấu hình Webhook nhận thông báo.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 p-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-semibold transition-colors rounded-xl hover:bg-[var(--border)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleAccept}
              disabled={loading}
              className="flex items-center justify-center flex-1 gap-2 py-3 text-sm font-bold text-white transition-opacity bg-blue-500 rounded-xl hover:bg-blue-600 disabled:opacity-50"
            >
              Tôi đồng ý <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
