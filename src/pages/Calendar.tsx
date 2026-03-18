import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store';
import {
  format, startOfWeek, addDays, startOfMonth, endOfMonth,
  endOfWeek, isSameMonth, isSameDay, addMonths, subMonths,
  setHours, setMinutes, isToday, differenceInMinutes, parseISO,
  getHours, getMinutes, startOfDay,
} from 'date-fns';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  Clock, Lock, Unlock, X, Trash2, Link as LinkIcon,
  Sparkles, LayoutGrid, List, CheckSquare, FileText,
  DollarSign, Zap, Tag, MoreHorizontal, AlignLeft,
  ChevronDown, Search, Command,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { CalendarEvent, Priority, Task, Note } from '@/types';

type CalView = 'month' | 'week' | 'day';

// ─── Color palette per item type ─────────────────────────────────────────────
const TYPE_COLORS = {
  event:   { bg: 'bg-indigo-500',  text: 'text-white',        dot: 'bg-indigo-500',  light: 'bg-indigo-50  border-indigo-200  text-indigo-800'  },
  task:    { bg: 'bg-blue-500',    text: 'text-white',        dot: 'bg-blue-400',    light: 'bg-blue-50    border-blue-200    text-blue-800'    },
  note:    { bg: 'bg-violet-500',  text: 'text-white',        dot: 'bg-violet-400',  light: 'bg-violet-50  border-violet-200  text-violet-800'  },
  spending:{ bg: 'bg-emerald-500', text: 'text-white',        dot: 'bg-emerald-500', light: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  private: { bg: 'bg-amber-400',   text: 'text-amber-900',    dot: 'bg-amber-400',   light: 'bg-amber-50   border-amber-200   text-amber-800'   },
};

const priorityColor = (p: Priority) => {
  const map: Record<string, string> = {
    Urgent: 'bg-purple-100 text-purple-700 border-purple-200',
    High:   'bg-red-100 text-red-700 border-red-200',
    Medium: 'bg-orange-100 text-orange-700 border-orange-200',
    Low:    'bg-zinc-100 text-zinc-500 border-zinc-200',
  };
  return map[p] ?? map.Low;
};

// ─── Natural language parser ──────────────────────────────────────────────────

function parseNaturalEvent(input: string, baseDate: Date): Partial<CalendarEvent> | null {
  const lower = input.toLowerCase().trim();
  if (!lower) return null;

  const now = new Date();

  // Date words
  let date = new Date(baseDate);
  if (/\btoday\b/.test(lower))     date = new Date(now);
  if (/\btomorrow\b/.test(lower))  { date = addDays(now, 1); }
  if (/\bmonday\b/.test(lower))    date = nextWeekday(now, 1);
  if (/\btuesday\b/.test(lower))   date = nextWeekday(now, 2);
  if (/\bwednesday\b/.test(lower)) date = nextWeekday(now, 3);
  if (/\bthursday\b/.test(lower))  date = nextWeekday(now, 4);
  if (/\bfriday\b/.test(lower))    date = nextWeekday(now, 5);
  if (/\bsaturday\b/.test(lower))  date = nextWeekday(now, 6);
  if (/\bsunday\b/.test(lower))    date = nextWeekday(now, 0);

  // Time: "at 3pm", "at 14:00", "3pm", "10:30am"
  let startHour = 9, startMin = 0;
  const timeMatch = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?|\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (timeMatch) {
    const h   = parseInt(timeMatch[1] ?? timeMatch[4]);
    const m   = parseInt(timeMatch[2] ?? timeMatch[5] ?? '0');
    const mer = timeMatch[3] ?? timeMatch[6];
    startHour = (mer === 'pm' && h < 12) ? h + 12 : (mer === 'am' && h === 12) ? 0 : h;
    startMin  = m;
  }

  // Duration: "for 2 hours", "for 30 min", "for 1h"
  let durMin = 60;
  const durMatch = lower.match(/for\s+(\d+\.?\d*)\s*(h|hour|hours|m|min|minutes)/);
  if (durMatch) {
    const n   = parseFloat(durMatch[1]);
    const unit = durMatch[2];
    durMin = unit.startsWith('h') ? Math.round(n * 60) : Math.round(n);
  }

  // Strip date/time words to get the title
  let title = input
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
    .replace(/\bfor\s+\d+\.?\d*\s*(?:h|hour|hours|m|min|minutes)\b/gi, '')
    .replace(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title) title = 'New Event';

  const startTime = setMinutes(setHours(date, startHour), startMin).getTime();
  const endTime   = startTime + durMin * 60_000;

  return { title, startTime, endTime, isPrivate: false };
}

function nextWeekday(from: Date, day: number): Date {
  const d = new Date(from);
  const diff = (day - d.getDay() + 7) % 7 || 7;
  return addDays(d, diff);
}

// ─── Gap finder hook ──────────────────────────────────────────────────────────

interface Gap { date: Date; startHour: number; endHour: number; durationMinutes: number; }

function useGapFinder(events: CalendarEvent[]): Gap[] {
  return useMemo(() => {
    const gaps: Gap[] = [];
    const today = new Date();
    for (let d = 0; d < 7; d++) {
      const date = addDays(today, d);
      const dayStart = 8, dayEnd = 19;
      const dayEvents = events.filter(e => isSameDay(new Date(e.startTime), date))
        .sort((a, b) => a.startTime - b.startTime);
      let cursor = dayStart;
      for (const ev of dayEvents) {
        const evS = getHours(ev.startTime) + getMinutes(ev.startTime) / 60;
        const evE = getHours(ev.endTime)   + getMinutes(ev.endTime)   / 60;
        if (evS - cursor >= 1) gaps.push({ date, startHour: cursor, endHour: evS, durationMinutes: Math.round((evS - cursor) * 60) });
        cursor = Math.max(cursor, evE);
      }
      if (dayEnd - cursor >= 1) gaps.push({ date, startHour: cursor, endHour: dayEnd, durationMinutes: Math.round((dayEnd - cursor) * 60) });
    }
    return gaps.sort((a, b) => b.durationMinutes - a.durationMinutes).slice(0, 5);
  }, [events]);
}

// ─── Quick Add Bar ────────────────────────────────────────────────────────────

function QuickAddBar({ defaultDate, onClose, onCreateEvent, onCreateTask }: {
  defaultDate: Date;
  onClose: () => void;
  onCreateEvent: (data: Partial<CalendarEvent>) => void;
  onCreateTask: (title: string, dueDate: number) => void;
}) {
  const [input, setInput] = useState('');
  const [mode, setMode]   = useState<'event' | 'task'>('event');
  const [preview, setPreview] = useState<Partial<CalendarEvent> | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  useEffect(() => {
    if (mode === 'event') {
      const parsed = parseNaturalEvent(input, defaultDate);
      setPreview(parsed);
    }
  }, [input, mode, defaultDate]);

  const commit = () => {
    if (!input.trim()) return;
    if (mode === 'event') {
      const data = parseNaturalEvent(input, defaultDate) ?? { title: input.trim(), startTime: setHours(defaultDate, 9).getTime(), endTime: setHours(defaultDate, 10).getTime(), isPrivate: false };
      onCreateEvent(data);
    } else {
      onCreateTask(input.trim(), setHours(defaultDate, 23).getTime());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Mode toggle */}
        <div className="flex items-center gap-1 px-3 pt-3">
          {(['event', 'task'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all',
                mode === m ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100')}>
              {m === 'event' ? '📅 Event' : '✅ Task'}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-slate-300">
            <kbd className="bg-slate-100 px-1 rounded">Enter</kbd> create · <kbd className="bg-slate-100 px-1 rounded">Esc</kbd> close
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <Zap className="w-4 h-4 text-indigo-400 shrink-0" />
          <input ref={ref} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onClose(); }}
            placeholder={mode === 'event' ? 'Meeting with John tomorrow at 3pm for 1h' : 'Review budget — due Friday'}
            className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder-slate-400" />
        </div>
        {/* NLP preview */}
        {mode === 'event' && preview?.title && input && (
          <div className="mx-4 mb-3 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 flex items-center gap-2">
            <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold">{preview.title}</span>
            {preview.startTime && (
              <span className="text-indigo-500 ml-1">{format(preview.startTime, 'EEE MMM d, h:mm a')} → {preview.endTime && format(preview.endTime, 'h:mm a')}</span>
            )}
          </div>
        )}
        <div className="px-4 pb-3 flex justify-end">
          <button onClick={commit} disabled={!input.trim()}
            className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40">
            Create {mode}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Day Context Panel ────────────────────────────────────────────────────────

function DayContextPanel({ date, events, tasks, notes, onClose, onOpenEvent, onOpenTask, onOpenNote, onAddEvent }: {
  date: Date;
  events: CalendarEvent[];
  tasks: Task[];
  notes: Note[];
  onClose: () => void;
  onOpenEvent: (e: CalendarEvent) => void;
  onOpenTask:  (t: Task) => void;
  onOpenNote:  (n: Note) => void;
  onAddEvent:  (date: Date) => void;
}) {
  const dayEvents  = events.filter(e => isSameDay(new Date(e.startTime), date)).sort((a, b) => a.startTime - b.startTime);
  const dayTasks   = tasks.filter(t  => t.dueDate && isSameDay(new Date(t.dueDate), date));
  const dayNotes   = notes.filter(n  => isSameDay(new Date(n.updatedAt), date));
  const total      = dayEvents.length + dayTasks.length + dayNotes.length;

  // Calculate total scheduled time for the day
  const scheduledMin = dayEvents.reduce((sum, e) => sum + differenceInMinutes(e.endTime, e.startTime), 0);

  return (
    <div className="w-72 shrink-0 border-l border-zinc-200 bg-white flex flex-col overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-100 bg-gradient-to-b from-indigo-50 to-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-bold text-zinc-900">{format(date, 'EEEE')}</p>
            <p className="text-xs text-zinc-400">{format(date, 'MMMM d, yyyy')}</p>
            {scheduledMin > 0 && (
              <p className="text-[10px] text-indigo-500 font-medium mt-1 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {scheduledMin >= 60 ? `${Math.floor(scheduledMin/60)}h ${scheduledMin%60 ? `${scheduledMin%60}m` : ''} scheduled` : `${scheduledMin}m scheduled`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => onAddEvent(date)}
              className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-zinc-400 p-6">
          <CalendarIcon className="w-10 h-10 opacity-15" />
          <p className="text-sm font-medium text-zinc-500">Nothing scheduled</p>
          <p className="text-xs text-zinc-400 text-center">A free day — use it well</p>
          <button onClick={() => onAddEvent(date)}
            className="mt-2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            Add event
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">

          {/* Events — with time bar visualisation */}
          {dayEvents.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" /> Events ({dayEvents.length})
              </h3>
              <div className="space-y-1.5">
                {dayEvents.map(ev => {
                  const durMin = differenceInMinutes(ev.endTime, ev.startTime);
                  return (
                    <div key={ev.id} onClick={() => onOpenEvent(ev)}
                      className="group flex items-start gap-0 cursor-pointer">
                      {/* Left colour bar */}
                      <div className={cn('w-1 self-stretch rounded-full mr-2.5 shrink-0', ev.isPrivate ? 'bg-amber-400' : 'bg-indigo-500')} />
                      <div className={cn('flex-1 p-2.5 rounded-xl border transition-all', 'bg-indigo-50/60 border-indigo-100 hover:border-indigo-300 hover:shadow-sm hover:-translate-y-px')}>
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-semibold text-zinc-800 group-hover:text-indigo-700 transition-colors">{ev.title}</p>
                          {ev.isPrivate && <Lock className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          {format(ev.startTime, 'h:mm a')} – {format(ev.endTime, 'h:mm a')}
                          <span className="ml-1.5 text-indigo-400">
                            {durMin >= 60 ? `${Math.floor(durMin/60)}h${durMin%60 ? ` ${durMin%60}m` : ''}` : `${durMin}m`}
                          </span>
                        </p>
                        {ev.description && (
                          <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2 italic">{ev.description}</p>
                        )}
                        {ev.linkedNoteId && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-violet-500 font-medium">
                            <FileText className="w-2.5 h-2.5" /> Linked note
                          </div>
                        )}
                        {ev.linkedTaskId && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-500 font-medium">
                            <CheckSquare className="w-2.5 h-2.5" /> Linked task
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tasks */}
          {dayTasks.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" /> Tasks Due ({dayTasks.length})
              </h3>
              <div className="space-y-1.5">
                {dayTasks.map(t => (
                  <div key={t.id} onClick={() => onOpenTask(t)}
                    className={cn(
                      'flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer group',
                      'transition-all hover:shadow-sm hover:-translate-y-px',
                      t.status === 'Done'
                        ? 'bg-zinc-50 border-zinc-200 opacity-60'
                        : 'bg-blue-50/60 border-blue-100 hover:border-blue-300',
                    )}>
                    <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                      t.status === 'Done' ? 'border-zinc-300 bg-zinc-300' : 'border-blue-400')}>
                      {t.status === 'Done' && <span className="text-white text-[8px]">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-semibold text-zinc-800 truncate group-hover:text-blue-700 transition-colors',
                        t.status === 'Done' && 'line-through text-zinc-400')}>{t.title}</p>
                      <p className="text-[10px] text-zinc-400 capitalize">{t.status} · {t.priority}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notes — with content preview */}
          {dayNotes.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-400" /> Notes Updated ({dayNotes.length})
              </h3>
              <div className="space-y-1.5">
                {dayNotes.slice(0, 3).map(n => {
                  const preview = n.content
                    .replace(/^---[\s\S]*?---\n?/, '')
                    .replace(/[#*`>_~]/g, '')
                    .trim()
                    .split('\n').find(l => l.trim().length > 0) ?? '';
                  return (
                    <div key={n.id} onClick={() => onOpenNote(n)}
                      className={cn(
                        'p-2.5 rounded-xl border cursor-pointer group',
                        'bg-violet-50/60 border-violet-100 border-dashed',
                        'transition-all hover:border-violet-300 hover:shadow-sm hover:-translate-y-px',
                      )}>
                      <p className="text-xs font-semibold text-zinc-800 truncate group-hover:text-violet-700 transition-colors">{n.title}</p>
                      {preview && <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">{preview.slice(0, 60)}{preview.length > 60 ? '…' : ''}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mini Calendar Sidebar ────────────────────────────────────────────────────

function MiniCalendar({ currentDate, activeDate, events, tasks, onSelectDay, onMonthChange }: {
  currentDate: Date;
  activeDate: Date;
  events: CalendarEvent[];
  tasks: Task[];
  onSelectDay: (d: Date) => void;
  onMonthChange: (d: Date) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd   = endOfMonth(monthStart);
  const startDate  = startOfWeek(monthStart);
  const endDate    = endOfWeek(monthEnd);

  const days: Date[] = [];
  let d = startDate;
  while (d <= endDate) { days.push(d); d = addDays(d, 1); }

  const hasDot = (day: Date) =>
    events.some(e => isSameDay(new Date(e.startTime), day)) ||
    tasks.some(t => t.dueDate && isSameDay(new Date(t.dueDate), day));

  return (
    <div className="p-3 border-b border-zinc-200 bg-white select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-zinc-700">{format(currentDate, 'MMMM yyyy')}</span>
        <div className="flex gap-0.5">
          <button onClick={() => onMonthChange(subMonths(currentDate, 1))} className="p-1 rounded hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-700"><ChevronLeft className="w-3 h-3" /></button>
          <button onClick={() => onMonthChange(addMonths(currentDate, 1))} className="p-1 rounded hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-700"><ChevronRight className="w-3 h-3" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['S','M','T','W','T','F','S'].map((l, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-zinc-400 py-0.5">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          const inMonth   = isSameMonth(day, monthStart);
          const isTodays  = isToday(day);
          const isActive  = isSameDay(day, activeDate);
          const dot       = hasDot(day);
          return (
            <button key={i} onClick={() => onSelectDay(day)}
              className={cn(
                'relative flex flex-col items-center justify-center w-full aspect-square rounded-full text-[10px] font-medium transition-all',
                !inMonth && 'opacity-30',
                isActive && 'bg-indigo-600 text-white',
                isTodays && !isActive && 'bg-indigo-100 text-indigo-700 font-bold',
                !isActive && !isTodays && 'text-zinc-700 hover:bg-zinc-100',
              )}>
              {format(day, 'd')}
              {dot && !isActive && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-indigo-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Event modal ──────────────────────────────────────────────────────────────

function EventModal({ selectedDate, editingEvent, onClose, onSave, onDelete }: {
  selectedDate: Date;
  editingEvent: CalendarEvent | null;
  onClose: () => void;
  onSave: (data: Partial<CalendarEvent>) => void;
  onDelete: () => void;
}) {
  const { setSelectedTaskId, setCurrentView, setSelectedNoteId } = useAppStore();
  const [title,       setTitle]       = useState(editingEvent?.title || '');
  const [description, setDescription] = useState(editingEvent?.description || '');
  const [startTime,   setStartTime]   = useState(editingEvent ? format(editingEvent.startTime, 'HH:mm') : '09:00');
  const [endTime,     setEndTime]     = useState(editingEvent ? format(editingEvent.endTime,   'HH:mm') : '10:00');
  const [isPrivate,   setIsPrivate]   = useState(editingEvent?.isPrivate || false);
  const [dateStr,     setDateStr]     = useState(format(selectedDate, 'yyyy-MM-dd'));
  const [nlInput,     setNlInput]     = useState('');
  const [showNl,      setShowNl]      = useState(!editingEvent);

  const applyNl = () => {
    const parsed = parseNaturalEvent(nlInput, selectedDate);
    if (parsed?.title) setTitle(parsed.title);
    if (parsed?.startTime) setStartTime(format(parsed.startTime, 'HH:mm'));
    if (parsed?.endTime)   setEndTime(format(parsed.endTime, 'HH:mm'));
    setShowNl(false);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const base     = new Date(dateStr + 'T12:00:00');
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      startTime: setMinutes(setHours(base, sh), sm).getTime(),
      endTime:   setMinutes(setHours(base, eh), em).getTime(),
      isPrivate,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
          <h3 className="font-semibold text-zinc-900 flex items-center gap-2 text-sm">
            <CalendarIcon className="w-4 h-4 text-indigo-500" />
            {editingEvent ? 'Edit Event' : 'New Event'}
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Natural language toggle */}
          {showNl && !editingEvent && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 block">Describe the event</label>
              <div className="flex gap-2">
                <input value={nlInput} onChange={e => setNlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') applyNl(); if (e.key === 'Escape') setShowNl(false); }}
                  placeholder="Team sync tomorrow at 2pm for 1 hour"
                  className="flex-1 text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  autoFocus />
                <button onClick={applyNl} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">Parse</button>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-px bg-zinc-200 flex-1" />
                <button onClick={() => setShowNl(false)} className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors">or fill manually</button>
                <div className="h-px bg-zinc-200 flex-1" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Title *</label>
            <Input autoFocus={!!editingEvent || !showNl} placeholder="e.g. Team Sync" value={title}
              onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSave(); }} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Date</label>
              <Input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Start</label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">End</label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Notes</label>
            <textarea placeholder="Add details, links…" value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 resize-none h-16 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          {/* Privacy toggle */}
          <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-200">
            <div className="flex items-center gap-2">
              <div className={cn('p-1.5 rounded-full', isPrivate ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600')}>
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
            <button className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 hover:bg-blue-100 transition-colors"
              onClick={() => { setSelectedTaskId(editingEvent.linkedTaskId!); setCurrentView('tasks'); onClose(); }}>
              <CheckSquare className="w-3.5 h-3.5 shrink-0" /> Open linked task
            </button>
          )}
          {editingEvent?.linkedNoteId && (
            <button className="w-full flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700 hover:bg-violet-100 transition-colors"
              onClick={() => { setSelectedNoteId(editingEvent.linkedNoteId!); setCurrentView('notes'); onClose(); }}>
              <FileText className="w-3.5 h-3.5 shrink-0" /> Open linked note
            </button>
          )}
        </div>

        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center">
          {editingEvent ? (
            <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs" onClick={onDelete}>
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

// ─── Main Calendar ────────────────────────────────────────────────────────────

export function CalendarView() {
  const {
    workspace, tasks, events, notes, addEvent, updateEvent, deleteEvent,
    addTask, settings, setCurrentView, setSelectedTaskId, setSelectedNoteId, setSelectedProjectId,
  } = useAppStore();

  const [currentDate,     setCurrentDate]     = useState(new Date());
  const [calView,         setCalView]         = useState<CalView>('month');
  const [isModalOpen,     setIsModalOpen]     = useState(false);
  const [editingEvent,    setEditingEvent]    = useState<CalendarEvent | null>(null);
  const [selectedDate,    setSelectedDate]    = useState(new Date());
  const [showGapFinder,   setShowGapFinder]   = useState(false);
  const [showQuickAdd,    setShowQuickAdd]    = useState(false);
  const [contextDay,      setContextDay]      = useState<Date | null>(null);
  const [hoveredDay,      setHoveredDay]      = useState<string | null>(null);
  const [overflowPopover, setOverflowPopover] = useState<{ key: string; date: Date } | null>(null);
  // Drag state
  const [dragEventId,     setDragEventId]     = useState<string | null>(null);
  const [dragOffset,      setDragOffset]      = useState(0); // minutes offset from event start

  const workspaceTasks  = useMemo(() => tasks.filter(t => t.workspace === workspace), [tasks, workspace]);
  const workspaceEvents = useMemo(() => events.filter(e => e.workspace === workspace), [events, workspace]);
  const workspaceNotes  = useMemo(() => notes.filter(n => n.workspace === workspace), [notes, workspace]);
  const tasksWithDue    = workspaceTasks.filter(t => t.dueDate);

  const gaps = useGapFinder(workspaceEvents);

  const openModal = useCallback((date: Date, event?: CalendarEvent) => {
    setSelectedDate(date); setEditingEvent(event ?? null); setIsModalOpen(true);
    setOverflowPopover(null);
  }, []);
  const closeModal = () => { setIsModalOpen(false); setEditingEvent(null); };

  const handleSave = (data: Partial<CalendarEvent>) => {
    if (editingEvent) updateEvent(editingEvent.id, data);
    else addEvent({ ...data, workspace, isPrivate: data.isPrivate ?? false } as Omit<CalendarEvent, 'id'>);
    closeModal();
  };
  const handleDelete = () => { if (editingEvent) { deleteEvent(editingEvent.id); closeModal(); } };

  // Quick add
  const handleQuickAddEvent = (data: Partial<CalendarEvent>) => {
    addEvent({ ...data, workspace, isPrivate: data.isPrivate ?? false } as Omit<CalendarEvent, 'id'>);
  };
  const handleQuickAddTask = (title: string, dueDate: number) => {
    addTask({ title, status: 'To Do', priority: 'Medium', workspace, dueDate, order: 0 } as any);
  };

  // Keyboard shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowQuickAdd(true); }
      if (e.key === 'Escape') { setShowQuickAdd(false); setContextDay(null); setOverflowPopover(null); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // Drag-and-drop event move
  const handleEventDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDragEventId(event.id);
    const startH = getHours(event.startTime);
    const startM = getMinutes(event.startTime);
    const offsetMin = startH * 60 + startM - 8 * 60; // relative to 8am
    setDragOffset(offsetMin);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleEventDrop = (e: React.DragEvent, targetDate: Date, targetHour?: number) => {
    e.preventDefault();
    if (!dragEventId) return;
    const ev = workspaceEvents.find(x => x.id === dragEventId);
    if (!ev) return;
    const dur = ev.endTime - ev.startTime;
    const hour = targetHour ?? 9;
    const newStart = setMinutes(setHours(targetDate, hour), 0).getTime();
    updateEvent(dragEventId, { startTime: newStart, endTime: newStart + dur });
    setDragEventId(null);
  };

  // ── Month View ──────────────────────────────────────────────────────────

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd   = endOfMonth(monthStart);
    const start      = startOfWeek(monthStart);
    const end        = endOfWeek(monthEnd);
    const dayLabels  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const rows: React.ReactNode[] = [];
    let day = start;

    // How many visible event/task/note slots per cell before overflow
    const MAX_ITEMS = 3;

    const header = (
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/60 sticky top-0 z-10">
        {dayLabels.map(l => <div key={l} className="py-2 text-center text-[11px] font-bold text-zinc-400 uppercase tracking-wide">{l}</div>)}
      </div>
    );

    while (day <= end) {
      const week: React.ReactNode[] = [];
      for (let i = 0; i < 7; i++) {
        const cloneDay  = new Date(day);
        const dayKey    = format(cloneDay, 'yyyy-MM-dd');
        const dayEvents = workspaceEvents.filter(e => isSameDay(new Date(e.startTime), cloneDay))
          .sort((a, b) => a.startTime - b.startTime);
        const dayTasks  = tasksWithDue.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), cloneDay));
        const dayNotes  = workspaceNotes.filter(n => isSameDay(new Date(n.updatedAt), cloneDay));
        const inMonth   = isSameMonth(day, monthStart);
        const isTodays  = isToday(day);
        const hasCtx    = contextDay && isSameDay(contextDay, cloneDay);
        const isHov     = hoveredDay === dayKey;

        // Build unified item list for overflow counting
        const allItems = [
          ...dayEvents.map(e => ({ type: 'event' as const, data: e })),
          ...dayTasks.map(t  => ({ type: 'task'  as const, data: t })),
          ...dayNotes.map(n  => ({ type: 'note'  as const, data: n })),
        ];
        const visibleItems = allItems.slice(0, MAX_ITEMS);
        const hiddenCount  = allItems.length - MAX_ITEMS;

        week.push(
          <div key={dayKey}
            onMouseEnter={() => setHoveredDay(dayKey)}
            onMouseLeave={() => setHoveredDay(null)}
            className={cn(
              'min-h-[100px] md:min-h-[120px] border-b border-r border-zinc-100 p-1.5 cursor-pointer relative transition-all duration-100',
              !inMonth  && 'bg-zinc-50/30 text-zinc-400',
              isTodays  && 'bg-indigo-50/60 ring-1 ring-inset ring-indigo-300/60',
              hasCtx    && 'ring-2 ring-inset ring-indigo-400',
              isHov     && !isTodays && !hasCtx && 'bg-zinc-50',
            )}
            onClick={() => {
              setContextDay(contextDay && isSameDay(contextDay, cloneDay) ? null : cloneDay);
              setOverflowPopover(null);
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleEventDrop(e, cloneDay)}
          >
            {/* Day number row */}
            <div className="flex items-center justify-between mb-1 pr-0.5">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                isTodays  ? 'bg-indigo-600 text-white shadow-sm'
                          : inMonth ? 'text-zinc-800 hover:bg-zinc-200' : 'text-zinc-300',
              )}>
                {format(day, 'd')}
              </div>
              {/* Inline "+" on hover */}
              <button
                onClick={e => { e.stopPropagation(); openModal(cloneDay); }}
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center transition-all text-zinc-400',
                  'border border-zinc-200 bg-white shadow-sm',
                  'hover:border-indigo-400 hover:text-indigo-600 hover:scale-110',
                  isHov ? 'opacity-100' : 'opacity-0',
                )}
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* Color-coded items — distinct visual per type */}
            <div className="space-y-0.5">
              {visibleItems.map((item, idx) => {
                if (item.type === 'event') {
                  const ev = item.data as CalendarEvent;
                  return (
                    <div key={ev.id} draggable
                      onDragStart={e => { e.stopPropagation(); handleEventDragStart(e, ev); }}
                      onClick={e => { e.stopPropagation(); openModal(cloneDay, ev); }}
                      title={ev.title}
                      className={cn(
                        // Solid color bar — "event" style
                        'text-[10px] px-1.5 py-0.5 rounded-md font-medium truncate',
                        'cursor-grab active:cursor-grabbing select-none',
                        'flex items-center gap-1',
                        'shadow-sm hover:-translate-y-px hover:shadow-md transition-all duration-100',
                        ev.isPrivate
                          ? 'bg-amber-400 text-amber-900'
                          : 'bg-indigo-500 text-white',
                      )}>
                      {ev.isPrivate && <Lock className="w-2 h-2 shrink-0" />}
                      <span className="shrink-0 opacity-80">{format(ev.startTime, 'HH:mm')}</span>
                      <span className="truncate">{ev.title}</span>
                    </div>
                  );
                }
                if (item.type === 'task') {
                  const t = item.data as Task;
                  return (
                    <div key={t.id}
                      onClick={e => { e.stopPropagation(); if (t.projectId) setSelectedProjectId(t.projectId); setSelectedTaskId(t.id); setCurrentView('tasks'); }}
                      title={t.title}
                      className={cn(
                        // Left border + lighter bg — "task" style
                        'text-[10px] px-1.5 py-0.5 rounded-r-md font-medium truncate',
                        'cursor-pointer select-none border-l-2',
                        'flex items-center gap-1',
                        'hover:-translate-y-px hover:shadow-sm transition-all duration-100',
                        t.status === 'Done'
                          ? 'border-l-zinc-300 bg-zinc-100 text-zinc-400 line-through'
                          : 'border-l-blue-500 bg-blue-50 text-blue-800',
                      )}>
                      <CheckSquare className="w-2 h-2 shrink-0" />
                      <span className="truncate">{t.title}</span>
                    </div>
                  );
                }
                // note
                const n = item.data as Note;
                return (
                  <div key={n.id}
                    onClick={e => { e.stopPropagation(); setSelectedNoteId(n.id); setCurrentView('notes'); }}
                    title={n.title}
                    className={cn(
                      // Dashed border + faded bg — "note" style
                      'text-[10px] px-1.5 py-0.5 rounded-md font-medium truncate',
                      'cursor-pointer select-none border border-dashed border-violet-300',
                      'flex items-center gap-1 bg-violet-50/60 text-violet-700',
                      'hover:-translate-y-px hover:shadow-sm transition-all duration-100',
                    )}>
                    <FileText className="w-2 h-2 shrink-0 opacity-70" />
                    <span className="truncate">{n.title}</span>
                  </div>
                );
              })}

              {/* Overflow pill — clickable popover */}
              {hiddenCount > 0 && (
                <div className="relative">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setOverflowPopover(prev =>
                        prev?.key === dayKey ? null : { key: dayKey, date: cloneDay }
                      );
                    }}
                    className="text-[10px] text-zinc-500 font-medium pl-1.5 py-0.5 rounded hover:bg-zinc-200 hover:text-zinc-800 transition-colors w-full text-left"
                  >
                    +{hiddenCount} more
                  </button>

                  {/* Overflow popover */}
                  {overflowPopover?.key === dayKey && (
                    <div
                      className="absolute z-30 left-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl w-52 overflow-hidden"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 border-b border-zinc-200">
                        <span className="text-xs font-semibold text-zinc-700">{format(cloneDay, 'EEEE, MMM d')}</span>
                        <button onClick={() => setOverflowPopover(null)} className="text-zinc-400 hover:text-zinc-700">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                        {allItems.map((item) => {
                          if (item.type === 'event') {
                            const ev = item.data as CalendarEvent;
                            return (
                              <button key={ev.id} onClick={() => { openModal(cloneDay, ev); setOverflowPopover(null); }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors text-left">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                <span className="text-xs font-medium text-zinc-800 truncate flex-1">{ev.title}</span>
                                <span className="text-[10px] text-zinc-400 shrink-0">{format(ev.startTime, 'h:mm a')}</span>
                              </button>
                            );
                          }
                          if (item.type === 'task') {
                            const t = item.data as Task;
                            return (
                              <button key={t.id} onClick={() => { if (t.projectId) setSelectedProjectId(t.projectId); setSelectedTaskId(t.id); setCurrentView('tasks'); setOverflowPopover(null); }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition-colors text-left">
                                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                                <CheckSquare className="w-3 h-3 text-blue-500 shrink-0" />
                                <span className="text-xs font-medium text-zinc-800 truncate flex-1">{t.title}</span>
                              </button>
                            );
                          }
                          const n = item.data as Note;
                          return (
                            <button key={n.id} onClick={() => { setSelectedNoteId(n.id); setCurrentView('notes'); setOverflowPopover(null); }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-violet-50 transition-colors text-left">
                              <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                              <FileText className="w-3 h-3 text-violet-500 shrink-0" />
                              <span className="text-xs font-medium text-zinc-800 truncate flex-1">{n.title}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="px-3 py-2 border-t border-zinc-100 bg-zinc-50">
                        <button onClick={() => { openModal(cloneDay); setOverflowPopover(null); }}
                          className="text-xs text-indigo-600 font-medium hover:text-indigo-800 transition-colors flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add event
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div key={day.toString()} className="grid grid-cols-7">{week}</div>);
    }

    return <>{header}{rows}</>;
  };

  // ── Week View ────────────────────────────────────────────────────────────

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 13 }, (_, i) => i + 8);

    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-8 border-b border-zinc-200 bg-zinc-50 sticky top-0 z-10">
          <div className="border-r border-zinc-200 p-2 text-[10px] text-zinc-400 text-right">GMT</div>
          {days.map(d => (
            <div key={d.toString()} onClick={() => { setCurrentDate(d); setCalView('day'); }}
              className={cn('p-2 text-center border-r border-zinc-100 cursor-pointer hover:bg-indigo-50 transition-colors', isToday(d) && 'bg-indigo-50')}>
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">{format(d, 'EEE')}</div>
              <div className={cn('text-sm font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full',
                isToday(d) ? 'bg-indigo-600 text-white' : 'text-zinc-700 hover:bg-indigo-100')}>
                {format(d, 'd')}
              </div>
            </div>
          ))}
        </div>
        {hours.map(hour => (
          <div key={hour} className="grid grid-cols-8 border-b border-zinc-100 min-h-[52px]">
            <div className="border-r border-zinc-200 px-2 py-1 text-[10px] text-zinc-400 text-right">
              {format(setHours(new Date(), hour), 'h a')}
            </div>
            {days.map(d => {
              const hourEvents = workspaceEvents.filter(e => isSameDay(new Date(e.startTime), d) && getHours(e.startTime) === hour);
              const hourTasks  = tasksWithDue.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), d) && hour === 8);
              return (
                <div key={d.toString()}
                  className={cn('border-r border-zinc-100 p-0.5 cursor-pointer hover:bg-zinc-50 transition-colors relative', isToday(d) && 'bg-indigo-50/20')}
                  onClick={() => openModal(setHours(d, hour))}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleEventDrop(e, d, hour)}>
                  {hourEvents.map(ev => (
                    <div key={ev.id} draggable onDragStart={e => handleEventDragStart(e, ev)}
                      onClick={ee => { ee.stopPropagation(); openModal(d, ev); }}
                      className={cn('text-[10px] rounded-md px-1.5 py-1 mb-0.5 truncate cursor-grab active:cursor-grabbing hover:opacity-90',
                        ev.isPrivate ? `${TYPE_COLORS.private.bg} ${TYPE_COLORS.private.text}` : `${TYPE_COLORS.event.bg} ${TYPE_COLORS.event.text}`)}>
                      {ev.title}
                    </div>
                  ))}
                  {hourTasks.map(t => (
                    <div key={t.id}
                      onClick={ee => { ee.stopPropagation(); if (t.projectId) setSelectedProjectId(t.projectId); setSelectedTaskId(t.id); setCurrentView('tasks'); }}
                      className={cn('text-[10px] rounded-md px-1.5 py-0.5 mb-0.5 truncate cursor-pointer border', TYPE_COLORS.task.light)}>
                      ✓ {t.title}
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

  // ── Day View ─────────────────────────────────────────────────────────────

  const renderDayView = () => {
    const hours = Array.from({ length: 15 }, (_, i) => i + 7);
    const dayEvents = workspaceEvents.filter(e => isSameDay(new Date(e.startTime), currentDate))
      .sort((a, b) => a.startTime - b.startTime);
    const dayTasks  = tasksWithDue.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), currentDate));
    const dayNotes  = workspaceNotes.filter(n => isSameDay(new Date(n.updatedAt), currentDate));

    return (
      <div className="flex-1 overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold',
              isToday(currentDate) ? 'bg-indigo-600 text-white' : 'bg-zinc-200 text-zinc-700')}>
              {format(currentDate, 'd')}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">{format(currentDate, 'EEEE')}</p>
              <p className="text-xs text-zinc-400">{format(currentDate, 'MMMM yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><span className={cn('w-2 h-2 rounded-full', TYPE_COLORS.event.dot)} />Events ({dayEvents.length})</span>
            <span className="flex items-center gap-1"><span className={cn('w-2 h-2 rounded-full', TYPE_COLORS.task.dot)} />Tasks ({dayTasks.length})</span>
            <span className="flex items-center gap-1"><span className={cn('w-2 h-2 rounded-full', TYPE_COLORS.note.dot)} />Notes ({dayNotes.length})</span>
          </div>
        </div>

        {/* All-day strip */}
        {(dayTasks.length > 0 || dayNotes.length > 0) && (
          <div className="flex gap-1.5 px-4 py-2 border-b border-zinc-100 bg-zinc-50/50 flex-wrap">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase mr-1 mt-1">All day</span>
            {dayTasks.map(t => (
              <div key={t.id} onClick={() => { if (t.projectId) setSelectedProjectId(t.projectId); setSelectedTaskId(t.id); setCurrentView('tasks'); }}
                className={cn('text-[10px] px-2 py-1 rounded-full border cursor-pointer font-medium flex items-center gap-1', TYPE_COLORS.task.light)}>
                <CheckSquare className="w-2.5 h-2.5" />{t.title}
              </div>
            ))}
            {dayNotes.map(n => (
              <div key={n.id} onClick={() => { setSelectedNoteId(n.id); setCurrentView('notes'); }}
                className={cn('text-[10px] px-2 py-1 rounded-full border cursor-pointer font-medium flex items-center gap-1', TYPE_COLORS.note.light)}>
                <FileText className="w-2.5 h-2.5" />{n.title}
              </div>
            ))}
          </div>
        )}

        {hours.map(hour => {
          const hourEvents = dayEvents.filter(e => getHours(e.startTime) === hour);
          return (
            <div key={hour} className="flex border-b border-zinc-100 min-h-[56px] hover:bg-zinc-50/50 cursor-pointer transition-colors group"
              onClick={() => openModal(setHours(currentDate, hour))}>
              <div className="w-16 shrink-0 px-3 py-2 text-[10px] text-zinc-400 text-right border-r border-zinc-200">
                {format(setHours(new Date(), hour), 'h a')}
              </div>
              <div className="flex-1 p-1 space-y-0.5">
                {hourEvents.map(ev => (
                  <div key={ev.id} draggable onDragStart={e => handleEventDragStart(e, ev)}
                    onClick={e => { e.stopPropagation(); openModal(currentDate, ev); }}
                    className={cn('px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity',
                      ev.isPrivate ? `${TYPE_COLORS.private.bg} ${TYPE_COLORS.private.text}` : `${TYPE_COLORS.event.bg} ${TYPE_COLORS.event.text}`)}>
                    <p className="text-xs font-semibold">{ev.title}</p>
                    <p className="text-[10px] opacity-75">{format(ev.startTime, 'h:mm a')} – {format(ev.endTime, 'h:mm a')}</p>
                    {ev.description && <p className="text-[10px] opacity-70 mt-0.5 truncate">{ev.description}</p>}
                  </div>
                ))}
                {hourEvents.length === 0 && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-indigo-400 pl-1">+ Add event</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const periodLabel = calView === 'month'
    ? format(currentDate, 'MMMM yyyy')
    : calView === 'week'
    ? `${format(startOfWeek(currentDate), 'MMM d')} – ${format(endOfWeek(currentDate), 'MMM d, yyyy')}`
    : format(currentDate, 'EEEE, MMMM d, yyyy');

  const navigate = (dir: 1 | -1) => {
    if (calView === 'month') setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (calView === 'week') setCurrentDate(addDays(currentDate, dir * 7));
    else setCurrentDate(addDays(currentDate, dir));
  };

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex overflow-hidden bg-white">

      {/* ── Left sidebar: mini calendar + Today Engine ─────────── */}
      <div className="w-52 shrink-0 border-r border-zinc-200 flex flex-col overflow-hidden bg-white">
        <MiniCalendar
          currentDate={currentDate}
          activeDate={currentDate}
          events={workspaceEvents}
          tasks={tasksWithDue}
          onSelectDay={d => { setCurrentDate(d); if (calView === 'month') setCalView('day'); }}
          onMonthChange={setCurrentDate}
        />

        {/* Legend */}
        <div className="px-3 py-2 border-b border-zinc-100">
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { dot: 'bg-indigo-500',  label: 'Event'   },
              { dot: 'bg-blue-400',    label: 'Task'     },
              { dot: 'bg-violet-400',  label: 'Note'     },
            ].map(({ dot, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
                <span className="text-[10px] text-zinc-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TODAY ENGINE */}
        <div className="flex-1 overflow-y-auto">
          {/* Today header */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Today</p>
              <span className="text-[10px] text-zinc-400">{format(new Date(), 'EEE, MMM d')}</span>
            </div>
          </div>

          {/* Today's timeline */}
          {(() => {
            const today = new Date();
            const todayEvents = workspaceEvents
              .filter(e => isSameDay(new Date(e.startTime), today))
              .sort((a, b) => a.startTime - b.startTime);
            const todayTasks = tasksWithDue
              .filter(t => t.dueDate && isSameDay(new Date(t.dueDate), today));
            const todayNotes = workspaceNotes
              .filter(n => isSameDay(new Date(n.updatedAt), today));

            const todayItems: { time?: number; label: string; type: 'event'|'task'|'note'; onClick: () => void; sub?: string }[] = [
              ...todayEvents.map(e => ({
                time: e.startTime,
                label: e.title,
                type: 'event' as const,
                sub: `${format(e.startTime, 'h:mm')}–${format(e.endTime, 'h:mm a')}`,
                onClick: () => openModal(today, e),
              })),
              ...todayTasks.map(t => ({
                label: t.title,
                type: 'task' as const,
                sub: t.status,
                onClick: () => { if (t.projectId) setSelectedProjectId(t.projectId); setSelectedTaskId(t.id); setCurrentView('tasks'); },
              })),
              ...todayNotes.map(n => ({
                label: n.title,
                type: 'note' as const,
                sub: 'updated today',
                onClick: () => { setSelectedNoteId(n.id); setCurrentView('notes'); },
              })),
            ].sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));

            const dotColor = { event: 'bg-indigo-500', task: 'bg-blue-400', note: 'bg-violet-400' };
            const bgHover  = { event: 'hover:bg-indigo-50', task: 'hover:bg-blue-50', note: 'hover:bg-violet-50' };

            if (todayItems.length === 0) return (
              <div className="px-3 pb-3 text-center">
                <p className="text-[11px] text-zinc-400 mb-2">Nothing today</p>
                <button onClick={() => { setCurrentDate(new Date()); openModal(new Date()); }}
                  className="text-[11px] text-indigo-500 font-medium hover:text-indigo-700 transition-colors">
                  + Add event
                </button>
              </div>
            );

            return (
              <div className="px-2 pb-3 space-y-0.5">
                {todayItems.map((item, i) => (
                  <button key={i} onClick={item.onClick}
                    className={cn(
                      'w-full flex items-start gap-2 px-2 py-2 rounded-lg transition-colors text-left group',
                      bgHover[item.type],
                    )}>
                    <span className={cn('w-2 h-2 rounded-full mt-1 shrink-0', dotColor[item.type])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-800 truncate group-hover:text-zinc-900">{item.label}</p>
                      {item.sub && <p className="text-[10px] text-zinc-400 capitalize mt-0.5">{item.sub}</p>}
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}

          {/* Divider */}
          <div className="px-3 pb-2 pt-1">
            <div className="h-px bg-zinc-100" />
          </div>

          {/* Free time gaps */}
          <div className="px-3 pb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Free Time</p>
            </div>
            {gaps.length === 0
              ? <p className="text-[11px] text-zinc-400">No large gaps found.</p>
              : gaps.map((gap, i) => (
                <button key={i} onClick={() => { setCurrentDate(gap.date); openModal(setHours(gap.date, gap.startHour)); }}
                  className="w-full flex flex-col p-2 mb-1.5 bg-indigo-50 border border-indigo-100 rounded-xl hover:border-indigo-300 transition-colors text-left">
                  <span className="text-[10px] font-semibold text-zinc-700">{format(gap.date, 'EEE, MMM d')}</span>
                  <span className="text-[10px] text-indigo-600">{format(setHours(new Date(), gap.startHour), 'h a')} – {format(setHours(new Date(), gap.endHour), 'h a')}</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium mt-0.5 self-start">
                    {gap.durationMinutes >= 60 ? `${Math.floor(gap.durationMinutes/60)}h${gap.durationMinutes%60?` ${gap.durationMinutes%60}m`:''}` : `${gap.durationMinutes}m`}
                  </span>
                </button>
              ))
            }
          </div>
        </div>
      </div>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Controls bar */}
        <div className="px-4 py-3 border-b border-zinc-200 bg-white flex flex-wrap gap-3 items-center justify-between shrink-0">
          {/* Nav */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 border border-zinc-200 rounded-lg p-0.5 bg-zinc-50 shadow-sm">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium" onClick={() => setCurrentDate(new Date())}>Today</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
            <h2 className="text-sm font-bold text-zinc-900 min-w-0 truncate">{periodLabel}</h2>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex bg-white border border-zinc-200 rounded-lg p-0.5">
              {(['month', 'week', 'day'] as CalView[]).map(v => (
                <button key={v} onClick={() => setCalView(v)}
                  className={cn('px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors',
                    calView === v ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900')}>
                  {v}
                </button>
              ))}
            </div>
            {/* Quick add */}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowQuickAdd(true)}>
              <Zap className="w-3.5 h-3.5 mr-1.5" /> Quick Add
              <span className="ml-1 text-[10px] text-zinc-400">⌘K</span>
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => openModal(new Date())}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Event
            </Button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto border-zinc-200">
            {calView === 'month' ? renderMonthView() : calView === 'week' ? renderWeekView() : renderDayView()}
          </div>

          {/* Day context panel */}
          {contextDay && (
            <DayContextPanel
              date={contextDay}
              events={workspaceEvents}
              tasks={tasksWithDue}
              notes={workspaceNotes}
              onClose={() => setContextDay(null)}
              onOpenEvent={ev => openModal(new Date(ev.startTime), ev)}
              onOpenTask={t => { if (t.projectId) setSelectedProjectId(t.projectId); setSelectedTaskId(t.id); setCurrentView('tasks'); }}
              onOpenNote={n => { setSelectedNoteId(n.id); setCurrentView('notes'); }}
              onAddEvent={date => openModal(date)}
            />
          )}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
      {isModalOpen && (
        <EventModal selectedDate={selectedDate} editingEvent={editingEvent}
          onClose={closeModal} onSave={handleSave} onDelete={handleDelete} />
      )}
      {showQuickAdd && (
        <QuickAddBar defaultDate={selectedDate}
          onClose={() => setShowQuickAdd(false)}
          onCreateEvent={handleQuickAddEvent}
          onCreateTask={handleQuickAddTask} />
      )}
    </div>
  );
}