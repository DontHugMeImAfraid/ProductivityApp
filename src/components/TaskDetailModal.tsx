import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { Task, Status, Priority, TaskType } from '@/types';
import { format } from 'date-fns';
import { X, Calendar as CalendarIcon, Clock, Link as LinkIcon, Trash2, AlignLeft, Layers, GitCommit } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export function TaskDetailModal() {
  const { tasks, selectedTaskId, setSelectedTaskId, updateTask, deleteTask, workspace, settings } = useAppStore();
  
  const task = tasks.find(t => t.id === selectedTaskId);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>('To Do');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [type, setType] = useState<TaskType | ''>('');
  const [parentId, setParentId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [time, setTime] = useState('');
  const [effort, setEffort] = useState('');
  const [impact, setImpact] = useState('');
  const [addToCalendar, setAddToCalendar] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setType(task.type || '');
      setParentId(task.parentId || '');
      setStartDate(task.startDate ? format(task.startDate, 'yyyy-MM-dd') : '');
      setDueDate(task.dueDate ? format(task.dueDate, 'yyyy-MM-dd') : '');
      setTime(task.time || '');
      setEffort(task.effort?.toString() || '');
      setImpact(task.impact?.toString() || '');
      setAddToCalendar(task.addToCalendar || false);
    }
  }, [task]);

  if (!task) return null;

  const handleSave = () => {
    // Validation
    const maxScale = settings.scaleSystem === '1-5' ? 5 : 10;
    const parsedEffort = effort ? Math.min(Math.max(parseInt(effort, 10), 1), maxScale) : undefined;
    const parsedImpact = impact ? Math.min(Math.max(parseInt(impact, 10), 1), maxScale) : undefined;

    const today = format(new Date(), 'yyyy-MM-dd');
    let finalDueDate = dueDate;
    let finalStartDate = startDate;

    if (!settings.allowBackDatingTasks) {
      if (finalDueDate && finalDueDate < today) {
        finalDueDate = today;
      }
      if (finalStartDate && finalStartDate < today) {
        finalStartDate = today;
      }
      if (finalStartDate && finalDueDate && finalDueDate < finalStartDate) {
        finalDueDate = finalStartDate;
      }
    }

    updateTask(task.id, {
      title,
      description,
      status,
      priority: settings.enablePriority ? priority : 'Medium',
      type: type as TaskType || undefined,
      parentId: parentId || undefined,
      startDate: finalStartDate ? new Date(finalStartDate).getTime() : undefined,
      dueDate: finalDueDate ? new Date(finalDueDate).getTime() : undefined,
      time: time || undefined,
      effort: settings.enableEffort ? parsedEffort : undefined,
      impact: settings.enableImpact ? parsedImpact : undefined,
      addToCalendar,
    });
    setSelectedTaskId(null);
  };

  const handleDelete = () => {
    deleteTask(task.id);
    setSelectedTaskId(null);
  };

  const epics = tasks.filter(t => t.workspace === workspace && t.type === 'Epic' && t.id !== task.id);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
        <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-zinc-500">{task.id.slice(0, 8)}</Badge>
            <select 
              className="text-sm font-medium border-none bg-transparent focus:ring-0 cursor-pointer text-zinc-900"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              <option value="Backlog">Backlog</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="In Review">In Review</option>
              <option value="Done">Done</option>
            </select>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setSelectedTaskId(null)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div>
            <Input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-bold border-none px-0 h-auto focus-visible:ring-0 shadow-none placeholder:text-zinc-300"
              placeholder="Task title"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-zinc-500 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Type
                </div>
                <select 
                  className="flex-1 text-sm border border-zinc-200 rounded-md p-2 bg-white"
                  value={type}
                  onChange={(e) => setType(e.target.value as TaskType | '')}
                >
                  <option value="">Standard Task</option>
                  <option value="Epic">Epic</option>
                  <option value="Story">Story</option>
                  <option value="Bug">Bug</option>
                </select>
              </div>

              {type !== 'Epic' && (
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm text-zinc-500 flex items-center gap-2">
                    <GitCommit className="w-4 h-4" /> Parent Epic
                  </div>
                  <select 
                    className="flex-1 text-sm border border-zinc-200 rounded-md p-2 bg-white"
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    <option value="">None</option>
                    {epics.map(epic => (
                      <option key={epic.id} value={epic.id}>{epic.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {settings.enablePriority && (
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm text-zinc-500 flex items-center gap-2">
                    <AlignLeft className="w-4 h-4" /> Priority
                  </div>
                  <select 
                    className="flex-1 text-sm border border-zinc-200 rounded-md p-2 bg-white"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-zinc-500 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" /> Start Date
                </div>
                <Input 
                  type="date" 
                  className="flex-1 h-9"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-zinc-500 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Due Date
                </div>
                <Input 
                  type="date" 
                  className="flex-1 h-9"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-zinc-500 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Time
                </div>
                <Input 
                  type="time" 
                  className="flex-1 h-9"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>

              {settings.enableEffort && (
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm text-zinc-500">Effort (1-{settings.scaleSystem === '1-5' ? '5' : '10'})</div>
                  <Input 
                    type="number" 
                    min="1" max={settings.scaleSystem === '1-5' ? '5' : '10'}
                    className="flex-1 h-9"
                    value={effort}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const max = settings.scaleSystem === '1-5' ? 5 : 10;
                      if (!isNaN(val)) {
                        setEffort(Math.min(Math.max(val, 1), max).toString());
                      } else {
                        setEffort('');
                      }
                    }}
                  />
                </div>
              )}

              {settings.enableImpact && (
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm text-zinc-500">Impact (1-{settings.scaleSystem === '1-5' ? '5' : '10'})</div>
                  <Input 
                    type="number" 
                    min="1" max={settings.scaleSystem === '1-5' ? '5' : '10'}
                    className="flex-1 h-9"
                    value={impact}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const max = settings.scaleSystem === '1-5' ? 5 : 10;
                      if (!isNaN(val)) {
                        setImpact(Math.min(Math.max(val, 1), max).toString());
                      } else {
                        setImpact('');
                      }
                    }}
                  />
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-zinc-500">Add to Calendar</div>
                <input 
                  type="checkbox" 
                  className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500"
                  checked={addToCalendar}
                  onChange={(e) => setAddToCalendar(e.target.checked)}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-zinc-900 mb-2">Description</div>
            <Textarea 
              placeholder="Add a more detailed description..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[150px] resize-y"
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center sticky bottom-0 z-10">
          <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedTaskId(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!title.trim()}>Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
