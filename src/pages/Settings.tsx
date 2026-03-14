import React, { useState } from 'react';
import { useAppStore } from '@/store';
import {
  Settings as SettingsIcon, User, Palette, CheckSquare, Calendar,
  FileText, Bell, Shield, Search, Plus, Trash2, Download,
  Briefcase, Home, Dumbbell, Zap, Star, Heart, Music, Coffee,
  Book, Camera, Globe, Code, Cpu, Lock, Eye, EyeOff, Moon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Status } from '@/types';
import * as LucideIcons from 'lucide-react';

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="w-10 h-5 bg-zinc-200 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
    </label>
  );
}

// ─── Setting Row ──────────────────────────────────────────────────────────────
function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-4 border border-zinc-200 rounded-lg bg-white">
      <div className="flex-1 mr-4">
        <div className="font-medium text-zinc-900 text-sm">{label}</div>
        {description && <div className="text-xs text-zinc-500 mt-0.5">{description}</div>}
      </div>
      {children}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mt-8 mb-3 first:mt-0">{title}</h3>;
}

// ─── Available profile icons ──────────────────────────────────────────────────
const PROFILE_ICONS = [
  'Briefcase', 'Home', 'Dumbbell', 'Star', 'Heart', 'Music',
  'Coffee', 'Book', 'Camera', 'Globe', 'Code', 'Cpu',
  'Zap', 'Moon', 'User', 'Settings'
];

