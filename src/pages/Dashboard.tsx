import React, { useMemo } from 'react';
import { useAppStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle2, Clock, FileText, AlertCircle, TrendingUp,
  Flame, CalendarDays, ArrowRight, Plus, Zap
} from 'lucide-react';
import { format, isToday, isTomorrow, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function CompletionRing({ pct }: { pct: number }) {
  const r = 28, circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#f4f4f5" strokeWidth="7" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke="#6366f1" strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

export function Dashboard() {
  const { workspace, tasks, notes, events, setCurrentView, setSelectedNoteId, setSelectedTaskId } = useAppStore();

  const workspaceTasks = tasks.filter(t => t.workspace === workspace);
  const workspaceNotes = notes.filter(n => n.workspace === workspace);
  const workspaceEvents = events.filter(e => e.workspace === workspace);

  // Stats
  const todoTasks      = workspaceTasks.filter(t => t.status === 'To Do');
  const inProgressTasks = workspaceTasks.filter(t => t.status === 'In Progress');
  const doneTasks      = workspaceTasks.filter(t => t.status === 'Done');
  const overdueTasks   = workspaceTasks.filter(t => t.dueDate && t.dueDate < Date.now() && t.status !== 'Done');

  const completionPct = workspaceTasks.length > 0
    ? Math.round((doneTasks.length / workspaceTasks.length) * 100)
    : 0;

  // Today's events
  const todayStart = startOfDay(new Date()).getTime();
  const todayEnd   = endOfDay(new Date()).getTime();
  const todayEvents = workspaceEvents
    .filter(e => e.startTime >= todayStart && e.startTime <= todayEnd)
    .sort((a, b) => a.startTime - b.startTime);

  // Upcoming tasks (next 7 days, not done)
  const upcomingTasks = useMemo(() =>
    workspaceTasks
      .filter(t => t.dueDate && t.dueDate > Date.now() && t.status !== 'Done')
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
      .slice(0, 5),
    [workspaceTasks]
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'High':   return 'bg-red-100 text-red-700 border-red-200';
      case 'Medium': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Low':    return 'bg-zinc-100 text-zinc-700 border-zinc-200';
      default:       return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  const getDueDateLabel = (dueDate: number) => {
    if (isToday(dueDate))    return <span className="text-amber-600 font-medium">Today</span>;
    if (isTomorrow(dueDate)) return <span className="text-blue-600">Tomorrow</span>;
    return <span className="text-zinc-500">{format(dueDate, 'MMM d')}</span>;
  };

  const statCards = [
    {
      label: 'In Progress',
      value: inProgressTasks.length,
      icon: Clock,
      iconColor: 'text-blue-500',
      bg: 'bg-blue-50',
      onClick: () => setCurrentView('tasks'),
    },
    {
      label: 'To Do',
      value: todoTasks.length,
      icon: AlertCircle,
      iconColor: 'text-amber-500',
      bg: 'bg-amber-50',
      onClick: () => setCurrentView('tasks'),
    },
    {
      label: 'Completed',
      value: doneTasks.length,
      icon: CheckCircle2,
      iconColor: 'text-emerald-500',
      bg: 'bg-emerald-50',
      onClick: () => setCurrentView('tasks'),
    },
    {
      label: 'Notes',
      value: workspaceNotes.length,
      icon: FileText,
      iconColor: 'text-indigo-500',
      bg: 'bg-indigo-50',
      onClick: () => setCurrentView('notes'),
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">
            {getGreeting()}! 👋
          </h1>
          <p className="text-zinc-500 mt-1 text-sm md:text-base">
            Here's your <span className="font-medium text-zinc-700">{workspace}</span> workspace overview for {format(new Date(), 'EEEE, MMMM d')}.
          </p>
        </div>
        <Button size="sm" className="hidden sm:flex" onClick={() => setCurrentView('tasks')}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Task
        </Button>
      </header>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon, iconColor, bg, onClick }) => (
          <Card
            key={label}
            className="cursor-pointer hover:shadow-md transition-shadow border-zinc-200"
            onClick={onClick}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", bg)}>
                <Icon className={cn("w-5 h-5", iconColor)} />
              </div>
              <div>
                <div className="text-2xl font-bold text-zinc-900">{value}</div>
                <div className="text-xs text-zinc-500">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Progress + Overdue ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Completion Ring */}
        <Card className="border-zinc-200">
          <CardContent className="p-5 flex items-center gap-6">
            <div className="relative shrink-0">
              <CompletionRing pct={completionPct} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-zinc-900">{completionPct}%</span>
              </div>
            </div>
            <div>
              <div className="font-semibold text-zinc-900">Completion Rate</div>
              <div className="text-sm text-zinc-500 mt-0.5">
                {doneTasks.length} of {workspaceTasks.length} tasks done
              </div>
              <div className="mt-2 h-1.5 w-40 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overdue & Urgent */}
        <Card className={cn("border-zinc-200", overdueTasks.length > 0 && "border-red-200 bg-red-50/30")}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className={cn("w-4 h-4", overdueTasks.length > 0 ? "text-red-500" : "text-zinc-400")} />
              <span className="font-semibold text-zinc-900">
                {overdueTasks.length > 0 ? `${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? 's' : ''}` : 'All Clear'}
              </span>
            </div>
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-zinc-500">No overdue tasks. Great work! 🎉</p>
            ) : (
              <div className="space-y-1">
                {overdueTasks.slice(0, 3).map(t => (
                  <div
                    key={t.id}
                    onClick={() => { setSelectedTaskId(t.id); setCurrentView('tasks'); }}
                    className="flex items-center justify-between text-sm cursor-pointer hover:underline text-red-700"
                  >
                    <span className="truncate">{t.title}</span>
                    <span className="text-xs text-red-400 ml-2 shrink-0">{t.dueDate ? format(t.dueDate, 'MMM d') : ''}</span>
                  </div>
                ))}
                {overdueTasks.length > 3 && (
                  <button className="text-xs text-red-500 hover:underline" onClick={() => setCurrentView('tasks')}>
                    +{overdueTasks.length - 3} more
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Upcoming Tasks */}
        <Card className="lg:col-span-2 border-zinc-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Upcoming Tasks</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentView('tasks')}>
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {upcomingTasks.length === 0 && (
              <p className="text-sm text-zinc-500 py-4 text-center">No upcoming tasks with due dates.</p>
            )}
            {upcomingTasks.map(task => (
              <div
                key={task.id}
                onClick={() => { setSelectedTaskId(task.id); setCurrentView('tasks'); }}
                className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 hover:bg-zinc-50 hover:border-zinc-200 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-1.5 h-8 rounded-full bg-indigo-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-zinc-900 truncate">{task.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{task.status}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge variant="outline" className={cn("border text-[10px]", getPriorityColor(task.priority))}>
                    {task.priority}
                  </Badge>
                  <span className="text-xs">{task.dueDate ? getDueDateLabel(task.dueDate) : ''}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card className="border-zinc-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-500" />
              Today
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentView('calendar')}>
              Calendar <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {todayEvents.length === 0 && (
              <p className="text-sm text-zinc-500 py-4 text-center">No events today.</p>
            )}
            {todayEvents.map(ev => (
              <div
                key={ev.id}
                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100"
              >
                <div className="w-1 h-8 rounded-full bg-indigo-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-zinc-900 truncate">{ev.title}</p>
                  <p className="text-xs text-indigo-500">
                    {format(ev.startTime, 'h:mm a')} – {format(ev.endTime, 'h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Notes ── */}
      <Card className="border-zinc-200">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Recent Notes</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentView('notes')}>
            All notes <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {workspaceNotes.slice(0, 6).map(note => (
              <div
                key={note.id}
                onClick={() => { setSelectedNoteId(note.id); setCurrentView('notes'); }}
                className="p-3 rounded-lg border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 transition-all cursor-pointer"
              >
                <p className="font-medium text-sm text-zinc-900 truncate">{note.title}</p>
                <p className="text-xs text-zinc-400 truncate mt-1">
                  {note.content.replace(/[#*`\-\[\]]/g, '').trim().slice(0, 60) || 'Empty note'}
                </p>
                <p className="text-[10px] text-zinc-400 mt-2">{format(note.updatedAt, 'MMM d, yyyy')}</p>
              </div>
            ))}
            {workspaceNotes.length === 0 && (
              <div className="col-span-3 py-4 text-center text-sm text-zinc-500">
                No notes yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}