import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/store';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval, setHours, setMinutes, isBefore, isEqual } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, Lock, Unlock, Users, RefreshCw, Search, X, Trash2, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { CalendarEvent, Priority, Task } from '@/types';

export function CalendarView() {
  const { workspace, tasks, events, addEvent, updateEvent, deleteEvent, setCurrentView, setSelectedTaskId, setSelectedNoteId } = useAppStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isPrivate, setIsPrivate] = useState(false);

  // Feature States
  const [showGaps, setShowGaps] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const workspaceTasks = tasks.filter(t => t.workspace === workspace && t.dueDate);
  const workspaceEvents = events.filter(e => e.workspace === workspace);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  const openModal = (date: Date, event?: CalendarEvent) => {
    setSelectedDate(date);
    if (event) {
      setEditingEvent(event);
      setTitle(event.title);
      setDescription(event.description || '');
      setStartTime(format(event.startTime, 'HH:mm'));
      setEndTime(format(event.endTime, 'HH:mm'));
      setIsPrivate(event.isPrivate);
    } else {
      setEditingEvent(null);
      setTitle('');
      setDescription('');
      setStartTime('09:00');
      setEndTime('10:00');
      setIsPrivate(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const handleSaveEvent = () => {
    if (!title.trim()) return;

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const start = setMinutes(setHours(selectedDate, startHour), startMinute).getTime();
    const end = setMinutes(setHours(selectedDate, endHour), endMinute).getTime();

    if (editingEvent) {
      updateEvent(editingEvent.id, {
        title,
        description,
        startTime: start,
        endTime: end,
        isPrivate
      });
    } else {
      addEvent({
        title,
        description,
        startTime: start,
        endTime: end,
        workspace,
        isPrivate
      });
    }
    closeModal();
  };

  const handleDeleteEvent = () => {
    if (editingEvent) {
      deleteEvent(editingEvent.id);
      closeModal();
    }
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      // Mock sync: add a random event tomorrow
      const tomorrow = addDays(new Date(), 1);
      addEvent({
        title: 'Synced: Google Meet',
        description: 'Imported from Google Calendar',
        startTime: setHours(tomorrow, 14).getTime(),
        endTime: setHours(tomorrow, 15).getTime(),
        workspace,
        isPrivate: false
      });
      setIsSyncing(false);
      alert('Successfully synced 1 event from Google Calendar.');
    }, 1500);
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Medium': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Low': return 'bg-zinc-100 text-zinc-700 border-zinc-200';
      default: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  const renderHeader = () => {
    return (
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-zinc-900 w-48">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-1 border border-zinc-200 rounded-md p-0.5 bg-white shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-3 font-medium" onClick={today}>Today</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant={showGaps ? "default" : "outline"} 
            size="sm" 
            onClick={() => setShowGaps(!showGaps)}
            className="h-9"
          >
            <Search className="w-4 h-4 mr-2" />
            Gap Finder
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => alert('Share link copied to clipboard! (Mock)')}>
            <Users className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
            {isSyncing ? 'Syncing...' : 'Sync GCal'}
          </Button>
          <Button size="sm" className="h-9" onClick={() => openModal(new Date())}>
            <Plus className="w-4 h-4 mr-2" />
            New Event
          </Button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentDate);

    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center font-semibold text-sm text-zinc-500 py-2">
          {format(addDays(startDate, i), 'EEE')}
        </div>
      );
    }
    return <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/50">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        
        // Find tasks and events for this day
        const dayTasks = workspaceTasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), cloneDay));
        const dayEvents = workspaceEvents.filter(e => isSameDay(new Date(e.startTime), cloneDay));
        
        // Sort events by time
        dayEvents.sort((a, b) => a.startTime - b.startTime);

        // Calculate gaps if Gap Finder is active
        let hasGap = false;
        if (showGaps && dayEvents.length < 3 && !isBefore(cloneDay, new Date(new Date().setHours(0,0,0,0)))) {
          hasGap = true; // Highlight future days with few events
        }

        days.push(
          <div
            key={day.toString()}
            className={cn(
              "min-h-[140px] p-2 border-b border-r border-zinc-200 transition-colors relative group",
              !isSameMonth(day, monthStart) ? "bg-zinc-50/50 text-zinc-400" : "bg-white text-zinc-900",
              isSameDay(day, new Date()) ? "bg-indigo-50/10" : "",
              hasGap ? "ring-2 ring-inset ring-emerald-400 bg-emerald-50/20" : ""
            )}
            onClick={(e) => {
              if (e.target === e.currentTarget) openModal(cloneDay);
            }}
          >
            <div className="flex justify-between items-start pointer-events-none">
              <span className={cn(
                "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full pointer-events-auto",
                isSameDay(day, new Date()) ? "bg-indigo-600 text-white" : "hover:bg-zinc-100 cursor-pointer",
                !isSameMonth(day, monthStart) && !isSameDay(day, new Date()) ? "text-zinc-400" : ""
              )} onClick={() => openModal(cloneDay)}>
                {formattedDate}
              </span>
              {hasGap && <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Free Time</span>}
            </div>
            
            <div className="mt-2 flex flex-col gap-1.5">
              {/* Render Events */}
              {dayEvents.map(event => (
                <div 
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(cloneDay, event);
                  }}
                  className={cn(
                    "text-xs p-1.5 rounded border cursor-pointer hover:shadow-sm transition-all flex flex-col gap-0.5",
                    event.isPrivate ? "bg-zinc-100 border-zinc-200 text-zinc-700" : "bg-blue-50 border-blue-200 text-blue-800"
                  )}
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="truncate">{event.title}</span>
                    {event.isPrivate && <Lock className="w-3 h-3 shrink-0 opacity-50" />}
                  </div>
                  <div className="flex items-center text-[10px] opacity-80">
                    <Clock className="w-3 h-3 mr-1" />
                    {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                  </div>
                </div>
              ))}

              {/* Render Tasks */}
              {dayTasks.map(task => (
                <div 
                  key={task.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTaskId(task.id);
                    setCurrentView('tasks');
                  }}
                  className={cn(
                    "text-xs p-1.5 rounded border truncate cursor-pointer hover:shadow-sm transition-all flex items-center gap-1.5",
                    task.status === 'Done' ? "bg-zinc-50 border-zinc-200 text-zinc-400 line-through" : getPriorityColor(task.priority)
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full shrink-0", task.status === 'Done' ? 'bg-zinc-300' : 'bg-current opacity-50')} />
                  <span className="truncate font-medium">{task.title}</span>
                </div>
              ))}
            </div>
            
            {/* Quick Add Button on Hover */}
            <button 
              className="absolute bottom-2 right-2 w-6 h-6 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all"
              onClick={(e) => {
                e.stopPropagation();
                openModal(cloneDay);
              }}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="border-l border-zinc-200">{rows}</div>;
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col relative">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">Calendar</h1>
        <p className="text-zinc-500 mt-1 text-sm md:text-base">Unified view of your {workspace.toLowerCase()} schedule and deadlines.</p>
      </header>

      <div className="flex-1 bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 md:p-6 border-b border-zinc-200 bg-zinc-50/30">
          {renderHeader()}
        </div>
        <div className="flex-1 overflow-y-auto">
          {renderDays()}
          {renderCells()}
        </div>
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-indigo-500" />
                {editingEvent ? 'Edit Event' : 'New Event'}
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={closeModal}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Date</label>
                <div className="text-sm font-medium p-2 bg-zinc-50 rounded-md border border-zinc-200">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Event Title</label>
                <Input 
                  autoFocus
                  placeholder="e.g., Team Sync" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-700 mb-1 block">Start Time</label>
                  <Input 
                    type="time" 
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700 mb-1 block">End Time</label>
                  <Input 
                    type="time" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Description (Optional)</label>
                <Textarea 
                  placeholder="Add details, links, or notes..." 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none h-20"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-full", isPrivate ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600")}>
                    {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{isPrivate ? 'Private Event' : 'Public Event'}</p>
                    <p className="text-xs text-zinc-500">{isPrivate ? 'Only you can see details' : 'Visible to shared contacts'}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={isPrivate} onChange={() => setIsPrivate(!isPrivate)} />
                  <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {editingEvent?.linkedTaskId && (
                <Button variant="outline" className="w-full justify-start text-indigo-600 border-indigo-200 bg-indigo-50" onClick={() => {
                  setSelectedTaskId(editingEvent.linkedTaskId!);
                  setCurrentView('tasks');
                  closeModal();
                }}>
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Open Linked Task
                </Button>
              )}
              {editingEvent?.linkedNoteId && (
                <Button variant="outline" className="w-full justify-start text-indigo-600 border-indigo-200 bg-indigo-50" onClick={() => {
                  setSelectedNoteId(editingEvent.linkedNoteId!);
                  setCurrentView('notes');
                  closeModal();
                }}>
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Open Linked Note
                </Button>
              )}
            </div>
            
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center">
              {editingEvent ? (
                <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDeleteEvent}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              ) : <div></div>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeModal}>Cancel</Button>
                <Button onClick={handleSaveEvent} disabled={!title.trim()}>Save Event</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
