import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store';
import {
  format, startOfWeek, addDays, startOfMonth, endOfMonth,
  endOfWeek, isSameMonth, isSameDay, addMonths, subMonths,
  setHours, setMinutes, isToday, differenceInMinutes,
  getHours, getMinutes,
} from 'date-fns';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  Clock, Lock, Unlock, X, Trash2, Sparkles, CheckSquare,
  FileText, Zap, Phone, MapPin, Brain, Coffee, Users, Dumbbell,
  Star, AlertTriangle, Target, ArrowRight, Command as CommandIcon,
  RotateCcw, Filter, Check, Edit2, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { CalendarEvent, Task, Note } from '@/types';

type CalView = 'month' | 'week' | 'day';

// ─── Categories ───────────────────────────────────────────────────────────────
export const EVENT_CATEGORIES = [
  { id: 'work',     label: 'Work',     color: '#6366f1', icon: Target   },
  { id: 'personal', label: 'Personal', color: '#10b981', icon: Star     },
  { id: 'meeting',  label: 'Meeting',  color: '#3b82f6', icon: Users    },
  { id: 'focus',    label: 'Focus',    color: '#8b5cf6', icon: Brain    },
  { id: 'health',   label: 'Health',   color: '#f97316', icon: Dumbbell },
  { id: 'social',   label: 'Social',   color: '#ec4899', icon: Coffee   },
  { id: 'call',     label: 'Call',     color: '#14b8a6', icon: Phone    },
  { id: 'location', label: 'Location', color: '#f59e0b', icon: MapPin   },
] as const;
export type EventCategory = typeof EVENT_CATEGORIES[number]['id'];
type RichEvent = CalendarEvent & { category?: EventCategory };
function getCat(id?: string) { return EVENT_CATEGORIES.find(c => c.id === id) ?? EVENT_CATEGORIES[0]; }

// ─── NLP ──────────────────────────────────────────────────────────────────────
function parseNL(input: string, base: Date): Partial<RichEvent> | null {
  const lo = input.toLowerCase().trim();
  if (!lo) return null;
  const now = new Date();
  let date = new Date(base);
  if (/\btoday\b/.test(lo))     date = new Date(now);
  if (/\btomorrow\b/.test(lo))  date = addDays(now, 1);
  if (/\bmonday\b/.test(lo))    date = nextWD(now, 1);
  if (/\btuesday\b/.test(lo))   date = nextWD(now, 2);
  if (/\bwednesday\b/.test(lo)) date = nextWD(now, 3);
  if (/\bthursday\b/.test(lo))  date = nextWD(now, 4);
  if (/\bfriday\b/.test(lo))    date = nextWD(now, 5);
  if (/\bsaturday\b/.test(lo))  date = nextWD(now, 6);
  if (/\bsunday\b/.test(lo))    date = nextWD(now, 0);

  let sh = 9, sm = 0;
  const tm = lo.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?|\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (tm) {
    const h = parseInt(tm[1] ?? tm[4]), m = parseInt(tm[2] ?? tm[5] ?? '0'), mer = tm[3] ?? tm[6];
    sh = (mer === 'pm' && h < 12) ? h + 12 : (mer === 'am' && h === 12) ? 0 : h; sm = m;
  }
  let dur = 60;
  const dm = lo.match(/for\s+(\d+\.?\d*)\s*(h|hour|hours|m|min|minutes)/);
  if (dm) { const n = parseFloat(dm[1]); dur = dm[2].startsWith('h') ? Math.round(n * 60) : Math.round(n); }

  let cat: EventCategory = 'work';
  if (/\b(gym|workout|run|yoga|health)\b/.test(lo)) cat = 'health';
  else if (/\b(call|phone)\b/.test(lo)) cat = 'call';
  else if (/\b(meeting|standup|sync|review|interview)\b/.test(lo)) cat = 'meeting';
  else if (/\b(focus|deep work|study)\b/.test(lo)) cat = 'focus';
  else if (/\b(lunch|dinner|coffee|party|social)\b/.test(lo)) cat = 'social';
  else if (/\b(personal|home|family)\b/.test(lo)) cat = 'personal';

  let title = input
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
    .replace(/\bfor\s+\d+\.?\d*\s*(?:h|hour|hours|m|min|minutes)\b/gi, '')
    .replace(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\s+/g, ' ').trim() || 'New Event';

  const st = setMinutes(setHours(date, sh), sm).getTime();
  return { title, startTime: st, endTime: st + dur * 60_000, isPrivate: false, category: cat };
}
function nextWD(from: Date, day: number): Date {
  const d = new Date(from); return addDays(d, (day - d.getDay() + 7) % 7 || 7);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function detectConflicts(evs: RichEvent[]): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (let i = 0; i < evs.length; i++)
    for (let j = i + 1; j < evs.length; j++) {
      const a = evs[i], b = evs[j];
      if (isSameDay(new Date(a.startTime), new Date(b.startTime)) && a.startTime < b.endTime && b.startTime < a.endTime) {
        m.set(a.id, true); m.set(b.id, true);
      }
    }
  return m;
}

interface FreeSlot { date: Date; startHour: number; endHour: number; durationMinutes: number; }
function useFreeSlots(evs: RichEvent[]) {
  return useMemo(() => {
    const now = new Date(), ch = now.getHours() + now.getMinutes() / 60, slots: FreeSlot[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(now, d), ds = d === 0 ? Math.ceil(ch) : 8, de = 20;
      const day = evs.filter(e => isSameDay(new Date(e.startTime), date)).sort((a, b) => a.startTime - b.startTime);
      let cur = ds;
      for (const ev of day) {
        const s = getHours(ev.startTime) + getMinutes(ev.startTime) / 60, e2 = getHours(ev.endTime) + getMinutes(ev.endTime) / 60;
        if (s - cur >= 0.5) slots.push({ date, startHour: cur, endHour: s, durationMinutes: Math.round((s - cur) * 60) });
        cur = Math.max(cur, e2);
      }
      if (de - cur >= 0.5) slots.push({ date, startHour: cur, endHour: de, durationMinutes: Math.round((de - cur) * 60) });
    }
    return { slots, next: slots[0] ?? null, best: [...slots].sort((a, b) => b.durationMinutes - a.durationMinutes)[0] ?? null };
  }, [evs]);
}

