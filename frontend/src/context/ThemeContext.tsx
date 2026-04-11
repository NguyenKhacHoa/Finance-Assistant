import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  type ThemeId,
  THEMES,
  DEFAULT_THEME,
  applyTheme,
  getThemeById,
} from '../theme-config';

const STORAGE_KEY = 'finance-theme';

interface ThemeCtx {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  themes: typeof THEMES;
}

const Ctx = createContext<ThemeCtx>({
  themeId: DEFAULT_THEME,
  setTheme: () => {},
  themes: THEMES,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ThemeId) ?? DEFAULT_THEME;
  });

  useEffect(() => {
    const theme = getThemeById(themeId);
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, themeId);
  }, [themeId]);

  return (
    <Ctx.Provider value={{ themeId, setTheme: setThemeId, themes: THEMES }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
