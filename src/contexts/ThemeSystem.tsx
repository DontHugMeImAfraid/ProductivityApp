import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThemeColors {
  bgPrimary: string; bgSecondary: string; bgTertiary: string;
  bgElevated: string; bgSurface: string;
  textPrimary: string; textSecondary: string; textMuted: string; textInverse: string;
  accent: string; accentHover: string; accentLight: string; accentText: string;
  border: string; borderStrong: string; shadow: string;
  success: string; warning: string; danger: string; info: string;
  sidebarBg: string; sidebarText: string; sidebarActive: string; sidebarActiveBg: string;
  calendarBg: string; calendarToday: string; calendarEvent: string;
  notesBg: string; editorBg: string; codeBlockBg: string; codeBlockText: string;
  cardBg: string; inputBg: string; inputBorder: string;
  buttonBg: string; buttonText: string;
}

export interface Theme {
  id: string; name: string; isDark: boolean;
  colors: ThemeColors;
  typography: { fontFamily: string; editorFont: string; monoFont: string; baseFontSize: number; lineHeight: number; letterSpacing: string; };
  layout: { density: string; borderRadius: string; buttonRadius: string; cardStyle: string; sidebarWidth: number; };
}

// ─── CSS variable map ─────────────────────────────────────────────────────────

const VAR_MAP: Record<keyof ThemeColors, string> = {
  bgPrimary: '--nxs-bg-primary', bgSecondary: '--nxs-bg-secondary',
  bgTertiary: '--nxs-bg-tertiary', bgElevated: '--nxs-bg-elevated', bgSurface: '--nxs-bg-surface',
  textPrimary: '--nxs-text-primary', textSecondary: '--nxs-text-secondary',
  textMuted: '--nxs-text-muted', textInverse: '--nxs-text-inverse',
  accent: '--nxs-accent', accentHover: '--nxs-accent-hover',
  accentLight: '--nxs-accent-light', accentText: '--nxs-accent-text',
  border: '--nxs-border', borderStrong: '--nxs-border-strong', shadow: '--nxs-shadow',
  success: '--nxs-success', warning: '--nxs-warning', danger: '--nxs-danger', info: '--nxs-info',
  sidebarBg: '--nxs-sidebar-bg', sidebarText: '--nxs-sidebar-text',
  sidebarActive: '--nxs-sidebar-active', sidebarActiveBg: '--nxs-sidebar-active-bg',
  calendarBg: '--nxs-calendar-bg', calendarToday: '--nxs-calendar-today', calendarEvent: '--nxs-calendar-event',
  notesBg: '--nxs-notes-bg', editorBg: '--nxs-editor-bg',
  codeBlockBg: '--nxs-code-block-bg', codeBlockText: '--nxs-code-block-text',
  cardBg: '--nxs-card-bg', inputBg: '--nxs-input-bg', inputBorder: '--nxs-input-border',
  buttonBg: '--nxs-button-bg', buttonText: '--nxs-button-text',
};

export function applyThemeToDom(theme: Theme) {
  const root = document.documentElement;
  // Color variables
  (Object.keys(VAR_MAP) as (keyof ThemeColors)[]).forEach(key => {
    root.style.setProperty(VAR_MAP[key], theme.colors[key]);
  });
  // Typography variables
  root.style.setProperty('--nxs-font-family', theme.typography.fontFamily);
  root.style.setProperty('--nxs-editor-font', theme.typography.editorFont);
  root.style.setProperty('--nxs-mono-font', theme.typography.monoFont);
  root.style.setProperty('--nxs-font-size', `${theme.typography.baseFontSize}px`);
  root.style.setProperty('--nxs-line-height', String(theme.typography.lineHeight));
  // Layout variables
  root.style.setProperty('--nxs-border-radius', theme.layout.borderRadius);
  root.style.setProperty('--nxs-button-radius', theme.layout.buttonRadius);
  root.style.setProperty('--nxs-sidebar-width', `${theme.layout.sidebarWidth}px`);
  // Dark mode class for Tailwind dark: variants
  root.setAttribute('data-theme', theme.id);
  theme.isDark ? root.classList.add('dark') : root.classList.remove('dark');
}

// ─── Default (light) theme ────────────────────────────────────────────────────

export const DEFAULT_THEME: Theme = {
  id: 'light', name: 'Light', isDark: false,
  colors: {
    bgPrimary: '#ffffff', bgSecondary: '#f6f8fa', bgTertiary: '#eef0f3',
    bgElevated: '#ffffff', bgSurface: '#f0f2f5',
    textPrimary: '#1a1d23', textSecondary: '#4b5563', textMuted: '#9ca3af', textInverse: '#ffffff',
    accent: '#6366f1', accentHover: '#4f46e5', accentLight: '#eef2ff', accentText: '#6366f1',
    border: '#e5e7eb', borderStrong: '#d1d5db', shadow: 'rgba(0,0,0,0.08)',
    success: '#10b981', warning: '#f59e0b', danger: '#ef4444', info: '#3b82f6',
    sidebarBg: '#ffffff', sidebarText: '#374151', sidebarActive: '#6366f1', sidebarActiveBg: '#eef2ff',
    calendarBg: '#ffffff', calendarToday: '#6366f1', calendarEvent: '#6366f1',
    notesBg: '#ffffff', editorBg: '#ffffff', codeBlockBg: '#1e2433', codeBlockText: '#e2e8f0',
    cardBg: '#ffffff', inputBg: '#ffffff', inputBorder: '#d1d5db',
    buttonBg: '#6366f1', buttonText: '#ffffff',
  },
  typography: { fontFamily: 'system-ui, -apple-system, sans-serif', editorFont: "Georgia, 'Times New Roman', serif", monoFont: "'Fira Code', 'Cascadia Code', monospace", baseFontSize: 15, lineHeight: 1.6, letterSpacing: '0em' },
  layout: { density: 'comfortable', borderRadius: '12px', buttonRadius: '8px', cardStyle: 'bordered', sidebarWidth: 256 },
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'nexus-active-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as Theme;
    } catch { /* ignore */ }
    return DEFAULT_THEME;
  });

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newTheme)); } catch { /* ignore */ }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}