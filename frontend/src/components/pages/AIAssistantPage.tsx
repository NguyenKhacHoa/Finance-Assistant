import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { formatVND } from '../../utils/format';
import {
  Send, User, Loader2, Sparkles, Trash2, Zap,
  TrendingUp, TrendingDown, Target, PiggyBank, BarChart3,
  CheckCircle2, ChevronRight, Brain,
  Wallet, ArrowUpRight, Clock, AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AgentAction {
  tool: string;
  args: Record<string, any>;
  result: 'success' | 'error';
  detail: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts?: number;
  actionsExecuted?: AgentAction[];
  pendingActions?: PendingAction[];
}

interface PendingAction {
  id: string;
  label: string;
  description: string;
  payload: { message: string };
  variant: 'primary' | 'success' | 'warning';
}

interface InsightData {
  pockets: any[];
  goals: any[];
  recentTransactions: any[];
  monthlySummary: { month: string; income: number; expense: number }[];
  unallocatedBalance: number;
  totalAssets: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STORAGE_KEY = 'fa_strategy_chat_v2';

const WELCOME_MSG: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Xin chào! Tôi là **ARIA** — Financial Strategy AI 🧠

Tôi đã kết nối với toàn bộ dữ liệu tài chính của bạn (6 tháng giao dịch, số dư hũ, mục tiêu). Tôi có thể:

✅ **Thực thi lệnh**: Ghi chi tiêu, phân bổ tiền, tạo hũ mới
📊 **Phân tích chiến lược**: Xu hướng chi tiêu, dự báo tài chính  
🎯 **Lập kế hoạch**: Mục tiêu tiết kiệm, kế hoạch mua nhà/xe  

Bạn muốn bắt đầu từ đâu?`,
  ts: Date.now(),
};

const STRATEGY_PROMPTS = [
  { icon: BarChart3, label: 'Phân tích chi tiêu 6 tháng', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  { icon: TrendingDown, label: 'Hũ nào đang chi tiêu quá đà?', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
  { icon: Target, label: 'Lập kế hoạch mua nhà', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  { icon: PiggyBank, label: 'Tối ưu tỷ lệ % các hũ', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  { icon: TrendingUp, label: 'Dự báo số dư tháng sau', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
  { icon: Brain, label: 'Chiến lược tiết kiệm thông minh', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' },
];

const POCKET_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [WELCOME_MSG];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return parsed.length > 0 ? parsed : [WELCOME_MSG];
  } catch { return [WELCOME_MSG]; }
}

function saveMessages(msgs: ChatMessage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50))); } catch { /* ignore */ }
}

function formatMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-xs font-mono">$1</code>');
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: AgentAction }) {
  const isSuccess = action.result === 'success';
  const toolLabel: Record<string, string> = {
    create_transaction: '💳 Giao dịch',
    update_pocket_percentage: '⚙️ Tỷ lệ hũ',
    create_pocket: '🪣 Hũ mới',
    distribute_funds: '💰 Phân bổ',
    manage_goal: '🎯 Mục tiêu',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
      isSuccess
        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
    }`}>
      {isSuccess ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
      {toolLabel[action.tool] ?? action.tool}
    </div>
  );
}

