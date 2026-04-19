import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatVND } from '../../utils/format';
import { generateChartData, type ChartPoint } from '../../utils/chartDataUtils';

// ─── Y-Axis formatter ──────────────────────────────────────────────────────────
/**
 * Rút gọn số VNĐ để hiển thị trên YAxis:
 *  ≥ 1.000.000.000 → "1,0 tỷ"
 *  ≥ 1.000.000     → "1,0 tr"   (triệu)
 *  ≥ 1.000         → "1,0 k"
 *  < 1.000         → giá trị nguyên
 */
function formatYAxis(value: number): string {
  if (value === 0) return '0';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace('.', ',')} tỷ`;
  if (value >= 1_000_000)     return `${(value / 1_000_000).toFixed(1).replace('.', ',')} tr`;
  if (value >= 1_000)         return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

/**
 * Tính domain YAxis với padding 20% phía trên so với max thực tế,
 * đồng thời làm tròn max lên đến mức "đẹp" (multiple of a nice step)
 * để grid lines trùng với các mốc tiền tệ có ý nghĩa.
 */
function computeYDomain(data: ChartPoint[]): [number, number] {
  const maxVal = data.reduce((m, d) => Math.max(m, d.income, d.expense), 0);
  if (maxVal === 0) return [0, 1_000_000]; // fallback khi không có data

  // Bước đẹp: chọn bước gần nhất trong bộ cơ số
  const rawMax = maxVal * 1.2; // +20% padding
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax))); // bậc 10
  const steps = [1, 2, 2.5, 5, 10];
  let niceStep = magnitude;
  for (const s of steps) {
    const candidate = s * magnitude;
    if (rawMax / candidate <= 5) { // ≤ 5 ticks đẹp
      niceStep = candidate;
      break;
    }
  }
  const niceMax = Math.ceil(rawMax / niceStep) * niceStep;
  return [0, niceMax];
}

const FILTERS: { label: string; period: '7d' | '1m' }[] = [
  { label: '7 ngày', period: '7d' },
  { label: '1 tháng', period: '1m' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-2xl px-4 py-3 text-sm"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
    >
      <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name === 'income' ? 'Thu nhập' : 'Chi tiêu'}:</span>
          <span className="font-bold" style={{ color: p.color }}>{formatVND(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

import { useQuery } from '@tanstack/react-query';

export default function FinancialChartBlock() {
  const { token } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'7d' | '1m'>('7d');

  const { data, isLoading: loading } = useQuery({
    queryKey: ['chart', activeFilter],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3000/transactions/chart?period=${activeFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('API error');
      const json: ChartPoint[] = await res.json();
      return generateChartData(json, activeFilter);
    },
    enabled: !!token,
    placeholderData: (previousData) => previousData || generateChartData([], activeFilter),
  });

  const displayData = data || generateChartData([], activeFilter);

  // Tính domain + tickCount từ dữ liệu thực tế
  const yDomain = useMemo(() => computeYDomain(displayData), [displayData]);
  // 5 tick đều nhau từ 0 → max
  const yTickCount = 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.45 }}
      className="glass-card p-6 flex flex-col gap-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Montserrat, sans-serif' }}>
            Xu Hướng Thu Chi
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Phân tích dòng tiền thực tế từ database
          </p>
        </div>
        {/* Segment Filters */}
        <div
          className="flex items-center p-1 rounded-xl gap-1"
          style={{ background: 'var(--border)' }}
        >
          {FILTERS.map((f) => (
            <button
              key={f.period}
              onClick={() => setActiveFilter(f.period)}
              className="relative px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors"
              style={{ color: activeFilter === f.period ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              {activeFilter === f.period && (
                <motion.div
                  layoutId="chart-filter-active"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--bg-surface)' }}
                />
              )}
              <span className="relative z-10">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5">
        {[{ label: 'Thu nhập', color: '#34d399' }, { label: 'Chi tiêu', color: '#f87171' }].map((l) => (
          <div key={l.label} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="w-3 h-0.5 rounded-full" style={{ background: l.color, display: 'inline-block' }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-52 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-sky-400" />
          </div>
        ) : displayData.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <p className="text-sm">Chưa có dữ liệu giao dịch trong khoảng thời gian này.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={displayData}
              margin={{ top: 8, right: 8, bottom: 0, left: 12 }}
            >
              <defs>
                <linearGradient id="incomeG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* Grid nằm ngang, căn theo các mốc tiền tệ của YAxis */}
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="var(--border)"
                vertical={false}
                strokeOpacity={0.6}
              />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                dy={4}
              />

              {/* YAxis với formatter VNĐ rút gọn + domain có padding */}
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
                domain={yDomain}
                tickCount={yTickCount}
                width={56}
              />

              <Tooltip content={<CustomTooltip />} />

              <Area
                type="monotone" dataKey="income" name="income"
                stroke="#34d399" strokeWidth={2.5}
                fill="url(#incomeG)" dot={false}
                animationDuration={800}
              />
              <Area
                type="monotone" dataKey="expense" name="expense"
                stroke="#f87171" strokeWidth={2.5}
                fill="url(#expenseG)" dot={false}
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
