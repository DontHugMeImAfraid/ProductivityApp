import React from 'react';
import { useAppStore } from '@/store';
import { LayoutDashboard, CheckSquare, FileText, Calendar, Sparkles, Settings, Briefcase, User, Dumbbell, Home, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const { workspace, setWorkspace, profiles } = useAppStore();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks & Projects', icon: CheckSquare },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'ai', label: 'AI Assistant', icon: Sparkles },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || Briefcase;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="w-64 bg-zinc-50 border-r border-zinc-200 h-screen flex flex-col">
      <div className="p-4 border-b border-zinc-200">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-zinc-900">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-zinc-50" />
          </div>
          Nexus
        </div>
      </div>

      <div className="p-4">
        <div className="bg-zinc-200/50 p-1 rounded-lg flex flex-wrap gap-1 mb-6">
          {profiles.map(profile => (
            <button
              key={profile.id}
              onClick={() => setWorkspace(profile.name)}
              className={cn(
                "flex-1 min-w-[45%] flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all duration-200 active:scale-95",
                workspace === profile.name ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              {getIcon(profile.icon)}
              {profile.name}
            </button>
          ))}
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 active:scale-95",
                  currentView === item.id 
                    ? "bg-zinc-100 text-zinc-900" 
                    : "text-zinc-600 hover:bg-zinc-100/50 hover:text-zinc-900"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
      
      <div className="mt-auto p-4 border-t border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
            FB
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-900">Fortune Bowie</span>
            <span className="text-xs text-zinc-500">Free Plan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
