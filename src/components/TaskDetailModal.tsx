import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { Task, Status, Priority, TaskType } from '@/types';
import { format } from 'date-fns';
import {
  X, Calendar as CalendarIcon, Clock, Trash2,
  AlignLeft, Layers, GitCommit, FileText, Plus,
  ChevronDown, Check, AlertTriangle, Zap, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

// ── Styled Select ─────────────────────────────────────────────────────────────

function StyledSelect({ value, onChange, children, className }: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'w-full appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white',
          'focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400',
          'hover:border-slate-300 transition-colors cursor-pointer text-slate-800',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ── Styled Date Picker ────────────────────────────────────────────────────────

function StyledDatePicker({ value, onChange, label, min }: {
  value: string; onChange: (v: string) => void; label: string; min?: string;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <CalendarIcon className="w-3.5 h-3.5 text-violet-400" />
      </div>
      <input
        type="date" value={value} min={min}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white',
          'focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400',
          'hover:border-slate-300 transition-colors cursor-pointer text-slate-800',
        )}
      />
    </div>
  );
}

// ── Styled Checkbox ───────────────────────────────────────────────────────────

function StyledCheckbox({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 shrink-0',
          checked
            ? 'bg-violet-600 border-violet-600'
            : 'border-slate-300 bg-white group-hover:border-violet-300',
        )}
      >
        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

// ── Score Selector ────────────────────────────────────────────────────────────

