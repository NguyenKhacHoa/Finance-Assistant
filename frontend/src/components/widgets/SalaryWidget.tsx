import { useState } from 'react';
import { Sparkles, Wallet } from 'lucide-react';
import { formatInputVND, parseVNDToNumber } from '../../utils/format';

interface SalaryWidgetProps {
  onStartDistribution: (amount: number) => void;
}

export default function SalaryWidget({ onStartDistribution }: SalaryWidgetProps) {
  const [displayAmount, setDisplayAmount] = useState('');

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const num = Number(raw);
    setDisplayAmount(num === 0 && !raw ? '' : formatInputVND(num.toString()));
  };

  const handleStart = () => {
    const num = parseVNDToNumber(displayAmount);
    if (num > 0) {
      onStartDistribution(num);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[2rem] p-6 bg-[#0c1624] border border-white/5 shadow-2xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-fuchsia-500/10 blur-3xl pointer-events-none rounded-full" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Wallet size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white">Trung Tâm Nhận Lương</h3>
            <p className="text-[10px] text-emerald-100/50 uppercase tracking-wider font-bold mt-0.5">
              Phân bổ dòng tiền <Sparkles size={10} className="inline text-fuchsia-400 ml-1" />
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">VND</span>
            <input
              type="text"
              value={displayAmount}
              onChange={handleAmountChange}
              placeholder="VD: 30.000.000"
              className="w-full bg-black/20 border border-white/10 rounded-2xl py-3 pl-14 pr-4 text-white font-mono font-black tracking-widest placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 focus:bg-black/40 transition-all"
            />
          </div>

          <button
            onClick={handleStart}
            disabled={!displayAmount || parseVNDToNumber(displayAmount) <= 0}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            Bắt đầu phân bổ
          </button>
        </div>
      </div>
    </div>
  );
}