const PROFILE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#64748b', '#18181b',
];

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

  // ── Export JSON ──────────────────────────────────────────────────────────────
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

  // ── Export Markdown ──────────────────────────────────────────────────────────
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

  const getProfileIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || Briefcase;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="flex h-full bg-white">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-56 border-r border-zinc-200 p-4 flex flex-col gap-3 overflow-y-auto shrink-0 bg-zinc-50/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <Input
            placeholder="Search…"
            className="pl-8 h-8 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <nav className="space-y-0.5">
          {filteredTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-zinc-200/80 text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold text-zinc-900 mb-6">
            {tabs.find(t => t.id === activeTab)?.label}
          </h1>

          {/* ═══════════════ GENERAL ═══════════════ */}
          {activeTab === 'general' && (
            <div className="space-y-2">
              <SectionHeader title="Layout" />
              <SettingRow label="UI Density" description="Compact fits more content; Comfortable gives more breathing room.">
                <select
                  className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 bg-white"
                  value={settings.uiDensity}
                  onChange={(e) => updateSettings({ uiDensity: e.target.value as any })}
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </SettingRow>

              <SettingRow label="Sidebar Behavior" description="How the sidebar behaves on mobile devices.">
                <select
                  className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 bg-white"
                  value={settings.sidebarBehavior}
                  onChange={(e) => updateSettings({ sidebarBehavior: e.target.value as any })}
                >
                  <option value="full">Full sidebar</option>
                  <option value="icons-only">Icons only</option>
                  <option value="auto-hide">Auto-hide on mobile</option>
                </select>
              </SettingRow>

              <SettingRow label="Default Landing Page" description="The view that opens when you launch the app.">
                <select
                  className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 bg-white"
                  value={settings.defaultLandingPage ?? 'dashboard'}
                  onChange={(e) => updateSettings({ defaultLandingPage: e.target.value as any })}
                >
                  <option value="dashboard">Dashboard</option>
                  <option value="calendar">Calendar</option>
                  <option value="task-kanban">Task Board</option>
                  <option value="daily-note">Daily Note</option>
                </select>
              </SettingRow>

              <SectionHeader title="Productivity" />
              <SettingRow label="Daily Reset Time" description="When 'Today' resets. Useful for night owls (e.g. 4:00 AM).">
                <Input
                  type="time"
                  className="w-32 h-9 text-sm"
                  value={settings.dailyResetTime ?? '00:00'}
                  onChange={(e) => updateSettings({ dailyResetTime: e.target.value })}
                />
              </SettingRow>

              <SettingRow label="Celebration Effects" description="Show confetti animation when completing tasks.">
                <Toggle
                  checked={settings.celebrationEffects ?? true}
                  onChange={(v) => updateSettings({ celebrationEffects: v })}
                />
              </SettingRow>

              <SettingRow label="Streak Tracking" description="Display streak counters on recurring tasks (🔥 12-day streak).">
                <Toggle
                  checked={settings.streakTracking ?? false}
                  onChange={(v) => updateSettings({ streakTracking: v })}
                />
              </SettingRow>

              <SectionHeader title="Focus" />
              <SettingRow
                label="Nuclear Mode"
                description="When active, only the current profile's notifications are delivered."
              >
                <Toggle
                  checked={settings.nuclearMode ?? false}
                  onChange={(v) => updateSettings({ nuclearMode: v })}
                />
              </SettingRow>
            </div>
          )}

          {/* ═══════════════ APPEARANCE ═══════════════ */}
          {activeTab === 'appearance' && (
            <div className="space-y-2">
              <SectionHeader title="Status Colors" />
              <p className="text-sm text-zinc-500 mb-4">Customize the color associated with each task status.</p>

              {(['In Progress', 'In Review', 'Done', 'To Do', 'Backlog'] as Status[]).map(status => (
                <div key={status} className="flex items-center justify-between p-4 border border-zinc-200 rounded-lg bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: settings.statusColors[status] || '#e4e4e7' }} />
                    <span className="text-sm font-medium text-zinc-900">{status}</span>
                  </div>
                  <input
                    type="color"
                    className="w-9 h-9 rounded-md cursor-pointer border border-zinc-200 p-0.5"
                    value={settings.statusColors[status] || '#e4e4e7'}
                    onChange={(e) =>
                      updateSettings({
                        statusColors: { ...settings.statusColors, [status]: e.target.value }
                      })
                    }
                  />
                </div>
              ))}

              <SectionHeader title="Priority Heatmap" />
              <div className="p-4 border border-zinc-200 rounded-lg bg-white space-y-3">
                <p className="text-sm text-zinc-500">Task card borders and badges are automatically tinted based on priority level.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Low', color: '#22c55e' },
                    { label: 'Medium', color: '#f97316' },
                    { label: 'High', color: '#ef4444' },
                    { label: 'Urgent', color: '#7c3aed' },
                  ].map(p => (
                    <div key={p.label} className="flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-100 bg-zinc-50">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-sm text-zinc-700">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <SectionHeader title="Privacy" />
              <SettingRow
                label="Cloak Mode"
                description="Instantly blur or hide sensitive content during presentations or screen sharing."
              >
                <Toggle
                  checked={settings.cloakMode ?? false}
                  onChange={(v) => updateSettings({ cloakMode: v })}
                />
              </SettingRow>
            </div>
          )}

          {/* ═══════════════ TASKS ═══════════════ */}
          {activeTab === 'tasks' && (
            <div className="space-y-2">
              <SectionHeader title="Task Creation" />
              <SettingRow label="Allow Back-Dating Tasks" description="Enable creating tasks with due dates in the past.">
                <Toggle
                  checked={settings.allowBackDatingTasks}
                  onChange={(v) => updateSettings({ allowBackDatingTasks: v })}
                />
              </SettingRow>
              <SettingRow label="Hide Completed Tasks" description="Automatically hide tasks marked as done from the board.">
                <Toggle
                  checked={settings.hideCompletedTasks}
                  onChange={(v) => updateSettings({ hideCompletedTasks: v })}
                />
              </SettingRow>

              <SectionHeader title="Metrics & Scales" />
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'enablePriority', label: 'Priority' },
                  { key: 'enableImpact', label: 'Impact' },
                  { key: 'enableEffort', label: 'Effort' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex flex-col items-center gap-2 p-4 border border-zinc-200 rounded-lg bg-white">
                    <span className="text-sm font-medium text-zinc-900">{label}</span>
                    <Toggle
                      checked={(settings as any)[key]}
                      onChange={(v) => updateSettings({ [key]: v } as any)}
                    />
                  </div>
                ))}
              </div>

              <div className="p-4 border border-zinc-200 rounded-lg bg-white">
                <div className="font-medium text-sm text-zinc-900 mb-1">Scale System</div>
                <div className="text-xs text-zinc-500 mb-3">Choose the scoring range for Impact and Effort.</div>
                <div className="flex gap-2">
                  {(['1-5', '1-10'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => updateSettings({ scaleSystem: s })}
                      className={cn(
                        "flex-1 py-2 rounded-md text-sm font-medium border transition-colors",
                        settings.scaleSystem === s
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <SectionHeader title="Impact × Effort Matrix" />
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'High Impact / Low Effort', tag: 'Quick Wins', color: 'bg-green-50 border-green-200 text-green-700' },
                  { label: 'High Impact / High Effort', tag: 'Major Projects', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                  { label: 'Low Impact / Low Effort', tag: 'Fill Tasks', color: 'bg-zinc-50 border-zinc-200 text-zinc-600' },
                  { label: 'Low Impact / High Effort', tag: 'Time Wasters', color: 'bg-red-50 border-red-200 text-red-700' },
                ].map(q => (
                  <div key={q.tag} className={cn("p-3 rounded-lg border", q.color)}>
                    <div className="text-xs font-semibold">{q.tag}</div>
                    <div className="text-xs opacity-70 mt-0.5">{q.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════ CALENDAR ═══════════════ */}
          {activeTab === 'calendar' && (
            <div className="space-y-2">
              <SectionHeader title="Task-to-Calendar Automation" />
              <div className="p-4 border border-zinc-200 rounded-lg bg-white space-y-3">
                <p className="text-sm text-zinc-500">Configure how tasks with dates interact with the calendar.</p>
                <select
                  className="w-full text-sm border border-zinc-200 rounded-md p-2 bg-white"
                  value={settings.taskToCalendarAutomation}
                  onChange={(e) => updateSettings({ taskToCalendarAutomation: e.target.value as any })}
                >
                  <option value="always">Always — Automatically add tasks with dates</option>
                  <option value="prompt">Prompt — Ask me before adding</option>
                  <option value="if-time">If Time Specified — Only tasks with HH:MM</option>
                  <option value="never">Never — Tasks remain in list only</option>
                </select>
              </div>

              <SectionHeader title="Default Event Duration" />
              <SettingRow label="Default Duration" description="Used when a task is added to calendar without a specified end time.">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    className="w-20 h-9 text-sm text-right"
                    value={settings.defaultTaskDuration ?? 30}
                    onChange={(e) => updateSettings({ defaultTaskDuration: parseInt(e.target.value) || 30 })}
                  />
                  <span className="text-sm text-zinc-500">min</span>
                </div>
              </SettingRow>
            </div>
          )}

          {/* ═══════════════ PROFILES ═══════════════ */}
          {activeTab === 'profiles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">Each profile has its own tasks, notes, calendar view and settings.</p>
                <Button
                  size="sm"
                  onClick={() => addProfile({ name: 'New Profile', color: '#6366f1', icon: 'User' })}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Profile
                </Button>
              </div>

              <div className="space-y-3">
                {profiles.map(profile => (
                  <div key={profile.id} className="p-4 border border-zinc-200 rounded-xl bg-white space-y-4">
                    <div className="flex items-center gap-3">
                      {/* Color + Icon preview */}
                      <button
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 transition-transform hover:scale-110"
                        style={{ backgroundColor: profile.color }}
                        onClick={() => setColorPickerFor(colorPickerFor === profile.id ? null : profile.id)}
                        title="Change color"
                      >
                        {getProfileIcon(profile.icon)}
                      </button>

                      <div className="flex-1">
                        <Input
                          value={profile.name}
                          onChange={(e) => updateProfile(profile.id, { name: e.target.value })}
                          className="font-medium text-sm border-none px-0 h-auto focus-visible:ring-0 shadow-none"
                          placeholder="Profile name"
                        />
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => deleteProfile(profile.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Color picker */}
                    {colorPickerFor === profile.id && (
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-zinc-500 mb-2">Color</p>
                          <div className="flex flex-wrap gap-2">
                            {PROFILE_COLORS.map(color => (
                              <button
                                key={color}
                                className={cn(
                                  "w-7 h-7 rounded-full transition-transform hover:scale-110",
                                  profile.color === color && "ring-2 ring-offset-2 ring-zinc-900"
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() => updateProfile(profile.id, { color })}
                              />
                            ))}
                            <label className="w-7 h-7 rounded-full border-2 border-dashed border-zinc-300 flex items-center justify-center cursor-pointer hover:border-zinc-400" title="Custom color">
                              <input
                                type="color"
                                className="sr-only"
                                value={profile.color}
                                onChange={(e) => updateProfile(profile.id, { color: e.target.value })}
                              />
                              <Plus className="w-3 h-3 text-zinc-400" />
                            </label>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-zinc-500 mb-2">Icon</p>
                          <div className="flex flex-wrap gap-2">
                            {PROFILE_ICONS.map(iconName => {
                              const Icon = (LucideIcons as any)[iconName] || Briefcase;
                              return (
                                <button
                                  key={iconName}
                                  title={iconName}
                                  className={cn(
                                    "w-8 h-8 rounded-lg border flex items-center justify-center transition-colors",
                                    profile.icon === iconName
                                      ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                                      : "border-zinc-200 hover:border-zinc-300 text-zinc-600"
                                  )}
                                  onClick={() => updateProfile(profile.id, { icon: iconName })}
                                >
                                  <Icon className="w-4 h-4" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════ MARKDOWN ═══════════════ */}
          {activeTab === 'markdown' && (
            <div className="space-y-2">
              <SectionHeader title="Rendering Mode" />
              <div className="space-y-2">
                {[
                  { value: 'always', label: 'Always Show Syntax', desc: 'Raw Markdown symbols remain visible at all times.' },
                  { value: 'dynamic', label: 'Dynamic Mode', desc: 'Markdown syntax appears only on the line being edited.' },
                  { value: 'never', label: 'Never Show Syntax (WYSIWYG)', desc: 'Pure rich-text experience — no syntax symbols.' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => updateSettings({ markdownRenderMode: opt.value as any })}
                    className={cn(
                      "w-full text-left p-4 rounded-lg border transition-colors",
                      settings.markdownRenderMode === opt.value
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-zinc-900">{opt.label}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{opt.desc}</div>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 shrink-0",
                        settings.markdownRenderMode === opt.value
                          ? "border-indigo-600 bg-indigo-600"
                          : "border-zinc-300"
                      )} />
                    </div>
                  </button>
                ))}
              </div>

              <SectionHeader title="Smart Editing" />
              <div className="p-4 border border-zinc-200 rounded-lg bg-white space-y-2">
                {[
                  'Auto-pair brackets and symbols  ( [ → [ ]  )',
                  'Auto-continue lists on Enter ( - or 1. )',
                  'Strike-through completed checklist items',
                  'Move completed checklist items to bottom',
                  'Wikilinks via [[Note Name]] syntax',
                ].map(feat => (
                  <div key={feat} className="flex items-center gap-2 text-sm text-zinc-700">
                    <div className="w-4 h-4 rounded bg-indigo-100 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    </div>
                    {feat}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════ NOTIFICATIONS ═══════════════ */}
          {activeTab === 'notifications' && (
            <div className="space-y-2">
              <SectionHeader title="Focus" />
              <SettingRow label="Focus Mode Integration" description="Notifications automatically mute when your device enters Focus Mode.">
                <Toggle checked={true} onChange={() => {}} />
              </SettingRow>

              <SettingRow
                label="Nuclear Mode"
                description="Only the active workspace profile sends notifications. All others are silenced."
              >
                <Toggle
                  checked={settings.nuclearMode ?? false}
                  onChange={(v) => updateSettings({ nuclearMode: v })}
                />
              </SettingRow>

              <SectionHeader title="Reminder Lead Time" />
              <SettingRow label="Notify me before events" description="How far in advance to receive reminders.">
                <div className="flex items-center gap-2">
                  <select
                    className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 bg-white"
                    value={settings.reminderLeadTime ?? 15}
                    onChange={(e) => updateSettings({ reminderLeadTime: parseInt(e.target.value) })}
                  >
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={1440}>Day before at 9 AM</option>
                  </select>
                </div>
              </SettingRow>

              <SectionHeader title="Daily Briefings" />
              <SettingRow label="Morning Summary" description="Receive a digest of high-impact tasks and today's events.">
                <Toggle
                  checked={settings.morningDigest ?? false}
                  onChange={(v) => updateSettings({ morningDigest: v })}
                />
              </SettingRow>
              <SettingRow label="Evening Summary" description="End-of-day recap of completed tasks and overdue items.">
                <Toggle
                  checked={settings.eveningDigest ?? false}
                  onChange={(v) => updateSettings({ eveningDigest: v })}
                />
              </SettingRow>
            </div>
          )}

          {/* ═══════════════ SECURITY ═══════════════ */}
          {activeTab === 'security' && (
            <div className="space-y-2">
              <SectionHeader title="Auto Archive" />
              <SettingRow label="Archive completed tasks after" description="Completed tasks are automatically archived to keep your board clean.">
                <select
                  className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 bg-white"
                  value={settings.autoArchive ?? 'never'}
                  onChange={(e) => updateSettings({ autoArchive: e.target.value as any })}
                >
                  <option value="1-day">1 day</option>
                  <option value="7-days">7 days</option>
                  <option value="30-days">30 days</option>
                  <option value="never">Never</option>
                </select>
              </SettingRow>

              <SectionHeader title="Trash" />
              <SettingRow label="Trash Retention" description="How long deleted items are kept in the trash before permanent deletion.">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    className="w-20 h-9 text-sm text-right"
                    value={settings.trashRetention ?? 30}
                    onChange={(e) => updateSettings({ trashRetention: parseInt(e.target.value) || 30 })}
                  />
                  <span className="text-sm text-zinc-500">days</span>
                </div>
              </SettingRow>

              <SectionHeader title="Biometric Lock" />
              <SettingRow label="Require authentication on launch" description="Use Face ID or fingerprint to unlock the app.">
                <Toggle
                  checked={settings.biometricLock ?? false}
                  onChange={(v) => updateSettings({ biometricLock: v })}
                />
              </SettingRow>

              <SectionHeader title="Data Export" />
              <div className="p-4 border border-zinc-200 rounded-xl bg-white space-y-3">
                <p className="text-sm text-zinc-500">Export your entire database. Your data belongs to you.</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleExportJSON}>
                    <Download className="w-4 h-4 mr-2" />
                    Export JSON
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleExportMarkdown}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Markdown
                  </Button>
                </div>
                <div className="text-xs text-zinc-400">
                  JSON includes all tasks, notes, events and settings. Markdown exports your notes as individual files.
                </div>
              </div>

              <SectionHeader title="Privacy Engine (Cloak Mode)" />
              <div className="p-4 border border-zinc-200 rounded-xl bg-white space-y-3">
                <p className="text-sm text-zinc-500">Control what's visible during screen sharing or presentations.</p>
                <div className="space-y-2">
                  {[
                    { label: 'Full Detail', desc: 'All information visible.', icon: Eye },
                    { label: 'Availability Only', desc: 'Calendar shows "Busy" only.', icon: EyeOff },
                    { label: 'Hidden', desc: 'No visible activity.', icon: Lock },
                  ].map(({ label, desc, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 bg-zinc-50">
                      <Icon className="w-4 h-4 text-zinc-500 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-zinc-900">{label}</div>
                        <div className="text-xs text-zinc-500">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <SettingRow label="Enable Cloak Mode" description="Instantly blur sensitive content.">
                  <Toggle
                    checked={settings.cloakMode ?? false}
                    onChange={(v) => updateSettings({ cloakMode: v })}
                  />
                </SettingRow>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}