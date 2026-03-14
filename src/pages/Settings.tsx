import React, { useState } from 'react';
import { useAppStore } from '@/store';
import {
  Settings as SettingsIcon, User, Palette, CheckSquare, Calendar,
  FileText, Bell, Shield, Search, Plus, Trash2, Download,
  Zap, Star, Heart, Music, Coffee, Book, Camera, Globe,
  Code, Cpu, Lock, Eye, EyeOff, Moon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Status } from '@/types';
import * as LucideIcons from 'lucide-react';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-violet-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 transition-colors" />
    </label>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-white">
      <div className="flex-1 mr-4">
        <div className="font-medium text-slate-900 text-sm">{label}</div>
        {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-8 mb-3 first:mt-0">{title}</h3>;
}

const PROFILE_ICONS = [
  'Briefcase', 'Home', 'Dumbbell', 'Star', 'Heart', 'Music',
  'Coffee', 'Book', 'Camera', 'Globe', 'Code', 'Cpu',
  'Zap', 'Moon', 'User', 'Settings',
];

const PROFILE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#64748b', '#18181b',
];

const StyledSelect = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 hover:border-slate-300 transition-colors"
  >
    {children}
  </select>
);

export function Settings() {
  const { settings, updateSettings, profiles, addProfile, updateProfile, deleteProfile, tasks, notes } = useAppStore();
  const [activeTab, setActiveTab] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

  const tabs = [
    { id: 'general',       label: 'General',         icon: SettingsIcon },
    { id: 'appearance',    label: 'Appearance',       icon: Palette },
    { id: 'tasks',         label: 'Tasks & Projects', icon: CheckSquare },
    { id: 'calendar',      label: 'Calendar',         icon: Calendar },
    { id: 'profiles',      label: 'Profiles',         icon: User },
    { id: 'markdown',      label: 'Markdown',         icon: FileText },
    { id: 'notifications', label: 'Notifications',    icon: Bell },
    { id: 'security',      label: 'Data & Security',  icon: Shield },
  ];

  const filteredTabs = tabs.filter(tab =>
    tab.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportJSON = () => {
    const data = { tasks, notes, settings, profiles, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    const lines = notes.map(n =>
      `# ${n.title}\n\n> Workspace: ${n.workspace} | Updated: ${new Date(n.updatedAt).toLocaleDateString()}\n\n${n.content}\n\n---\n`
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-notes-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || (LucideIcons as any)['Briefcase'];
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Tab sidebar */}
      <div className="w-52 bg-slate-50/60 border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-base font-bold text-slate-900">Settings</h1>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              placeholder="Filter…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
            />
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {filteredTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  activeTab === tab.id
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", activeTab === tab.id ? "text-white" : "text-slate-400")} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">

        {/* ══ GENERAL ══ */}
        {activeTab === 'general' && (
          <div className="space-y-2">
            <SectionHeader title="Interface" />
            <SettingRow label="UI Density" description="Controls spacing and sizing throughout the app.">
              <StyledSelect value={settings.uiDensity} onChange={v => updateSettings({ uiDensity: v as any })}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </StyledSelect>
            </SettingRow>

            <SettingRow label="Sidebar Behavior" description="How the sidebar behaves on mobile devices.">
              <StyledSelect value={settings.sidebarBehavior} onChange={v => updateSettings({ sidebarBehavior: v as any })}>
                <option value="full">Full sidebar</option>
                <option value="icons-only">Icons only</option>
                <option value="auto-hide">Auto-hide on mobile</option>
              </StyledSelect>
            </SettingRow>

            <SettingRow label="Default Landing Page" description="The view that opens when you launch the app.">
              <StyledSelect value={settings.defaultLandingPage ?? 'dashboard'} onChange={v => updateSettings({ defaultLandingPage: v as any })}>
                <option value="dashboard">Dashboard</option>
                <option value="calendar">Calendar</option>
                <option value="task-kanban">Task Board</option>
                <option value="daily-note">Daily Note</option>
              </StyledSelect>
            </SettingRow>

            <SectionHeader title="Dashboard" />
            <SettingRow
              label="Task Click Behaviour"
              description="What happens when you click a task on the Dashboard."
            >
              <StyledSelect
                value={settings.dashboardTaskClickBehavior ?? 'auto-open'}
                onChange={v => updateSettings({ dashboardTaskClickBehavior: v as any })}
              >
                <option value="auto-open">Automatically open the task</option>
                <option value="highlight">Highlight the task in its project</option>
              </StyledSelect>
            </SettingRow>

            <SectionHeader title="Productivity" />
            <SettingRow label="Daily Reset Time" description="When 'Today' resets (useful for night owls).">
              <Input
                type="time"
                className="w-32 h-9 text-sm"
                value={settings.dailyResetTime ?? '04:00'}
                onChange={e => updateSettings({ dailyResetTime: e.target.value })}
              />
            </SettingRow>
            <SettingRow label="Celebration Effects" description="Show confetti when completing tasks.">
              <Toggle checked={settings.celebrationEffects ?? true} onChange={v => updateSettings({ celebrationEffects: v })} />
            </SettingRow>
            <SettingRow label="Streak Tracking" description="Show streak counters on recurring tasks.">
              <Toggle checked={settings.streakTracking ?? false} onChange={v => updateSettings({ streakTracking: v })} />
            </SettingRow>

            <SectionHeader title="Focus" />
            <SettingRow label="Nuclear Mode" description="Only deliver notifications from the current profile.">
              <Toggle checked={settings.nuclearMode ?? false} onChange={v => updateSettings({ nuclearMode: v })} />
            </SettingRow>
          </div>
        )}

        {/* ══ APPEARANCE ══ */}
        {activeTab === 'appearance' && (
          <div className="space-y-2">
            <SectionHeader title="Status Colors" />
            <p className="text-sm text-slate-500 mb-4">Customize the color for each task status.</p>
            {(['To Do', 'In Progress', 'In Review', 'Done'] as Status[]).map(status => (
              <div key={status} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: settings.statusColors[status] ?? '#e4e4e7' }} />
                  <span className="text-sm font-medium text-slate-900">{status}</span>
                </div>
                <input
                  type="color"
                  className="w-9 h-9 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                  value={settings.statusColors[status] ?? '#e4e4e7'}
                  onChange={e => updateSettings({ statusColors: { ...settings.statusColors, [status]: e.target.value } })}
                />
              </div>
            ))}

            <SectionHeader title="Privacy" />
            <SettingRow label="Cloak Mode" description="Blur sensitive content during screen sharing.">
              <Toggle checked={settings.cloakMode ?? false} onChange={v => updateSettings({ cloakMode: v })} />
            </SettingRow>
          </div>
        )}

        {/* ══ TASKS ══ */}
        {activeTab === 'tasks' && (
          <div className="space-y-2">
            <SectionHeader title="Task Creation" />
            <SettingRow label="Allow Back-Dating Tasks" description="Enable creating tasks with due dates in the past.">
              <Toggle checked={settings.allowBackDatingTasks} onChange={v => updateSettings({ allowBackDatingTasks: v })} />
            </SettingRow>
            <SettingRow label="Hide Completed Tasks" description="Automatically hide tasks marked as done from the board.">
              <Toggle checked={settings.hideCompletedTasks} onChange={v => updateSettings({ hideCompletedTasks: v })} />
            </SettingRow>

            <SectionHeader title="Metrics & Scales" />
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'enablePriority', label: 'Priority' },
                { key: 'enableImpact',   label: 'Impact'   },
                { key: 'enableEffort',   label: 'Effort'   },
              ].map(({ key, label }) => (
                <div key={key} className="flex flex-col items-center gap-2 p-4 border border-slate-200 rounded-xl bg-white">
                  <span className="text-sm font-medium text-slate-900">{label}</span>
                  <Toggle
                    checked={(settings as any)[key]}
                    onChange={v => updateSettings({ [key]: v } as any)}
                  />
                </div>
              ))}
            </div>

            <div className="p-4 border border-slate-200 rounded-xl bg-white">
              <div className="font-medium text-sm text-slate-900 mb-1">Scale System</div>
              <div className="text-xs text-slate-500 mb-3">Scoring range for Impact and Effort.</div>
              <div className="flex gap-2">
                {(['1-5', '1-10'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => updateSettings({ scaleSystem: s })}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-sm font-medium border transition-all",
                      settings.scaleSystem === s
                        ? "bg-violet-600 text-white border-violet-600"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ CALENDAR ══ */}
        {activeTab === 'calendar' && (
          <div className="space-y-2">
            <SectionHeader title="Task → Calendar" />
            <SettingRow label="Auto-add Tasks to Calendar" description="Control when tasks with times are added.">
              <StyledSelect value={settings.taskToCalendarAutomation} onChange={v => updateSettings({ taskToCalendarAutomation: v as any })}>
                <option value="always">Always</option>
                <option value="prompt">Prompt me</option>
                <option value="if-time">Only if time is set</option>
                <option value="never">Never</option>
              </StyledSelect>
            </SettingRow>
            <SettingRow label="Default Task Duration" description="How long tasks appear on the calendar.">
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={5} max={480} step={5}
                  className="w-20 h-9 text-sm text-right"
                  value={settings.defaultTaskDuration}
                  onChange={e => updateSettings({ defaultTaskDuration: parseInt(e.target.value) || 30 })}
                />
                <span className="text-sm text-slate-500">min</span>
              </div>
            </SettingRow>
            <SectionHeader title="Reminders" />
            <SettingRow label="Reminder Lead Time" description="Minutes before an event to send reminders.">
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={120}
                  className="w-20 h-9 text-sm text-right"
                  value={settings.reminderLeadTime ?? 15}
                  onChange={e => updateSettings({ reminderLeadTime: parseInt(e.target.value) || 15 })}
                />
                <span className="text-sm text-slate-500">min</span>
              </div>
            </SettingRow>
          </div>
        )}

        {/* ══ PROFILES ══ */}
        {activeTab === 'profiles' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <SectionHeader title="Profiles" />
              <Button
                size="sm"
                onClick={() => addProfile({ name: 'New Profile', color: '#6366f1', icon: 'Star' })}
                className="h-8 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Profile
              </Button>
            </div>
            {profiles.map(profile => (
              <div key={profile.id} className="p-4 border border-slate-200 rounded-xl bg-white space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: profile.color }}
                  >
                    {getIcon(profile.icon)}
                  </div>
                  <Input
                    value={profile.name}
                    onChange={e => updateProfile(profile.id, { name: e.target.value })}
                    className="flex-1 font-medium"
                  />
                  <button
                    onClick={() => deleteProfile(profile.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Color picker */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">Color</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {PROFILE_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => updateProfile(profile.id, { color: c })}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                          profile.color === c ? "border-slate-700 scale-110" : "border-transparent"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Icon picker */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">Icon</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {PROFILE_ICONS.map(iconName => {
                      const Icon = (LucideIcons as any)[iconName];
                      if (!Icon) return null;
                      return (
                        <button
                          key={iconName}
                          onClick={() => updateProfile(profile.id, { icon: iconName })}
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center border transition-all",
                            profile.icon === iconName
                              ? "border-violet-400 bg-violet-50 text-violet-700"
                              : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ MARKDOWN ══ */}
        {activeTab === 'markdown' && (
          <div className="space-y-2">
            <SectionHeader title="Rendering" />
            <div className="p-4 border border-slate-200 rounded-xl bg-white">
              <div className="font-medium text-sm text-slate-900 mb-1">Markdown Render Mode</div>
              <div className="text-xs text-slate-500 mb-3">When markdown is converted to rich text in notes.</div>
              <div className="space-y-2">
                {[
                  { value: 'always',  label: 'Always', desc: 'Notes always display as rich text.' },
                  { value: 'dynamic', label: 'Dynamic', desc: 'Switch between edit and preview.' },
                  { value: 'never',   label: 'Never', desc: 'Always show raw markdown.' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="markdownMode"
                      value={opt.value}
                      checked={settings.markdownRenderMode === opt.value}
                      onChange={() => updateSettings({ markdownRenderMode: opt.value as any })}
                      className="mt-0.5 accent-violet-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ NOTIFICATIONS ══ */}
        {activeTab === 'notifications' && (
          <div className="space-y-2">
            <SectionHeader title="Digests" />
            <SettingRow label="Morning Digest" description="Daily summary of tasks and events in the morning.">
              <Toggle checked={settings.morningDigest ?? false} onChange={v => updateSettings({ morningDigest: v })} />
            </SettingRow>
            <SettingRow label="Evening Digest" description="End-of-day recap of completed and upcoming tasks.">
              <Toggle checked={settings.eveningDigest ?? false} onChange={v => updateSettings({ eveningDigest: v })} />
            </SettingRow>
          </div>
        )}

        {/* ══ DATA & SECURITY ══ */}
        {activeTab === 'security' && (
          <div className="space-y-2">
            <SectionHeader title="Auto Archive" />
            <SettingRow label="Archive completed tasks after" description="Automatically archive done tasks.">
              <StyledSelect value={settings.autoArchive ?? 'never'} onChange={v => updateSettings({ autoArchive: v as any })}>
                <option value="1-day">1 day</option>
                <option value="7-days">7 days</option>
                <option value="30-days">30 days</option>
                <option value="never">Never</option>
              </StyledSelect>
            </SettingRow>

            <SectionHeader title="Trash" />
            <SettingRow label="Trash Retention" description="How long deleted items are kept.">
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={365}
                  className="w-20 h-9 text-sm text-right"
                  value={settings.trashRetention ?? 30}
                  onChange={e => updateSettings({ trashRetention: parseInt(e.target.value) || 30 })}
                />
                <span className="text-sm text-slate-500">days</span>
              </div>
            </SettingRow>

            <SectionHeader title="Data Export" />
            <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3">
              <p className="text-sm text-slate-500">Export your entire database. Your data belongs to you.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleExportJSON}>
                  <Download className="w-4 h-4 mr-2" /> Export JSON
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleExportMarkdown}>
                  <Download className="w-4 h-4 mr-2" /> Export Markdown
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
