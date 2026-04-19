import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X, Loader2, Sparkles, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function FloatingAIWidget() {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Chào bạn! Mình là AI Tài chính thu nhỏ. Mình có thể tính toán nhanh hoặc xem thông tin số dư giúp bạn ngay lúc này.',
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const
  messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const handleBankEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      
      const formatCurrency = (amt: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Math.abs(amt));
      
      let aiMessage = '';
      if (data.amount > 0) {
        aiMessage = `Ting ting! Bạn vừa nhận được ${formatCurrency(data.amount)}. Mình đã cộng số tiền này vào mục Chưa Phân Bổ nhé!`;
      } else {
        aiMessage = `Bạn vừa chi ${formatCurrency(data.amount)} cho "${data.description}". Mình đã tự động ghi nhận giao dịch này rồi, bạn nhớ kiểm tra lại xem có đúng hũ không nhé!`;
      }

      setIsOpen(true);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', content: aiMessage }
      ]);
    };

    window.addEventListener('bank_transaction_ai_msg', handleBankEvent);
    return () => window.removeEventListener('bank_transaction_ai_msg', handleBankEvent);
  }, []);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:3000/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Lỗi server');

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply ?? 'Xin lỗi, mình đang bận. Vui lòng thử lại sau!',
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ ${err?.message ?? 'Lỗi kết nối'}.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      drag
      dragConstraints={{ left: -1000, right: 0, top: -800, bottom: 0 }}
      dragElastic={0.1}
      dragMomentum={false}
      className="fixed z-[9999] bottom-6 right-6 flex flex-col items-end"
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-80 sm:w-96 mb-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onPointerDown={(e) => e.stopPropagation()} // Prevent dragging when clicking inside the window
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-3 flex items-center justify-between text-white cursor-move">
               <div className="flex items-center gap-2">
                  <Bot size={18} />
                  <div>
                      <h3 className="font-bold text-sm">Finance Mini-AI</h3>
                      <p className="text-[10px] opacity-80 flex items-center gap-1"><Sparkles size={10} /> Trợ lý tức thì</p>
                  </div>
               </div>
               <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
               >
                  <X size={16} />
               </button>
            </div>

            {/* Chat Body */}
            <div className="h-72 overflow-y-auto p-4 space-y-4 bg-[var(--bg-base)] custom-scrollbar">
               {messages.map(msg => (
                   <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                       <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                           msg.role === 'user' 
                           ? 'bg-blue-500 text-white rounded-tr-sm' 
                           : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-tl-sm'
                       }`}>
                           <p className="whitespace-pre-wrap">{msg.content}</p>
                       </div>
                   </div>
               ))}
               {isLoading && (
                   <div className="flex justify-start">
                       <div className="px-3 py-2 rounded-xl rounded-tl-sm text-sm bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm flex items-center gap-2">
                           <Loader2 size={14} className="animate-spin text-indigo-500" />
                           <span className="text-[var(--text-muted)] text-xs">AI đang nghĩ...</span>
                       </div>
                   </div>
               )}
               <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-surface)]">
               <div className="relative flex items-center">
                   <input 
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Hỏi nhanh về tiền..."
                      className="w-full pl-3 pr-10 py-2.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-sm outline-none focus:border-indigo-500 text-[var(--text-primary)] transition-colors"
                   />
                   <button 
                      onClick={sendMessage}
                      disabled={!input.trim() || isLoading}
                      className="absolute right-2 p-1.5 rounded-lg bg-indigo-500 text-white disabled:opacity-50 hover:bg-indigo-600 transition-colors"
                   >
                       <Send size={14} />
                   </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shadow-xl shadow-purple-500/30 flex items-center justify-center text-white cursor-pointer relative"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        {!isOpen && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[var(--bg-base)]" />
        )}
      </motion.button>
    </motion.div>
  );
}