function ScoreSelector({ value, onChange, max, label, color }: {
  value: string; onChange: (v: string) => void;
  max: number; label: string; color: string;
}) {
  const num = parseInt(value) || 0;
  const levelLabel = (n: number, m: number) => {
    const pct = n / m;
    if (pct === 0)   return '—';
    if (pct <= 0.33) return 'Low';
    if (pct <= 0.66) return 'Medium';
    return 'High';
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${color}20`, color }}>
          {num > 0 ? `${num} / ${max} — ${levelLabel(num, max)}` : `— / ${max}`}
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === num ? '' : String(n))}
            className={cn(
              'flex-1 h-6 rounded-md border transition-all duration-100 text-[10px] font-medium',
              n <= num
                ? 'border-transparent text-white'
                : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300',
            )}
            style={n <= num ? { backgroundColor: color } : undefined}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── ROI Insight ───────────────────────────────────────────────────────────────

function RoiInsight({ impact, effort }: { impact: string; effort: string }) {
  const i = parseInt(impact) || 0;
  const e = parseInt(effort) || 0;
  if (!i || !e) return null;
  const ratio = i / e;

  let emoji: string, label: string, tip: string, cls: string;
  if (ratio >= 1.8) {
    emoji = '🚀'; label = 'Quick win';
    tip = 'High impact, low effort — prioritise now';
    cls = 'bg-emerald-50 border-emerald-200 text-emerald-800';
  } else if (ratio >= 1.2) {
    emoji = '⚡'; label = 'High ROI';
    tip = 'Good return on investment';
    cls = 'bg-blue-50 border-blue-200 text-blue-800';
  } else if (ratio >= 0.8) {
    emoji = '→'; label = 'Balanced';
    tip = 'Effort and impact are roughly equal';
    cls = 'bg-slate-50 border-slate-200 text-slate-600';
  } else {
    emoji = '⚠️'; label = 'Low ROI';
    tip = 'High effort for low impact — consider deprioritising';
    cls = 'bg-amber-50 border-amber-200 text-amber-800';
  }

  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-xl border text-sm', cls)}>
      <span className="text-lg leading-none shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{label}</span>
        <span className="text-xs ml-2 opacity-70">{tip}</span>
      </div>
      <span className="text-xs font-semibold opacity-60 shrink-0">{ratio.toFixed(1)}×</span>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function TaskDetailModal() {
  const {
    tasks, selectedTaskId, setSelectedTaskId,
    updateTask, deleteTask, addTask, workspace, settings,
    notes, updateNote, projects,
  } = useAppStore();

  const task = tasks.find(t => t.id === selectedTaskId);

  const [title,         setTitle]         = useState('');
  const [description,   setDescription]   = useState('');
  const [status,        setStatus]        = useState<Status>('To Do');
  const [priority,      setPriority]      = useState<Priority>('Medium');
  const [type,          setType]          = useState<TaskType | ''>('');
  const [parentId,      setParentId]      = useState('');
  const [startDate,     setStartDate]     = useState('');
  const [dueDate,       setDueDate]       = useState('');
  const [time,          setTime]          = useState('');
  const [effort,        setEffort]        = useState('');
  const [impact,        setImpact]        = useState('');
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [showDateError, setShowDateError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showNoteLinker,setShowNoteLinker]= useState(false);
  const [noteSearchQ,   setNoteSearchQ]   = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setType(task.type || '');
      setParentId(task.parentId || '');
      setStartDate(task.startDate ? format(task.startDate, 'yyyy-MM-dd') : '');
      setDueDate(task.dueDate   ? format(task.dueDate,   'yyyy-MM-dd') : '');
      setTime(task.time || '');
      setEffort(task.effort?.toString() || '');
      setImpact(task.impact?.toString() || '');
      setAddToCalendar(task.addToCalendar || false);
      setConfirmDelete(false);
      setShowNoteLinker(false);
      setNoteSearchQ('');
    }
  }, [task]);

  if (!task) return null;

  const maxScale = settings.scaleSystem === '1-5' ? 5 : 10;

  const executeSave = () => {
    const parsedEffort = effort ? Math.min(Math.max(parseInt(effort, 10), 1), maxScale) : undefined;
    const parsedImpact = impact ? Math.min(Math.max(parseInt(impact, 10), 1), maxScale) : undefined;
    let finalDueDate   = dueDate;
    let finalStartDate = startDate;
    if (finalStartDate && finalDueDate && finalDueDate < finalStartDate) finalDueDate = finalStartDate;
    updateTask(task.id, {
      title, description, status,
      priority: settings.enablePriority ? priority : 'Medium',
      type: type as TaskType || undefined,
      parentId: parentId || undefined,
      startDate: finalStartDate ? new Date(finalStartDate).getTime() : undefined,
      dueDate:   finalDueDate   ? new Date(finalDueDate).getTime()   : undefined,
      time: time || undefined,
      effort: settings.enableEffort ? parsedEffort : undefined,
      impact: settings.enableImpact ? parsedImpact : undefined,
      addToCalendar,
    });
    setShowDateError(false);
    setSelectedTaskId(null);
  };

  const handleSave = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (!settings.allowBackDatingTasks) {
      if ((dueDate && dueDate < today) || (startDate && startDate < today)) {
        setShowDateError(true);
        return;
      }
    }
    executeSave();
  };

  const handleSaveAndNew = () => {
    handleSave();
    // After save, open a fresh task in the same status — re-open the add-task
    // inline form in the board instead of opening another modal. Nothing else needed.
  };

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    deleteTask(task.id);
    setSelectedTaskId(null);
  };

  const linkedNotes    = notes.filter(n => (task.linkedNoteIds || []).includes(n.id));
  const availableNotes = notes.filter(n =>
    n.workspace === workspace &&
    !(task.linkedNoteIds || []).includes(n.id) &&
    (noteSearchQ === '' || n.title.toLowerCase().includes(noteSearchQ.toLowerCase()))
  );

  const linkNote = (noteId: string) => {
    updateTask(task.id, { linkedNoteIds: [...(task.linkedNoteIds || []), noteId] });
    const note = notes.find(n => n.id === noteId);
    if (note) updateNote(noteId, { linkedTaskIds: [...(note.linkedTaskIds || []), task.id] });
    setShowNoteLinker(false);
    setNoteSearchQ('');
  };

  const unlinkNote = (noteId: string) => {
    updateTask(task.id, { linkedNoteIds: (task.linkedNoteIds || []).filter(id => id !== noteId) });
    const note = notes.find(n => n.id === noteId);
    if (note) updateNote(noteId, { linkedTaskIds: (note.linkedTaskIds || []).filter(id => id !== task.id) });
  };

  const epics   = tasks.filter(t => t.workspace === workspace && t.type === 'Epic' && t.id !== task.id);
  const project = projects.find(p => p.id === task.projectId);

  // Priority chip config
  const priorityConfig: Record<Priority, { bg: string; text: string; border: string; icon: string }> = {
    Low:    { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-300',  icon: '○' },
    Medium: { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300',  icon: '◔' },
    High:   { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', icon: '◕' },
    Urgent: { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300',    icon: '⚠' },
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[92vh]">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            {project && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${project.color}18`, color: project.color }}>
                {project.name}
              </span>
            )}
            <Badge variant="outline" className="text-slate-400 font-mono text-[10px]">
              #{task.id.slice(0, 6)}
            </Badge>
            <StyledSelect value={status} onChange={v => setStatus(v as Status)} className="w-36 text-xs py-1">
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="In Review">In Review</option>
              <option value="Done">Done</option>
            </StyledSelect>
          </div>
          <button
            onClick={() => setSelectedTaskId(null)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* Title */}
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-xl font-bold text-slate-900 border-none outline-none bg-transparent placeholder:text-slate-300"
            placeholder="Task title"
            autoFocus
          />

          {/* Date error */}
          {showDateError && (
            <div className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
              Back-dating is disabled. Enable it in Settings or pick a future date.
              <button
                className="ml-auto text-amber-600 hover:text-amber-800 underline text-xs"
                onClick={() => { setShowDateError(false); executeSave(); }}
              >
                Save anyway
              </button>
            </div>
          )}

          {/* Two-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Left column */}
            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3 h-3" /> Type
                </label>
                <StyledSelect value={type} onChange={v => setType(v as TaskType | '')}>
                  <option value="">Standard Task</option>
                  <option value="Epic">Epic</option>
                  <option value="Story">Story</option>
                  <option value="Bug">Bug</option>
                </StyledSelect>
              </div>

              {/* Parent epic */}
              {type !== 'Epic' && epics.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5">
                    <GitCommit className="w-3 h-3" /> Parent Epic
                  </label>
                  <StyledSelect value={parentId} onChange={setParentId}>
                    <option value="">None</option>
                    {epics.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                  </StyledSelect>
                </div>
              )}

              {/* Priority — visual chips */}
              {settings.enablePriority && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">Priority</label>
                  <div className="flex gap-2 flex-wrap">
                    {(['Low', 'Medium', 'High', 'Urgent'] as Priority[]).map(p => {
                      const cfg   = priorityConfig[p];
                      const isAct = priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-semibold transition-all',
                            isAct
                              ? `${cfg.bg} ${cfg.text} ${cfg.border} shadow-sm scale-105`
                              : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600',
                          )}
                        >
                          <span className="text-base leading-none">{cfg.icon}</span>
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right column — dates */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Start Date</label>
                <StyledDatePicker value={startDate} onChange={setStartDate} label="Start" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Due Date</label>
                <StyledDatePicker value={dueDate} onChange={setDueDate} label="Due" min={startDate || undefined} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Time
                </label>
                <input
                  type="time" value={time} onChange={e => setTime(e.target.value)}
                  className="w-full pl-3 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 hover:border-slate-300 transition-colors"
                />
              </div>
              <StyledCheckbox checked={addToCalendar} onChange={setAddToCalendar} label="Add to Calendar" />
            </div>
          </div>

          {/* Effort + Impact + ROI */}
          {(settings.enableEffort || settings.enableImpact) && (
            <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              {settings.enableEffort && (
                <ScoreSelector value={effort} onChange={setEffort} max={maxScale} label="Effort" color="#f59e0b" />
              )}
              {settings.enableImpact && (
                <ScoreSelector value={impact} onChange={setImpact} max={maxScale} label="Impact" color="#3b82f6" />
              )}
              {/* Live ROI insight */}
              {settings.enableEffort && settings.enableImpact && (
                <RoiInsight impact={impact} effort={effort} />
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5">
              <AlignLeft className="w-3 h-3" /> Description
            </label>
            <Textarea
              placeholder="Add a more detailed description…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="min-h-[100px] resize-y text-sm border-slate-200 focus:ring-violet-300 focus:border-violet-400"
            />
          </div>

          {/* Linked Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Linked Notes
              </label>
              <button
                onClick={() => setShowNoteLinker(v => !v)}
                className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> Link Note
              </button>
            </div>

            {/* Search box */}
            {showNoteLinker && (
              <div className="mb-3 p-3 border border-violet-200 rounded-xl bg-violet-50/50 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                <Input
                  autoFocus
                  placeholder="Search notes…"
                  value={noteSearchQ}
                  onChange={e => setNoteSearchQ(e.target.value)}
                  className="text-sm h-8"
                />
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {availableNotes.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">No notes found</p>
                  )}
                  {availableNotes.map(n => (
                    <button
                      key={n.id}
                      onClick={() => linkNote(n.id)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-violet-100 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      {n.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No notes empty state */}
            {linkedNotes.length === 0 && !showNoteLinker && (
              <p className="text-xs text-slate-400 py-1">No notes linked yet</p>
            )}

            {/* Linked note items — with preview */}
            <div className="space-y-1.5">
              {linkedNotes.map(n => {
                const preview = n.content
                  .replace(/^---[\s\S]*?---\n?/, '')
                  .replace(/[#*`>_~]/g, '')
                  .trim()
                  .split('\n')
                  .find((l: string) => l.trim().length > 0) ?? '';
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-2 p-2.5 bg-violet-50 border border-violet-100 rounded-xl group hover:border-violet-300 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-violet-800 font-medium truncate">{n.title}</p>
                      {preview && (
                        <p className="text-[11px] text-violet-500 truncate mt-0.5">
                          {preview.slice(0, 70)}{preview.length > 70 ? '…' : ''}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => unlinkNote(n.id)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-violet-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-between items-center sticky bottom-0 z-10">
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-red-600 font-medium">Delete this task?</span>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedTaskId(null)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!title.trim()}
              onClick={handleSaveAndNew}
              className="text-violet-600 border-violet-200 hover:bg-violet-50"
            >
              Save &amp; New
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!title.trim()}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}