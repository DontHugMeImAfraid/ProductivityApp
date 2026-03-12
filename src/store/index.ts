import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { AppState, Status, Task, Note, Workspace, NoteSection, CalendarEvent, Profile, Settings } from '../types';

const initialTasks: Task[] = [
  {
    id: '1',
    title: 'Draft Q3 Roadmap',
    description: 'Outline the key objectives and deliverables for the upcoming quarter.',
    status: 'To Do',
    priority: 'High',
    workspace: 'Work',
    createdAt: Date.now(),
    effort: 8,
    impact: 9,
    startDate: Date.now(),
    dueDate: Date.now() + 86400000 * 3, // 3 days from now
    order: 0,
  },
  {
    id: '2',
    title: 'Buy groceries',
    description: 'Milk, eggs, bread, and coffee.',
    status: 'To Do',
    priority: 'Medium',
    workspace: 'Personal',
    createdAt: Date.now(),
    effort: 2,
    impact: 5,
    order: 1,
  },
  {
    id: '3',
    title: 'Review PR #42',
    description: 'Check the new authentication flow implementation.',
    status: 'In Progress',
    priority: 'High',
    workspace: 'Work',
    createdAt: Date.now(),
    effort: 4,
    impact: 7,
    startDate: Date.now() - 86400000,
    dueDate: Date.now() + 86400000 * 2,
    order: 0,
  },
  {
    id: '4',
    title: 'Update landing page copy',
    description: 'Revise the hero section to better reflect the new value proposition.',
    status: 'Backlog',
    priority: 'Medium',
    workspace: 'Work',
    createdAt: Date.now(),
    effort: 5,
    impact: 6,
    order: 0,
  }
];

const initialNoteSections: NoteSection[] = [
  { id: 's1', name: 'Meetings', workspace: 'Work' },
  { id: 's2', name: 'Ideas', workspace: 'Personal' }
];

const initialNotes: Note[] = [
  {
    id: '1',
    title: 'Q3 Planning Meeting Notes',
    content: '# Q3 Goals\n- Increase user retention by 15%\n- Launch new AI features\n- Expand into European market\n\n## Action Items\n- [ ] Finalize budget\n- [ ] Hire 2 new engineers',
    workspace: 'Work',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    linkedTaskIds: ['1'],
    sectionId: 's1'
  }
];

const initialEvents: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Team Standup',
    startTime: new Date().setHours(10, 0, 0, 0),
    endTime: new Date().setHours(10, 30, 0, 0),
    workspace: 'Work',
    isPrivate: false,
  },
  {
    id: 'e2',
    title: 'Lunch with Sarah',
    startTime: new Date().setHours(12, 30, 0, 0),
    endTime: new Date().setHours(13, 30, 0, 0),
    workspace: 'Personal',
    isPrivate: true,
  }
];

const initialProfiles: Profile[] = [
  { id: '1', name: 'Work', color: 'bg-red-500', icon: 'Briefcase' },
  { id: '2', name: 'Personal', color: 'bg-blue-500', icon: 'Home' },
  { id: '3', name: 'Gym', color: 'bg-green-500', icon: 'Dumbbell' }
];

