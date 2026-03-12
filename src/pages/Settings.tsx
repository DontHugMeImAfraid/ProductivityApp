import React, { useState } from 'react';
import { useAppStore } from '@/store';
import { Settings as SettingsIcon, User, Palette, CheckSquare, Calendar, FileText, Bell, Shield, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function Settings() {
  const { settings, updateSettings, profiles, addProfile, updateProfile, deleteProfile } = useAppStore();
  const [activeTab, setActiveTab] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'tasks', label: 'Tasks & Projects', icon: CheckSquare },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'profiles', label: 'Profiles', icon: User },
    { id: 'markdown', label: 'Markdown', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Data & Security', icon: Shield },
  ];

  const filteredTabs = tabs.filter(tab => 
    tab.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full bg-white">
      {/* Settings Sidebar */}
      <div className="w-64 border-r border-zinc-200 p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input 
            placeholder="Search settings..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <nav className="space-y-1">
          {filteredTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  activeTab === tab.id 
                    ? "bg-zinc-100 text-zinc-900" 
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-zinc-900 mb-6">
            {tabs.find(t => t.id === activeTab)?.label}
          </h1>

          {activeTab === 'tasks' && (
            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-medium text-zinc-900 mb-4">Task Creation</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 border border-zinc-200 rounded-lg">
                    <div>
                      <div className="font-medium text-zinc-900">Allow Back-Dating Tasks</div>
                      <div className="text-sm text-zinc-500">Enable creating tasks with due dates in the past.</div>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500"
                      checked={settings.allowBackDatingTasks}
                      onChange={(e) => updateSettings({ allowBackDatingTasks: e.target.checked })}
                    />
                  </label>
                  
                  <label className="flex items-center justify-between p-4 border border-zinc-200 rounded-lg">
                    <div>
                      <div className="font-medium text-zinc-900">Hide Completed Tasks</div>
                      <div className="text-sm text-zinc-500">Automatically hide tasks marked as done.</div>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500"
                      checked={settings.hideCompletedTasks}
                      onChange={(e) => updateSettings({ hideCompletedTasks: e.target.checked })}
                    />
                  </label>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-medium text-zinc-900 mb-4">Metrics & Scales</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <label className="flex-1 flex items-center justify-between p-4 border border-zinc-200 rounded-lg">
                      <span className="font-medium text-zinc-900">Priority</span>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500"
                        checked={settings.enablePriority}
                        onChange={(e) => updateSettings({ enablePriority: e.target.checked })}
                      />
                    </label>
                    <label className="flex-1 flex items-center justify-between p-4 border border-zinc-200 rounded-lg">
                      <span className="font-medium text-zinc-900">Impact</span>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500"
                        checked={settings.enableImpact}
                        onChange={(e) => updateSettings({ enableImpact: e.target.checked })}
                      />
                    </label>
                    <label className="flex-1 flex items-center justify-between p-4 border border-zinc-200 rounded-lg">
                      <span className="font-medium text-zinc-900">Effort</span>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500"
                        checked={settings.enableEffort}
                        onChange={(e) => updateSettings({ enableEffort: e.target.checked })}
                      />
                    </label>
                  </div>

                  <div className="p-4 border border-zinc-200 rounded-lg">
                    <div className="font-medium text-zinc-900 mb-2">Scale System</div>
                    <div className="text-sm text-zinc-500 mb-4">Choose the scoring range for Impact and Effort.</div>
                    <select 
                      className="w-full p-2 border border-zinc-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={settings.scaleSystem}
                      onChange={(e) => updateSettings({ scaleSystem: e.target.value as any })}
                    >
                      <option value="1-5">1 - 5</option>
                      <option value="1-10">1 - 10</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-medium text-zinc-900 mb-4">Task-to-Calendar Automation</h3>
                <div className="p-4 border border-zinc-200 rounded-lg space-y-4">
                  <div className="text-sm text-zinc-500 mb-4">Configure how tasks interact with the calendar when created.</div>
                  <select 
                    className="w-full p-2 border border-zinc-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={settings.taskToCalendarAutomation}
                    onChange={(e) => updateSettings({ taskToCalendarAutomation: e.target.value as any })}
                  >
                    <option value="always">Always (Automatically add tasks with dates)</option>
                    <option value="prompt">Prompt (Ask before adding)</option>
                    <option value="if-time">If Time Is Specified (Only tasks with HH:MM)</option>
                    <option value="never">Never (Tasks remain in list only)</option>
                  </select>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'markdown' && (
            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-medium text-zinc-900 mb-4">Rendering Mode</h3>
                <div className="p-4 border border-zinc-200 rounded-lg space-y-4">
                  <div className="text-sm text-zinc-500 mb-4">Choose how Markdown syntax is displayed when editing.</div>
                  <select 
                    className="w-full p-2 border border-zinc-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={settings.markdownRenderMode}
                    onChange={(e) => updateSettings({ markdownRenderMode: e.target.value as any })}
                  >
                    <option value="always">Always Show Syntax</option>
                    <option value="dynamic">Dynamic Mode (Show on edited line)</option>
                    <option value="never">Never Show Syntax (WYSIWYG)</option>
                  </select>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'profiles' && (
            <div className="space-y-8">
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-zinc-900">Workspace Profiles</h3>
                  <Button size="sm" onClick={() => {
                    addProfile({ name: 'New Profile', color: 'bg-zinc-500', icon: 'Briefcase' });
                  }}>
                    Add Profile
                  </Button>
                </div>
                <div className="space-y-4">
                  {profiles.map(profile => (
                    <div key={profile.id} className="flex items-center gap-4 p-4 border border-zinc-200 rounded-lg">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white", profile.color)}>
                        <User className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <Input 
                          value={profile.name}
                          onChange={(e) => updateProfile(profile.id, { name: e.target.value })}
                          className="font-medium border-none px-0 h-auto focus-visible:ring-0"
                        />
                      </div>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteProfile(profile.id)}>
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Add placeholders for other tabs */}
          {['general', 'appearance', 'notifications', 'security'].includes(activeTab) && (
            <div className="p-8 text-center border border-dashed border-zinc-300 rounded-xl text-zinc-500">
              Settings for {tabs.find(t => t.id === activeTab)?.label} will appear here.
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
