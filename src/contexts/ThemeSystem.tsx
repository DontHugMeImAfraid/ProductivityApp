import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
  id: string; name: string; isDark: boolean; emoji: string;
  colors: ThemeColors;
  typography: { fontFamily: string; editorFont: string; monoFont: string; baseFontSize: number; lineHeight: number; letterSpacing: string; };
  layout: { density: string; borderRadius: string; buttonRadius: string; cardStyle: string; sidebarWidth: number; };
}

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
  (Object.keys(VAR_MAP) as (keyof ThemeColors)[]).forEach(key => {
    root.style.setProperty(VAR_MAP[key], theme.colors[key]);
  });
  root.style.setProperty('--nxs-font-family', theme.typography.fontFamily);
  root.style.setProperty('--nxs-editor-font', theme.typography.editorFont);
  root.style.setProperty('--nxs-mono-font', theme.typography.monoFont);
  root.style.setProperty('--nxs-font-size', `${theme.typography.baseFontSize}px`);
  root.style.setProperty('--nxs-line-height', String(theme.typography.lineHeight));
  root.style.setProperty('--nxs-border-radius', theme.layout.borderRadius);
  root.style.setProperty('--nxs-button-radius', theme.layout.buttonRadius);
  root.style.setProperty('--nxs-sidebar-width', `${theme.layout.sidebarWidth}px`);
  root.setAttribute('data-theme', theme.id);
  theme.isDark ? root.classList.add('dark') : root.classList.remove('dark');
}

