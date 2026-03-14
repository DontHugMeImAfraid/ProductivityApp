/**
 * TaskCard.tsx
 * Drop-in replacement for the inline task card in Tasks.tsx (board view).
 * 
 * Adds:
 *  - Subtask progress pill  ████░░░░  40%
 *  - Streak counter badge   🔥 12
 *  - Status-colored top border from settings.statusColors
 *  - Overdue indicator
 */

import React from 'react';
import { useAppStore } from '@/store';
import { Task } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Calendar as CalendarIcon, Flame } from 'lucide-react';
import { format, isPast } from 'date-fns';
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
  const pct = Math.round((done / subtasks.length) * 100);
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
        <div
          className="h-full rounded-full bg-indigo-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function TaskCard({ task, isDragging, isSelected, onClick }: TaskCardProps) {
  const settings = useAppStore(s => s.settings);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'High':   return 'bg-red-100 text-red-700 border-red-200';
      case 'Medium': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Low':    return 'bg-zinc-100 text-zinc-700 border-zinc-200';
      default:       return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  const isOverdue = task.dueDate && isPast(task.dueDate) && task.status !== 'Done';
  const statusColor = settings.statusColors?.[task.status] || '#e4e4e7';

  return (
    <Card
      className={cn(
        "shadow-sm cursor-pointer hover:shadow-md transition-all duration-150 border-zinc-200/80 overflow-hidden",
        isDragging ? 'shadow-lg ring-1 ring-indigo-300 rotate-1' : '',
        isSelected ? 'ring-2 ring-indigo-500' : '',
        isOverdue ? 'border-red-200' : ''
      )}
      onClick={onClick}
    >
      {/* Status top-border stripe */}
      <div className="h-0.5 w-full" style={{ backgroundColor: statusColor }} />

      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {settings.enablePriority && (
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border shrink-0", getPriorityColor(task.priority))}>
                {task.priority}
              </Badge>
            )}
            {task.type && task.type !== 'Task' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                {task.type}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Streak counter */}
            {settings.streakTracking && task.streakCount && task.streakCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200">
                <Flame className="w-2.5 h-2.5" />
                {task.streakCount}
              </span>
            )}

            {/* Due date */}
            {task.dueDate && (
              <div className={cn(
                "flex items-center text-[10px]",
                isOverdue ? "text-red-500 font-medium" : "text-zinc-400"
              )}>
                <CalendarIcon className="w-2.5 h-2.5 mr-0.5" />
                {format(task.dueDate, 'MMM d')}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className={cn(
          "font-medium text-sm text-zinc-900 mb-1 leading-snug",
          task.status === 'Done' && "line-through text-zinc-400"
        )}>
          {task.title}
        </h4>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{task.description}</p>
        )}

        {/* Subtask progress pill */}
        <SubtaskProgress taskId={task.id} />

        {/* Impact/Effort chips */}
        {(task.impact !== undefined || task.effort !== undefined) && (
          <div className="flex gap-1.5 mt-2">
            {task.impact !== undefined && settings.enableImpact && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                Impact {task.impact}
              </span>
            )}
            {task.effort !== undefined && settings.enableEffort && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100">
                Effort {task.effort}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
