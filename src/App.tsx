import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Tasks } from './pages/Tasks';
import { Notes } from './pages/Notes';

import { CalendarView } from './pages/Calendar';
import { Settings } from './pages/Settings';
import { Menu, Sparkles } from 'lucide-react';
import { Button } from './components/ui/Button';
import { SpendingManager } from './pages/SpendingManager';
import { cn } from './lib/utils';
import { useAppStore } from './store';
import { ThemeProvider } from './contexts/ThemeSystem'; // ← add this import

export default function App() {
  const { currentView, setCurrentView, setSelectedNoteId } = useAppStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [prevView, setPrevView] = useState(currentView);
  const [transitioning, setTransitioning] = useState(false);
  const [displayView, setDisplayView] = useState(currentView);

  useEffect(() => {
    const openNoteId = sessionStorage.getItem('nexus_open_note');
    if (openNoteId) {
      sessionStorage.removeItem('nexus_open_note');
      setCurrentView('notes');
      setSelectedNoteId(openNoteId);
    }
  }, []);

  // Page transition: fade+slide between views
  useEffect(() => {
    if (currentView === displayView) return;
    setTransitioning(true);
    const t = setTimeout(() => {
      setDisplayView(currentView);
      setTransitioning(false);
    }, 180);
    return () => clearTimeout(t);
  }, [currentView]);

  const renderView = () => {
    switch (displayView) {
      case 'dashboard': return <Dashboard />;
      case 'tasks':     return <Tasks />;
      case 'notes':     return <Notes />;
      case 'spending': return <SpendingManager />;
      case 'calendar':  return <CalendarView />;
      case 'settings':  return <Settings />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center flex-col gap-4 text-slate-500 p-4 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">Coming Soon</h2>
            <p>This section is under development.</p>
          </div>
        );
    }
  };

  return (
    <ThemeProvider>
    <div className="flex h-screen bg-slate-50 text-slate-950 font-sans overflow-hidden">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <Sidebar
          currentView={displayView}
          setCurrentView={(v) => {
            setCurrentView(v);
            setIsMobileMenuOpen(false);
          }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 bg-white">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-slate-900">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            Nexus
          </div>
          <div className="w-9" />
        </div>

        {/* Page with transition */}
        <div
          className={cn(
            'flex-1 overflow-auto transition-all duration-200 ease-in-out',
            transitioning
              ? 'opacity-0 translate-y-1'
              : 'opacity-100 translate-y-0'
          )}
        >
          {renderView()}
        </div>
      </div>
    </div>
    </ThemeProvider>
  );
}
