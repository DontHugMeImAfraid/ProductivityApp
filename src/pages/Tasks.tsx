import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '@/store';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Status, Task, Priority, ProjectColumn } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plus, MoreVertical, Calendar as CalendarIcon,
  LayoutGrid, List, LayoutTemplate, Layers, GitCommit,
  FolderKanban, ChevronRight, Eye, CheckCircle2, GripVertical,
  Search, X,
} from 'lucide-react';
import { format, addDays, startOfWeek, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TaskCard } from './TaskCard';
import { Confetti } from './Confetti';
import { ProjectSelector } from '@/components/ProjectSelector';
import { ColumnHeaderMenu } from '@/components/ColumnHeaderMenu';

type TaskView = 'board' | 'list' | 'matrix' | 'backlog' | 'timeline';

// ── Helper: project panel overlay ─────────────────────────────────────────────

function ProjectPanelOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative ml-0 w-80 bg-white border-r border-slate-200 h-full shadow-2xl p-5 overflow-y-auto animate-in slide-in-from-left duration-250">
        <ProjectSelector onClose={onClose} />
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function Tasks() {
  const {
    workspace, tasks, moveTask, addTask, selectedTaskId, setSelectedTaskId,
    reorderTasks, updateTask, settings, projects, selectedProjectId,
    setSelectedProjectId, projectColumns, updateProjectColumn,
    reorderProjectColumns, addProjectColumn,
  } = useAppStore();

  const [isAddingTask,         setIsAddingTask]         = useState<string | null>(null);
  const [newTaskTitle,         setNewTaskTitle]         = useState('');
  const [newTaskPriority,      setNewTaskPriority]      = useState<Priority>('Medium');
  const [newTaskTime,          setNewTaskTime]          = useState('');
  const [newTaskAddToCalendar, setNewTaskAddToCalendar] = useState(false);
  const [currentTaskView,      setCurrentTaskView]      = useState<TaskView>('board');
  const [showProjectPanel,     setShowProjectPanel]     = useState(false);
  const [showConfetti,         setShowConfetti]         = useState(false);
  const [addingColumn,         setAddingColumn]         = useState(false);
  const [newColLabel,          setNewColLabel]          = useState('');
  const [dragColFrom,          setDragColFrom]          = useState<number | null>(null);
  // ── New: filter state ──────────────────────────────────────────────────────
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSearch,   setFilterSearch]   = useState('');

  const currentProject    = projects.find(p => p.id === selectedProjectId);
  const workspaceProjects = projects.filter(p => p.workspace === workspace);

  const allCols     = projectColumns.filter(c => c.projectId === selectedProjectId).sort((a, b) => a.order - b.order);
  const visibleCols = allCols.filter(c => !c.isHidden);
  const hiddenCols  = allCols.filter(c => c.isHidden);

  // Apply filters
  const workspaceTasks = tasks.filter(t => {
    if (t.workspace     !== workspace)         return false;
    if (t.projectId     !== selectedProjectId) return false;
    if (settings.hideCompletedTasks && t.status === 'Done') return false;
    if (filterPriority && t.priority !== filterPriority)    return false;
    if (filterSearch   && !t.title.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  // Keyboard shortcut: N = open add-task in first visible column
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const firstCol = visibleCols[0];
        if (firstCol) setIsAddingTask(firstCol.id);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visibleCols]);

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;

    if (type === 'column') {
      reorderProjectColumns(selectedProjectId!, source.index, destination.index);
      return;
    }

    if (destination.droppableId === source.droppableId && destination.index !== source.index) {
      reorderTasks(source.index, destination.index, source.droppableId as Status);
      return;
    }

    if (destination.droppableId !== source.droppableId) {
      if (destination.droppableId === 'Done' && settings.celebrationEffects) setShowConfetti(true);
      moveTask(draggableId, destination.droppableId as Status);
    }
  };

  // ── Add task ────────────────────────────────────────────────────────────────

  const handleAddTask = (col: ProjectColumn) => {
    if (!newTaskTitle.trim()) { setIsAddingTask(null); return; }

    let finalAddToCalendar = newTaskAddToCalendar;
    if (settings.taskToCalendarAutomation === 'always') finalAddToCalendar = true;

    addTask({
      title: newTaskTitle,
      status: col.status,
      priority: newTaskPriority,
      workspace,
      projectId: selectedProjectId ?? undefined,
      time: newTaskTime || undefined,
      addToCalendar: finalAddToCalendar,
    });
    setNewTaskTitle('');
    setNewTaskPriority('Medium');
    setNewTaskTime('');
    setNewTaskAddToCalendar(false);
    setIsAddingTask(null);
  };

  const handleAddColumn = () => {
    if (!newColLabel.trim() || !selectedProjectId) return;
    addProjectColumn({
      projectId: selectedProjectId,
      status: 'To Do',
      label: newColLabel.trim(),
      color: '#6366f1',
      isHidden: false,
      order: allCols.length,
    });
    setNewColLabel('');
    setAddingColumn(false);
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'Urgent': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'High':   return 'bg-red-100    text-red-700    border-red-200';
      case 'Medium': return 'bg-amber-100  text-amber-700  border-amber-200';
      case 'Low':    return 'bg-slate-100  text-slate-700  border-slate-200';
      default:       return 'bg-slate-100  text-slate-700  border-slate-200';
    }
  };

  // ── Board view ──────────────────────────────────────────────────────────────

  const renderBoardView = () => (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="all-columns" direction="horizontal" type="column">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex gap-4 h-full overflow-x-auto pb-4 items-start"
          >
            {visibleCols.map((col, index) => {
              const colTasks = workspaceTasks
                .filter(t => t.status === col.status)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

              return (
                <Draggable key={col.id} draggableId={`col-${col.id}`} index={index}>
                  {(colProvided, colSnapshot) => (
                    <div
                      ref={colProvided.innerRef}
                      {...colProvided.draggableProps}
                      className={cn(
                        'flex flex-col gap-2 rounded-2xl p-3 min-w-[280px] max-w-[320px] flex-shrink-0 group/col',
                        !colSnapshot.isDragging && 'bg-slate-100/60',
                        colSnapshot.isDragging  && 'bg-white shadow-2xl ring-1 ring-slate-200',
                      )}
                      style={{
                        ...colProvided.draggableProps.style,
                        minWidth: col.width ? `${col.width}px` : '280px',
                      }}
                    >
                      {/* Column header */}
                      <div className="flex items-center justify-between px-1 py-0.5">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            {...colProvided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing opacity-0 group-hover/col:opacity-40 hover:!opacity-70 transition-opacity"
                          >
                            <GripVertical className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                          {/* Colour dot */}
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                          {/* Label — bolder */}
                          <h3 className="font-bold text-sm text-slate-800 truncate">{col.label}</h3>
                          {/* Count badge — coloured pill */}
                          <span
                            className="ml-auto shrink-0 min-w-[20px] text-center text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: col.color }}
                          >
                            {colTasks.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <ColumnHeaderMenu column={col} />
                        </div>
                      </div>

                      {/* Task drop zone */}
                      <Droppable droppableId={col.status} type="task">
                        {(taskProvided, taskSnapshot) => (
                          <div
                            ref={taskProvided.innerRef}
                            {...taskProvided.droppableProps}
                            className={cn(
                              'flex flex-col gap-2 flex-1 min-h-[80px] rounded-xl p-1 transition-colors duration-150',
                              taskSnapshot.isDraggingOver
                                ? 'bg-violet-50 ring-2 ring-violet-200 ring-inset'
                                : 'bg-transparent',
                            )}
                          >
                            {colTasks.map((task, i) => (
                              <Draggable key={task.id} draggableId={task.id} index={i}>
                                {(taskDrag, taskSnap) => (
                                  <div
                                    ref={taskDrag.innerRef}
                                    {...taskDrag.draggableProps}
                                    {...taskDrag.dragHandleProps}
                                    style={taskDrag.draggableProps.style}
                                  >
                                    <TaskCard
                                      task={task}
                                      isDragging={taskSnap.isDragging}
                                      isSelected={selectedTaskId === task.id}
                                      onClick={() => setSelectedTaskId(task.id)}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {taskProvided.placeholder}

                            {/* Inline add task */}
                            {isAddingTask === col.id ? (
                              <Card className="border-violet-200 shadow-sm bg-white">
                                <CardContent className="p-3 space-y-2.5">
                                  <Input
                                    autoFocus
                                    placeholder="Task title…"
                                    value={newTaskTitle}
                                    onChange={e => setNewTaskTitle(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter')  handleAddTask(col);
                                      if (e.key === 'Escape') setIsAddingTask(null);
                                    }}
                                    className="text-sm h-8"
                                  />
                                  {settings.enablePriority && (
                                    <div className="flex gap-1 flex-wrap">
                                      {(['Low', 'Medium', 'High', 'Urgent'] as Priority[]).map(p => (
                                        <button
                                          key={p}
                                          onClick={() => setNewTaskPriority(p)}
                                          className={cn(
                                            'px-2 py-0.5 rounded-md text-[10px] font-medium border transition-all',
                                            newTaskPriority === p
                                              ? getPriorityColor(p) + ' border-transparent'
                                              : 'border-slate-200 text-slate-400',
                                          )}
                                        >
                                          {p}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex justify-end gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => setIsAddingTask(null)} className="h-7 text-xs">Cancel</Button>
                                    <Button size="sm" onClick={() => handleAddTask(col)} className="h-7 text-xs">Add</Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ) : (
                              <button
                                onClick={() => setIsAddingTask(col.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-all text-sm"
                              >
                                <Plus className="w-3.5 h-3.5" /> Add task
                              </button>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}

            {/* Hidden column chips */}
            {hiddenCols.map(col => (
              <button
                key={col.id}
                onClick={() => updateProjectColumn(col.id, { isHidden: false })}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-all h-fit"
                title={`Show ${col.label}`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="text-xs">{col.label}</span>
              </button>
            ))}

            {/* Add column */}
            {addingColumn ? (
              <div className="flex-shrink-0 flex flex-col gap-2 p-3 bg-white border border-violet-200 rounded-2xl w-52 animate-in fade-in">
                <Input
                  autoFocus
                  placeholder="Section name…"
                  value={newColLabel}
                  onChange={e => setNewColLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') setAddingColumn(false); }}
                  className="text-sm h-8"
                />
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={handleAddColumn} disabled={!newColLabel.trim()} className="flex-1 h-7 text-xs">Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingColumn(false)} className="flex-1 h-7 text-xs">Cancel</Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-white/60 border border-dashed border-slate-300 rounded-2xl text-sm text-slate-400 hover:text-slate-600 hover:border-slate-400 hover:bg-white transition-all h-fit"
              >
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            )}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );

  // ── List view ────────────────────────────────────────────────────────────────

  const renderListView = () => (
    <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200 sticky top-0">
          <tr>
            <th className="px-4 py-3 font-semibold">Title</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Priority</th>
            <th className="px-4 py-3 font-semibold">Due Date</th>
          </tr>
        </thead>
        <tbody>
          {workspaceTasks.map(task => (
            <tr
              key={task.id}
              onClick={() => setSelectedTaskId(task.id)}
              className={cn(
                'border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors',
                selectedTaskId === task.id ? 'bg-violet-50/50' : '',
              )}
            >
              <td className="px-4 py-3 font-medium text-slate-900">{task.title}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-1 rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: `${settings.statusColors[task.status] ?? '#e4e4e7'}20`,
                    color: settings.statusColors[task.status] ?? '#52525b',
                  }}>
                  {task.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={cn('text-[10px] border', getPriorityColor(task.priority))}>
                  {task.priority}
                </Badge>
              </td>
              <td className="px-4 py-3 text-slate-500">
                {task.dueDate ? format(task.dueDate, 'MMM d') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ── Backlog view ─────────────────────────────────────────────────────────────

  const renderBacklogView = () => {
    const statuses: Status[] = ['To Do', 'In Progress', 'In Review', 'Done'];
    return (
      <div className="space-y-3 overflow-y-auto h-full pb-4">
        {statuses.map(s => {
          const statusTasks = workspaceTasks.filter(t => t.status === s);
          return (
            <div key={s} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: settings.statusColors[s] ?? '#94a3b8' }} />
                  <span className="text-sm font-semibold text-slate-800">{s}</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: settings.statusColors[s] ?? '#94a3b8' }}>
                    {statusTasks.length}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {statusTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="w-1.5 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: settings.statusColors[task.status] ?? '#94a3b8' }} />
                    <span className="flex-1 text-sm font-medium text-slate-900 truncate">{task.title}</span>
                    <Badge variant="outline" className={cn('text-[10px] border shrink-0', getPriorityColor(task.priority))}>
                      {task.priority}
                    </Badge>
                    {task.dueDate && (
                      <span className="text-xs text-slate-400 shrink-0">{format(task.dueDate, 'MMM d')}</span>
                    )}
                  </div>
                ))}
                {statusTasks.length === 0 && (
                  <p className="px-4 py-3 text-xs text-slate-400 italic">No tasks</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── No project ───────────────────────────────────────────────────────────────

  if (!currentProject) {
    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
          <FolderKanban className="w-12 h-12 opacity-30" />
          <p className="text-sm">No project selected</p>
          <Button size="sm" onClick={() => setShowProjectPanel(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Project
          </Button>
        </div>
        {showProjectPanel && <ProjectPanelOverlay onClose={() => setShowProjectPanel(false)} />}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-4">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowProjectPanel(v => !v)}
            className="flex items-center gap-2.5 px-3 py-2 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all group"
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentProject.color }} />
            <span className="text-sm font-semibold text-slate-900">{currentProject.name}</span>
            {currentProject.isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
            <ChevronRight className={cn(
              'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
              showProjectPanel && 'rotate-90',
            )} />
          </button>
          <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-500">
            <span>{workspaceTasks.length} tasks</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {([
              { id: 'board',   icon: LayoutGrid, title: 'Board'   },
              { id: 'list',    icon: List,        title: 'List'    },
              { id: 'backlog', icon: Layers,      title: 'Backlog' },
            ] as const).map(({ id, icon: Icon, title }) => (
              <Button
                key={id}
                variant="ghost"
                size="sm"
                title={title}
                className={cn('h-8 px-2.5 rounded-lg transition-all', currentTaskView === id && 'bg-white shadow-sm')}
                onClick={() => setCurrentTaskView(id as TaskView)}
              >
                <Icon className="w-4 h-4" />
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-48 max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
          />
          {filterSearch && (
            <button
              onClick={() => setFilterSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Priority chips */}
        <div className="flex gap-1 flex-wrap">
          {(['', 'Urgent', 'High', 'Medium', 'Low'] as const).map(p => (
            <button
              key={p}
              onClick={() => setFilterPriority(prev => prev === p ? '' : p)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                filterPriority === p && p !== ''
                  ? getPriorityColor(p)
                  : p === '' && filterPriority === ''
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700',
              )}
            >
              {p || 'All'}
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {(filterPriority || filterSearch) && (
          <button
            onClick={() => { setFilterPriority(''); setFilterSearch(''); }}
            className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        {/* Keyboard hint */}
        <span className="text-[10px] text-slate-400 ml-auto hidden sm:block">
          <kbd className="bg-slate-100 px-1.5 py-0.5 rounded font-mono border border-slate-200">N</kbd> new task
        </span>
      </div>

      {/* ── Project panel slide-out ───────────────────────────────────── */}
      {showProjectPanel && <ProjectPanelOverlay onClose={() => setShowProjectPanel(false)} />}

      {/* ── Views ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {currentTaskView === 'board'   && renderBoardView()}
        {currentTaskView === 'list'    && renderListView()}
        {currentTaskView === 'backlog' && renderBacklogView()}
      </div>

      {selectedTaskId && <TaskDetailModal />}
      {showConfetti   && <Confetti onDone={() => setShowConfetti(false)} />}
    </div>
  );
}