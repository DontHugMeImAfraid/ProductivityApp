import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store';
import {
  LayoutDashboard, CheckSquare, FileText, Calendar,
  Sparkles, Settings, Briefcase, Home, Dumbbell,
  Plus, User, LogOut, ChevronDown, FolderKanban
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const { workspace, setWorkspace, profiles } = useAppStore();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard',       icon: LayoutDashboard },
    { id: 'tasks',     label: 'Tasks & Projects', icon: FolderKanban },
    { id: 'notes',     label: 'Notes',            icon: FileText },
    { id: 'calendar',  label: 'Calendar',         icon: Calendar },
    { id: 'spending', label: 'Spending', icon: Sparkles },
  ];

  const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || Briefcase;
    return <Icon className="w-4 h-4" />;
  };

  const currentProfile = profiles.find(p => p.name === workspace) ?? profiles[0];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
              <p className="text-xs text-slate-400 truncate">nexus.app</p>
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
                  alert('Logout — connect your auth provider here.');
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
