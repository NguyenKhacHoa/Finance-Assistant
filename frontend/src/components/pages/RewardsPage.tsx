import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Trophy, Star, Zap, Award, Plus, ChevronRight,
  Clock, PiggyBank, Camera, History, Medal,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatVND } from '../../utils/format';

// ── icon mapping dùng chung ────────────────────────────────────────
function badgeIcon(icon: string, cls = 'w-6 h-6') {
  switch (icon) {
    case 'Target':    return <Target className={cls} />;
    case 'Zap':       return <Zap className={cls} />;
    case 'Star':      return <Star className={cls} />;
    case 'Award':     return <Award className={cls} />;
    case 'Camera':    return <Camera className={cls} />;
    case 'PiggyBank': return <PiggyBank className={cls} />;
    default:          return <Trophy className={cls} />;
  }
}

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff} giây trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

type TabId = 'badges' | 'history' | 'goals';

export default function Rewards() {
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>('badges');

  // Goals state
  const [goalTitle, setGoalTitle] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalDays, setGoalDays] = useState('7');
  const [activeGoals, setActiveGoals] = useState<any[]>([]);

  // Badge state
  const [badges, setBadges] = useState<any[]>([]);

  // Point history state
  const [pointHistory, setPointHistory] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) setPoints(user.rewardPoints || 0);
  }, [user]);

  const getHeaders = () => {
    const token = localStorage.getItem('fa_v4_token');
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  const fetchData = async () => {
    try {
      const [goalsRes, badgesRes, historyRes] = await Promise.all([
        fetch('http://localhost:3000/gamification/goals', { headers: getHeaders() }),
        fetch('http://localhost:3000/gamification/badges', { headers: getHeaders() }),
        fetch('http://localhost:3000/gamification/points/history', { headers: getHeaders() }),
      ]);

      if (goalsRes.ok) setActiveGoals(await goalsRes.json());
      if (badgesRes.ok) setBadges(await badgesRes.json());
      if (historyRes.ok) setPointHistory(await historyRes.json());

      // Refresh user points from auth
      const meRes = await fetch('http://localhost:3000/auth/me', { headers: getHeaders() });
      if (meRes.ok) {
        const me = await meRes.json();
        setPoints(me.rewardPoints ?? 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateGoal = async () => {
    if (!goalTitle || !goalAmount || !goalDays) return;
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + parseInt(goalDays));
      await fetch('http://localhost:3000/gamification/goals', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ title: goalTitle, targetAmount: Number(goalAmount.replace(/\D/g, '')), deadline: targetDate.toISOString() })
      });
      setGoalTitle(''); setGoalAmount(''); setGoalDays('7');
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleFundGoal = async (id: string) => {
    try {
      await fetch('http://localhost:3000/gamification/goals/fund', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ goalId: id, amount: 100000 })
      });
      await fetch('http://localhost:3000/gamification/evaluate', { method: 'POST', headers: getHeaders() });
      await fetchData();
    } catch (e) { console.error(e); }
  };

  const unlockedCount = badges.filter(b => b.unlocked).length;
  let tierName = 'Hạng Đồng';
  let tierGradient = 'from-amber-700 to-amber-900';
  if (unlockedCount >= 12) { tierName = 'Kim Cương'; tierGradient = 'from-indigo-600 via-purple-600 to-pink-500'; }
  else if (unlockedCount >= 9) { tierName = 'Bạch Kim'; tierGradient = 'from-cyan-500 via-sky-600 to-blue-700'; }
  else if (unlockedCount >= 6) { tierName = 'Hạng Vàng'; tierGradient = 'from-yellow-400 via-orange-500 to-amber-600'; }
  else if (unlockedCount >= 3) { tierName = 'Hạng Bạc'; tierGradient = 'from-slate-400 via-gray-500 to-slate-600'; }

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'badges',  label: 'Huy Hiệu',      icon: <Medal size={15} /> },
    { id: 'history', label: 'Lịch Sử Điểm',  icon: <History size={15} /> },
    { id: 'goals',   label: 'Mục Tiêu',       icon: <Target size={15} /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-6xl mx-auto space-y-8 pb-12"
    >
      {/* ── Hero Header ── */}
      <div className={`relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br ${tierGradient} p-8 text-white shadow-2xl`}>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-widest">
              <Star size={12} className="fill-current" /> Member Elite
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Thợ Săn Điểm Thưởng</h1>
            <p className="text-white/80 font-medium">{tierName} • {unlockedCount} Huy hiệu đã mở khóa</p>
          </div>
          <div className="flex items-center gap-6 bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/40">
              <Award size={32} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-200 uppercase tracking-tighter">W-Points tích lũy</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black tabular-nums">{points.toLocaleString()}</span>
                <span className="text-sm font-bold text-indigo-200">PTS</span>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-64 h-64 bg-pink-400/20 rounded-full blur-3xl" />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 p-1 rounded-2xl" style={{ background: 'var(--border)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${
              activeTab === tab.id
                ? 'bg-[var(--bg-surface)] text-[var(--primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── TAB: Huy Hiệu ── */}
        {activeTab === 'badges' && (
          <motion.div
            key="badges"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Trophy size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Tủ Kính Huy Hiệu</h2>
                  <p className="text-xs text-slate-400">Hoàn thành nhiệm vụ để sưu tầm</p>
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                {badges.map((b) => (
                  <motion.div
                    key={b.id}
                    whileHover={b.unlocked ? { scale: 1.15, rotate: 5, y: -8 } : { scale: 1.05 }}
                    className="relative group"
                  >
                    <div className={`aspect-square rounded-2xl flex items-center justify-center relative overflow-hidden backdrop-blur-md transition-all duration-500 ${
                      b.unlocked
                        ? 'bg-gradient-to-br from-indigo-500/30 to-purple-600/30 border border-indigo-400/40 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.3)]'
                        : 'bg-white/5 border border-white/5 text-slate-600 grayscale opacity-30'
                    }`}>
                      {b.unlocked && <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent animate-pulse" />}
                      <div className="relative z-10">{badgeIcon(b.icon)}</div>
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-52 p-3 rounded-2xl bg-[#0c1624]/95 backdrop-blur-xl border border-white/10 shadow-2xl opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 pointer-events-none z-50">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${b.unlocked ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                        <h4 className="text-xs font-black text-white">{b.name}</h4>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed">{b.description}</p>
                      {!b.unlocked && b.requiredPoints > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
                          <span className="text-[9px] text-slate-500 uppercase tracking-wider">Yêu cầu</span>
                          <span className="text-xs font-black text-amber-500 flex items-center gap-0.5">
                            <Star size={9} className="fill-current" /> {b.requiredPoints.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {b.unlocked && (
                        <div className="mt-2 pt-2 border-t border-indigo-500/30">
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">✨ Đã sở hữu</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB: Lịch Sử Điểm ── */}
        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="rounded-[2rem] border overflow-hidden"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-4 p-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <History size={20} />
              </div>
              <div>
                <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Lịch Sử Nhận Thưởng</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Toàn bộ điểm tích lũy của bạn</p>
              </div>
            </div>

            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {pointHistory.length === 0 ? (
                <div className="py-16 text-center">
                  <Clock size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Chưa có lịch sử điểm</p>
                </div>
              ) : (
                pointHistory.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-4 px-6 py-4"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
                      log.delta > 0
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {log.delta > 0 ? `+${log.delta}` : log.delta}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {log.reason}
                      </p>
                      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <Clock size={10} /> {timeAgo(log.createdAt)}
                      </p>
                    </div>
                    <span className={`text-sm font-black shrink-0 ${log.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {log.delta > 0 ? '+' : ''}{log.delta} PTS
                    </span>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* ── TAB: Mục Tiêu ── */}
        {activeTab === 'goals' && (
          <motion.div
            key="goals"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="rounded-[2rem] border overflow-hidden"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            {/* Form tạo Goal */}
            <div className="p-6 border-b space-y-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Target size={18} style={{ color: 'var(--primary)' }} /> Lập Mục Tiêu Mới
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  value={goalTitle}
                  onChange={e => setGoalTitle(e.target.value)}
                  placeholder="Tên mục tiêu..."
                  className="px-4 py-3 rounded-xl text-sm font-medium outline-none border focus:ring-2"
                  style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                />
                <input
                  value={goalAmount}
                  onChange={e => setGoalAmount(e.target.value)}
                  placeholder="Số tiền (VNĐ)"
                  className="px-4 py-3 rounded-xl text-sm font-medium outline-none border"
                  style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                />
                <div className="flex gap-2">
                  <input
                    type="number" value={goalDays}
                    onChange={e => setGoalDays(e.target.value)}
                    placeholder="Số ngày"
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-medium outline-none border"
                    style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                  />
                  <button
                    onClick={handleCreateGoal}
                    className="px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95"
                    style={{ background: 'var(--primary)', color: '#000' }}
                  >
                    <Plus size={16} /> Tạo
                  </button>
                </div>
              </div>
            </div>

            {/* Goal List */}
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              <AnimatePresence mode="popLayout">
                {activeGoals.map((g) => {
                  const current = Number(g.currentAmount ?? 0);
                  const target = Number(g.targetAmount ?? 1);
                  const pct = Math.min(100, Math.round((current / target) * 100));
                  const isDone = g.status === 'COMPLETED';
                  const daysLeft = g.deadline ? Math.max(0, Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000)) : null;

                  return (
                    <motion.div
                      layout key={g.id}
                      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="p-6 flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{g.title}</h4>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {isDone ? '🌟 Đã hoàn thành' : daysLeft !== null ? `📅 Còn ${daysLeft} ngày` : ''}
                          </p>
                        </div>
                        <span className={`text-xl font-black ${isDone ? 'text-emerald-400' : ''}`} style={!isDone ? { color: 'var(--primary)' } : {}}>
                          {pct}%
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          className={`h-full rounded-full ${isDone ? 'bg-emerald-400' : 'bg-[var(--primary)]'}`}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{formatVND(current)}</span>
                          {' / '}{formatVND(target)}
                        </span>
                        {!isDone && (
                          <button
                            onClick={() => handleFundGoal(g.id)}
                            className="px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105"
                            style={{ background: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid var(--primary)' }}
                          >
                            + Nạp 100K <ChevronRight size={12} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {activeGoals.length === 0 && !isLoading && (
                <div className="py-16 text-center">
                  <Target size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chưa có mục tiêu nào. Hãy tạo mục tiêu đầu tiên!</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}
