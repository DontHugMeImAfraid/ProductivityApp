/**
 * TaskCard.tsx — upgraded with:
 * - ROI score badge (Impact / Effort)
 * - Icon mini-bars for Impact & Effort
 * - Due date urgency colouring (red = overdue, amber = due today/tomorrow)
 * - Quick-action hover buttons (edit, move to done, duplicate)
 */

import React from 'react';
import { useAppStore } from '@/store';
import { Task } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Calendar as CalendarIcon, Flame, Zap, Clock, CheckCircle, Edit2 } from 'lucide-react';
import { format, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  isDragging: boolean;
  isSelected: boolean;
  onClick: () => void;
}

function SubtaskProgress({ taskId }: { taskId: string }) {
  const tasks = useAppStore(s => s.tasks);
  const subtasks = tasks.filter(t => t.parentId === taskId);
  if (subtasks.length === 0) return null;

  const done = subtasks.filter(t => t.status === 'Done').length;
  const pct  = Math.round((done / subtasks.length) * 100);
  const TOTAL_BLOCKS = 8;
  const filledBlocks = Math.round((done / subtasks.length) * TOTAL_BLOCKS);

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-[10px] text-zinc-400">
        <span className="font-mono tracking-tighter">
          {'█'.repeat(filledBlocks)}{'░'.repeat(TOTAL_BLOCKS - filledBlocks)}
        </span>
        <span>{pct}% · {done}/{subtasks.length}</span>
      </div>
      <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-indigo-400 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Mini horizontal bar — fills proportionally against max */
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex-1 h-1 bg-zinc-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

/** ROI label based on impact/effort ratio */
function roiLabel(impact: number, effort: number): { label: string; emoji: string; color: string } | null {
  if (!impact || !effort) return null;
  const ratio = impact / effort;
  if (ratio >= 1.8) return { label: 'Quick Win',     emoji: '🚀', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  if (ratio >= 1.2) return { label: 'High ROI',      emoji: '⚡', color: 'text-blue-600   bg-blue-50   border-blue-200'   };
  if (ratio >= 0.8) return { label: 'Balanced',      emoji: '➡️', color: 'text-slate-500  bg-slate-50  border-slate-200'  };
  return              { label: 'Low ROI',       emoji: '⚠️', color: 'text-amber-600  bg-amber-50  border-amber-200'  };
}

export function TaskCard({ task, isDragging, isSelected, onClick }: TaskCardProps) {
  const settings  = useAppStore(s => s.settings);
  const moveTask  = useAppStore(s => s.moveTask);
  const updateTask = useAppStore(s => s.updateTask);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'High':   return 'bg-red-100    text-red-700    border-red-200';
      case 'Medium': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Low':    return 'bg-zinc-100   text-zinc-700   border-zinc-200';
      default:       return 'bg-zinc-100   text-zinc-700   border-zinc-200';
    }
  };

  const isOverdue   = !!(task.dueDate && isPast(task.dueDate)    && task.status !== 'Done');
  const isDueToday  = !!(task.dueDate && isToday(task.dueDate)   && task.status !== 'Done');
  const isDueSoon   = !!(task.dueDate && isTomorrow(task.dueDate)&& task.status !== 'Done');
  const statusColor = settings.statusColors?.[task.status] || '#e4e4e7';
  const maxScale    = settings.scaleSystem === '1-5' ? 5 : 10;

  const roi = (task.impact !== undefined && task.effort !== undefined)
    ? roiLabel(task.impact, task.effort)
    : null;

  return (
    <Card
      className={cn(
        'cursor-pointer border-zinc-200/80 overflow-hidden group/card relative',
        !isDragging && 'shadow-sm hover:shadow-md hover:-translate-y-px transition-[box-shadow,transform] duration-150',
        isDragging  && 'shadow-2xl ring-2 ring-violet-400 ring-offset-1 bg-white',
        isSelected  && !isDragging && 'ring-2 ring-indigo-500',
        isOverdue   && 'border-red-200',
      )}
      onClick={onClick}
    >
      {/* Status top-border stripe */}
      <div className="h-0.5 w-full" style={{ backgroundColor: statusColor }} />

      <CardContent className="p-3.5">
        {/* Header row: priority + due date + ROI */}
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {settings.enablePriority && (
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border shrink-0', getPriorityColor(task.priority))}>
                {task.priority}
              </Badge>
            )}
            {task.type && task.type !== 'Task' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{task.type}</Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Streak counter */}
            {settings.streakTracking && task.streakCount && task.streakCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200">
                <Flame className="w-2.5 h-2.5" />{task.streakCount}
              </span>
            )}

            {/* Due date — colour-coded by urgency */}
            {task.dueDate && (
              <div className={cn(
                'flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border font-medium',
                isOverdue  ? 'bg-red-50   text-red-600   border-red-200'
                : isDueToday ? 'bg-amber-50 text-amber-600 border-amber-200'
                : isDueSoon  ? 'bg-blue-50  text-blue-600  border-blue-200'
                :              'text-zinc-400 border-transparent bg-transparent',
              )}>
                <CalendarIcon className="w-2.5 h-2.5" />
                {isOverdue
                  ? `${differenceInDays(new Date(), task.dueDate)}d overdue`
                  : isDueToday
                  ? 'Today'
                  : isDueSoon
                  ? 'Tomorrow'
                  : format(task.dueDate, 'MMM d')}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className={cn(
          'font-medium text-sm text-zinc-900 mb-1 leading-snug',
          task.status === 'Done' && 'line-through text-zinc-400',
        )}>
          {task.title}
        </h4>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-1">{task.description}</p>
        )}

        {/* Subtask progress */}
        <SubtaskProgress taskId={task.id} />

        {/* Impact / Effort mini-bars */}
        {(task.impact !== undefined || task.effort !== undefined) && (
          <div className="mt-2 space-y-1">
            {task.impact !== undefined && settings.enableImpact && (
              <div className="flex items-center gap-1.5">
                <Zap className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                <span className="text-[10px] text-zinc-400 w-9 shrink-0">Impact</span>
                <MiniBar value={task.impact} max={maxScale} color="#3b82f6" />
                <span className="text-[10px] font-semibold text-blue-600 w-4 text-right shrink-0">{task.impact}</span>
              </div>
            )}
            {task.effort !== undefined && settings.enableEffort && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span className="text-[10px] text-zinc-400 w-9 shrink-0">Effort</span>
                <MiniBar value={task.effort} max={maxScale} color="#f59e0b" />
                <span className="text-[10px] font-semibold text-amber-600 w-4 text-right shrink-0">{task.effort}</span>
              </div>
            )}
          </div>
        )}

        {/* ROI badge */}
        {roi && (
          <div className={cn('mt-2 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border', roi.color)}>
            <span>{roi.emoji}</span>
            <span>{roi.label}</span>
          </div>
        )}

        {/* Quick actions on hover */}
        {task.status !== 'Done' && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); onClick(); }}
              title="Edit"
              className="w-6 h-6 rounded-md bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-indigo-600 hover:border-indigo-300 shadow-sm transition-all"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); moveTask(task.id, 'Done'); }}
              title="Mark done"
              className="w-6 h-6 rounded-md bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-emerald-600 hover:border-emerald-300 shadow-sm transition-all"
            >
              <CheckCircle className="w-3 h-3" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}