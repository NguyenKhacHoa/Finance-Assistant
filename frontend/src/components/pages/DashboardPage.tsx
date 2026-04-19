import { motion } from 'framer-motion';
import DashboardGreeting from '../dashboard/DashboardGreeting';
import FintechStatsGrid from '../dashboard/FintechStatsGrid';
import FinancialChartBlock from '../dashboard/FinancialChartBlock';

export default function DashboardPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-[1440px] mx-auto flex flex-col gap-6"
    >
      {/* Greeting */}
      <DashboardGreeting />

      {/* 4 Stat Cards */}
      <FintechStatsGrid />

      {/* Chart Full Width */}
      <div className="w-full">
        <FinancialChartBlock />
      </div>
    </motion.div>
  );
}
