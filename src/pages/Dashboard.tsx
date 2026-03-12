import React from 'react';
import { useAppStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, Clock, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const { workspace, tasks, notes, setCurrentView, setSelectedNoteId, setSelectedTaskId } = useAppStore();

  const workspaceTasks = tasks.filter(t => t.workspace === workspace);
  const workspaceNotes = notes.filter(n => n.workspace === workspace);

  const todoTasks = workspaceTasks.filter(t => t.status === 'To Do');
  const inProgressTasks = workspaceTasks.filter(t => t.status === 'In Progress');
  const doneTasks = workspaceTasks.filter(t => t.status === 'Done');

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Medium': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Low': return 'bg-zinc-100 text-zinc-700 border-zinc-200';
      default: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  const handleTaskClick = (id: string) => {
    setSelectedTaskId(id);
    setCurrentView('tasks');
  };

  const handleNoteClick = (id: string) => {
    setSelectedNoteId(id);
    setCurrentView('notes');
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">Good morning!</h1>
        <p className="text-zinc-500 mt-1 text-sm md:text-base">Here's an overview of your {workspace.toLowerCase()} workspace.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Total Tasks</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspaceTasks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">In Progress</CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">To Do</CardTitle>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todoTasks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Notes</CardTitle>
            <FileText className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspaceNotes.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workspaceTasks.slice(0, 5).map(task => (
                <div 
                  key={task.id} 
                  onClick={() => handleTaskClick(task.id)}
                  className="flex items-start justify-between p-3 rounded-lg border border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer active:scale-[0.99]"
                >
                  <div>
                    <p className="font-medium text-sm text-zinc-900">{task.title}</p>
                    <p className="text-xs text-zinc-500 mt-1">{task.status}</p>
                  </div>
                  <Badge variant="outline" className={cn("border", getPriorityColor(task.priority))}>{task.priority}</Badge>
                </div>
              ))}
              {workspaceTasks.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-4">No tasks found.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workspaceNotes.slice(0, 5).map(note => (
                <div 
                  key={note.id} 
                  onClick={() => handleNoteClick(note.id)}
                  className="p-3 rounded-lg border border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer active:scale-[0.99]"
                >
                  <p className="font-medium text-sm text-zinc-900">{note.title}</p>
                  <p className="text-xs text-zinc-500 mt-1">Updated {format(note.updatedAt, 'MMM d, yyyy')}</p>
                </div>
              ))}
              {workspaceNotes.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-4">No notes found.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
