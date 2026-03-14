import React, { useMemo, useState } from 'react';
import { useAppStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle2, Clock, FileText, AlertCircle, TrendingUp,
  Flame, CalendarDays, ArrowRight, Plus, Zap, X, FolderKanban
} from 'lucide-react';
import { format, isToday, isTomorrow, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Status, Task } from '@/types';

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
      <circle cx="36" cy="36" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke="#7c3aed" strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

// Modal showing all tasks for a given status
function StatusTasksModal({
  status, tasks, onClose, onTaskClick
}: {
  status: Status;
  tasks: Task[];
  onClose: () => void;
  onTaskClick: (task: Task) => void;
}) {
  const { settings } = useAppStore();
  const statusColor = settings.statusColors[status] ?? '#94a3b8';
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'High':   return 'bg-red-100 text-red-700 border-red-200';
      case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Low':    return 'bg-slate-100 text-slate-700 border-slate-200';
      default:       return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColor }} />
            <h2 className="font-semibold text-slate-900">{status}</h2>
            <span className="text-sm text-slate-400">{tasks.length} tasks</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-1.5">
          {tasks.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No tasks in this status</p>
          )}
          {tasks.map(task => (
            <button
              key={task.id}
              onClick={() => onTaskClick(task)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-violet-50 hover:border-violet-200 transition-all text-left group"
            >
              <div
                className="w-1.5 h-10 rounded-full shrink-0"
                style={{ backgroundColor: statusColor }}
              />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium text-slate-900 truncate", task.status === 'Done' && "line-through text-slate-400")}>
                  {task.title}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{task.status}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={cn("text-[10px] border", getPriorityColor(task.priority))}>
                  {task.priority}
                </Badge>
                {task.dueDate && (
                  <span className="text-xs text-slate-400">{format(task.dueDate, 'MMM d')}</span>
                )}
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-400 transition-colors" />
              </div>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center">
            Click a task to navigate to its project
          </p>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const {
    workspace, tasks, notes, events,
    setCurrentView, setSelectedNoteId, setSelectedTaskId,
    settings, projects, setSelectedProjectId,
  } = useAppStore();

  const [statusModal, setStatusModal] = useState<Status | null>(null);

  const workspaceTasks = tasks.filter(t => t.workspace === workspace);
  const workspaceNotes = notes.filter(n => n.workspace === workspace);
  const workspaceEvents = events.filter(e => e.workspace === workspace);

  const todoTasks       = workspaceTasks.filter(t => t.status === 'To Do');
  const inProgressTasks = workspaceTasks.filter(t => t.status === 'In Progress');
  const inReviewTasks   = workspaceTasks.filter(t => t.status === 'In Review');
  const doneTasks       = workspaceTasks.filter(t => t.status === 'Done');
  const overdueTasks    = workspaceTasks.filter(t => t.dueDate && t.dueDate < Date.now() && t.status !== 'Done');

  const completionPct = workspaceTasks.length > 0
    ? Math.round((doneTasks.length / workspaceTasks.length) * 100)
    : 0;

  const todayStart = startOfDay(new Date()).getTime();
  const todayEnd   = endOfDay(new Date()).getTime();
  const todayEvents = workspaceEvents
    .filter(e => e.startTime >= todayStart && e.startTime <= todayEnd)
    .sort((a, b) => a.startTime - b.startTime);

  const upcomingTasks = useMemo(() =>
    workspaceTasks
      .filter(t => t.dueDate && t.dueDate > Date.now() && t.status !== 'Done')
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
      .slice(0, 5),
    [workspaceTasks]
  );

  const workspaceProjects = projects.filter(p => p.workspace === workspace && !p.isCompleted);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'High':   return 'bg-red-100 text-red-700 border-red-200';
      case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Low':    return 'bg-slate-100 text-slate-700 border-slate-200';
      default:       return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getDueDateLabel = (dueDate: number) => {
    if (isToday(dueDate))    return <span className="text-amber-600 font-medium">Today</span>;
    if (isTomorrow(dueDate)) return <span className="text-blue-600">Tomorrow</span>;
    return <span className="text-slate-500">{format(dueDate, 'MMM d')}</span>;
  };

  // Navigate to task's project and open/highlight it
  const handleTaskClick = (task: Task) => {
    if (task.projectId) setSelectedProjectId(task.projectId);
    setCurrentView('tasks');
    if (settings.dashboardTaskClickBehavior === 'auto-open') {
      setSelectedTaskId(task.id);
    } else {
      setSelectedTaskId(task.id); // highlight
    }
    setStatusModal(null);
  };

  const statCards = [
    {
      label: 'In Progress',
      value: inProgressTasks.length,
      status: 'In Progress' as Status,
      icon: Clock,
      iconColor: 'text-blue-500',
      bg: 'bg-blue-50',
      ring: 'hover:ring-blue-200',
    },
    {
      label: 'To Do',
      value: todoTasks.length,
      status: 'To Do' as Status,
      icon: AlertCircle,
      iconColor: 'text-violet-500',
      bg: 'bg-violet-50',
      ring: 'hover:ring-violet-200',
    },
    {
      label: 'In Review',
      value: inReviewTasks.length,
      status: 'In Review' as Status,
      icon: TrendingUp,
      iconColor: 'text-purple-500',
      bg: 'bg-purple-50',
      ring: 'hover:ring-purple-200',
    },
    {
      label: 'Completed',
      value: doneTasks.length,
      status: 'Done' as Status,
      icon: CheckCircle2,
      iconColor: 'text-emerald-500',
      bg: 'bg-emerald-50',
      ring: 'hover:ring-emerald-200',
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            {getGreeting()}! 👋
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Your <span className="font-medium text-slate-700">{workspace}</span> overview for {format(new Date(), 'EEEE, MMMM d')}.
          </p>
        </div>
        <Button size="sm" className="hidden sm:flex bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setCurrentView('tasks')}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Task
        </Button>
      </header>

      {/* Stat Cards — clickable, show status task list */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(({ label, value, status, icon: Icon, iconColor, bg, ring }) => (
          <Card
            key={label}
            onClick={() => setStatusModal(status)}
            className={cn(
              "cursor-pointer hover:shadow-md transition-all duration-200 border-slate-200 hover:ring-2",
              ring
            )}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", bg)}>
                <Icon className={cn("w-5 h-5", iconColor)} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress + Overdue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-6">
            <div className="relative shrink-0">
              <CompletionRing pct={completionPct} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-slate-900">{completionPct}%</span>
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-900">Completion Rate</div>
              <div className="text-sm text-slate-500 mt-0.5">
                {doneTasks.length} of {workspaceTasks.length} tasks done
              </div>
              <div className="mt-2 h-1.5 w-40 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-700"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("border-slate-200", overdueTasks.length > 0 && "border-red-200 bg-red-50/30")}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className={cn("w-4 h-4", overdueTasks.length > 0 ? "text-red-500" : "text-slate-400")} />
              <span className="font-semibold text-slate-900">
                {overdueTasks.length > 0 ? `${overdueTasks.length} Overdue` : 'All on track'}
              </span>
            </div>
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-slate-400">Great work! 🎉</p>
            ) : (
              <div className="space-y-1">
                {overdueTasks.slice(0, 3).map(t => (
                  <div
                    key={t.id}
                    onClick={() => handleTaskClick(t)}
                    className="flex items-center justify-between text-sm cursor-pointer hover:underline text-red-700"
                  >
                    <span className="truncate">{t.title}</span>
                    <span className="text-xs text-red-400 ml-2 shrink-0">
                      {t.dueDate ? format(t.dueDate, 'MMM d') : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Upcoming Tasks */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Upcoming Tasks</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentView('tasks')}>
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {upcomingTasks.length === 0 && (
              <p className="text-sm text-slate-500 py-4 text-center">No upcoming tasks with due dates.</p>
            )}
            {upcomingTasks.map(task => (
              <div
                key={task.id}
                onClick={() => handleTaskClick(task)}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-violet-50/50 hover:border-violet-200 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: settings.statusColors[task.status] ?? '#94a3b8' }} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">{task.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{task.status}</p>
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

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Projects quick access */}
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-violet-500" /> Projects
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentView('tasks')}>
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {workspaceProjects.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-3">No active projects</p>
              )}
              {workspaceProjects.slice(0, 4).map(p => {
                const pTasks = tasks.filter(t => t.projectId === p.id);
                const pDone = pTasks.filter(t => t.status === 'Done');
                const pct = pTasks.length > 0 ? Math.round((pDone.length / pTasks.length) * 100) : 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProjectId(p.id); setCurrentView('tasks'); }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group text-left"
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                      <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden w-full">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{pct}%</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Today's Events */}
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-violet-500" /> Today
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentView('calendar')}>
                Calendar <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {todayEvents.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-3">No events today</p>
              )}
              {todayEvents.map(event => (
                <div key={event.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-8 text-center shrink-0">
                    <span className="text-xs font-semibold text-slate-600">{format(event.startTime, 'h:mm')}</span>
                    <span className="text-[10px] text-slate-400 block">{format(event.startTime, 'a')}</span>
                  </div>
                  <div className="w-px bg-violet-200 self-stretch shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{event.title}</p>
                    <p className="text-xs text-slate-400">
                      {format(event.startTime, 'h:mm a')} – {format(event.endTime, 'h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Status Tasks Modal */}
      {statusModal && (
        <StatusTasksModal
          status={statusModal}
          tasks={workspaceTasks.filter(t => t.status === statusModal)}
          onClose={() => setStatusModal(null)}
          onTaskClick={handleTaskClick}
        />
      )}
    </div>
  );
}
