import React, { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Tasks } from './pages/Tasks';
import { Notes } from './pages/Notes';
import { AIAssistant } from './pages/AIAssistant';
import { CalendarView } from './pages/Calendar';
import { Settings } from './pages/Settings';
import { Menu, Sparkles } from 'lucide-react';
import { Button } from './components/ui/Button';
import { cn } from './lib/utils';
import { useAppStore } from './store';

export default function App() {
  const { currentView, setCurrentView } = useAppStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'tasks':
        return <Tasks />;
      case 'notes':
        return <Notes />;
      case 'ai':
        return <AIAssistant />;
      case 'calendar':
        return <CalendarView />;
      case 'settings':
        return <Settings />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center flex-col gap-4 text-zinc-500 p-4 text-center">
            <h2 className="text-2xl font-semibold text-zinc-900">Coming Soon</h2>
            <p>This section is under development.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-white text-zinc-950 font-sans overflow-hidden">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar 
          currentView={currentView} 
          setCurrentView={(v) => { 
            setCurrentView(v); 
            setIsMobileMenuOpen(false); 
          }} 
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-200 bg-white shrink-0">
          <div className="flex items-center gap-2 font-bold text-lg text-zinc-900">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-zinc-50" />
            </div>
            Nexus
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
        </div>
        
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
