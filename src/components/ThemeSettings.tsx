import React, { useState } from 'react';
import { useTheme, PRESET_THEMES, Theme } from '@/contexts/ThemeSystem';
import { Check, Palette, Sun, Moon, Type, Layout, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Theme Card ───────────────────────────────────────────────────────────────

function ThemeCard({ preset, isActive, onSelect }: {
  preset: Theme;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative group flex flex-col gap-0 overflow-hidden rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer hover:scale-[1.02] hover:shadow-lg',
        isActive ? 'border-violet-500 shadow-md shadow-violet-100' : 'border-transparent hover:border-slate-300',
      )}
      style={{ background: preset.colors.bgSecondary }}
    >
      {/* Mini UI preview */}
      <div className="h-20 relative p-2 overflow-hidden" style={{ background: preset.colors.bgPrimary }}>
        {/* Fake sidebar strip */}
        <div className="absolute left-0 top-0 bottom-0 w-6 flex flex-col gap-1 p-1" style={{ background: preset.colors.sidebarBg, borderRight: `1px solid ${preset.colors.border}` }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-1.5 rounded-full" style={{ background: i === 0 ? preset.colors.sidebarActive : preset.colors.border, width: i === 0 ? '80%' : '60%' }} />
          ))}
        </div>
        {/* Fake content area */}
        <div className="ml-7 space-y-1">
          {/* Header bar */}
          <div className="h-2.5 rounded-sm flex gap-1 items-center">
            <div className="h-1.5 w-12 rounded-full" style={{ background: preset.colors.accent }} />
            <div className="h-1.5 w-6 rounded-full ml-auto" style={{ background: preset.colors.border }} />
          </div>
          {/* Card row */}
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex-1 h-8 rounded-lg p-1 space-y-0.5" style={{ background: preset.colors.cardBg, border: `1px solid ${preset.colors.border}` }}>
                <div className="h-1 rounded-full w-3/4" style={{ background: preset.colors.textMuted }} />
                <div className="h-1 rounded-full w-1/2" style={{ background: preset.colors.border }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Label row */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: preset.colors.bgSecondary }}>
        <span className="text-base leading-none">{preset.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: preset.colors.textPrimary }}>{preset.name}</p>
          <p className="text-[10px]" style={{ color: preset.colors.textMuted }}>{preset.isDark ? 'Dark' : 'Light'}</p>
        </div>
        {isActive && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: preset.colors.accent }}>
            <Check className="w-3 h-3" style={{ color: preset.colors.buttonText }} />
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Density Selector ─────────────────────────────────────────────────────────

function DensitySelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = [
    { id: 'compact', label: 'Compact', desc: 'Dense, more content visible' },
    { id: 'comfortable', label: 'Comfortable', desc: 'Balanced spacing (default)' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {opts.map(opt => (
        <button key={opt.id} onClick={() => onChange(opt.id)}
          className={cn(
            'flex flex-col gap-1 p-3.5 rounded-xl border text-left transition-all',
            value === opt.id ? 'border-violet-400 bg-violet-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300',
          )}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">{opt.label}</span>
            {value === opt.id && <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
          </div>
          <span className="text-xs text-slate-500">{opt.desc}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Font Size Selector ───────────────────────────────────────────────────────

function FontSizeSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const sizes = [13, 14, 15, 16, 17, 18];
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 flex-wrap flex-1">
        {sizes.map(s => (
          <button key={s} onClick={() => onChange(s)}
            className={cn(
              'w-10 h-8 rounded-lg text-xs font-semibold transition-all',
              value === s ? 'bg-violet-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300',
            )}>
            {s}
          </button>
        ))}
      </div>
      <span className="text-xs text-slate-400 shrink-0">px</span>
    </div>
  );
}

// ─── Border Radius Selector ───────────────────────────────────────────────────

function RadiusSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = [
    { label: 'Square', value: '4px', preview: '0.25rem' },
    { label: 'Soft', value: '8px', preview: '0.5rem' },
    { label: 'Round', value: '12px', preview: '0.75rem' },
    { label: 'Pill', value: '20px', preview: '1.25rem' },
  ];
  return (
    <div className="flex gap-2">
      {opts.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 flex flex-col items-center gap-1.5 py-2.5 px-2 transition-all text-xs border',
            value === opt.value ? 'border-violet-400 bg-violet-50/60 text-violet-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
          )}
          style={{ borderRadius: opt.value }}>
          <div className="w-6 h-6 border-2" style={{ borderRadius: opt.value, borderColor: value === opt.value ? '#7c3aed' : '#94a3b8', background: value === opt.value ? '#ede9fe' : '#f8fafc' }} />
          <span className="font-medium">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Theme Settings Panel ─────────────────────────────────────────────────────

export function ThemeSettings() {
  const { theme, setTheme, presets } = useTheme();
  const [customizing, setCustomizing] = useState(false);

  const updateLayout = (key: keyof Theme['layout'], val: string | number) => {
    setTheme({
      ...theme,
      layout: { ...theme.layout, [key]: val },
    });
  };

  const updateTypography = (key: keyof Theme['typography'], val: string | number) => {
    setTheme({
      ...theme,
      typography: { ...theme.typography, [key]: val },
    });
  };

  const lightThemes = presets.filter(t => !t.isDark);
  const darkThemes  = presets.filter(t => t.isDark);

  return (
    <div className="space-y-8">
      {/* Light themes */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sun className="w-4 h-4 text-amber-500" />
          <h4 className="text-sm font-semibold text-slate-700">Light Themes</h4>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {lightThemes.map(preset => (
            <ThemeCard key={preset.id} preset={preset} isActive={theme.id === preset.id} onSelect={() => setTheme(preset)} />
          ))}
        </div>
      </div>

      {/* Dark themes */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Moon className="w-4 h-4 text-indigo-400" />
          <h4 className="text-sm font-semibold text-slate-700">Dark Themes</h4>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {darkThemes.map(preset => (
            <ThemeCard key={preset.id} preset={preset} isActive={theme.id === preset.id} onSelect={() => setTheme(preset)} />
          ))}
        </div>
      </div>

      {/* Customization accordion */}
      <div>
        <button
          onClick={() => setCustomizing(v => !v)}
          className="flex items-center gap-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <Layout className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700 flex-1 text-left">Customise Layout & Typography</span>
          <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', customizing && 'rotate-180')} />
        </button>

        {customizing && (
          <div className="mt-3 space-y-5 p-4 border border-slate-200 rounded-xl bg-white">
            {/* UI Density */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                UI Density
              </label>
              <DensitySelector value={theme.layout.density} onChange={v => updateLayout('density', v)} />
            </div>

            {/* Border Radius */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Corner Style
              </label>
              <RadiusSelector value={theme.layout.borderRadius} onChange={v => { updateLayout('borderRadius', v); updateLayout('buttonRadius', v); }} />
            </div>

            {/* Font size */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" />Base Font Size
              </label>
              <FontSizeSelector value={theme.typography.baseFontSize} onChange={v => updateTypography('baseFontSize', v)} />
            </div>

            {/* Sidebar width */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Sidebar Width — {theme.layout.sidebarWidth}px
              </label>
              <input
                type="range" min={200} max={320} step={8}
                value={theme.layout.sidebarWidth}
                onChange={e => updateLayout('sidebarWidth', parseInt(e.target.value))}
                className="w-full accent-violet-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Active theme pill */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: `${theme.colors.accentLight}`, border: `1px solid ${theme.colors.accent}30` }}>
        <span className="text-lg">{theme.emoji}</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: theme.colors.accent }}>{theme.name}</p>
          <p className="text-xs" style={{ color: theme.colors.textMuted }}>{theme.isDark ? 'Dark theme' : 'Light theme'} · {theme.layout.density} density</p>
        </div>
        <div className="ml-auto w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: theme.colors.accent }}>
          <Palette className="w-4 h-4" style={{ color: theme.colors.buttonText }} />
        </div>
      </div>
    </div>
  );
}
