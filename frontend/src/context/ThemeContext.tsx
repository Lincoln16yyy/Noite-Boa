import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

/** Preferência de tema escolhida pelo usuário. */
export type Theme = 'light' | 'dark' | 'auto';
/** Tema efetivamente aplicado no documento ('auto' já resolvido). */
export type ResolvedTheme = 'light' | 'dark';

/** Valor do contexto de tema. */
export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = 'noiteboa.theme';

/**
 * Tema atual: 'light' | 'dark' | 'auto'
 * 'auto' segue prefers-color-scheme
 */
export function ThemeProvider({ children, initialTheme = 'auto' }: { children: ReactNode; initialTheme?: Theme }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Inicialização síncrona para evitar flash
    if (typeof window !== 'undefined') {
      // O valor persistido é sempre um dos três temas ('setTheme' só grava Theme).
      return (localStorage.getItem(THEME_KEY) || initialTheme) as Theme;
    }
    return initialTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  // Aplica o tema no documento
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolved = prefersDark ? 'dark' : 'light';
      root.setAttribute('data-theme', resolved);
      setResolvedTheme(resolved);
    } else {
      root.setAttribute('data-theme', theme);
      setResolvedTheme(theme);
    }
  }, [theme]);

  // Persiste a preferência
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Escuta mudanças na preferência do sistema
  useEffect(() => {
    if (theme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', resolved);
      setResolvedTheme(resolved);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    if (['light', 'dark', 'auto'].includes(newTheme)) {
      setThemeState(newTheme);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook para acessar o contexto de tema */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}