function fmtDur(min: number) { return min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? `${min % 60}m` : ''}` : `${min}m`; }

// ─── Quick-Edit Popover ───────────────────────────────────────────────────────
function QuickEditPopover({ event, onClose, onSave, onFullEdit, onDelete, style }: {
  event: RichEvent; onClose: () => void;
  onSave: (updates: Partial<RichEvent>) => void;
  onFullEdit: () => void; onDelete: () => void;
  style?: React.CSSProperties;
}) {
  const cat = getCat(event.category);
  const CatIcon = cat.icon;
  const [title, setTitle]   = useState(event.title);
  const [startT, setStartT] = useState(format(event.startTime, 'HH:mm'));
  const [endT,   setEndT]   = useState(format(event.endTime,   'HH:mm'));
  const [cat2,   setCat2]   = useState<EventCategory>(event.category ?? 'work');
  const [showCats, setShowCats] = useState(false);

  const save = () => {
    const base = new Date(event.startTime);
    const [sh, sm] = startT.split(':').map(Number);
    const [eh, em] = endT.split(':').map(Number);
    base.setHours(sh, sm, 0, 0);
    const end = new Date(event.endTime); end.setHours(eh, em, 0, 0);
    onSave({ title: title.trim() || event.title, startTime: base.getTime(), endTime: end.getTime(), category: cat2 });
    onClose();
  };

  return (
    <div className="fixed z-[100] w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
      style={style} onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: `${cat.color}12`, borderBottom: `2px solid ${cat.color}20` }}>
        <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: cat.color }}>
          <CatIcon className="w-3.5 h-3.5 text-white" />
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
          className="flex-1 text-sm font-bold text-slate-900 bg-transparent outline-none border-b border-transparent focus:border-slate-300 transition-colors"
          autoFocus />
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-4 space-y-3">
        {/* Time */}
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="flex items-center gap-1.5 flex-1">
            <input type="time" value={startT} onChange={e => setStartT(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <span className="text-xs text-slate-400">–</span>
            <input type="time" value={endT} onChange={e => setEndT(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>

        {/* Category */}
        <div>
          <button onClick={() => setShowCats(v => !v)}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors w-full">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: getCat(cat2).color }} />
            <span>{getCat(cat2).label}</span>
            <ChevronDown className="w-3 h-3 ml-auto" />
          </button>
          {showCats && (
            <div className="grid grid-cols-4 gap-1 mt-2">
              {EVENT_CATEGORIES.map(c => {
                const CI = c.icon;
                return (
                  <button key={c.id} onClick={() => { setCat2(c.id as EventCategory); setShowCats(false); }}
                    className={cn('flex flex-col items-center gap-0.5 p-1.5 rounded-xl border text-[9px] font-bold transition-all',
                      cat2 === c.id ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-300')}
                    style={cat2 === c.id ? { background: c.color } : {}}>
                    <CI className="w-3 h-3" />{c.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 pt-1">
          <button onClick={save} className="flex-1 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-700 transition-colors">Save</button>
          <button onClick={onFullEdit} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-50 rounded-xl transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Day Creator ───────────────────────────────────────────────────────
function InlineDayCreator({ date, onCommit, onCancel }: {
  date: Date; onCommit: (title: string, date: Date) => void; onCancel: () => void;
}) {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="mt-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && val.trim()) { onCommit(val.trim(), date); }
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Event title…"
        className="flex-1 text-[10px] px-2 py-1 border border-indigo-300 rounded-lg outline-none bg-white shadow-sm focus:ring-1 focus:ring-indigo-400 min-w-0"
      />
      <button onClick={() => val.trim() && onCommit(val.trim(), date)}
        className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors shrink-0">
        <Check className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Smart Schedule Panel ─────────────────────────────────────────────────────
function SmartPanel({ events, onOpenModal, onSetDate, onScheduleSlot, onBreakSlot, onMoveSlot }: {
  events: RichEvent[]; onOpenModal: (d: Date, pre?: Partial<RichEvent>) => void;
  onSetDate: (d: Date) => void;
  onScheduleSlot: (slot: FreeSlot, title: string) => void;
  onBreakSlot: (slot: FreeSlot) => void;
  onMoveSlot: (slot: FreeSlot) => void;
}) {
  const now = new Date();
  const { slots, next, best } = useFreeSlots(events);
  const todayEvents = events.filter(e => isSameDay(new Date(e.startTime), now)).sort((a, b) => a.startTime - b.startTime);
  const todayConflicts = detectConflicts(todayEvents);
  const [scheduleSlot, setScheduleSlot] = useState<FreeSlot | null>(null);
  const [slotTitle, setSlotTitle] = useState('Focus Time');

  // Behaviour insights
  const insights = useMemo(() => {
    const ins: string[] = [];
    const focusThisWeek = events.filter(e => {
      const d = new Date(e.startTime);
      return e.category === 'focus' && isSameMonth(d, now) && d >= startOfWeek(now) && d <= endOfWeek(now);
    });
    if (focusThisWeek.length === 0) ins.push("No focus time scheduled this week");
    const healthThisWeek = events.filter(e => {
      const d = new Date(e.startTime);
      return e.category === 'health' && d >= startOfWeek(now) && d <= endOfWeek(now);
    });
    if (healthThisWeek.length === 0) ins.push("No health events this week");
    const weekTotal = events.filter(e => {
      const d = new Date(e.startTime);
      return d >= startOfWeek(now) && d <= endOfWeek(now);
    }).reduce((s, e) => s + differenceInMinutes(e.endTime, e.startTime), 0);
    if (weekTotal > 0) ins.push(`${fmtDur(weekTotal)} scheduled this week`);
    return ins.slice(0, 3);
  }, [events]);

  const FOCUS_TITLES = ['Focus Time', 'Deep Work', 'Study Block', 'Writing Session', 'Code Sprint'];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Today</p>
        <span className="text-[10px] text-zinc-400">{format(now, 'EEE, MMM d')}</span>
      </div>

      {todayConflicts.size > 0 && (
        <div className="mx-3 mb-2 px-2.5 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <p className="text-[11px] text-red-700 font-bold">{todayConflicts.size} conflict{todayConflicts.size > 1 ? 's' : ''}</p>
        </div>
      )}

      {todayEvents.length === 0
        ? <div className="px-3 pb-3 text-center">
            <p className="text-[11px] text-zinc-400 mb-2">Nothing scheduled</p>
            <button onClick={() => onOpenModal(now)} className="text-[11px] text-indigo-500 font-bold hover:text-indigo-700">+ Add event</button>
          </div>
        : <div className="px-2 pb-2 space-y-0.5">
            {todayEvents.map(ev => {
              const cat = getCat(ev.category); const Icon = cat.icon;
              return (
                <button key={ev.id} onClick={() => onSetDate(new Date(ev.startTime))}
                  className={cn('w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left transition-all hover:bg-slate-50',
                    todayConflicts.has(ev.id) && 'ring-1 ring-red-200 bg-red-50/40')}>
                  <div className="w-6 h-6 rounded-xl flex items-center justify-center shrink-0" style={{ background: cat.color }}>
                    <Icon className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-zinc-800 truncate">{ev.title}</p>
                    <p className="text-[10px] text-zinc-400">{format(ev.startTime, 'h:mm')}–{format(ev.endTime, 'h:mm a')}</p>
                  </div>
                  {todayConflicts.has(ev.id) && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                </button>
              );
            })}
          </div>
      }

      <div className="mx-3 h-px bg-zinc-100 my-1" />

      {/* Insights */}
      {insights.length > 0 && (
        <div className="px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Brain className="w-3 h-3 text-violet-400" />
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Insights</p>
          </div>
          {insights.map((ins, i) => (
            <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-xl hover:bg-violet-50 transition-colors">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 mt-1.5" />
              <p className="text-[11px] text-zinc-600">{ins}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mx-3 h-px bg-zinc-100 my-1" />

      {/* Smart Schedule */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Smart Schedule</p>
        </div>

        {next && (
          <div className="mb-2 p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2">
            <div>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wide">Next Free Slot</p>
              <p className="text-xs font-bold text-zinc-900 mt-0.5">
                {isSameDay(next.date, now) ? 'Today' : format(next.date, 'EEE, MMM d')}
                {' · '}{format(setHours(next.date, next.startHour), 'h:mm a')}–{format(setHours(next.date, next.endHour), 'h:mm a')}
              </p>
              <p className="text-[10px] text-zinc-400">{fmtDur(next.durationMinutes)} free</p>
            </div>
            {scheduleSlot === next ? (
              <div className="space-y-1.5">
                <select value={slotTitle} onChange={e => setSlotTitle(e.target.value)}
                  className="w-full text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {FOCUS_TITLES.map(t => <option key={t}>{t}</option>)}
                </select>
                <div className="flex gap-1.5">
                  <button onClick={() => { onScheduleSlot(next, slotTitle); setScheduleSlot(null); }}
                    className="flex-1 py-1 text-[10px] font-black bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    Confirm
                  </button>
                  <button onClick={() => setScheduleSlot(null)}
                    className="px-2 py-1 text-[10px] text-zinc-500 hover:bg-white rounded-lg transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button onClick={() => setScheduleSlot(next)}
                  className="flex-1 py-1 text-[10px] font-black bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  Schedule here
                </button>
                {next.durationMinutes >= 60 && (
                  <button onClick={() => onBreakSlot(next)}
                    className="flex-1 py-1 text-[10px] font-bold border border-indigo-200 text-indigo-600 rounded-lg hover:bg-white transition-colors">
                    2 sessions
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {best && best !== next && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
            <div>
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wide">Longest Block This Week</p>
              <p className="text-xs font-bold text-zinc-900 mt-0.5">{format(best.date, 'EEEE')}</p>
              <p className="text-[10px] text-zinc-400">
                {format(setHours(best.date, best.startHour), 'h a')}–{format(setHours(best.date, best.endHour), 'h a')}
                {' · '}{fmtDur(best.durationMinutes)}
              </p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => onScheduleSlot(best, 'Focus Time')}
                className="flex-1 py-1 text-[10px] font-black bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                Schedule focus
              </button>
              <button onClick={() => onMoveSlot(best)}
                className="flex-1 py-1 text-[10px] font-bold border border-emerald-200 text-emerald-700 rounded-lg hover:bg-white transition-colors">
                Move event
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mx-3 h-px bg-zinc-100 my-1" />
      <div className="px-3 py-2 pb-4">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Shortcuts</p>
        {[['C','New event'],['T','Today'],['← →','Navigate'],['⌘K','Command'],['Dbl‑click','Create']].map(([k, l]) => (
          <div key={k} className="flex items-center justify-between py-0.5">
            <span className="text-[10px] text-zinc-500">{l}</span>
            <kbd className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-mono border border-zinc-200">{k}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Command Palette ──────────────────────────────────────────────────────────
function CommandPalette({ onClose, onCreateEvent, onNavigate, events }: {
  onClose: () => void;
  onCreateEvent: (d: Partial<RichEvent>) => void;
  onNavigate: (date: Date) => void;
  events: RichEvent[];
}) {
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<Partial<RichEvent> | null>(null);
  const [result, setResult] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => { if (q) setPreview(parseNL(q, new Date())); }, [q]);

  const SUGGESTIONS = [
    { label: 'Schedule focus time tomorrow 9am for 2h', cat: 'focus' },
    { label: 'Team meeting Friday 2pm for 1h', cat: 'meeting' },
    { label: 'Gym tomorrow 6pm for 1h', cat: 'health' },
    { label: 'Go to next Monday', cat: 'nav' },
    { label: 'Go to next Friday', cat: 'nav' },
  ];

  const execute = (cmd: string) => {
    const lo = cmd.toLowerCase();
    if (/^go to (.+)/.test(lo)) {
      const parsed = parseNL(lo.replace(/^go to /, ''), new Date());
      if (parsed?.startTime) { onNavigate(new Date(parsed.startTime)); setResult('Navigated ✓'); setTimeout(onClose, 700); return; }
    }
    const parsed = parseNL(cmd, new Date());
    if (parsed?.title) {
      onCreateEvent(parsed);
      setResult(`Created "${parsed.title}" ✓`);
      setTimeout(onClose, 800);
    }
  };

  const cat = preview?.category ? getCat(preview.category) : null;
  const CatIcon = cat?.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <CommandIcon className="w-4 h-4 text-slate-400 shrink-0" />
          <input ref={ref} value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') execute(q); if (e.key === 'Escape') onClose(); }}
            placeholder="Create event or navigate… e.g. 'meeting tomorrow 2pm'"
            className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder-slate-400" />
          {q && <button onClick={() => setQ('')} className="text-slate-300 hover:text-slate-500 shrink-0"><X className="w-3.5 h-3.5" /></button>}
        </div>

        {result
          ? <div className="px-4 py-4 text-sm font-bold text-emerald-600">{result}</div>
          : <>
              {/* Preview */}
              {preview?.title && q && (
                <div className="mx-4 my-2.5 px-3 py-2.5 rounded-xl border flex items-center gap-3"
                  style={{ background: cat ? `${cat.color}10` : '#f8fafc', borderColor: cat ? `${cat.color}30` : '#e2e8f0' }}>
                  {CatIcon && cat && (
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: cat.color }}>
                      <CatIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{preview.title}</p>
                    {preview.startTime && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {format(preview.startTime, 'EEE, MMM d')} · {format(preview.startTime, 'h:mm a')}
                        {preview.endTime && ` – ${format(preview.endTime, 'h:mm a')}`}
                        {cat && <span className="ml-2 font-bold" style={{ color: cat.color }}>{cat.label}</span>}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!q && (
                <div className="p-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 mb-2">Suggestions</p>
                  {SUGGESTIONS.map(s => (
                    <button key={s.label} onClick={() => { setQ(s.label); execute(s.label); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left">
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex gap-3">
                  <span className="text-[10px] text-slate-300"><kbd className="bg-slate-100 px-1 rounded">Enter</kbd> execute</span>
                  <span className="text-[10px] text-slate-300"><kbd className="bg-slate-100 px-1 rounded">Esc</kbd> close</span>
                </div>
                {q && <Button size="sm" onClick={() => execute(q)} className="h-7 text-xs">Execute</Button>}
              </div>
            </>
        }
      </div>
    </div>
  );
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────
function MiniCalendar({ currentDate, activeDate, events, onSelectDay, onMonthChange }: {
  currentDate: Date; activeDate: Date; events: RichEvent[];
  onSelectDay: (d: Date) => void; onMonthChange: (d: Date) => void;
}) {
  const ms = startOfMonth(currentDate);
  const days: Date[] = [];
  let d = startOfWeek(ms);
  while (d <= endOfWeek(endOfMonth(ms))) { days.push(d); d = addDays(d, 1); }

  return (
    <div className="p-3 border-b border-zinc-200 bg-white select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black text-zinc-900">{format(currentDate, 'MMMM yyyy')}</span>
        <div className="flex gap-0.5">
          <button onClick={() => onMonthChange(subMonths(currentDate, 1))} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400"><ChevronLeft className="w-3 h-3" /></button>
          <button onClick={() => onMonthChange(addMonths(currentDate, 1))} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400"><ChevronRight className="w-3 h-3" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['S','M','T','W','T','F','S'].map((l, i) => <div key={i} className="text-center text-[9px] font-black text-zinc-400 py-0.5">{l}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          const inM = isSameMonth(day, ms), tod = isToday(day), act = isSameDay(day, activeDate);
          const dots = events.filter(e => isSameDay(new Date(e.startTime), day)).slice(0, 3).map(e => getCat(e.category).color);
          return (
            <button key={i} onClick={() => onSelectDay(day)}
              className={cn('relative flex flex-col items-center justify-center w-full aspect-square rounded-xl text-[10px] font-bold transition-all',
                !inM && 'opacity-25',
                tod && !act && 'bg-indigo-600 text-white shadow-md shadow-indigo-200',
                act && !tod && 'ring-2 ring-indigo-500 ring-offset-1',
                !tod && !act && 'text-zinc-700 hover:bg-zinc-100')}>
              {format(day, 'd')}
              {dots.length > 0 && (
                <div className="absolute bottom-0.5 flex gap-0.5">
                  {dots.map((c, di) => <span key={di} className="w-1 h-1 rounded-full" style={{ background: c }} />)}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Event Modal ──────────────────────────────────────────────────────────────
function EventModal({ selectedDate, editingEvent, preData, onClose, onSave, onDelete }: {
  selectedDate: Date; editingEvent: RichEvent | null; preData?: Partial<RichEvent>;
  onClose: () => void; onSave: (d: Partial<RichEvent>) => void; onDelete: () => void;
}) {
  const { workspace, tasks, notes, setSelectedTaskId, setCurrentView, setSelectedNoteId } = useAppStore();
  const [title,  setTitle]  = useState(editingEvent?.title  ?? preData?.title ?? '');
  const [desc,   setDesc]   = useState(editingEvent?.description ?? '');
  const [startT, setStartT] = useState(editingEvent ? format(editingEvent.startTime, 'HH:mm') : preData?.startTime ? format(preData.startTime, 'HH:mm') : '09:00');
  const [endT,   setEndT]   = useState(editingEvent ? format(editingEvent.endTime,   'HH:mm') : preData?.endTime   ? format(preData.endTime,   'HH:mm') : '10:00');
  const [priv,   setPriv]   = useState(editingEvent?.isPrivate ?? false);
  const [dateS,  setDateS]  = useState(format(selectedDate, 'yyyy-MM-dd'));
  const [cat,    setCat]    = useState<EventCategory>(editingEvent?.category ?? preData?.category ?? 'work');
  const [ltId,   setLtId]   = useState<string|undefined>(editingEvent?.linkedTaskId);
  const [lnId,   setLnId]   = useState<string|undefined>(editingEvent?.linkedNoteId);
  const [showNl, setShowNl] = useState(!editingEvent && !preData?.title);
  const [nlIn,   setNlIn]   = useState('');
  const [tPick,  setTPick]  = useState(false);
  const [nPick,  setNPick]  = useState(false);
  const [tSrc,   setTSrc]   = useState('');
  const [nSrc,   setNSrc]   = useState('');

  const wsTasks = tasks.filter(t => t.workspace === workspace);
  const wsNotes = notes.filter(n => n.workspace === workspace);
  const lt = tasks.find(t => t.id === ltId);
  const ln = notes.find(n => n.id === lnId);

  const applyNl = () => {
    const p = parseNL(nlIn, selectedDate);
    if (p?.title) setTitle(p.title);
    if (p?.startTime) setStartT(format(p.startTime, 'HH:mm'));
    if (p?.endTime)   setEndT(format(p.endTime, 'HH:mm'));
    if (p?.category)  setCat(p.category);
    setShowNl(false);
  };
  const save = () => {
    if (!title.trim()) return;
    const [sh,sm] = startT.split(':').map(Number), [eh,em] = endT.split(':').map(Number);
    const base = new Date(dateS + 'T12:00:00');
    onSave({ title: title.trim(), description: desc.trim()||undefined,
      startTime: setMinutes(setHours(base,sh),sm).getTime(),
      endTime: setMinutes(setHours(base,eh),em).getTime(),
      isPrivate: priv, category: cat,
      linkedTaskId: ltId||undefined, linkedNoteId: lnId||undefined });
  };

  const sc = getCat(cat); const SCI = sc.icon;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex justify-between items-center shrink-0" style={{ background: `${sc.color}10` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: sc.color }}>
              <SCI className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-black text-slate-900 text-sm">{editingEvent ? 'Edit Event' : 'New Event'}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-white/60"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {showNl && !editingEvent && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={nlIn} onChange={e => setNlIn(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') applyNl(); if (e.key === 'Escape') setShowNl(false); }}
                  placeholder="Describe the event naturally…" autoFocus
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button onClick={applyNl} className="px-3 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700">Parse</button>
              </div>
              <button onClick={() => setShowNl(false)} className="text-[11px] text-slate-400 hover:text-slate-600">fill manually →</button>
            </div>
          )}
          <div>
            <label className="text-xs font-black text-slate-500 mb-1.5 block">Title *</label>
            <Input autoFocus={!!editingEvent || !!preData?.title || !showNl} placeholder="Event title" value={title}
              onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); }} />
          </div>
          <div>
            <label className="text-xs font-black text-slate-500 mb-2 block">Category</label>
            <div className="grid grid-cols-4 gap-1.5">
              {EVENT_CATEGORIES.map(c => { const CI = c.icon; const a = cat === c.id;
                return (
                  <button key={c.id} onClick={() => setCat(c.id as EventCategory)}
                    className={cn('flex flex-col items-center gap-1 p-2 rounded-xl border text-[10px] font-black transition-all',
                      a ? 'text-white border-transparent shadow-sm scale-105' : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white')}
                    style={a ? { background: c.color } : {}}>
                    <CI className="w-3.5 h-3.5" />{c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-slate-500 mb-1.5 block">Date</label>
              <Input type="date" value={dateS} onChange={e => setDateS(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div><label className="text-xs font-black text-slate-500 mb-1.5 block">Start</label><Input type="time" value={startT} onChange={e => setStartT(e.target.value)} /></div>
              <div><label className="text-xs font-black text-slate-500 mb-1.5 block">End</label><Input type="time" value={endT} onChange={e => setEndT(e.target.value)} /></div>
            </div>
          </div>
          <div>
            <label className="text-xs font-black text-slate-500 mb-1.5 block">Notes</label>
            <textarea placeholder="Add details…" value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none h-16 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <div className={cn('p-1.5 rounded-full', priv ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600')}>
                {priv ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </div>
              <span className="text-xs font-bold text-slate-700">{priv ? 'Private' : 'Public'}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={priv} onChange={() => setPriv(!priv)} />
              <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>
          {/* Link Task */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-500 flex items-center gap-1.5"><CheckSquare className="w-3 h-3" />Task</label>
              {ltId ? <button onClick={() => setLtId(undefined)} className="text-[10px] text-red-400 hover:text-red-600">Remove</button>
                : <button onClick={() => { setTPick(v => !v); setNPick(false); }} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold">{tPick ? 'Cancel' : '+ Link'}</button>}
            </div>
            {lt && (
              <div className="flex items-center gap-2.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
                <CheckSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-xs font-bold text-blue-800 truncate">{lt.title}</p><p className="text-[10px] text-blue-500 capitalize">{lt.status}</p></div>
                <button onClick={() => { setSelectedTaskId(lt.id); setCurrentView('tasks'); onClose(); }} className="text-[10px] text-blue-500 font-bold shrink-0">Open →</button>
              </div>
            )}
            {tPick && !ltId && (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-2 border-b"><Input autoFocus placeholder="Search…" value={tSrc} onChange={e => setTSrc(e.target.value)} className="h-7 text-xs" /></div>
                <div className="max-h-32 overflow-y-auto">
                  {wsTasks.filter(t => !tSrc || t.title.toLowerCase().includes(tSrc.toLowerCase())).map(t => (
                    <button key={t.id} onClick={() => { setLtId(t.id); setTPick(false); setTSrc(''); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-indigo-50">
                      <CheckSquare className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-xs truncate flex-1">{t.title}</span>
                      <span className="text-[10px] text-slate-400 capitalize shrink-0">{t.status}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Link Note */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-500 flex items-center gap-1.5"><FileText className="w-3 h-3" />Note</label>
              {lnId ? <button onClick={() => setLnId(undefined)} className="text-[10px] text-red-400 hover:text-red-600">Remove</button>
                : <button onClick={() => { setNPick(v => !v); setTPick(false); }} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold">{nPick ? 'Cancel' : '+ Link'}</button>}
            </div>
            {ln && (
              <div className="flex items-center gap-2.5 px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl">
                <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <span className="text-xs font-bold text-violet-800 truncate flex-1">{ln.title}</span>
                <button onClick={() => { setSelectedNoteId(ln.id); setCurrentView('notes'); onClose(); }} className="text-[10px] text-violet-500 font-bold shrink-0">Open →</button>
              </div>
            )}
            {nPick && !lnId && (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-2 border-b"><Input autoFocus placeholder="Search…" value={nSrc} onChange={e => setNSrc(e.target.value)} className="h-7 text-xs" /></div>
                <div className="max-h-32 overflow-y-auto">
                  {wsNotes.filter(n => !nSrc || n.title.toLowerCase().includes(nSrc.toLowerCase())).map(n => (
                    <button key={n.id} onClick={() => { setLnId(n.id); setNPick(false); setNSrc(''); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-violet-50">
                      <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-xs truncate">{n.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          {editingEvent ? <Button variant="ghost" className="text-red-500 hover:bg-red-50 text-xs h-8" onClick={onDelete}><Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete</Button> : <div />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={!title.trim()}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Calendar ────────────────────────────────────────────────────────────
export function CalendarView() {
  const { workspace, tasks, events, notes, addEvent, updateEvent, deleteEvent, addTask, setCurrentView, setSelectedTaskId, setSelectedProjectId } = useAppStore();

  const [currentDate,  setCurrentDate]  = useState(new Date());
  const [calView,      setCalView]      = useState<CalView>('month');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingEv,    setEditingEv]    = useState<RichEvent | null>(null);
  const [preData,      setPreData]      = useState<Partial<RichEvent> | undefined>();
  const [selDate,      setSelDate]      = useState(new Date());
  const [showCmd,      setShowCmd]      = useState(false);
  const [contextDay,   setContextDay]   = useState<Date | null>(null);
  const [dragId,       setDragId]       = useState<string | null>(null);
  const [hoverEv,      setHoverEv]      = useState<{ event: RichEvent; x: number; y: number } | null>(null);
  const [quickEd,      setQuickEd]      = useState<{ event: RichEvent; x: number; y: number } | null>(null);
  const [inlineDay,    setInlineDay]    = useState<string | null>(null);
  const [overflowPop,  setOverflowPop]  = useState<{ key: string; date: Date } | null>(null);
  const [ctxMenu,      setCtxMenu]      = useState<{ event: RichEvent; x: number; y: number } | null>(null);
  const [activeCats,   setActiveCats]   = useState<Set<EventCategory>>(new Set());
  const [showSidebar,  setShowSidebar]  = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wsEvs  = useMemo(() => (events as RichEvent[]).filter(e => e.workspace === workspace), [events, workspace]);
  const wsTasks = useMemo(() => tasks.filter(t => t.workspace === workspace), [tasks, workspace]);

  // Category filter: empty set = show all
  const filteredEvs = useMemo(() =>
    activeCats.size === 0 ? wsEvs : wsEvs.filter(e => activeCats.has(e.category ?? 'work')),
    [wsEvs, activeCats]);

  const conflicts = useMemo(() => detectConflicts(wsEvs), [wsEvs]);

  const openModal = useCallback((date: Date, ev?: RichEvent, pre?: Partial<RichEvent>) => {
    setSelDate(date); setEditingEv(ev ?? null); setPreData(pre); setModalOpen(true);
    setOverflowPop(null); setCtxMenu(null); setQuickEd(null);
  }, []);
  const closeModal = () => { setModalOpen(false); setEditingEv(null); setPreData(undefined); };
  const handleSave = (data: Partial<RichEvent>) => {
    if (editingEv) updateEvent(editingEv.id, data);
    else addEvent({ ...data, workspace, isPrivate: data.isPrivate ?? false } as Omit<CalendarEvent, 'id'>);
    closeModal();
  };

  const toggleCat = (cat: EventCategory) => {
    setActiveCats(prev => {
      const n = new Set(prev);
      n.has(cat) ? n.delete(cat) : n.add(cat);
      return n;
    });
  };

  const navigate = useCallback((dir: 1 | -1) => {
    if (calView === 'month') setCurrentDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
    else if (calView === 'week') setCurrentDate(d => addDays(d, dir * 7));
    else setCurrentDate(d => addDays(d, dir));
  }, [calView]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowCmd(true); return; }
      switch (e.key) {
        case 'Escape': setShowCmd(false); setContextDay(null); setOverflowPop(null); setCtxMenu(null); setQuickEd(null); setInlineDay(null); break;
        case 'c': case 'C': openModal(new Date()); break;
        case 't': case 'T': setCurrentDate(new Date()); break;
        case 'ArrowLeft':  navigate(-1); break;
        case 'ArrowRight': navigate(1);  break;
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [navigate, openModal]);

  useEffect(() => {
    if (!ctxMenu) return;
    const h = () => setCtxMenu(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [ctxMenu]);

  const onEvEnter = (e: React.MouseEvent, ev: RichEvent) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    // Capture rect synchronously — currentTarget is nulled after the event returns
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hoverTimer.current = setTimeout(() => {
      setHoverEv({ event: ev, x: rect.right + 8, y: Math.min(rect.top, window.innerHeight - 300) });
    }, 700);
  };
  const onEvLeave = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setHoverEv(null), 150); };

  const onDragStart = (e: React.DragEvent, ev: RichEvent) => { setDragId(ev.id); e.dataTransfer.effectAllowed = 'move'; };
  const onDrop = (e: React.DragEvent, td: Date, th?: number) => {
    e.preventDefault();
    if (!dragId) return;
    const ev = wsEvs.find(x => x.id === dragId);
    if (!ev) return;
    const dur = ev.endTime - ev.startTime;
    const h = th ?? getHours(ev.startTime);
    const ns = setMinutes(setHours(td, h), getMinutes(ev.startTime)).getTime();
    updateEvent(dragId, { startTime: ns, endTime: ns + dur });
    setDragId(null);
  };

  // Smart scheduling handlers
  const scheduleSlot = (slot: FreeSlot, title: string) => {
    const st = setHours(slot.date, slot.startHour).getTime();
    const et = setHours(slot.date, Math.min(slot.endHour, slot.startHour + 2)).getTime();
    addEvent({ title, startTime: st, endTime: et, workspace, isPrivate: false, category: 'focus' } as Omit<CalendarEvent, 'id'>);
  };
  const breakSlot = (slot: FreeSlot) => {
    const half = Math.floor(slot.durationMinutes / 2);
    const mid = slot.startHour + half / 60;
    addEvent({ title: 'Focus Session 1', startTime: setHours(slot.date, slot.startHour).getTime(), endTime: setHours(slot.date, mid).getTime(), workspace, isPrivate: false, category: 'focus' } as Omit<CalendarEvent, 'id'>);
    addEvent({ title: 'Focus Session 2', startTime: setHours(slot.date, mid + 0.25).getTime(), endTime: setHours(slot.date, slot.endHour).getTime(), workspace, isPrivate: false, category: 'focus' } as Omit<CalendarEvent, 'id'>);
  };
  const moveSlot = (slot: FreeSlot) => {
    openModal(setHours(slot.date, slot.startHour), undefined, {
      startTime: setHours(slot.date, slot.startHour).getTime(),
      endTime: setHours(slot.date, slot.endHour).getTime(),
      title: 'Rescheduled Event',
    });
  };

  // Inline create
  const commitInline = (title: string, date: Date) => {
    addEvent({ title, startTime: setHours(date, 9).getTime(), endTime: setHours(date, 10).getTime(), workspace, isPrivate: false, category: 'work' } as Omit<CalendarEvent, 'id'>);
    setInlineDay(null);
  };

  // Event chip
  const chip = (ev: RichEvent, cloneDay: Date) => {
    const cat = getCat(ev.category); const Icon = cat.icon;
    const isConflict = conflicts.has(ev.id);
    return (
      <div key={ev.id} draggable
        onDragStart={e => { e.stopPropagation(); onDragStart(e, ev); }}
        onClick={e => {
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setQuickEd({ event: ev, x: Math.min(rect.right + 4, window.innerWidth - 300), y: Math.min(rect.top, window.innerHeight - 280) });
        }}
        onMouseEnter={e => onEvEnter(e, ev)} onMouseLeave={onEvLeave}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ event: ev, x: e.clientX, y: e.clientY }); }}
        className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-bold truncate cursor-pointer select-none flex items-center gap-1 hover:-translate-y-px transition-all duration-100 shadow-sm',
          isConflict && 'ring-1 ring-red-400', ev.isPrivate && 'ring-1 ring-amber-300')}
        style={{ background: cat.color, color: '#fff' }}>
        {isConflict && <AlertTriangle className="w-2 h-2 shrink-0" />}
        {ev.isPrivate && <Lock className="w-2 h-2 shrink-0 opacity-80" />}
        <Icon className="w-2.5 h-2.5 shrink-0 opacity-80" />
        <span className="shrink-0 opacity-80">{format(ev.startTime, 'H:mm')}</span>
        <span className="truncate">{ev.title}</span>
        {(ev.linkedTaskId || ev.linkedNoteId) && <span className="text-[8px] opacity-60">🔗</span>}
      </div>
    );
  };

  // ── Month View ─────────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const ms = startOfMonth(currentDate);
    let day  = startOfWeek(ms);
    const end = endOfWeek(endOfMonth(ms));
    const rows: React.ReactNode[] = [];
    const MAX = 3;

    while (day <= end) {
      const week: React.ReactNode[] = [];
      for (let i = 0; i < 7; i++) {
        const cd  = new Date(day);
        const key = format(cd, 'yyyy-MM-dd');
        const allEvs = wsEvs.filter(e => isSameDay(new Date(e.startTime), cd)).sort((a, b) => a.startTime - b.startTime);
        const evs = filteredEvs.filter(e => isSameDay(new Date(e.startTime), cd)).sort((a, b) => a.startTime - b.startTime);
        const totalMins = allEvs.reduce((s, e) => s + differenceInMinutes(e.endTime, e.startTime), 0);
        const busyPct = Math.min((totalMins / 480) * 100, 100); // 8h = 100%
        const inM  = isSameMonth(day, ms), tod = isToday(day), isWkend = day.getDay() === 0 || day.getDay() === 6;
        const isInline = inlineDay === key;

        week.push(
          <div key={key}
            className={cn('min-h-[110px] border-b border-r border-zinc-100 p-1.5 relative group/day',
              !inM && 'bg-zinc-50/40 opacity-60',
              tod && 'bg-indigo-50/80 ring-2 ring-inset ring-indigo-400/60',
              isWkend && inM && !tod && 'bg-slate-50/40',
              !tod && inM && 'hover:bg-slate-50/60 transition-colors cursor-pointer')}
            onDoubleClick={() => { setInlineDay(key); }}
            onClick={() => setContextDay(contextDay && isSameDay(contextDay, cd) ? null : cd)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => onDrop(e, cd)}>

            {/* Day number row */}
            <div className="flex items-center justify-between mb-1">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black',
                tod ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : inM ? 'text-zinc-800' : 'text-zinc-300')}>
                {format(day, 'd')}
              </div>
              {/* Quick add button - always visible on hover */}
              <button
                onClick={e => { e.stopPropagation(); setInlineDay(key); }}
                className={cn('flex items-center gap-0.5 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 opacity-0 group-hover/day:opacity-100 transition-all px-1.5 py-0.5 rounded-lg hover:bg-indigo-50')}>
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {/* Busy heatmap bar */}
            {busyPct > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b">
                <div className="h-full rounded-b transition-all duration-500"
                  style={{ width: `${busyPct}%`, background: busyPct >= 80 ? '#ef4444' : busyPct >= 50 ? '#f97316' : '#6366f1', opacity: 0.5 }} />
              </div>
            )}

            {/* Events */}
            <div className="space-y-0.5">
              {evs.slice(0, MAX).map(ev => chip(ev, cd))}
              {evs.length > MAX && (
                <div className="relative">
                  <button onClick={e => { e.stopPropagation(); setOverflowPop(p => p?.key === key ? null : { key, date: cd }); }}
                    className="text-[10px] text-zinc-500 font-bold pl-1.5 py-0.5 rounded-lg hover:bg-zinc-200 w-full text-left">
                    +{evs.length - MAX} more
                  </button>
                  {overflowPop?.key === key && (
                    <div className="absolute z-30 left-0 top-full mt-1 bg-white border border-zinc-200 rounded-2xl shadow-2xl w-60 overflow-hidden" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 border-b border-zinc-100">
                        <span className="text-xs font-black text-zinc-700">{format(cd, 'EEE, MMM d')}</span>
                        <button onClick={() => setOverflowPop(null)} className="text-zinc-400 hover:text-zinc-700"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="p-2 space-y-1 max-h-56 overflow-y-auto">
                        {allEvs.map(ev => { const c = getCat(ev.category); const CI = c.icon; return (
                          <button key={ev.id} onClick={() => { openModal(cd, ev); setOverflowPop(null); }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 text-left">
                            <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: c.color }}>
                              <CI className="w-2.5 h-2.5 text-white" />
                            </div>
                            <span className="text-xs font-bold text-zinc-800 truncate flex-1">{ev.title}</span>
                            <span className="text-[10px] text-zinc-400 shrink-0">{format(ev.startTime, 'h:mm a')}</span>
                          </button>
                        ); })}
                      </div>
                      <div className="px-3 py-2 border-t border-zinc-100">
                        <button onClick={() => { openModal(cd); setOverflowPop(null); }} className="text-xs text-indigo-600 font-bold flex items-center gap-1">
                          <Plus className="w-3 h-3" />Add event
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Inline creator */}
              {isInline && (
                <InlineDayCreator date={cd} onCommit={commitInline} onCancel={() => setInlineDay(null)} />
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div key={day.toString()} className="grid grid-cols-7">{week}</div>);
    }

    return (
      <>
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 sticky top-0 z-10">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(l => <div key={l} className="py-2.5 text-center text-[11px] font-black text-zinc-400 uppercase tracking-wider">{l}</div>)}
        </div>
        {rows}
      </>
    );
  };

  // ── Week View ─────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const ws = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const hours = Array.from({ length: 15 }, (_, i) => i + 7);
    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-8 border-b border-zinc-200 bg-zinc-50 sticky top-0 z-10">
          <div className="border-r border-zinc-200 p-2 text-[10px] text-zinc-400 text-right font-black">UTC</div>
          {days.map(d => {
            const ec = wsEvs.filter(e => isSameDay(new Date(e.startTime), d)).length;
            return (
              <div key={d.toString()} onClick={() => { setCurrentDate(d); setCalView('day'); }}
                className={cn('p-2 text-center border-r border-zinc-100 cursor-pointer hover:bg-indigo-50', isToday(d) && 'bg-indigo-50/80')}>
                <div className="text-[10px] text-zinc-500 uppercase font-black">{format(d, 'EEE')}</div>
                <div className={cn('text-base font-black mx-auto w-8 h-8 flex items-center justify-center rounded-full mt-0.5',
                  isToday(d) ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-zinc-700 hover:bg-indigo-100')}>
                  {format(d, 'd')}
                </div>
                {ec > 0 && <div className="text-[9px] text-zinc-400 mt-0.5">{ec}</div>}
              </div>
            );
          })}
        </div>
        {hours.map(hour => (
          <div key={hour} className="grid grid-cols-8 border-b border-zinc-100 min-h-[52px]">
            <div className="border-r border-zinc-200 px-2 py-1 text-[10px] text-zinc-400 text-right font-bold">{format(setHours(new Date(), hour), 'h a')}</div>
            {days.map(d => {
              const evs = filteredEvs.filter(e => isSameDay(new Date(e.startTime), d) && getHours(e.startTime) === hour);
              return (
                <div key={d.toString()}
                  className={cn('border-r border-zinc-100 p-0.5 cursor-pointer hover:bg-zinc-50 group/cell', isToday(d) && 'bg-indigo-50/20')}
                  onClick={() => openModal(setHours(d, hour))}
                  onDragOver={e => e.preventDefault()} onDrop={e => onDrop(e, d, hour)}>
                  {evs.map(ev => (
                    <div key={ev.id} draggable onDragStart={e => { e.stopPropagation(); onDragStart(e, ev); }}
                      onClick={ee => { ee.stopPropagation(); const r = (ee.currentTarget as HTMLElement).getBoundingClientRect(); setQuickEd({ event: ev, x: Math.min(r.right + 4, window.innerWidth - 300), y: Math.min(r.top, window.innerHeight - 280) }); }}
                      onMouseEnter={e => onEvEnter(e, ev)} onMouseLeave={onEvLeave}
                      className="text-[10px] rounded-lg px-1.5 py-1 mb-0.5 truncate cursor-grab hover:opacity-90 font-bold"
                      style={{ background: getCat(ev.category).color, color: '#fff' }}>
                      {ev.title}
                    </div>
                  ))}
                  <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity text-[9px] text-indigo-400 pl-0.5">+</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ── Day View ──────────────────────────────────────────────────────────────
  const renderDayView = () => {
    const hours = Array.from({ length: 15 }, (_, i) => i + 7);
    const dayEvs = filteredEvs.filter(e => isSameDay(new Date(e.startTime), currentDate)).sort((a, b) => a.startTime - b.startTime);
    const dayConflicts = detectConflicts(dayEvs);
    return (
      <div className="flex-1 overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-black',
              isToday(currentDate) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border border-zinc-200 text-zinc-700')}>
              {format(currentDate, 'd')}
            </div>
            <div>
              <p className="text-sm font-black text-zinc-900">{format(currentDate, 'EEEE')}</p>
              <p className="text-xs text-zinc-400">{format(currentDate, 'MMMM yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-zinc-500">{dayEvs.length} event{dayEvs.length !== 1 ? 's' : ''}</span>
            {dayConflicts.size > 0 && <span className="flex items-center gap-1 text-red-500 font-black"><AlertTriangle className="w-3 h-3" />{dayConflicts.size} conflict{dayConflicts.size > 1 ? 's' : ''}</span>}
          </div>
        </div>
        {hours.map(hour => {
          const evs = dayEvs.filter(e => getHours(e.startTime) === hour);
          const isCur = isToday(currentDate) && getHours(new Date()) === hour;
          return (
            <div key={hour}
              className={cn('flex border-b border-zinc-100 min-h-[60px] group/hour', isCur ? 'bg-indigo-50/50' : 'hover:bg-zinc-50/50 cursor-pointer transition-colors')}
              onClick={() => openModal(setHours(currentDate, hour))}>
              <div className="w-16 shrink-0 px-3 py-2 text-[10px] text-zinc-400 text-right border-r border-zinc-200 font-black relative">
                {format(setHours(new Date(), hour), 'h a')}
                {isCur && <div className="absolute right-0 top-1/2 w-2 h-2 bg-indigo-500 rounded-full -mr-1 shadow-lg" />}
              </div>
              <div className="flex-1 p-1.5 space-y-1">
                {evs.map(ev => {
                  const cat = getCat(ev.category); const Icon = cat.icon;
                  const dur = differenceInMinutes(ev.endTime, ev.startTime);
                  const isConflict = dayConflicts.has(ev.id);
                  return (
                    <div key={ev.id} draggable onDragStart={e => onDragStart(e, ev)}
                      onClick={e => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setQuickEd({ event: ev, x: Math.min(r.right + 4, window.innerWidth - 300), y: Math.min(r.top, window.innerHeight - 280) }); }}
                      onMouseEnter={e => onEvEnter(e, ev)} onMouseLeave={onEvLeave}
                      className={cn('px-3 py-2 rounded-xl cursor-grab hover:shadow-md transition-all', isConflict && 'ring-2 ring-red-400')}
                      style={{ background: `${cat.color}12`, borderLeft: `3px solid ${cat.color}` }}>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: cat.color }}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        <p className="text-xs font-black text-zinc-900">{ev.title}</p>
                        {isConflict && <AlertTriangle className="w-3 h-3 text-red-400 ml-auto shrink-0" />}
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-0.5 ml-7">
                        {format(ev.startTime, 'h:mm a')} – {format(ev.endTime, 'h:mm a')} · {fmtDur(dur)}
                        {isConflict && <span className="ml-2 text-red-400 font-black">⚠ conflict</span>}
                      </p>
                    </div>
                  );
                })}
                {evs.length === 0 && <div className="opacity-0 group-hover/hour:opacity-100 transition-opacity"><span className="text-[10px] text-indigo-400 pl-1">+ Add event</span></div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const periodLabel = calView === 'month' ? format(currentDate, 'MMMM yyyy')
    : calView === 'week' ? `${format(startOfWeek(currentDate), 'MMM d')} – ${format(endOfWeek(currentDate), 'MMM d, yyyy')}`
    : format(currentDate, 'EEEE, MMMM d, yyyy');

  // Week summary
  const weekTotal = useMemo(() => {
    const ws = startOfWeek(currentDate), we = endOfWeek(currentDate);
    return wsEvs.filter(e => { const d = new Date(e.startTime); return d >= ws && d <= we; })
      .reduce((s, e) => s + differenceInMinutes(e.endTime, e.startTime), 0);
  }, [wsEvs, currentDate]);

  return (
    <div className="h-full flex overflow-hidden bg-white">
      {/* Mobile sidebar toggle button */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all"
      >
        <CalendarIcon className="w-6 h-6" />
      </button>

      {/* Mobile overlay */}
      {showSidebar && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "w-52 shrink-0 border-r border-zinc-200 flex flex-col overflow-hidden bg-white transition-transform duration-300 ease-in-out",
        "md:relative md:translate-x-0",
        "fixed inset-y-0 left-0 z-40",
        showSidebar ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Close button for mobile */}
        <div className="md:hidden flex justify-end p-2 border-b border-zinc-100">
          <button
            onClick={() => setShowSidebar(false)}
            className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <MiniCalendar currentDate={currentDate} activeDate={currentDate} events={filteredEvs}
          onSelectDay={d => { setCurrentDate(d); if (calView === 'month') setCalView('day'); setShowSidebar(false); }}
          onMonthChange={setCurrentDate} />

        {/* Category filters */}
        <div className="px-3 py-2 border-b border-zinc-100">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1">
              <Filter className="w-2.5 h-2.5 text-zinc-400" />
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Filter</span>
            </div>
            {activeCats.size > 0 && (
              <button onClick={() => setActiveCats(new Set())} className="text-[9px] text-indigo-500 font-bold hover:text-indigo-700">Clear</button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {EVENT_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const active = activeCats.has(cat.id as EventCategory);
              return (
                <button key={cat.id} onClick={() => toggleCat(cat.id as EventCategory)}
                  className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[9px] font-bold transition-all',
                    active ? 'text-white border-transparent' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 bg-white')}
                  style={active ? { background: cat.color } : {}}>
                  <Icon className="w-2.5 h-2.5" />{cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <SmartPanel events={wsEvs} onOpenModal={openModal} onSetDate={d => { setCurrentDate(d); setCalView('day'); }}
          onScheduleSlot={scheduleSlot} onBreakSlot={breakSlot} onMoveSlot={moveSlot} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-2.5 border-b border-zinc-200 bg-white flex flex-wrap gap-2 items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-zinc-200 rounded-xl p-0.5 bg-zinc-50 shadow-sm">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => navigate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs font-black" onClick={() => setCurrentDate(new Date())}>Today</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => navigate(1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
            <div>
              <h2 className="text-sm font-black text-zinc-900">{periodLabel}</h2>
              {calView !== 'day' && weekTotal > 0 && (
                <p className="text-[10px] text-zinc-400">{fmtDur(weekTotal)} scheduled this week</p>
              )}
            </div>
            {isToday(currentDate) && calView !== 'month' && (
              <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-600 text-white rounded-full">TODAY</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-100 p-0.5 rounded-xl">
              {(['month','week','day'] as CalView[]).map(v => (
                <button key={v} onClick={() => setCalView(v)}
                  className={cn('px-3 py-1.5 text-xs font-black rounded-lg capitalize transition-all',
                    calView === v ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-800')}>
                  {v}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowCmd(true)}>
              <CommandIcon className="w-3 h-3" /> Command <kbd className="text-[9px] text-zinc-400 ml-0.5">⌘K</kbd>
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => openModal(new Date())}>
              <Plus className="w-3.5 h-3.5" /> New Event
            </Button>
          </div>
        </div>

        {/* Calendar + side panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {calView === 'month' ? renderMonthView() : calView === 'week' ? renderWeekView() : renderDayView()}
          </div>

          {contextDay && (
            <div className="w-64 shrink-0 border-l border-zinc-200 bg-white flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 flex items-start justify-between" style={{ background: 'linear-gradient(to bottom,#eef2ff,white)' }}>
                <div>
                  <p className="text-sm font-black text-zinc-900">{format(contextDay, 'EEEE')}</p>
                  <p className="text-xs text-zinc-400">{format(contextDay, 'MMMM d, yyyy')}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openModal(contextDay)} className="p-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"><Plus className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setContextDay(null)} className="p-1.5 rounded-xl text-zinc-400 hover:bg-zinc-100"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {wsEvs.filter(e => isSameDay(new Date(e.startTime), contextDay)).sort((a, b) => a.startTime - b.startTime).map(ev => {
                  const cat = getCat(ev.category); const Icon = cat.icon;
                  return (
                    <div key={ev.id} onClick={() => openModal(contextDay, ev)}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer hover:shadow-sm transition-all border"
                      style={{ borderColor: `${cat.color}25`, background: `${cat.color}08` }}>
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: cat.color }}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-zinc-900 truncate">{ev.title}</p>
                        <p className="text-[10px] text-zinc-400">{format(ev.startTime, 'h:mm a')} – {format(ev.endTime, 'h:mm a')}</p>
                      </div>
                    </div>
                  );
                })}
                {wsEvs.filter(e => isSameDay(new Date(e.startTime), contextDay)).length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-zinc-400 mb-2">Nothing scheduled</p>
                    <button onClick={() => openModal(contextDay)} className="text-xs text-indigo-500 font-black hover:text-indigo-700">+ Add event</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Edit Popover */}
      {quickEd && (
        <div onClick={() => setQuickEd(null)} className="fixed inset-0 z-[90]" style={{ background: 'transparent' }}>
          <QuickEditPopover
            event={quickEd.event}
            onClose={() => setQuickEd(null)}
            onSave={updates => { updateEvent(quickEd.event.id, updates); setQuickEd(null); }}
            onFullEdit={() => { openModal(new Date(quickEd.event.startTime), quickEd.event); setQuickEd(null); }}
            onDelete={() => { deleteEvent(quickEd.event.id); setQuickEd(null); }}
            style={{ top: quickEd.y, left: quickEd.x }}
          />
        </div>
      )}

      {/* Hover card */}
      {hoverEv && !quickEd && (
        <div onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }} onMouseLeave={() => setHoverEv(null)}
          className="fixed z-[100] pointer-events-auto" style={{ top: hoverEv!.y, left: Math.min(hoverEv!.x, window.innerWidth - 280) }}>
          {(() => {
            const ev = hoverEv!.event; const cat = getCat(ev.category); const Icon = cat.icon;
            const dur = differenceInMinutes(ev.endTime, ev.startTime);
            const lt = tasks.find(t => t.id === ev.linkedTaskId), ln = notes.find(n => n.id === ev.linkedNoteId);
            return (
              <div className="w-60 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in duration-150">
                <div className="px-4 py-3 flex items-start gap-3" style={{ background: `${cat.color}12`, borderBottom: `2px solid ${cat.color}20` }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: cat.color }}><Icon className="w-4 h-4 text-white" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900">{ev.title}</p>
                    <p className="text-[11px] font-bold mt-0.5" style={{ color: cat.color }}>{cat.label}</p>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {format(ev.startTime, 'h:mm a')} – {format(ev.endTime, 'h:mm a')} · {fmtDur(dur)}
                  </div>
                  {ev.description && <p className="text-xs text-slate-500 line-clamp-2">{ev.description}</p>}
                  {lt && <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg"><CheckSquare className="w-3 h-3 shrink-0" /><span className="truncate">{lt.title}</span></div>}
                  {ln && <div className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 px-2.5 py-1.5 rounded-lg"><FileText className="w-3 h-3 shrink-0" /><span className="truncate">{ln.title}</span></div>}
                </div>
                <div className="px-4 py-2.5 border-t border-slate-100 flex gap-2">
                  <button onClick={() => { openModal(new Date(ev.startTime), ev); setHoverEv(null); }} className="flex-1 py-1.5 text-xs font-black bg-slate-900 text-white rounded-xl hover:bg-slate-700">Edit</button>
                  <button onClick={() => { deleteEvent(ev.id); setHoverEv(null); }} className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-xl">Delete</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Right-click menu */}
      {ctxMenu && (
        <div className="fixed z-50 w-44 bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden"
          style={{ top: ctxMenu.y, left: Math.min(ctxMenu.x, window.innerWidth - 180) }} onClick={e => e.stopPropagation()}>
          {[
            { l: 'Edit event', fn: () => { openModal(new Date(ctxMenu.event.startTime), ctxMenu.event); setCtxMenu(null); }, icon: CalendarIcon, danger: false },
            { l: 'Duplicate',  fn: () => { addEvent({ ...ctxMenu.event, title: `${ctxMenu.event.title} (copy)` } as any); setCtxMenu(null); }, icon: RotateCcw, danger: false },
            { l: 'Delete',     fn: () => { deleteEvent(ctxMenu.event.id); setCtxMenu(null); }, icon: Trash2, danger: true },
          ].map(({ l, fn, icon: Icon, danger }) => (
            <button key={l} onClick={fn}
              className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 text-sm', danger ? 'text-red-600 hover:bg-red-50' : 'text-zinc-700 hover:bg-zinc-50')}>
              <Icon className={cn('w-3.5 h-3.5', danger ? 'text-red-400' : 'text-zinc-400')} />{l}
            </button>
          ))}
        </div>
      )}

      {/* Modals */}
      {modalOpen && <EventModal selectedDate={selDate} editingEvent={editingEv} preData={preData} onClose={closeModal} onSave={handleSave} onDelete={() => { if (editingEv) { deleteEvent(editingEv.id); closeModal(); } }} />}
      {showCmd && <CommandPalette onClose={() => setShowCmd(false)}
        onCreateEvent={d => { addEvent({ ...d, workspace, isPrivate: d.isPrivate ?? false } as Omit<CalendarEvent, 'id'>); }}
        onNavigate={d => { setCurrentDate(d); setCalView('day'); }}
        events={wsEvs} />}
    </div>
  );
}