function PendingActionButton({ action, onConfirm }: { action: PendingAction; onConfirm: (msg: string) => void }) {
  const variantMap = {
    primary: 'bg-indigo-500 hover:bg-indigo-400 shadow-indigo-500/30',
    success: 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/30',
    warning: 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/30',
  };
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onConfirm(action.payload.message)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-colors ${variantMap[action.variant]}`}
    >
      <Zap size={11} />
      {action.label}
      <ChevronRight size={11} className="opacity-60" />
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Insight Panel
// ─────────────────────────────────────────────────────────────────────────────

function InsightPanel({ data, isLoading }: { data?: InsightData; isLoading: boolean }) {
  if (isLoading) return (
    <div className="flex flex-col gap-4 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-32 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)]" />
      ))}
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-[var(--text-muted)]">
      <Brain size={32} className="opacity-30" />
      <p className="text-sm">Dữ liệu đang tải...</p>
    </div>
  );

  const realPockets = data.pockets.filter(p => p.name !== 'Tiền chưa vào hũ');
  const pieData = realPockets.map(p => ({
    name: p.name,
    value: Number(p.balance) || 0,
  })).filter(p => p.value > 0);

  const lastMonth = data.monthlySummary[data.monthlySummary.length - 1];
  const prevMonth = data.monthlySummary[data.monthlySummary.length - 2];
  const expenseDelta = lastMonth && prevMonth
    ? ((lastMonth.expense - prevMonth.expense) / (prevMonth.expense || 1)) * 100
    : 0;

  const activeGoals = data.goals.filter(g => g.status === 'ACTIVE');

  return (
    <div className="flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar" style={{ maxHeight: 'calc(100vh - 140px)' }}>

      {/* Tổng quan số dư */}
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-indigo-500/10 to-violet-500/10 p-4">
        <p className="text-xs font-semibold text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
          <Wallet size={12} /> Tổng tài sản
        </p>
        <p className="text-2xl font-black text-[var(--text-primary)]">{formatVND(data.totalAssets, true)}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-amber-400 font-semibold">
            Chưa phân bổ: {formatVND(data.unallocatedBalance, true)}
          </span>
        </div>
      </div>

      {/* Biểu đồ thu/chi 6 tháng */}
      {data.monthlySummary.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <BarChart3 size={12} className="text-indigo-400" /> Thu/Chi 6 Tháng
            </p>
            {expenseDelta !== 0 && lastMonth && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                expenseDelta > 0
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {expenseDelta > 0 ? '↑' : '↓'} {Math.abs(expenseDelta).toFixed(0)}%
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={data.monthlySummary} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 11 }}
                formatter={(v: number, name: string) => [formatVND(v, true), name === 'income' ? 'Thu nhập' : 'Chi tiêu']}
              />
              <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#incomeGrad)" />
              <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2} fill="url(#expenseGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pie chart hũ tài chính */}
      {pieData.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-xs font-bold text-[var(--text-primary)] mb-3 flex items-center gap-1.5">
            <PiggyBank size={12} className="text-violet-400" /> Phân bổ Hũ
          </p>
          <div className="flex items-center gap-3">
            <ResponsiveContainer width={90} height={90}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={25} outerRadius={42} dataKey="value" strokeWidth={0}>
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={POCKET_COLORS[index % POCKET_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {realPockets.slice(0, 5).map((p, i) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: POCKET_COLORS[i % POCKET_COLORS.length] }} />
                    <span className="text-[10px] text-[var(--text-muted)] max-w-[80px] truncate">{p.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">{Number(p.percentage)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tiến độ mục tiêu */}
      {activeGoals.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-xs font-bold text-[var(--text-primary)] mb-3 flex items-center gap-1.5">
            <Target size={12} className="text-amber-400" /> Mục Tiêu Đang Theo Đuổi
          </p>
          <div className="space-y-3">
            {activeGoals.slice(0, 3).map((g: any) => {
              const pct = Math.min(100, Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100));
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[var(--text-secondary)] font-medium truncate max-w-[120px]">{g.title}</span>
                    <span className="text-[var(--text-muted)]">{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--bg-base)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] mt-0.5 text-[var(--text-muted)]">
                    <span>{formatVND(Number(g.currentAmount), true)}</span>
                    <span>{formatVND(Number(g.targetAmount), true)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Giao dịch gần nhất */}
      {data.recentTransactions.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-xs font-bold text-[var(--text-primary)] mb-3 flex items-center gap-1.5">
            <Clock size={12} className="text-sky-400" /> Giao Dịch Gần Nhất
          </p>
          <div className="space-y-2">
            {data.recentTransactions.slice(0, 5).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    tx.type === 'INCOME' ? 'bg-emerald-500/15' : 'bg-rose-500/15'
                  }`}>
                    {tx.type === 'INCOME'
                      ? <ArrowUpRight size={11} className="text-emerald-400" />
                      : <TrendingDown size={11} className="text-rose-400" />
                    }
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)] truncate max-w-[100px]">{tx.title}</span>
                </div>
                <span className={`text-[10px] font-bold ${tx.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tx.type === 'INCOME' ? '+' : '-'}{formatVND(Number(tx.amount), true)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AIAssistantPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Persist messages
  useEffect(() => { saveMessages(messages); }, [messages]);

  // Scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Fetch Insight Data ────────────────────────────────────────────────────
  const { data: insightData, isLoading: insightLoading } = useQuery<InsightData>({
    queryKey: ['ai-insight'],
    queryFn: async (): Promise<InsightData> => {
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      const [pocketsRes, goalsRes, txRes] = await Promise.all([
        fetch(`${API}/pockets`, { headers }),
        fetch(`${API}/goals`, { headers }),
        fetch(`${API}/transactions?limit=100`, { headers }),
      ]);

      const [pocketsRaw, goalsData, txData] = await Promise.all([
        pocketsRes.ok ? pocketsRes.json() : [],
        goalsRes.ok ? goalsRes.json() : [],
        txRes.ok ? txRes.json() : [],
      ]) as [any, any, any];

      const pockets: any[] = Array.isArray(pocketsRaw) ? pocketsRaw : (pocketsRaw?.pockets ?? []);
      const realPockets2 = pockets.filter((p: any) => p.name !== 'Tiền chưa vào hũ');
      const unallocatedPocket = pockets.find((p: any) => p.name === 'Tiền chưa vào hũ');
      const pocketTotalBalance = realPockets2.reduce((s: number, p: any) => s + Number(p.balance || 0), 0);
      const unallocatedBalance = Number(unallocatedPocket?.balance || 0);
      const totalAssets = pocketTotalBalance + unallocatedBalance;

      const txList: any[] = Array.isArray(txData) ? txData : (txData?.data ?? txData?.transactions ?? []);
      const monthMap: Record<string, { income: number; expense: number }> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
        monthMap[key] = { income: 0, expense: 0 };
      }
      txList.forEach((tx: any) => {
        const d = new Date(tx.createdAt || tx.date);
        const key = `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
        if (monthMap[key]) {
          if (tx.type === 'INCOME') monthMap[key].income += Number(tx.amount);
          else monthMap[key].expense += Number(tx.amount);
        }
      });

      const monthlySummary = Object.entries(monthMap).map(([month, v]) => ({ month, ...v }));

      return {
        pockets: realPockets2,
        goals: Array.isArray(goalsData) ? goalsData : (goalsData?.data ?? []),
        recentTransactions: txList.slice(0, 10),
        monthlySummary,
        unallocatedBalance,
        totalAssets,
      };
    },
    staleTime: 30_000,
    enabled: !!token,
  });

  // ── Send Message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      ts: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/ai/agent-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Lỗi server');

      const actionsExecuted: AgentAction[] = data.actionsExecuted ?? [];
      const hasAction = actionsExecuted.some(a => a.result === 'success');

      // Invalidate cache nếu có thay đổi DB
      if (hasAction) {
        queryClient.invalidateQueries({ queryKey: ['stats'] });
        queryClient.invalidateQueries({ queryKey: ['pockets'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['goals'] });
        queryClient.invalidateQueries({ queryKey: ['ai-insight'] });
      }

      // Tạo Pending Action Buttons nếu AI đề xuất tăng %
      const replyText: string = data.reply ?? 'Xin lỗi, mình không thể trả lời lúc này.';
      const pendingActions: PendingAction[] = [];

      // Detect nếu AI đang hỏi về việc tăng % hũ
      const increasePctMatch = replyText.match(/tăng tỷ lệ %.*?hũ\s+([""]?[\w\s]+[""]?)/i);
      if (increasePctMatch && replyText.toLowerCase().includes('có muốn')) {
        pendingActions.push({
          id: `pa-${Date.now()}`,
          label: 'Có, tăng tỷ lệ % và phân bổ lại',
          description: 'ARIA sẽ tăng tỷ lệ % hũ rồi phân bổ tiền ngay',
          payload: { message: 'Có, em hãy tăng tỷ lệ phù hợp và phân bổ lại cho anh nhé' },
          variant: 'success',
        });
        pendingActions.push({
          id: `pa2-${Date.now()}`,
          label: 'Không, giảm số tiền nạp thay',
          description: 'Chỉ nạp số tiền vừa đủ với gap hiện tại',
          payload: { message: 'Không cần tăng %, em hãy giảm số tiền nạp xuống bằng khoảng trống hiện tại nhé' },
          variant: 'warning',
        });
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyText,
        ts: Date.now(),
        actionsExecuted: actionsExecuted.length > 0 ? actionsExecuted : undefined,
        pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Lỗi kết nối: ${err?.message ?? 'Không rõ'}. Vui lòng thử lại.`,
        ts: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isLoading, token, queryClient]);

  const clearHistory = () => {
    setMessages([{ ...WELCOME_MSG, ts: Date.now() }]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-80px)] w-full max-w-[1400px] mx-auto">

      {/* ── LEFT: Deep Chat ──────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 rounded-3xl border border-[var(--border)] overflow-hidden bg-[var(--bg-surface)]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border)] bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-transparent shrink-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Brain size={18} className="text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[var(--bg-surface)] animate-pulse" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-[var(--text-primary)] text-sm leading-tight">ARIA — Financial Strategy AI</h2>
            <p className="text-[10px] text-emerald-400 font-medium">● Đang trực tuyến · 6 tháng dữ liệu · 6 Tools thực thi</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1 text-[10px] font-medium text-[var(--text-muted)] bg-[var(--bg-base)] px-2 py-1 rounded-lg border border-[var(--border)]">
              <Sparkles size={10} className="text-amber-400" /> Gemini 2.5 Flash
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={clearHistory}
              title="Xóa lịch sử chat"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold border text-[var(--text-muted)] border-[var(--border)] hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
            >
              <Trash2 size={11} /> Xóa
            </motion.button>
          </div>
        </div>

        {/* Strategy Quick Prompts */}
        <AnimatePresence>
          {messages.length <= 1 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-base)] shrink-0"
            >
              <p className="text-[10px] font-semibold text-[var(--text-muted)] mb-2 flex items-center gap-1">
                <Zap size={10} className="text-amber-400" /> GỢI Ý CHIẾN LƯỢC NHANH
              </p>
              <div className="grid grid-cols-2 gap-2">
                {STRATEGY_PROMPTS.map((p) => (
                  <motion.button
                    key={p.label}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => sendMessage(p.label)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${p.bg}`}
                  >
                    <p.icon size={13} className={p.color} />
                    <span className={`text-[10px] font-semibold ${p.color}`}>{p.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[var(--bg-base)]">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-sky-500 to-blue-600'
                  : 'bg-gradient-to-br from-violet-500 to-indigo-600'
              }`}>
                {msg.role === 'user'
                  ? <User size={12} className="text-white" />
                  : <Brain size={12} className="text-white" />
                }
              </div>

              {/* Bubble */}
              <div className={`max-w-[80%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'rounded-tr-sm text-white bg-gradient-to-br from-blue-500 to-indigo-600'
                    : 'rounded-tl-sm border bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)]'
                }`}>
                  <p
                    className="whitespace-pre-wrap [&_strong]:font-bold [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                  />
                  {msg.ts && (
                    <p className={`text-[9px] mt-1.5 opacity-50 ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {new Date(msg.ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {/* Action Badges */}
                {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.actionsExecuted.map((action, i) => (
                      <ActionBadge key={i} action={action} />
                    ))}
                  </div>
                )}

                {/* Pending Action Buttons (inline trong chat) */}
                {msg.pendingActions && msg.pendingActions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap gap-2 mt-1"
                  >
                    {msg.pendingActions.map((pa) => (
                      <PendingActionButton key={pa.id} action={pa} onConfirm={sendMessage} />
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Loading */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-3"
              >
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <Brain size={12} className="text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm border flex items-center gap-2.5 bg-[var(--bg-surface)] border-violet-500/40">
                  <div className="flex gap-1">
                    {[0, 0.15, 0.3].map((delay, i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-violet-400"
                        animate={{ y: [-3, 0, -3] }}
                        transition={{ duration: 0.7, repeat: Infinity, delay }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-violet-300">ARIA đang phân tích & thực thi...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
          <div className="relative flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
              }}
              placeholder={`"Ghi 150k ăn trưa vào hũ Thiết yếu" · "Phân tích chi tiêu tháng này" · "Tạo hũ Du lịch 10%"...`}
              className="flex-1 text-sm py-3 pl-4 pr-12 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40 bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] min-h-[48px] max-h-[120px] transition-all"
              rows={1}
            />
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 text-white bg-gradient-to-br from-violet-500 to-indigo-600 disabled:bg-[var(--border)] disabled:bg-none shadow-lg shadow-violet-500/30"
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </motion.button>
          </div>
          <p className="text-center text-[9px] mt-2 text-[var(--text-muted)]">
            ARIA có thể thực thi lệnh tài chính · Shift+Enter xuống dòng · Dữ liệu thực tế từ DB
          </p>
        </div>
      </div>

      {/* ── RIGHT: Insight Panel ─────────────────────────────────────────── */}
      <div className="w-72 shrink-0 hidden lg:flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
          <BarChart3 size={15} className="text-indigo-400" />
          <h3 className="font-bold text-xs text-[var(--text-primary)]">Insight Panel</h3>
          <span className="ml-auto text-[9px] text-[var(--text-muted)] bg-[var(--bg-base)] px-1.5 py-0.5 rounded-lg border border-[var(--border)]">
            Realtime
          </span>
        </div>

        {/* Data */}
        <InsightPanel data={insightData} isLoading={insightLoading} />
      </div>
    </div>
  );
}
