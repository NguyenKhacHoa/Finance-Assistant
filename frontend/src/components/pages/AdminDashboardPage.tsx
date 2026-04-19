import { motion } from 'framer-motion';
import { Users, Activity, Wallet, Key } from 'lucide-react';

export default function AdminDashboard() {
  // Giả lập Dữ liệu trả về từ API /admin/dashboard
  const mockSystemStats = {
    totalUsers: 1452,
    totalAssets: 48500200000,
    activeGoals: 342,
    completedGoals: 125,
    leaderboard: [
      { name: 'Nguyễn Văn A', points: 4500, streak: 30 },
      { name: 'Trần B', points: 4200, streak: 25 },
      { name: 'Khách C', points: 3100, streak: 12 },
    ]
  };

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-8">
        <h2 className="text-3xl font-black flex items-center gap-3">
          <Key className="text-red-500" />
          Khu Vực <span className="text-red-500 bg-red-500/10 px-2 rounded">BÍ MẬT</span> Quản Trị Hệ Thống
        </h2>
        <p className="text-slate-400 mt-2">Dành riêng cho Root Admin. Module Role-Based Access Control đang bảo vệ nghiêm ngặt trang này.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { title: 'Tổng User Hoạt Động', value: mockSystemStats.totalUsers, icon: <Users className="text-blue-500 w-8 h-8"/>, bg: 'from-blue-500/10 to-transparent', border: 'border-blue-500/30' },
          { title: 'Tài Sản Quản Lý', value: new Intl.NumberFormat('vi-VN', {style:'currency', currency:'VND'}).format(mockSystemStats.totalAssets), icon: <Wallet className="text-green-500 w-8 h-8"/>, bg: 'from-green-500/10 to-transparent', border: 'border-green-500/30' },
          { title: 'Mục Tiêu Đang Chạy', value: mockSystemStats.activeGoals, icon: <Activity className="text-amber-500 w-8 h-8"/>, bg: 'from-amber-500/10 to-transparent', border: 'border-amber-500/30' },
          { title: 'Sứ Mệnh Hoàn Thành', value: mockSystemStats.completedGoals, icon: <Target className="text-purple-500 w-8 h-8"/>, bg: 'from-purple-500/10 to-transparent', border: 'border-purple-500/30' },
        ].map((stat, i) => (
          <motion.div initial={{ y: 20, opacity: 0}} animate={{ y: 0, opacity: 1}} transition={{ delay: i * 0.1 }} key={i} className={`bg-gradient-to-b ${stat.bg} p-6 rounded-3xl border ${stat.border} shadow-lg relative overflow-hidden backdrop-blur-xl`}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-slate-300 font-bold text-sm uppercase">{stat.title}</h3>
              {stat.icon}
            </div>
            <p className="text-3xl font-black">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Leaderboard Khu vực Quản Trị */}
      <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-3xl backdrop-blur-xl">
        <h3 className="text-xl font-bold mb-6 text-indigo-400">🔥 Giám Sát Người Biểu Tình Hàng Đầu (Leaderboard)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-sm">
                <th className="pb-3 px-4 font-bold uppercase">Người Dùng</th>
                <th className="pb-3 text-right font-bold uppercase">Sức Mạnh (Points)</th>
                <th className="pb-3 text-right font-bold uppercase">Lửa (Streak)</th>
              </tr>
            </thead>
            <tbody>
              {mockSystemStats.leaderboard.map((user, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                  <td className="py-4 px-4 font-bold flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-xs">#{i+1}</div>
                    {user.name}
                  </td>
                  <td className="py-4 text-right font-mono text-yellow-500 font-bold">{user.points.toLocaleString()}</td>
                  <td className="py-4 text-right font-mono text-red-400 font-bold">{user.streak} Ngày</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Quick component for Target icon used in the loop
function Target(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
}