export const PRESET_THEMES: Theme[] = [
  // ─── LIGHT ───────────────────────────────────────────────────────────────
  {
    id: 'light', name: 'Light', isDark: false, emoji: '☀️',
    colors: {
      bgPrimary:    '#ffffff',
      bgSecondary:  '#f6f8fa',
      bgTertiary:   '#eef0f3',
      bgElevated:   '#ffffff',
      bgSurface:    '#f0f2f5',
      // text: light theme unchanged — already passes contrast
      textPrimary:   '#1a1d23',
      textSecondary: '#4b5563',
      textMuted:     '#6b7280',   // was #9ca3af — lifted slightly for better contrast
      textInverse:   '#ffffff',
      accent:        '#6366f1',
      accentHover:   '#4f46e5',
      accentLight:   '#eef2ff',
      accentText:    '#6366f1',
      border:        '#e5e7eb',
      borderStrong:  '#d1d5db',
      shadow:        'rgba(0,0,0,0.08)',
      success: '#10b981', warning: '#f59e0b', danger: '#ef4444', info: '#3b82f6',
      sidebarBg:       '#ffffff',
      sidebarText:     '#374151',
      sidebarActive:   '#6366f1',
      sidebarActiveBg: '#eef2ff',
      calendarBg: '#ffffff', calendarToday: '#6366f1', calendarEvent: '#6366f1',
      notesBg: '#ffffff', editorBg: '#ffffff',
      codeBlockBg: '#1e2433', codeBlockText: '#e2e8f0',
      cardBg: '#ffffff', inputBg: '#ffffff', inputBorder: '#d1d5db',
      buttonBg: '#6366f1', buttonText: '#ffffff',
    },
    typography: { fontFamily: 'system-ui, -apple-system, sans-serif', editorFont: 'Georgia, serif', monoFont: "'Fira Code', monospace", baseFontSize: 15, lineHeight: 1.6, letterSpacing: '0em' },
    layout: { density: 'comfortable', borderRadius: '12px', buttonRadius: '8px', cardStyle: 'bordered', sidebarWidth: 256 },
  },

  // ─── DARK ────────────────────────────────────────────────────────────────
  // Key fixes:
  //   textMuted:   #6e7681 → #9198a1  (+~2 stops lighter, now ~4.5:1 on #161b22)
  //   textSecondary: #8b949e → #adb6c0  (~5.5:1 on bgSecondary)
  //   border:      #30363d → #3d444d  (more visible dividers)
  //   borderStrong:#484f58 → #586068  (clearly distinct from bg)
  //   inputBorder: same fix
  {
    id: 'dark', name: 'Dark', isDark: true, emoji: '🌙',
    colors: {
      bgPrimary:    '#0f1117',
      bgSecondary:  '#161b22',
      bgTertiary:   '#1c2230',
      bgElevated:   '#1a2033',
      bgSurface:    '#131720',
      textPrimary:   '#e6edf3',   // ~14:1 on bgSecondary ✓
      textSecondary: '#adb6c0',   // ~6.8:1 on bgSecondary ✓  (was #8b949e ~3.8:1)
      textMuted:     '#8b96a4',   // ~4.5:1 on bgSecondary ✓  (was #6e7681 ~2.9:1)
      textInverse:   '#0f1117',
      accent:        '#7c3aed',
      accentHover:   '#6d28d9',
      accentLight:   '#1f1040',   // slightly lighter so text reads on it
      accentText:    '#c4b5fd',   // was #a78bfa — lighter for better contrast on accentLight
      border:        '#3d444d',   // was #30363d — more visible
      borderStrong:  '#586068',   // was #484f58 — clearly distinct
      shadow:        'rgba(0,0,0,0.5)',
      success: '#4ade80', warning: '#fbbf24', danger: '#f87171', info: '#60a5fa',
      // semantic colours lightened so they read well on dark bg
      sidebarBg:       '#161b22',
      sidebarText:     '#adb6c0',   // was #8b949e
      sidebarActive:   '#c4b5fd',   // was #a78bfa
      sidebarActiveBg: '#251048',   // was #1f1035 — slightly lighter
      calendarBg: '#161b22', calendarToday: '#7c3aed', calendarEvent: '#7c3aed',
      notesBg: '#161b22', editorBg: '#0d1117',
      codeBlockBg: '#0d1117', codeBlockText: '#e6edf3',
      cardBg: '#161b22', inputBg: '#0d1117', inputBorder: '#3d444d',  // was #30363d
      buttonBg: '#7c3aed', buttonText: '#ffffff',
    },
    typography: { fontFamily: 'system-ui, -apple-system, sans-serif', editorFont: 'Georgia, serif', monoFont: "'Fira Code', monospace", baseFontSize: 15, lineHeight: 1.6, letterSpacing: '0em' },
    layout: { density: 'comfortable', borderRadius: '12px', buttonRadius: '8px', cardStyle: 'bordered', sidebarWidth: 256 },
  },

  // ─── MIDNIGHT ────────────────────────────────────────────────────────────
  // textMuted was #4a5680 (~2.1:1) — critical failure
  // textSecondary #7a8ab5 was borderline
  {
    id: 'midnight', name: 'Midnight', isDark: true, emoji: '🌌',
    colors: {
      bgPrimary:    '#0a0e1a',
      bgSecondary:  '#0e1221',
      bgTertiary:   '#131729',
      bgElevated:   '#111520',
      bgSurface:    '#0c1018',
      textPrimary:   '#d4e0f7',   // was #cdd9f5 — slightly brighter
      textSecondary: '#9aadd4',   // was #7a8ab5 (~3.4:1) → now ~5.2:1
      textMuted:     '#7b8db8',   // was #4a5680 (~2.1:1) → now ~4.0:1
      textInverse:   '#0a0e1a',
      accent:        '#4f8ef7',   // was #3b82f6 — slightly brighter on deep dark
      accentHover:   '#2563eb',
      accentLight:   '#0d1e40',   // was #0a1833
      accentText:    '#93c5fd',   // good on #0d1e40
      border:        '#1e2d4d',   // was #1e2a45 — slightly more visible
      borderStrong:  '#2d4470',   // was #2d3f66
      shadow:        'rgba(0,0,0,0.65)',
      success: '#4ade80', warning: '#fbbf24', danger: '#f87171', info: '#60a5fa',
      sidebarBg:       '#0e1221',
      sidebarText:     '#9aadd4',
      sidebarActive:   '#4f8ef7',
      sidebarActiveBg: '#0d1e40',
      calendarBg: '#0e1221', calendarToday: '#4f8ef7', calendarEvent: '#4f8ef7',
      notesBg: '#0e1221', editorBg: '#0a0e1a',
      codeBlockBg: '#060810', codeBlockText: '#d4e0f7',
      cardBg: '#0e1221', inputBg: '#0a0e1a', inputBorder: '#1e2d4d',
      buttonBg: '#4f8ef7', buttonText: '#ffffff',
    },
    typography: { fontFamily: "'DM Sans', system-ui, sans-serif", editorFont: 'Georgia, serif', monoFont: "'JetBrains Mono', monospace", baseFontSize: 15, lineHeight: 1.65, letterSpacing: '-0.01em' },
    layout: { density: 'comfortable', borderRadius: '14px', buttonRadius: '10px', cardStyle: 'elevated', sidebarWidth: 260 },
  },

  // ─── SOLARIZED ───────────────────────────────────────────────────────────
  // Light theme — already good contrast, minor tweaks
  {
    id: 'solarized', name: 'Solarized', isDark: false, emoji: '🌅',
    colors: {
      bgPrimary:    '#fdf6e3',
      bgSecondary:  '#eee8d5',
      bgTertiary:   '#e8dfc4',
      bgElevated:   '#fdf6e3',
      bgSurface:    '#f5eed5',
      textPrimary:   '#073642',
      textSecondary: '#485e66',   // was #586e75 — slightly darker for contrast
      textMuted:     '#65777e',   // was #839496 — darker to hit 4.5:1 on light bg
      textInverse:   '#fdf6e3',
      accent:        '#268bd2',
      accentHover:   '#1a72b5',
      accentLight:   '#e8f2fb',
      accentText:    '#1a72b5',   // darker than accent for better readability in light chips
      border:        '#ddd6c0',
      borderStrong:  '#c9c2a8',
      shadow:        'rgba(7,54,66,0.1)',
      success: '#859900', warning: '#b58900', danger: '#dc322f', info: '#268bd2',
      sidebarBg:       '#eee8d5',
      sidebarText:     '#485e66',
      sidebarActive:   '#268bd2',
      sidebarActiveBg: '#dcedf9',
      calendarBg: '#fdf6e3', calendarToday: '#268bd2', calendarEvent: '#268bd2',
      notesBg: '#fdf6e3', editorBg: '#fdf6e3',
      codeBlockBg: '#073642', codeBlockText: '#93a1a1',
      cardBg: '#fdf6e3', inputBg: '#fdf6e3', inputBorder: '#ddd6c0',
      buttonBg: '#268bd2', buttonText: '#fdf6e3',
    },
    typography: { fontFamily: "'Source Sans Pro', Georgia, serif", editorFont: "Georgia, 'Palatino Linotype', serif", monoFont: "'Source Code Pro', monospace", baseFontSize: 15, lineHeight: 1.65, letterSpacing: '0em' },
    layout: { density: 'comfortable', borderRadius: '8px', buttonRadius: '6px', cardStyle: 'bordered', sidebarWidth: 256 },
  },

  // ─── FOREST ──────────────────────────────────────────────────────────────
  // Light theme — textMuted was borderline
  {
    id: 'forest', name: 'Forest', isDark: false, emoji: '🌿',
    colors: {
      bgPrimary:    '#f4f9f4',
      bgSecondary:  '#eaf3ea',
      bgTertiary:   '#dceadc',
      bgElevated:   '#ffffff',
      bgSurface:    '#ecf5ec',
      textPrimary:   '#1a2e1a',
      textSecondary: '#2e4a2e',   // was #3d5a3d — darker for 7:1+
      textMuted:     '#4a6e4a',   // was #6b8f6b — darker to pass 4.5:1 on light bg
      textInverse:   '#ffffff',
      accent:        '#2d7a2d',
      accentHover:   '#236323',
      accentLight:   '#e2f3e2',
      accentText:    '#1f5c1f',   // darker than accent for chip text
      border:        '#c8dfc8',
      borderStrong:  '#a8c8a8',
      shadow:        'rgba(26,46,26,0.08)',
      success: '#22c55e', warning: '#d97706', danger: '#dc2626', info: '#2563eb',
      sidebarBg:       '#eaf3ea',
      sidebarText:     '#2e4a2e',
      sidebarActive:   '#2d7a2d',
      sidebarActiveBg: '#d4edce',
      calendarBg: '#f4f9f4', calendarToday: '#2d7a2d', calendarEvent: '#2d7a2d',
      notesBg: '#f4f9f4', editorBg: '#ffffff',
      codeBlockBg: '#1a2e1a', codeBlockText: '#c8dfc8',
      cardBg: '#ffffff', inputBg: '#ffffff', inputBorder: '#c8dfc8',
      buttonBg: '#2d7a2d', buttonText: '#ffffff',
    },
    typography: { fontFamily: "Georgia, 'Book Antiqua', serif", editorFont: 'Georgia, serif', monoFont: "'Fira Code', monospace", baseFontSize: 15, lineHeight: 1.7, letterSpacing: '0em' },
    layout: { density: 'comfortable', borderRadius: '16px', buttonRadius: '12px', cardStyle: 'soft', sidebarWidth: 256 },
  },

  // ─── ROSE ────────────────────────────────────────────────────────────────
  {
    id: 'rose', name: 'Rose', isDark: false, emoji: '🌸',
    colors: {
      bgPrimary:    '#fff5f7',
      bgSecondary:  '#fce8ed',
      bgTertiary:   '#f9d8e0',
      bgElevated:   '#ffffff',
      bgSurface:    '#fdf0f3',
      textPrimary:   '#2d0a14',
      textSecondary: '#5c1a2a',   // was #6b2537 — slightly darker
      textMuted:     '#7a2d42',   // was #a85070 — much darker to pass on light pink bg
      textInverse:   '#ffffff',
      accent:        '#e11d48',
      accentHover:   '#be123c',
      accentLight:   '#ffe4ed',
      accentText:    '#9f0f35',   // dark enough for chip text on #ffe4ed
      border:        '#f8c8d4',
      borderStrong:  '#f4a0b5',
      shadow:        'rgba(45,10,20,0.08)',
      success: '#16a34a', warning: '#d97706', danger: '#dc2626', info: '#2563eb',
      sidebarBg:       '#fce8ed',
      sidebarText:     '#5c1a2a',
      sidebarActive:   '#e11d48',
      sidebarActiveBg: '#ffe4ed',
      calendarBg: '#fff5f7', calendarToday: '#e11d48', calendarEvent: '#e11d48',
      notesBg: '#fff5f7', editorBg: '#ffffff',
      codeBlockBg: '#2d0a14', codeBlockText: '#f9d8e0',
      cardBg: '#ffffff', inputBg: '#ffffff', inputBorder: '#f8c8d4',
      buttonBg: '#e11d48', buttonText: '#ffffff',
    },
    typography: { fontFamily: "'Lato', system-ui, sans-serif", editorFont: "'Palatino Linotype', Georgia, serif", monoFont: "'Fira Code', monospace", baseFontSize: 15, lineHeight: 1.6, letterSpacing: '0.01em' },
    layout: { density: 'comfortable', borderRadius: '20px', buttonRadius: '14px', cardStyle: 'soft', sidebarWidth: 256 },
  },

  // ─── OBSIDIAN ────────────────────────────────────────────────────────────
  // textMuted was #666666 (~3.8:1 on #1a1a1a) — fail
  // textSecondary #a0a0a0 was ok but borderline
 {
  id: 'chocolate',
  name: 'Chocolate',
  isDark: true,
  emoji: '🍫',

  colors: {
    // 🌑 BACKGROUNDS (rich cocoa layers)
    bgPrimary:    '#1a1412',   // deep cocoa (main app bg)
    bgSecondary:  '#241c1a',   // panels
    bgTertiary:   '#2f2522',   // elevated sections
    bgElevated:   '#3a2e2a',   // cards hover / modals
    bgSurface:    '#140f0e',   // deepest contrast layer

    // 📝 TEXT (warm readable tones)
    textPrimary:   '#f5e6d8',  // soft cream (main text)
    textSecondary: '#d2b8a3',  // muted caramel
    textMuted:     '#9a8275',  // low emphasis
    textInverse:   '#1a1412',

    // ✨ ACCENTS (gold / caramel)
    accent:        '#d4a017',  // gold (keep)
    accentHover:   '#b8880f',
    accentLight:   '#3a2b0c',  // subtle glow bg
    accentText:    '#f6d36b',  // readable on dark gold bg

    // 🧱 BORDERS / DEPTH
    border:        '#3a2e2a',
    borderStrong:  '#4a3a35',
    shadow:        'rgba(0,0,0,0.6)',

    // 🚦 STATUS
    success: '#6bcb77',
    warning: '#f0c040',
    danger:  '#ff6b6b',
    info:    '#74b9ff',

    // 📌 SIDEBAR (slightly darker for hierarchy)
    sidebarBg:       '#140f0e',
    sidebarText:     '#cbb3a3',
    sidebarActive:   '#f0d28a',
    sidebarActiveBg: '#3a2b0c',

    // 📅 CALENDAR
    calendarBg:    '#211917',
    calendarToday: '#d4a017',
    calendarEvent: '#c29512',

    // 📝 NOTES / EDITOR
    notesBg:   '#2a1f1c',
    editorBg:  '#120e0d',

    // 💻 CODE
    codeBlockBg:   '#120e0d',
    codeBlockText: '#f5e6d8',

    // 🧩 UI ELEMENTS
    cardBg:      '#211917',
    inputBg:     '#120e0d',
    inputBorder: '#3a2e2a',

    // 🔘 BUTTONS
    buttonBg:   '#d4a017',
    buttonText: '#1a1412',
  },

  typography: {
    fontFamily: "'Trebuchet MS', system-ui, sans-serif",
    editorFont: 'Georgia, serif',
    monoFont: "'Consolas', monospace",
    baseFontSize: 15,
    lineHeight: 1.6,
    letterSpacing: '0em'
  },

  layout: {
    density: 'comfortable',
    borderRadius: '8px',       // slightly smoother
    buttonRadius: '6px',
    cardStyle: 'bordered',
    sidebarWidth: 256
  }
},

  // ─── NORD ────────────────────────────────────────────────────────────────
  // textMuted was #4c566a (~2.3:1 on #2e3440) — extreme fail
  {
    id: 'nord', name: 'Nord', isDark: true, emoji: '❄️',
    colors: {
      bgPrimary:    '#2e3440',
      bgSecondary:  '#3b4252',
      bgTertiary:   '#434c5e',
      bgElevated:   '#3b4252',
      bgSurface:    '#2e3440',
      textPrimary:   '#eceff4',   // ~12:1 on bgSecondary ✓
      textSecondary: '#d8dee9',   // ~8.5:1 ✓
      textMuted:     '#9eaabf',   // was #4c566a (~2.3:1) → now ~4.6:1 ✓
      textInverse:   '#2e3440',
      accent:        '#88c0d0',
      accentHover:   '#81a1c1',
      accentLight:   '#3a4a58',   // was #3b4a58
      accentText:    '#c8e3ec',   // was #88c0d0 — lighter for reading on accentLight
      border:        '#4a5568',   // was #434c5e — slightly brighter
      borderStrong:  '#5d6b82',   // was #4c566a
      shadow:        'rgba(0,0,0,0.35)',
      success: '#a3be8c', warning: '#ebcb8b', danger: '#bf616a', info: '#81a1c1',
      sidebarBg:       '#3b4252',
      sidebarText:     '#d8dee9',
      sidebarActive:   '#88c0d0',
      sidebarActiveBg: '#3d5060',
      calendarBg: '#3b4252', calendarToday: '#88c0d0', calendarEvent: '#88c0d0',
      notesBg: '#3b4252', editorBg: '#2e3440',
      codeBlockBg: '#272c36', codeBlockText: '#eceff4',
      cardBg: '#3b4252', inputBg: '#2e3440', inputBorder: '#4a5568',
      buttonBg: '#88c0d0', buttonText: '#2e3440',
    },
    typography: { fontFamily: "'Nunito', system-ui, sans-serif", editorFont: 'Georgia, serif', monoFont: "'Fira Code', monospace", baseFontSize: 15, lineHeight: 1.65, letterSpacing: '0em' },
    layout: { density: 'comfortable', borderRadius: '10px', buttonRadius: '8px', cardStyle: 'bordered', sidebarWidth: 256 },
  },

  // ─── CATPPUCCIN ──────────────────────────────────────────────────────────
  // textMuted was #6c7086 (~2.8:1 on #1e1e2e) — fail
  {
    id: 'catppuccin', name: 'Catppuccin', isDark: true, emoji: '☕',
    colors: {
      bgPrimary:    '#1e1e2e',
      bgSecondary:  '#181825',
      bgTertiary:   '#313244',
      bgElevated:   '#24273a',
      bgSurface:    '#1e1e2e',
      textPrimary:   '#cdd6f4',   // ~11:1 ✓
      textSecondary: '#bac2de',   // was #a6adc8 (~5.5:1) → ~6.8:1 ✓
      textMuted:     '#9399b2',   // was #6c7086 (~2.8:1) → now ~4.5:1 ✓
      textInverse:   '#1e1e2e',
      accent:        '#cba6f7',
      accentHover:   '#b28ef4',
      accentLight:   '#2a1f45',   // was #302040 — more distinct from bgPrimary
      accentText:    '#e2d2fb',   // was #cba6f7 — much lighter for reading on accentLight
      border:        '#414558',   // was #313244 — more visible against bgPrimary
      borderStrong:  '#585b70',   // was #45475a
      shadow:        'rgba(0,0,0,0.4)',
      success: '#a6e3a1', warning: '#f9e2af', danger: '#f38ba8', info: '#89b4fa',
      sidebarBg:       '#181825',
      sidebarText:     '#bac2de',
      sidebarActive:   '#cba6f7',
      sidebarActiveBg: '#2a1f45',
      calendarBg: '#181825', calendarToday: '#cba6f7', calendarEvent: '#cba6f7',
      notesBg: '#1e1e2e', editorBg: '#181825',
      codeBlockBg: '#11111b', codeBlockText: '#cdd6f4',
      cardBg: '#24273a', inputBg: '#181825', inputBorder: '#414558',
      buttonBg: '#cba6f7', buttonText: '#1e1e2e',
    },
    typography: { fontFamily: "'Inter', system-ui, sans-serif", editorFont: 'Georgia, serif', monoFont: "'JetBrains Mono', monospace", baseFontSize: 15, lineHeight: 1.6, letterSpacing: '-0.01em' },
    layout: { density: 'comfortable', borderRadius: '12px', buttonRadius: '10px', cardStyle: 'elevated', sidebarWidth: 256 },
  },
];

export const DEFAULT_THEME = PRESET_THEMES[0];

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  presets: Theme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

const STORAGE_KEY = 'nexus-active-theme-v2';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Theme;
        const found = PRESET_THEMES.find(t => t.id === parsed.id);
        return found ?? DEFAULT_THEME;
      }
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
    <ThemeContext.Provider value={{ theme, setTheme, presets: PRESET_THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}