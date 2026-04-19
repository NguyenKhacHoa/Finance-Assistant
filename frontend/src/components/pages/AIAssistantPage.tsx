import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, Sparkles, Trash2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts?: number;
}

const STORAGE_KEY = 'fa_ai_chat_history';

const WELCOME_MSG: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Chào bạn! Mình là Trợ lý AI tài chính 🤖\n\nMình đã kết nối với dữ liệu ví và giao dịch thực tế của bạn. Hãy hỏi mình bất cứ điều gì về tài chính – phân tích chi tiêu, đề xuất tiết kiệm, hay tình trạng mục tiêu!',
  ts: Date.now(),
};

const QUICK_PROMPTS = [
  'Tài chính của tôi tháng này thế nào?',
  'Tôi đang chi tiêu nhiều nhất vào đâu?',
  'Tôi có đạt mục tiêu tiết kiệm không?',
  'Đưa ra lời khuyên cắt giảm chi tiêu',
];

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [WELCOME_MSG];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return parsed.length > 0 ? parsed : [WELCOME_MSG];
  } catch {
    return [WELCOME_MSG];
  }
}

function saveMessages(msgs: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch {
    /* ignore quota errors */
  }
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Persist to localStorage whenever messages change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearHistory = () => {
    const fresh = [{ ...WELCOME_MSG, ts: Date.now() }];
    setMessages(fresh);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('fa_v4_token');
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
        content: data.reply ?? 'Xin lỗi, mình không thể trả lời lúc này.',
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ Lỗi kết nối: ${err?.message ?? 'Không rõ'}. Vui lòng thử lại.`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex items-center gap-4 p-5 rounded-t-3xl border border-b-0 bg-[var(--bg-surface)] border-[var(--border)]">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Bot size={22} className="text-white" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[var(--bg-surface)]" />
        </div>
        <div>
          <h2 className="font-bold text-lg text-[var(--text-primary)]">Finance AI Assistant</h2>
          <p className="text-xs font-medium text-emerald-400">● Đang trực tuyến · Dữ liệu DB thực tế</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
            <Sparkles size={14} className="text-amber-400" /> Gemini 2.5 Flash
          </span>
          {/* Clear History Button */}
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={clearHistory}
            title="Xóa lịch sử chat"
            aria-label="Xóa lịch sử chat"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-[var(--text-muted)] border-[var(--border)]"
          >
            <Trash2 size={13} /> Xóa lịch sử
          </motion.button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 border border-t-0 border-b-0 bg-[var(--bg-base)] border-[var(--border)]">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${msg.role === 'user'
                ? 'bg-gradient-to-br from-sky-500 to-blue-600'
                : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                }`}
            >
              {msg.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
            </div>
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                ? 'rounded-tr-sm text-white bg-gradient-to-br from-blue-500 to-blue-600'
                : 'rounded-tl-sm border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)]'
                }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.ts && (
                <p className={`text-[10px] mt-1.5 opacity-50 ${msg.role === 'user' ? 'text-right text-white' : 'text-[var(--text-muted)]'}`}>
                  {new Date(msg.ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </motion.div>
        ))}

        {/* Loading indicator */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                <Bot size={14} className="text-white" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm border flex items-center gap-2 bg-[var(--bg-surface)] border-[var(--border)]">
                <Loader2 size={14} className="text-indigo-400 animate-spin" />
                <span className="text-sm text-[var(--text-muted)]">Đang phân tích dữ liệu...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length <= 1 && (
        <div className="px-5 py-3 border border-t-0 border-b-0 flex gap-2 overflow-x-auto bg-[var(--bg-base)] border-[var(--border)]">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all hover:scale-105 border-[var(--border)] text-[var(--text-secondary)] bg-[var(--bg-surface)]"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 rounded-b-3xl border border-t-0 bg-[var(--bg-surface)] border-[var(--border)]">
        <div className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Hỏi về chi tiêu, ngân sách, phân tích... (Enter để gửi)"
            className="w-full text-sm py-3 pl-4 pr-12 rounded-2xl resize-none focus:outline-none focus:ring-2 bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] min-h-[48px] max-h-[120px]"
            rows={1}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            title="Gửi tin nhắn"
            aria-label="Gửi tin nhắn"
            className={`absolute right-2 bottom-2 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 text-white ${!input.trim() || isLoading ? 'bg-[var(--border)]' : 'bg-gradient-to-br from-indigo-500 to-purple-500'
              }`}
          >
            <Send size={15} />
          </button>
        </div>
        <p className="text-center text-[10px] mt-2 text-[var(--text-muted)]">
          AI phân tích theo dữ liệu ví & giao dịch thực tế của bạn · Shift+Enter xuống dòng
        </p>
      </div>
    </div>
  );
}