const initialSettings: Settings = {
  allowBackDatingTasks: false,
  enablePriority: true,
  enableImpact: true,
  enableEffort: true,
  scaleSystem: '1-5',
  hideCompletedTasks: false,
  taskToCalendarAutomation: 'prompt',
  defaultTaskDuration: 30,
  markdownRenderMode: 'dynamic',
  uiDensity: 'comfortable',
  sidebarBehavior: 'full',
  defaultLandingPage: 'task-kanban',
  statusColors: {
    'Backlog': '#9ca3af', // zinc-400
    'To Do': '#e4e4e7', // zinc-200
    'In Progress': '#3b82f6', // blue-500
    'In Review': '#a855f7', // purple-500
    'Done': '#22c55e', // green-500
  }
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      workspace: 'Work',
      currentView: 'dashboard',
      selectedNoteId: null,
      selectedTaskId: null,
      tasks: initialTasks,
      notes: initialNotes,
      noteSections: initialNoteSections,
      events: initialEvents,
      profiles: initialProfiles,
      settings: initialSettings,
      
      setWorkspace: (workspace) => set({ workspace }),
      setCurrentView: (currentView) => set({ currentView }),
      setSelectedNoteId: (selectedNoteId) => set({ selectedNoteId }),
      setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
      
      addTask: (task) => set((state) => {
        const statusTasks = state.tasks.filter(t => t.status === task.status);
        const maxOrder = statusTasks.length > 0 ? Math.max(...statusTasks.map(t => t.order || 0)) : -1;
        
        // Enforce effort and impact range
        let sanitizedTask = { ...task };
        const maxScale = state.settings.scaleSystem === '1-5' ? 5 : 10;
        
        if (sanitizedTask.effort !== undefined) {
          sanitizedTask.effort = Math.min(Math.max(sanitizedTask.effort, 1), maxScale);
        }
        
        if (sanitizedTask.impact !== undefined) {
          sanitizedTask.impact = Math.min(Math.max(sanitizedTask.impact, 1), maxScale);
        }

        const newTask = { ...sanitizedTask, id: uuidv4(), createdAt: Date.now(), order: maxOrder + 1 };
        
        let newEvents = [...state.events];
        if (newTask.addToCalendar) {
          let startTime = newTask.dueDate ? new Date(newTask.dueDate) : new Date();
          if (newTask.time) {
            const [hours, minutes] = newTask.time.split(':').map(Number);
            startTime.setHours(hours, minutes, 0, 0);
          } else {
            startTime.setHours(9, 0, 0, 0); // Default to 9 AM
          }
          const endTime = new Date(startTime.getTime() + (state.settings.defaultTaskDuration * 60000));
          
          newEvents.push({
            id: uuidv4(),
            title: newTask.title,
            description: newTask.description,
            startTime: startTime.getTime(),
            endTime: endTime.getTime(),
            workspace: newTask.workspace,
            isPrivate: false,
            linkedTaskId: newTask.id,
          });
        }

        return {
          tasks: [...state.tasks, newTask],
          events: newEvents,
        };
      }),
      
      updateTask: (id, updates) => set((state) => {
        const existingTask = state.tasks.find(t => t.id === id);
        
        // Enforce effort and impact range
        let sanitizedUpdates = { ...updates };
        const maxScale = state.settings.scaleSystem === '1-5' ? 5 : 10;
        
        if (sanitizedUpdates.effort !== undefined) {
          sanitizedUpdates.effort = Math.min(Math.max(sanitizedUpdates.effort, 1), maxScale);
        }
        
        if (sanitizedUpdates.impact !== undefined) {
          sanitizedUpdates.impact = Math.min(Math.max(sanitizedUpdates.impact, 1), maxScale);
        }

        const updatedTask = { ...existingTask, ...sanitizedUpdates } as Task;
        
        let newEvents = [...state.events];
        
        // Handle calendar sync
        const existingEventIndex = newEvents.findIndex(e => e.linkedTaskId === id);
        
        if (updatedTask.addToCalendar) {
          let startTime = updatedTask.dueDate ? new Date(updatedTask.dueDate) : new Date();
          if (updatedTask.time) {
            const [hours, minutes] = updatedTask.time.split(':').map(Number);
            startTime.setHours(hours, minutes, 0, 0);
          } else {
            startTime.setHours(9, 0, 0, 0);
          }
          const endTime = new Date(startTime.getTime() + (state.settings.defaultTaskDuration * 60000));

          if (existingEventIndex >= 0) {
            // Update existing event
            newEvents[existingEventIndex] = {
              ...newEvents[existingEventIndex],
              title: updatedTask.title,
              description: updatedTask.description,
              startTime: startTime.getTime(),
              endTime: endTime.getTime(),
              workspace: updatedTask.workspace,
            };
          } else {
            // Create new event
            newEvents.push({
              id: uuidv4(),
              title: updatedTask.title,
              description: updatedTask.description,
              startTime: startTime.getTime(),
              endTime: endTime.getTime(),
              workspace: updatedTask.workspace,
              isPrivate: false,
              linkedTaskId: updatedTask.id,
            });
          }
        } else if (!updatedTask.addToCalendar && existingEventIndex >= 0) {
          // Remove event if addToCalendar is turned off
          newEvents.splice(existingEventIndex, 1);
        }

        return {
          tasks: state.tasks.map((t) => t.id === id ? updatedTask : t),
          events: newEvents,
        };
      }),
      
      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        events: state.events.filter((e) => e.linkedTaskId !== id)
      })),
      
      moveTask: (id, newStatus) => set((state) => {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return state;
        
        const statusTasks = state.tasks.filter(t => t.status === newStatus);
        const maxOrder = statusTasks.length > 0 ? Math.max(...statusTasks.map(t => t.order || 0)) : -1;
        
        return {
          tasks: state.tasks.map((t) => t.id === id ? { ...t, status: newStatus, order: maxOrder + 1 } : t)
        };
      }),

      reorderTasks: (startIndex, endIndex, status) => set((state) => {
        const statusTasks = state.tasks.filter(t => t.status === status).sort((a, b) => (a.order || 0) - (b.order || 0));
        const [removed] = statusTasks.splice(startIndex, 1);
        statusTasks.splice(endIndex, 0, removed);
        
        const updatedTasks = statusTasks.map((t, index) => ({ ...t, order: index }));
        
        return {
          tasks: state.tasks.map(t => {
            const updated = updatedTasks.find(ut => ut.id === t.id);
            return updated ? updated : t;
          })
        };
      }),
      
      addNote: (note) => set((state) => ({
        notes: [...state.notes, { ...note, createdAt: Date.now(), updatedAt: Date.now() }]
      })),
      
      updateNote: (id, updates) => set((state) => ({
        notes: state.notes.map((n) => n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n)
      })),
      
      deleteNote: (id) => set((state) => ({
        notes: state.notes.filter((n) => n.id !== id)
      })),
      
      addNoteSection: (section) => set((state) => ({
        noteSections: [...state.noteSections, { ...section, id: uuidv4() }]
      })),
      
      deleteNoteSection: (id) => set((state) => {
        const noteIdsToDelete = new Set(state.notes.filter(n => n.sectionId === id).map(n => n.id));
        return {
          noteSections: state.noteSections.filter((s) => s.id !== id),
          notes: state.notes.filter(n => !noteIdsToDelete.has(n.id)),
          selectedNoteId: state.selectedNoteId && noteIdsToDelete.has(state.selectedNoteId) ? null : state.selectedNoteId,
        };
      }),

      addEvent: (event) => set((state) => ({
        events: [...state.events, { ...event, id: uuidv4() }]
      })),

      updateEvent: (id, updates) => set((state) => ({
        events: state.events.map((e) => e.id === id ? { ...e, ...updates } : e)
      })),

      deleteEvent: (id) => set((state) => ({
        events: state.events.filter((e) => e.id !== id)
      })),

      addProfile: (profile) => set((state) => ({
        profiles: [...state.profiles, { ...profile, id: uuidv4() }]
      })),

      updateProfile: (id, updates) => set((state) => ({
        profiles: state.profiles.map((p) => p.id === id ? { ...p, ...updates } : p)
      })),

      deleteProfile: (id) => set((state) => ({
        profiles: state.profiles.filter((p) => p.id !== id)
      })),

      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),
    }),
    {
      name: 'nexus-storage',
    }
  )
);
