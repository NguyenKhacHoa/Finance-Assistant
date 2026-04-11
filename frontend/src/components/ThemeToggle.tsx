import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import type { ThemeId } from '../theme-config';

export default function ThemeToggle() {
  const { themeId, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-center w-9 h-9 rounded-xl transition-all"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
        }}
        title="Đổi theme"
      >
        <span className="text-base leading-none">
          {themes.find((t) => t.id === themeId)?.icon ?? '🌙'}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute bottom-full left-0 mb-2 py-1 rounded-xl overflow-hidden min-w-[150px] z-50"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id as ThemeId); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all text-left"
                style={{
                  color: themeId === t.id ? 'var(--primary)' : 'var(--text-secondary)',
                  background: themeId === t.id ? 'var(--primary-glow)' : 'transparent',
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {themeId === t.id && (
                  <motion.div
                    layoutId="theme-check"
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--primary)' }}
                  />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
