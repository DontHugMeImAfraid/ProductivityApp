import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store';
import {
  LayoutDashboard, CheckSquare, FileText, Calendar,
  Sparkles, Settings, Briefcase, Home, Dumbbell,
  Plus, User, LogOut, ChevronDown, FolderKanban,
  Sun, Moon, Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import { useTheme, PRESET_THEMES } from '@/contexts/ThemeSystem';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const { workspace, setWorkspace, profiles } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard',       icon: LayoutDashboard },
    { id: 'tasks',     label: 'Tasks & Projects', icon: FolderKanban },
    { id: 'notes',     label: 'Notes',            icon: FileText },
    { id: 'calendar',  label: 'Calendar',         icon: Calendar },
    { id: 'spending',  label: 'Spending',         icon: Sparkles },
  ];

  const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || Briefcase;
    return <Icon className="w-4 h-4" />;
  };

  const currentProfile = profiles.find(p => p.name === workspace) ?? profiles[0];
  const { signOut } = useAuth();
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setProfileMenuOpen(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemePickerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cycle through a curated quick list: light → dark → midnight → nord
  const quickThemeIds = ['light', 'dark', 'midnight', 'nord', 'catppuccin', 'obsidian'];
  const quickThemes = PRESET_THEMES.filter(t => quickThemeIds.includes(t.id));

  return (
    <div className="w-64 bg-white border-r border-slate-200/80 h-screen flex flex-col shadow-sm">
      {/* Logo */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-slate-900">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="bg-gradient-to-r from-violet-700 to-indigo-600 bg-clip-text text-transparent">
            Nexus
          </span>

          {/* Quick theme toggle button */}
          <div className="ml-auto relative" ref={themeRef}>
            <button
              onClick={() => setThemePickerOpen(v => !v)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              title="Quick theme switch"
            >
              {theme.isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {themePickerOpen && (
              <div className="absolute top-9 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 w-64 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center gap-2 mb-3">
                  <Palette className="w-3.5 h-3.5 text-violet-500" />
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Quick Themes</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {quickThemes.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setTheme(t); setThemePickerOpen(false); }}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-xs font-semibold hover:scale-105',
                        theme.id === t.id ? 'border-violet-400 shadow-sm' : 'border-transparent hover:border-slate-200',
                      )}
                      style={{ background: t.colors.bgSecondary }}
                    >
                      <span className="text-base">{t.emoji}</span>
                      <span style={{ color: t.colors.textSecondary }}>{t.name}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setCurrentView('settings'); setThemePickerOpen(false); }}
                  className="mt-2.5 w-full text-xs text-violet-600 hover:text-violet-800 font-medium py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
                >
                  All themes in Settings →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 pt-4 pb-2">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2 mb-2">Workspace</p>
        <div className="space-y-0.5">
          {profiles.map(profile => (
            <button
              key={profile.id}
              onClick={() => setWorkspace(profile.name)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                workspace === profile.name
                  ? "bg-violet-50 text-violet-700"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: profile.color ?? '#6366f1' }}
              />
              {profile.name}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 pt-3">
        <div className="h-px bg-slate-100" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                active
                  ? "bg-violet-600 text-white shadow-sm shadow-violet-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Profile menu at bottom */}
      <div className="p-3 border-t border-slate-100" ref={menuRef}>
        <div className="relative">
          <button
            onClick={() => setProfileMenuOpen(v => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-all duration-150 group"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
              style={{ backgroundColor: currentProfile?.color ?? '#6366f1' }}
            >
              {(currentProfile?.name ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-slate-900 truncate">{currentProfile?.name ?? 'User'}</p>
              <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                {theme.emoji} {theme.name}
              </p>
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-slate-400 transition-transform duration-200",
              profileMenuOpen && "rotate-180"
            )} />
          </button>

          {/* Dropdown */}
          {profileMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/60 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button
                onClick={() => { setCurrentView('settings'); setProfileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                Settings
              </button>
              <div className="h-px bg-slate-100 mx-3" />
              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  
                  signOut();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
