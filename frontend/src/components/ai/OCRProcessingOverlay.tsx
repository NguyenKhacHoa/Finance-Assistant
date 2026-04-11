import { motion } from 'framer-motion';
import { Cpu } from 'lucide-react';

export default function OCRProcessingOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050d18]/80 backdrop-blur-md"
    >
      <div className="relative flex flex-col items-center gap-8 px-10 py-12 rounded-[2.5rem] bg-white/5 border border-white/10 shadow-2xl overflow-hidden">
        {/* Animated Background Waves */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [1, 1.5, 2],
                opacity: [0, 0.2, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.8,
                ease: "easeOut"
              }}
              className="absolute inset-0 rounded-full border border-sky-500/30"
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="relative">
            <motion.div
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear"
              }}
              className="w-24 h-24 rounded-full border-2 border-dashed border-sky-400/50"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(56,189,248,0.4)]">
                <Cpu className="text-white w-8 h-8" />
              </div>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Đang phân tích hóa đơn...</h3>
            <p className="text-sm text-sky-200/60 font-medium">Hệ thống AI Gemini 2.5 Flash đang xử lý dữ liệu đa phương thức</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse [animation-delay:0.2s]" />
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse [animation-delay:0.4s]" />
          </div>
        </div>

        {/* Scan line effect */}
        <motion.div
          animate={{
            top: ['0%', '100%', '0%'],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400 to-transparent z-20 opacity-50 shadow-[0_0_10px_rgba(56,189,248,0.8)]"
        />
      </div>
    </motion.div>
  );
}
