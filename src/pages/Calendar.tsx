import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/store';
import {
  format, startOfWeek, addDays, startOfMonth, endOfMonth,
  endOfWeek, isSameMonth, isSameDay, addMonths, subMonths,
  setHours, setMinutes, isBefore, isToday, differenceInMinutes
} from 'date-fns';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  Clock, Lock, Unlock, X, Trash2, Link as LinkIcon,
  Sparkles, LayoutGrid, List, Search
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { CalendarEvent, Priority, Task } from '@/types';

type CalView = 'month' | 'week';

// ─── Gap suggestion type ─────────────────────────────────────────────────────
interface Gap {
  date: Date;
  startHour: number;
  endHour: number;
  durationMinutes: number;
}

// ─── Priority color helper ───────────────────────────────────────────────────
const priorityColor = (priority: Priority) => {
  switch (priority) {
    case 'Urgent': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'High':   return 'bg-red-100 text-red-700 border-red-200';
    case 'Medium': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Low':    return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    default:       return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  }
};

// ─── Time-blocking gap finder ────────────────────────────────────────────────
function useGapFinder(events: CalendarEvent[]): Gap[] {
  return useMemo(() => {
    const gaps: Gap[] = [];
    const today = new Date();

    for (let d = 0; d < 7; d++) {
      const date = addDays(today, d);
      const dayStart = 8;  // 8 AM
      const dayEnd   = 19; // 7 PM

      const dayEvents = events
        .filter(e => isSameDay(new Date(e.startTime), date))
        .sort((a, b) => a.startTime - b.startTime);

      let cursor = dayStart;
      for (const ev of dayEvents) {
        const evStart = new Date(ev.startTime).getHours() + new Date(ev.startTime).getMinutes() / 60;
        const evEnd   = new Date(ev.endTime).getHours() + new Date(ev.endTime).getMinutes() / 60;

        if (evStart - cursor >= 1) {
          gaps.push({
            date,
            startHour: cursor,
            endHour: evStart,
            durationMinutes: Math.round((evStart - cursor) * 60),
          });
        }
        cursor = Math.max(cursor, evEnd);
      }

      if (dayEnd - cursor >= 1) {
        gaps.push({
          date,
          startHour: cursor,
          endHour: dayEnd,
          durationMinutes: Math.round((dayEnd - cursor) * 60),
        });
      }
    }

    return gaps.sort((a, b) => b.durationMinutes - a.durationMinutes).slice(0, 5);
  }, [events]);
}

// ─── Event Modal ─────────────────────────────────────────────────────────────
interface EventModalProps {
  selectedDate: Date;
  editingEvent: CalendarEvent | null;
  onClose: () => void;
  onSave: (data: Partial<CalendarEvent>) => void;
  onDelete: () => void;
}

function EventModal({ selectedDate, editingEvent, onClose, onSave, onDelete }: EventModalProps) {
  const { setSelectedTaskId, setCurrentView, setSelectedNoteId } = useAppStore();
  const [title,       setTitle]       = useState(editingEvent?.title || '');
  const [description, setDescription] = useState(editingEvent?.description || '');
  const [startTime,   setStartTime]   = useState(editingEvent ? format(editingEvent.startTime, 'HH:mm') : '09:00');
  const [endTime,     setEndTime]     = useState(editingEvent ? format(editingEvent.endTime, 'HH:mm') : '10:00');
  const [isPrivate,   setIsPrivate]   = useState(editingEvent?.isPrivate || false);

  const handleSave = () => {
    if (!title.trim()) return;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    onSave({
      title,
      description,
      startTime: setMinutes(setHours(selectedDate, sh), sm).getTime(),
      endTime:   setMinutes(setHours(selectedDate, eh), em).getTime(),
      isPrivate,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
          <h3 className="font-semibold text-zinc-900 flex items-center gap-2 text-sm">
            <CalendarIcon className="w-4 h-4 text-indigo-500" />
            {editingEvent ? 'Edit Event' : 'New Event'}
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Date</label>
            <div className="text-sm font-medium px-3 py-2 bg-zinc-50 rounded-lg border border-zinc-200">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Title *</label>
            <Input
              autoFocus
              placeholder="e.g. Team Sync"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Start</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">End</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Description</label>
            <Textarea
              placeholder="Add notes, links, or details…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none h-16 text-sm"
            />
          </div>

          {/* Privacy toggle */}
          <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-full", isPrivate ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600")}>
                {isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-900">{isPrivate ? 'Private' : 'Public'}</p>
                <p className="text-[10px] text-zinc-400">{isPrivate ? 'Only visible to you' : 'Visible to shared contacts'}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={isPrivate} onChange={() => setIsPrivate(!isPrivate)} />
              <div className="w-8 h-4 bg-zinc-200 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>

          {/* Linked items */}
          {editingEvent?.linkedTaskId && (
            <Button variant="outline" className="w-full justify-start text-indigo-600 border-indigo-200 bg-indigo-50 text-xs h-8"
              onClick={() => { setSelectedTaskId(editingEvent.linkedTaskId!); setCurrentView('tasks'); onClose(); }}>
              <LinkIcon className="w-3 h-3 mr-1.5" /> Open Linked Task
            </Button>
          )}
          {editingEvent?.linkedNoteId && (
            <Button variant="outline" className="w-full justify-start text-indigo-600 border-indigo-200 bg-indigo-50 text-xs h-8"
              onClick={() => { setSelectedNoteId(editingEvent.linkedNoteId!); setCurrentView('notes'); onClose(); }}>
              <LinkIcon className="w-3 h-3 mr-1.5" /> Open Linked Note
            </Button>
          )}
        </div>

        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center">
          {editingEvent ? (
            <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 text-sm" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!title.trim()}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Calendar Component ─────────────────────────────────────────────────
export function CalendarView() {
  const { workspace, tasks, events, addEvent, updateEvent, deleteEvent, settings, setCurrentView, setSelectedTaskId } = useAppStore();

  const [currentDate,   setCurrentDate]   = useState(new Date());
  const [calView,       setCalView]       = useState<CalView>('month');
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [editingEvent,  setEditingEvent]  = useState<CalendarEvent | null>(null);
  const [selectedDate,  setSelectedDate]  = useState(new Date());
  const [showGapFinder, setShowGapFinder] = useState(false);

  const workspaceTasks  = tasks.filter(t => t.workspace === workspace && t.dueDate);
  const workspaceEvents = events.filter(e => e.workspace === workspace);

  const gaps = useGapFinder(workspaceEvents);

  const openModal = (date: Date, event?: CalendarEvent) => {
    setSelectedDate(date);
    setEditingEvent(event || null);
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingEvent(null); };

  const handleSave = (data: Partial<CalendarEvent>) => {
    if (editingEvent) {
      updateEvent(editingEvent.id, data);
    } else {
      addEvent({ ...data, workspace, isPrivate: data.isPrivate ?? false } as Omit<CalendarEvent, 'id'>);
    }
    closeModal();
  };

  const handleDelete = () => {
    if (editingEvent) { deleteEvent(editingEvent.id); closeModal(); }
  };

  // ── Month Grid ─────────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd   = endOfMonth(monthStart);
    const startDate  = startOfWeek(monthStart);
    const endDate    = endOfWeek(monthEnd);

    const rows: React.ReactNode[] = [];
    let day = startDate;
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const header = (
      <div key="header" className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/50">
        {dayLabels.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-zinc-500">{d}</div>
        ))}
      </div>
    );

    while (day <= endDate) {
      const week: React.ReactNode[] = [];
      for (let i = 0; i < 7; i++) {
        const cloneDay = new Date(day);
        const dayEvents = workspaceEvents.filter(e => isSameDay(new Date(e.startTime), cloneDay));
        const dayTasks  = workspaceTasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), cloneDay));
        const inMonth   = isSameMonth(day, monthStart);
        const isTodays  = isToday(day);

        week.push(
          <div
            key={day.toString()}
            className={cn(
              "min-h-[90px] md:min-h-[110px] border-b border-r border-zinc-100 p-1.5 cursor-pointer group relative transition-colors",
              !inMonth && "bg-zinc-50/30",
              isTodays && "bg-indigo-50/40",
              "hover:bg-zinc-50"
            )}
            onClick={() => openModal(cloneDay)}
          >
            {/* Day number */}
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 transition-colors",
              isTodays ? "bg-indigo-600 text-white" : inMonth ? "text-zinc-900" : "text-zinc-300",
            )}>
              {format(day, 'd')}
            </div>

            {/* Events */}
            <div className="space-y-0.5">
              {dayEvents.slice(0, 2).map(event => (
                <div
                  key={event.id}
                  onClick={(e) => { e.stopPropagation(); openModal(cloneDay, event); }}
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-medium truncate cursor-pointer transition-opacity hover:opacity-80",
                    event.isPrivate
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-indigo-500 text-white"
                  )}
                >
                  <span className="flex items-center gap-1">
                    {event.isPrivate && <Lock className="w-2 h-2 shrink-0" />}
                    {format(event.startTime, 'HH:mm')} {event.title}
                  </span>
                </div>
              ))}
              {dayTasks.slice(0, 1).map(task => (
                <div
                  key={task.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); setCurrentView('tasks'); }}
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-medium truncate cursor-pointer border flex items-center gap-1",
                    task.status === 'Done' ? "bg-zinc-50 border-zinc-200 text-zinc-400 line-through" : priorityColor(task.priority)
                  )}
                >
                  <div className="w-1 h-1 rounded-full bg-current opacity-60 shrink-0" />
                  {task.title}
                </div>
              ))}
              {(dayEvents.length + dayTasks.length) > 3 && (
                <div className="text-[10px] text-zinc-400 pl-1">
                  +{(dayEvents.length + dayTasks.length) - 3} more
                </div>
              )}
            </div>

            {/* Quick add on hover */}
            <button
              className="absolute bottom-1 right-1 w-5 h-5 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-zinc-400 opacity-0 group-hover:opacity-100 hover:border-indigo-300 hover:text-indigo-500 transition-all shadow-sm"
              onClick={(e) => { e.stopPropagation(); openModal(cloneDay); }}
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div key={day.toString()} className="grid grid-cols-7">{week}</div>);
    }

    return <>{header}{rows}</>;
  };

  // ── Week View ──────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8am–8pm

    return (
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="grid grid-cols-8 border-b border-zinc-200 bg-zinc-50 sticky top-0 z-10">
          <div className="border-r border-zinc-200 p-2" />
          {days.map(d => (
            <div key={d.toString()} className={cn("p-2 text-center border-r border-zinc-100", isToday(d) && "bg-indigo-50")}>
              <div className="text-xs text-zinc-500">{format(d, 'EEE')}</div>
              <div className={cn(
                "text-sm font-semibold mx-auto w-7 h-7 flex items-center justify-center rounded-full",
                isToday(d) ? "bg-indigo-600 text-white" : "text-zinc-900"
              )}>
                {format(d, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        {hours.map(hour => (
          <div key={hour} className="grid grid-cols-8 border-b border-zinc-100 min-h-[56px]">
            <div className="border-r border-zinc-200 px-2 py-1 text-[10px] text-zinc-400 text-right shrink-0">
              {format(setHours(new Date(), hour), 'h a')}
            </div>
            {days.map(d => {
              const dayEvents = workspaceEvents.filter(e => {
                const eh = new Date(e.startTime).getHours();
                return isSameDay(new Date(e.startTime), d) && eh === hour;
              });
              return (
                <div
                  key={d.toString()}
                  className={cn("border-r border-zinc-100 p-0.5 cursor-pointer hover:bg-zinc-50 transition-colors", isToday(d) && "bg-indigo-50/20")}
                  onClick={() => openModal(setHours(d, hour))}
                >
                  {dayEvents.map(ev => (
                    <div
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); openModal(d, ev); }}
                      className="text-[10px] bg-indigo-500 text-white rounded px-1 py-0.5 mb-0.5 truncate cursor-pointer hover:bg-indigo-600 transition-colors"
                    >
                      {ev.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <header className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">Calendar</h1>
        <p className="text-zinc-500 mt-1 text-sm">
          Unified view of your <strong>{workspace}</strong> schedule and deadlines.
        </p>
      </header>

      {/* ── Calendar Card ────────────────────────────────────────────────────── */}
      <div className="flex-1 bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">

        {/* Controls */}
        <div className="p-3 md:p-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Nav */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 border border-zinc-200 rounded-lg p-0.5 bg-white shadow-sm">
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setCurrentDate(calView === 'month' ? subMonths(currentDate, 1) : addDays(currentDate, -7))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium"
                onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setCurrentDate(calView === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, 7))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <h2 className="text-base font-bold text-zinc-900">
              {calView === 'month'
                ? format(currentDate, 'MMMM yyyy')
                : `${format(startOfWeek(currentDate), 'MMM d')} – ${format(endOfWeek(currentDate), 'MMM d, yyyy')}`}
            </h2>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex bg-white border border-zinc-200 rounded-lg p-0.5">
              <button
                onClick={() => setCalView('month')}
                className={cn("px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1",
                  calView === 'month' ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900")}
              >
                <LayoutGrid className="w-3 h-3" /> Month
              </button>
              <button
                onClick={() => setCalView('week')}
                className={cn("px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1",
                  calView === 'week' ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900")}
              >
                <List className="w-3 h-3" /> Week
              </button>
            </div>

            {/* Gap finder */}
            <Button
              variant={showGapFinder ? "default" : "outline"}
              size="sm" className="h-8 text-xs"
              onClick={() => setShowGapFinder(!showGapFinder)}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Gap Finder
            </Button>

            <Button size="sm" className="h-8 text-xs" onClick={() => openModal(new Date())}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Event
            </Button>
          </div>
        </div>

        {/* Gap Finder Panel */}
        {showGapFinder && (
          <div className="border-b border-zinc-200 bg-indigo-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-zinc-900">Available Time Blocks</h3>
              <span className="text-xs text-zinc-500">Next 7 days — gaps of 1 hr+</span>
            </div>
            {gaps.length === 0 ? (
              <p className="text-sm text-zinc-500">No significant gaps found in the next 7 days.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {gaps.map((gap, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs cursor-pointer hover:border-indigo-400 hover:shadow-sm transition-all"
                    onClick={() => {
                      openModal(setHours(gap.date, gap.startHour));
                      setShowGapFinder(false);
                    }}
                  >
                    <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                    <div>
                      <span className="font-medium text-zinc-900">{format(gap.date, 'EEE MMM d')}</span>
                      <span className="text-zinc-500 mx-1">·</span>
                      <span className="text-indigo-600">
                        {format(setHours(new Date(), gap.startHour), 'h a')} – {format(setHours(new Date(), gap.endHour), 'h a')}
                      </span>
                      <span className="ml-1.5 bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                        {gap.durationMinutes >= 60
                          ? `${Math.floor(gap.durationMinutes / 60)}h${gap.durationMinutes % 60 ? ` ${gap.durationMinutes % 60}m` : ''}`
                          : `${gap.durationMinutes}m`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Calendar grid */}
        <div className="flex-1 overflow-y-auto border-l border-zinc-200">
          {calView === 'month' ? renderMonthView() : renderWeekView()}
        </div>
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <EventModal
          selectedDate={selectedDate}
          editingEvent={editingEvent}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}