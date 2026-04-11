// ═══════════════════════════════════════════════════════════════
//  theme-config.ts — Hệ thống Multi-Theme cho Finance Dashboard
// ═══════════════════════════════════════════════════════════════

export type ThemeId = 'dark-night' | 'light-minimal' | 'amoled';

export interface ThemeConfig {
  id: ThemeId;
  label: string;
  icon: string;
  vars: Record<string, string>;
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'dark-night',
    label: 'Dark Night',
    icon: '🌙',
    vars: {
      '--bg-base':       '#080d1a',
      '--bg-surface':    '#0f172a',
      '--bg-card':       'rgba(15, 23, 42, 0.7)',
      '--sidebar-bg':    '#070b17',
      '--header-bg':     'rgba(8, 13, 26, 0.85)',
      '--border':        'rgba(148, 163, 184, 0.1)',
      '--border-hover':  'rgba(148, 163, 184, 0.25)',
      '--text-primary':  '#f1f5f9',
      '--text-secondary':'#94a3b8',
      '--text-muted':    '#475569',
      '--primary':       '#38bdf8',
      '--primary-glow':  'rgba(56, 189, 248, 0.15)',
      '--accent':        '#818cf8',
    },
  },
  {
    id: 'light-minimal',
    label: 'Light Minimal',
    icon: '☀️',
    vars: {
      '--bg-base':       '#f1f5f9',
      '--bg-surface':    '#ffffff',
      '--bg-card':       'rgba(255, 255, 255, 0.85)',
      '--sidebar-bg':    '#ffffff',
      '--header-bg':     'rgba(255, 255, 255, 0.9)',
      '--border':        'rgba(15, 23, 42, 0.08)',
      '--border-hover':  'rgba(15, 23, 42, 0.18)',
      '--text-primary':  '#0f172a',
      '--text-secondary':'#475569',
      '--text-muted':    '#94a3b8',
      '--primary':       '#0ea5e9',
      '--primary-glow':  'rgba(14, 165, 233, 0.12)',
      '--accent':        '#6366f1',
    },
  },
  {
    id: 'amoled',
    label: 'AMOLED',
    icon: '⚫',
    vars: {
      '--bg-base':       '#000000',
      '--bg-surface':    '#0d0d0d',
      '--bg-card':       'rgba(13, 13, 13, 0.9)',
      '--sidebar-bg':    '#050505',
      '--header-bg':     'rgba(0, 0, 0, 0.9)',
      '--border':        'rgba(255, 255, 255, 0.07)',
      '--border-hover':  'rgba(255, 255, 255, 0.15)',
      '--text-primary':  '#ffffff',
      '--text-secondary':'#888888',
      '--text-muted':    '#444444',
      '--primary':       '#00f5ff',
      '--primary-glow':  'rgba(0, 245, 255, 0.12)',
      '--accent':        '#a855f7',
    },
  },
];

export const DEFAULT_THEME: ThemeId = 'dark-night';

/** Inject CSS variables vào :root */
export function applyTheme(theme: ThemeConfig): void {
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.setAttribute('data-theme', theme.id);
}

export function getThemeById(id: ThemeId): ThemeConfig {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
