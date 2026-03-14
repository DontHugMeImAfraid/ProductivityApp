import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/store';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Status, Task, Priority } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, MoreVertical, Calendar as CalendarIcon, LayoutGrid, List, LayoutTemplate, Layers, GitCommit } from 'lucide-react';
import { format, addDays, startOfWeek, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TaskCard } from './TaskCard';
import { Confetti } from './Confetti';

const COLUMNS: Status[] = ['To Do', 'In Progress', 'In Review', 'Done'];
type TaskView = 'board' | 'list' | 'matrix' | 'backlog' | 'timeline' | 'calendar';

export function Tasks() {
  const { workspace, tasks, moveTask, addTask, selectedTaskId, setSelectedTaskId, reorderTasks, updateTask, settings } = useAppStore();
  const [isAddingTask, setIsAddingTask] = useState<Status | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('Medium');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskAddToCalendar, setNewTaskAddToCalendar] = useState(false);
  const [currentTaskView, setCurrentTaskView] = useState<TaskView>('board');
  const [timelineScale, setTimelineScale] = useState<'weeks' | 'months'>('weeks');
  const [showConfetti, setShowConfetti] = useState(false);

  const workspaceTasks = tasks.filter(t => {
    if (t.workspace !== workspace) return false;
    if (settings.hideCompletedTasks && t.status === 'Done') return false;
    return true;
  });

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    if (destination.droppableId === source.droppableId) {
      if (destination.index !== source.index) {
        reorderTasks(source.index, destination.index, source.droppableId as Status);
      }
      return;
    }

    if (destination.droppableId === 'Done') {
      if (settings.celebrationEffects) setShowConfetti(true);
      const task = tasks.find(t => t.id === draggableId);
      if (task?.recurringInterval) {
        updateTask(draggableId, { streakCount: (task.streakCount || 0) + 1 });
      }
    }

    moveTask(draggableId, destination.droppableId as Status);
  };

  const handleAddTask = (status: Status) => {
    if (!newTaskTitle.trim()) {
      setIsAddingTask(null);
      return;
    }

    let finalAddToCalendar = newTaskAddToCalendar;
    if (settings.taskToCalendarAutomation === 'always') {
      finalAddToCalendar = true;
    } else if (settings.taskToCalendarAutomation === 'if-time') {
      finalAddToCalendar = !!newTaskTime;
    } else if (settings.taskToCalendarAutomation === 'never') {
      finalAddToCalendar = false;
    }

    addTask({
      title: newTaskTitle,
      status,
      priority: settings.enablePriority ? newTaskPriority : 'Medium',
      workspace,
      time: newTaskTime || undefined,
      addToCalendar: finalAddToCalendar,
    });
    setNewTaskTitle('');
    setNewTaskPriority('Medium');
    setNewTaskTime('');
    setNewTaskAddToCalendar(false);
    setIsAddingTask(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Medium': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Low': return 'bg-zinc-100 text-zinc-700 border-zinc-200';
      default: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  const renderBoardView = () => (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex-1 flex gap-4 md:gap-6 overflow-x-auto pb-4 snap-x">
        {COLUMNS.filter(col => !(settings.hideCompletedTasks && col === 'Done')).map((status) => {
          const columnTasks = workspaceTasks.filter(t => t.status === status).sort((a, b) => (a.order || 0) - (b.order || 0));
          
          return (
            <div key={status} className="flex-shrink-0 w-[85vw] sm:w-80 flex flex-col bg-zinc-50/50 rounded-xl border border-zinc-200 snap-center">
              <div 
                className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 rounded-t-xl"
                style={{ borderTop: `3px solid ${settings.statusColors[status] || '#e4e4e7'}` }}
              >
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: settings.statusColors[status] || '#e4e4e7' }} />
                  {status}
                  <span className="bg-zinc-200 text-zinc-600 text-xs px-2 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </h3>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>

              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-3 space-y-3 overflow-y-auto min-h-[150px] ${
                      snapshot.isDraggingOver ? 'bg-zinc-100/50' : ''
                    }`}
                  >
                    {columnTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{ ...provided.draggableProps.style }}
                          >
                            <TaskCard
                              task={task}
                              isDragging={snapshot.isDragging}
                              isSelected={selectedTaskId === task.id}
                              onClick={() => setSelectedTaskId(task.id)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    
                    {isAddingTask === status ? (
                      <Card className="border-indigo-200 shadow-sm">
                        <CardContent className="p-3 space-y-3">
                          <Input 
                            autoFocus
                            placeholder="Task title..." 
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddTask(status);
                              if (e.key === 'Escape') setIsAddingTask(null);
                            }}
                          />
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center gap-2">
                              {settings.enablePriority && (
                                <select 
                                  className="text-xs border border-zinc-200 rounded p-1.5 bg-white flex-1"
                                  value={newTaskPriority}
                                  onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                                >
                                  <option value="Low">Low</option>
                                  <option value="Medium">Medium</option>
                                  <option value="High">High</option>
                                  <option value="Urgent">Urgent</option>
                                </select>
                              )}
                              <Input 
                                type="time"
                                className="text-xs h-7 flex-1 px-2"
                                value={newTaskTime}
                                onChange={(e) => setNewTaskTime(e.target.value)}
                              />
                            </div>
                            {settings.taskToCalendarAutomation === 'prompt' && (
                              <label className="flex items-center gap-2 text-xs text-zinc-600">
                                <input 
                                  type="checkbox" 
                                  className="w-3 h-3 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500"
                                  checked={newTaskAddToCalendar}
                                  onChange={(e) => setNewTaskAddToCalendar(e.target.checked)}
                                />
                                Add to Calendar
                              </label>
                            )}
                            <div className="flex justify-end gap-1 mt-1">
                              <Button size="sm" variant="ghost" onClick={() => setIsAddingTask(null)}>Cancel</Button>
                              <Button size="sm" onClick={() => handleAddTask(status)}>Add</Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start text-zinc-500 hover:text-zinc-900"
                        onClick={() => setIsAddingTask(status)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Task
                      </Button>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );

  const renderListView = () => (
    <div className="flex-1 bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {workspaceTasks.map(task => (
              <tr 
                key={task.id} 
                className={cn(
                  "border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer transition-colors",
                  selectedTaskId === task.id ? "bg-indigo-50/50" : ""
                )}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <td className="px-4 py-3 font-medium text-zinc-900">{task.title}</td>
                <td className="px-4 py-3">
                  <span 
                    className="px-2 py-1 rounded-md text-xs font-medium"
                    style={{ 
                      backgroundColor: `${settings.statusColors[task.status] || '#e4e4e7'}20`,
                      color: settings.statusColors[task.status] || '#52525b'
                    }}
                  >
                    {task.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={cn("text-[10px] border", getPriorityColor(task.priority))}>
                    {task.priority}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {task.dueDate ? format(task.dueDate, 'MMM d, yyyy') : '-'}
                </td>
              </tr>
            ))}
            {workspaceTasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No tasks found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMatrixView = () => (
    <div className="flex-1 bg-white border border-zinc-200 rounded-xl p-6 flex flex-col">
      <h3 className="text-lg font-semibold mb-4">Effort vs. Impact Matrix</h3>
      <div className="flex-1 relative border-l-2 border-b-2 border-zinc-300 ml-8 mb-8">
        <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-sm font-medium text-zinc-500 tracking-widest">IMPACT</div>
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm font-medium text-zinc-500 tracking-widest">EFFORT</div>
        
        <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-zinc-200"></div>
        <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-zinc-200"></div>
        
        <div className="absolute top-4 left-4 text-xs text-zinc-400 font-medium">Quick Wins</div>
        <div className="absolute top-4 right-4 text-xs text-zinc-400 font-medium">Major Projects</div>
        <div className="absolute bottom-4 left-4 text-xs text-zinc-400 font-medium">Fill-ins</div>
        <div className="absolute bottom-4 right-4 text-xs text-zinc-400 font-medium">Thankless Tasks</div>

        {workspaceTasks.map(task => {
          if (task.effort === undefined || task.impact === undefined) return null;
          const left = `${(task.effort / 10) * 100}%`;
          const bottom = `${(task.impact / 10) * 100}%`;
          
          return (
            <div 
              key={task.id}
              className="absolute w-4 h-4 -ml-2 -mb-2 rounded-full bg-indigo-500 shadow-sm cursor-pointer hover:scale-150 transition-transform group"
              style={{ left, bottom }}
              onClick={() => setSelectedTaskId(task.id)}
            >
              <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-zinc-900 text-white text-xs p-2 rounded shadow-lg z-10">
                <p className="font-semibold">{task.title}</p>
                <p className="text-zinc-300">Effort: {task.effort} | Impact: {task.impact}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderBacklogView = () => {
    const backlogTasks = workspaceTasks.filter(t => t.status === 'Backlog').sort((a, b) => (a.order || 0) - (b.order || 0));
    const sprintTasks = workspaceTasks.filter(t => t.status !== 'Backlog' && t.status !== 'Done').sort((a, b) => (a.order || 0) - (b.order || 0));

    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
          {/* Active Sprint */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex justify-between items-center">
              <h3 className="font-semibold text-zinc-900">Current Sprint</h3>
              <Badge variant="secondary">{sprintTasks.length} issues</Badge>
            </div>
            <Droppable droppableId="To Do">
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className={cn("p-2 min-h-[100px]", snapshot.isDraggingOver && "bg-zinc-50")}>
                  {sprintTasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            "flex items-center justify-between p-3 mb-2 bg-white border border-zinc-200 rounded-lg shadow-sm hover:border-zinc-300 transition-colors",
                            snapshot.isDragging && "shadow-md ring-1 ring-zinc-300"
                          )}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={cn("w-16 justify-center border", getPriorityColor(task.priority))}>{task.priority}</Badge>
                            <span className="font-medium text-sm text-zinc-900">{task.title}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-1 rounded">{task.status}</span>
                            {task.effort && <span className="text-xs font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">{task.effort}</span>}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* Backlog */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex justify-between items-center">
              <h3 className="font-semibold text-zinc-900">Backlog</h3>
              <Badge variant="secondary">{backlogTasks.length} issues</Badge>
            </div>
            <Droppable droppableId="Backlog">
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className={cn("p-2 min-h-[100px]", snapshot.isDraggingOver && "bg-zinc-50")}>
                  {backlogTasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            "flex items-center justify-between p-3 mb-2 bg-white border border-zinc-200 rounded-lg shadow-sm hover:border-zinc-300 transition-colors",
                            snapshot.isDragging && "shadow-md ring-1 ring-zinc-300"
                          )}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={cn("w-16 justify-center border", getPriorityColor(task.priority))}>{task.priority}</Badge>
                            <span className="font-medium text-sm text-zinc-900">{task.title}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            {task.effort && <span className="text-xs font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">{task.effort}</span>}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  
                  {isAddingTask === 'Backlog' ? (
                    <div className="p-2 border border-indigo-200 rounded-lg bg-indigo-50/30">
                      <Input 
                        autoFocus
                        placeholder="What needs to be done?" 
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTask('Backlog');
                          if (e.key === 'Escape') setIsAddingTask(null);
                        }}
                        className="mb-2"
                      />
                      <div className="flex justify-between">
                        <select 
                          className="text-xs border border-zinc-200 rounded p-1 bg-white"
                          value={newTaskPriority}
                          onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setIsAddingTask(null)}>Cancel</Button>
                          <Button size="sm" onClick={() => handleAddTask('Backlog')}>Add</Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button variant="ghost" className="w-full justify-start text-zinc-500 mt-2" onClick={() => setIsAddingTask('Backlog')}>
                      <Plus className="w-4 h-4 mr-2" /> Create issue
                    </Button>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        </div>
      </DragDropContext>
    );
  };

  const renderTimelineView = () => {
    const today = new Date();
    const startDate = startOfWeek(today);
    const days = Array.from({ length: 14 }).map((_, i) => addDays(startDate, i));
    
    const tasksWithDates = workspaceTasks.filter(t => t.startDate && t.dueDate);

    // Group tasks
    const epics = tasksWithDates.filter(t => t.type === 'Epic');
    const standaloneTasks = tasksWithDates.filter(t => t.type !== 'Epic' && !t.parentId);

    const renderTaskRow = (task: Task, isChild: boolean = false) => {
      const taskStart = new Date(task.startDate!);
      const taskEnd = new Date(task.dueDate!);
      
      const startDiff = differenceInDays(taskStart, startDate);
      const duration = differenceInDays(taskEnd, taskStart) + 1;
      
      const leftPercent = Math.max(0, (startDiff / 14) * 100);
      const widthPercent = Math.min(100 - leftPercent, (duration / 14) * 100);
      
      const isVisible = leftPercent < 100 && leftPercent + widthPercent > 0;

      return (
        <div key={task.id} className="flex border-b border-zinc-100 hover:bg-zinc-50 group">
          <div 
            className={cn(
              "w-64 flex-shrink-0 border-r border-zinc-200 p-3 text-sm truncate flex items-center gap-2 cursor-pointer",
              isChild && "pl-8"
            )} 
            onClick={() => setSelectedTaskId(task.id)}
          >
            <Badge variant="outline" className={cn("text-[10px] px-1 py-0 border", getPriorityColor(task.priority))}>{task.priority[0]}</Badge>
            {task.type === 'Epic' && <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-1 rounded">EPIC</span>}
            <span className="truncate">{task.title}</span>
          </div>
          <div className="flex-1 relative py-2">
            <div className="absolute inset-0 flex pointer-events-none">
              {days.map((_, i) => (
                <div key={i} className="flex-1 border-r border-zinc-100/50"></div>
              ))}
            </div>
            
            {isVisible && (
              <div 
                className={cn(
                  "absolute h-8 rounded-md shadow-sm flex items-center px-2 text-xs font-medium truncate cursor-pointer transition-colors",
                  task.type === 'Epic' ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-indigo-400 text-white hover:bg-indigo-500"
                )}
                style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => setSelectedTaskId(task.id)}
              >
                {task.title}
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="flex-1 bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
          <h3 className="font-semibold text-zinc-900">Timeline</h3>
          <div className="flex bg-white border border-zinc-200 rounded-md p-1">
            <button 
              className={cn("px-3 py-1 text-xs font-medium rounded", timelineScale === 'weeks' && "bg-zinc-100")}
              onClick={() => setTimelineScale('weeks')}
            >Weeks</button>
            <button 
              className={cn("px-3 py-1 text-xs font-medium rounded", timelineScale === 'months' && "bg-zinc-100")}
              onClick={() => setTimelineScale('months')}
            >Months</button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto relative">
          <div className="min-w-[800px]">
            {/* Header row */}
            <div className="flex border-b border-zinc-200 sticky top-0 bg-white z-10">
              <div className="w-64 flex-shrink-0 border-r border-zinc-200 p-3 font-medium text-sm text-zinc-500">Task</div>
              <div className="flex-1 flex">
                {days.map(day => (
                  <div key={day.toISOString()} className="flex-1 border-r border-zinc-100 p-2 text-center text-xs text-zinc-500">
                    <div className="font-medium">{format(day, 'EEE')}</div>
                    <div>{format(day, 'd')}</div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Task rows */}
            {epics.map(epic => (
              <React.Fragment key={epic.id}>
                {renderTaskRow(epic)}
                {tasksWithDates.filter(t => t.parentId === epic.id).map(child => renderTaskRow(child, true))}
              </React.Fragment>
            ))}
            {standaloneTasks.map(task => renderTaskRow(task))}
            
            {tasksWithDates.length === 0 && (
              <div className="p-8 text-center text-zinc-500 text-sm">
                No tasks with both start and due dates found.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col">
      <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">Tasks & Projects</h1>
          <p className="text-zinc-500 mt-1 text-sm md:text-base">Manage your {workspace.toLowerCase()} workflow.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <div className="flex bg-zinc-100 p-1 rounded-lg shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("h-8 px-2", currentTaskView === 'backlog' && "bg-white shadow-sm")}
              onClick={() => setCurrentTaskView('backlog')}
              title="Backlog View"
            >
              <Layers className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("h-8 px-2", currentTaskView === 'board' && "bg-white shadow-sm")}
              onClick={() => setCurrentTaskView('board')}
              title="Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("h-8 px-2", currentTaskView === 'list' && "bg-white shadow-sm")}
              onClick={() => setCurrentTaskView('list')}
              title="List View"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("h-8 px-2", currentTaskView === 'timeline' && "bg-white shadow-sm")}
              onClick={() => setCurrentTaskView('timeline')}
              title="Timeline View"
            >
              <GitCommit className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("h-8 px-2", currentTaskView === 'calendar' && "bg-white shadow-sm")}
              onClick={() => {
                const { setCurrentView } = useAppStore.getState();
                setCurrentView('calendar');
              }}
              title="Calendar View"
            >
              <CalendarIcon className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("h-8 px-2", currentTaskView === 'matrix' && "bg-white shadow-sm")}
              onClick={() => setCurrentTaskView('matrix')}
              title="Matrix View"
            >
              <LayoutTemplate className="w-4 h-4" />
            </Button>
          </div>
          <Button className="w-full sm:w-auto shrink-0" onClick={() => setIsAddingTask(currentTaskView === 'backlog' ? 'Backlog' : 'To Do')}>
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </header>

      {currentTaskView === 'board' && renderBoardView()}
      {currentTaskView === 'list' && renderListView()}
      {currentTaskView === 'matrix' && renderMatrixView()}
      {currentTaskView === 'backlog' && renderBacklogView()}
      {currentTaskView === 'timeline' && renderTimelineView()}
      
      {selectedTaskId && <TaskDetailModal />}
      <Confetti active={showConfetti} onDone={() => setShowConfetti(false)} />
    </div>
  );
}