import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import {
  AppState, Status, Task, Note, Workspace,
  NoteSection, CalendarEvent, Profile, Settings,
  Project, ProjectColumn
} from '../types';

// ─── Default columns factory ─────────────────────────────────────────────────
function makeDefaultColumns(projectId: string): ProjectColumn[] {
  const defaults: Array<{ status: Status; color: string }> = [
    { status: 'To Do',       color: '#6366f1' },
    { status: 'In Progress', color: '#3b82f6' },
    { status: 'In Review',   color: '#a855f7' },
    { status: 'Done',        color: '#22c55e' },
  ];
  return defaults.map((d, i) => ({
    id: uuidv4(),
    projectId,
    status: d.status,
    label: d.status,
    color: d.color,
    isHidden: false,
    order: i,
  }));
}

// ─── Helper: build a CalendarEvent from a Task ────────────────────────────────
function buildEventFromTask(task: Task & { id: string }, durationMin: number): CalendarEvent {
  const [h, m] = task.time ? task.time.split(':').map(Number) : [9, 0];
  const base = new Date(task.dueDate!);
  base.setHours(h, m, 0, 0);
  return {
    id: uuidv4(),
    title: task.title,
    startTime: base.getTime(),
    endTime: base.getTime() + durationMin * 60_000,
    workspace: task.workspace,
    isPrivate: false,
    linkedTaskId: task.id,
  };
}

// ─── Seed data ────────────────────────────────────────────────────────────────
const seedProjectWork: Project = {
  id: 'proj-work',
  name: 'Work Inbox',
  workspace: 'Work',
  color: '#6366f1',
  isCompleted: false,
  createdAt: Date.now() - 86400000 * 7,
};

const seedProjectPersonal: Project = {
  id: 'proj-personal',
  name: 'Personal Goals',
  workspace: 'Personal',
  color: '#3b82f6',
  isCompleted: false,
  createdAt: Date.now() - 86400000 * 3,
};

const seedColumns: ProjectColumn[] = [
  ...makeDefaultColumns('proj-work'),
  ...makeDefaultColumns('proj-personal'),
];

const initialTasks: Task[] = [
  {
    id: '1',
    title: 'Draft Q3 Roadmap',
    description: 'Outline the key objectives and deliverables for the upcoming quarter.',
    status: 'To Do',
    priority: 'High',
    workspace: 'Work',
    projectId: 'proj-work',
    createdAt: Date.now(),
    effort: 8,
    impact: 9,
    startDate: Date.now(),
    dueDate: Date.now() + 86400000 * 3,
    order: 0,
  },
  {
    id: '2',
    title: 'Buy groceries',
    description: 'Milk, eggs, bread, and coffee.',
    status: 'To Do',
    priority: 'Medium',
    workspace: 'Personal',
    projectId: 'proj-personal',
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
    projectId: 'proj-work',
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
    status: 'To Do',
    priority: 'Medium',
    workspace: 'Work',
    projectId: 'proj-work',
    createdAt: Date.now(),
    effort: 5,
    impact: 6,
    order: 2,
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
  { id: '1', name: 'Work',     color: '#6366f1', icon: 'Briefcase' },
  { id: '2', name: 'Personal', color: '#3b82f6', icon: 'Home' },
  { id: '3', name: 'Gym',      color: '#22c55e', icon: 'Dumbbell' }
];

const initialSettings: Settings = {
  allowBackDatingTasks: false,
  enablePriority: true,
  enableImpact: true,
  enableEffort: true,
  scaleSystem: '1-10',
  hideCompletedTasks: false,
  taskToCalendarAutomation: 'prompt',
  defaultTaskDuration: 30,
  markdownRenderMode: 'dynamic',
  uiDensity: 'comfortable',
  sidebarBehavior: 'full',
  defaultLandingPage: 'task-kanban',
  dashboardTaskClickBehavior: 'auto-open',
  statusColors: {
    'To Do':       '#6366f1',
    'In Progress': '#3b82f6',
    'In Review':   '#a855f7',
    'Done':        '#22c55e',
  },
  dailyResetTime: '04:00',
  celebrationEffects: true,
  streakTracking: false,
  nuclearMode: false,
  cloakMode: false,
  reminderLeadTime: 15,
  morningDigest: false,
  eveningDigest: false,
  autoArchive: 'never',
  trashRetention: 30,
  biometricLock: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      workspace: 'Work',
      currentView: 'dashboard',
      selectedNoteId: null,
      selectedTaskId: null,
      selectedProjectId: 'proj-work',
      tasks: initialTasks,
      notes: initialNotes,
      noteSections: initialNoteSections,
      events: initialEvents,
      profiles: initialProfiles,
      projects: [seedProjectWork, seedProjectPersonal],
      projectColumns: seedColumns,
      settings: initialSettings,

      setWorkspace: (workspace) => set({ workspace }),
      setCurrentView: (currentView) => set({ currentView }),
      setSelectedNoteId: (selectedNoteId) => set({ selectedNoteId }),
      setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
      setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),

      // ── Tasks ──────────────────────────────────────────────────────────────
      addTask: (task) => set((state) => {
        const id = uuidv4();
        const statusTasks = state.tasks.filter(
          t => t.status === task.status && t.projectId === task.projectId
        );
        const maxOrder = statusTasks.length > 0
          ? Math.max(...statusTasks.map(t => t.order ?? 0)) + 1
          : 0;
        const newTask: Task = { ...task, id, createdAt: Date.now(), order: maxOrder };

        // Auto-create a linked calendar event when addToCalendar is true and dueDate is set
        let newEvents = state.events;
        if (task.addToCalendar && task.dueDate) {
          const event = buildEventFromTask(
            { ...newTask, id },
            state.settings.defaultTaskDuration ?? 30
          );
          newEvents = [...state.events, event];
        }

        return { tasks: [...state.tasks, newTask], events: newEvents };
      }),

      updateTask: (id, updates) => set((state) => {
        const existing = state.tasks.find(t => t.id === id);
        if (!existing) {
          return { tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t) };
        }

        const updated: Task = { ...existing, ...updates };
        let newEvents = state.events;

        if (updated.addToCalendar && updated.dueDate) {
          const linkedIdx = state.events.findIndex(e => e.linkedTaskId === id);

          if (linkedIdx === -1) {
            // No linked event yet — create one
            const event = buildEventFromTask(
              { ...updated, id },
              state.settings.defaultTaskDuration ?? 30
            );
            newEvents = [...state.events, event];
          } else {
            // Linked event exists — keep it in sync with the task's due date/time/title
            newEvents = state.events.map((e, idx) => {
              if (idx !== linkedIdx) return e;
              const [h, m] = updated.time ? updated.time.split(':').map(Number) : [9, 0];
              const base = new Date(updated.dueDate!);
              base.setHours(h, m, 0, 0);
              return {
                ...e,
                title: updated.title ?? e.title,
                startTime: base.getTime(),
                endTime: base.getTime() + (state.settings.defaultTaskDuration ?? 30) * 60_000,
              };
            });
          }
        }

        return {
          tasks: state.tasks.map(t => t.id === id ? updated : t),
          events: newEvents,
        };
      }),

      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter(t => t.id !== id),
        // Remove any calendar events that were auto-created for this task
        events: state.events.filter(e => e.linkedTaskId !== id),
        notes: state.notes.map(n => ({
          ...n,
          linkedTaskIds: (n.linkedTaskIds || []).filter(tid => tid !== id)
        }))
      })),

      moveTask: (id, newStatus) => set((state) => ({
        tasks: state.tasks.map(t => {
          if (t.id !== id) return t;
          const statusTasks = state.tasks.filter(st => st.status === newStatus);
          return { ...t, status: newStatus, order: statusTasks.length };
        })
      })),

      reorderTasks: (startIndex, endIndex, status) => set((state) => {
        const statusTasks = [...state.tasks.filter(t => t.status === status)].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const [removed] = statusTasks.splice(startIndex, 1);
        statusTasks.splice(endIndex, 0, removed);
        const reordered = statusTasks.map((t, i) => ({ ...t, order: i }));
        return {
          tasks: state.tasks.map(t => {
            const updated = reordered.find(r => r.id === t.id);
            return updated ?? t;
          })
        };
      }),

      // ── Notes ──────────────────────────────────────────────────────────────
      addNote: (note) => set((state) => ({
        notes: [...state.notes, { ...note, id: (note as any).id ?? uuidv4(), createdAt: Date.now(), updatedAt: Date.now() }]
      })),

      updateNote: (id, updates) => set((state) => ({
        notes: state.notes.map(n => n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n)
      })),

      deleteNote: (id) => set((state) => ({
        notes: state.notes.filter(n => n.id !== id),
        // Remove note links from calendar events
        events: state.events.map(e =>
          e.linkedNoteId === id ? { ...e, linkedNoteId: undefined } : e
        ),
        tasks: state.tasks.map(t => ({
          ...t,
          linkedNoteIds: (t.linkedNoteIds || []).filter(nid => nid !== id)
        }))
      })),

      addNoteSection: (section) => set((state) => ({
        noteSections: [...state.noteSections, { ...section, id: uuidv4() }]
      })),

      deleteNoteSection: (id) => set((state) => ({
        noteSections: state.noteSections.filter(s => s.id !== id)
      })),

      // ── Events ─────────────────────────────────────────────────────────────
      addEvent: (event) => set((state) => ({
        events: [...state.events, { ...event, id: uuidv4() }]
      })),

      updateEvent: (id, updates) => set((state) => ({
        events: state.events.map(e => e.id === id ? { ...e, ...updates } : e)
      })),

      deleteEvent: (id) => set((state) => {
        const event = state.events.find(e => e.id === id);
        return {
          events: state.events.filter(e => e.id !== id),
          // If the deleted event was linked to a task, clear addToCalendar on that task
          tasks: event?.linkedTaskId
            ? state.tasks.map(t =>
                t.id === event.linkedTaskId ? { ...t, addToCalendar: false } : t
              )
            : state.tasks,
        };
      }),

      // ── Profiles ───────────────────────────────────────────────────────────
      addProfile: (profile) => set((state) => ({
        profiles: [...state.profiles, { ...profile, id: uuidv4() }]
      })),

      updateProfile: (id, updates) => set((state) => ({
        profiles: state.profiles.map(p => p.id === id ? { ...p, ...updates } : p)
      })),

      deleteProfile: (id) => set((state) => ({
        profiles: state.profiles.filter(p => p.id !== id)
      })),

      // ── Projects ───────────────────────────────────────────────────────────
      addProject: (project) => set((state) => {
        const id = uuidv4();
        const newProject: Project = { ...project, id, createdAt: Date.now() };
        const cols = makeDefaultColumns(id);
        return {
          projects: [...state.projects, newProject],
          projectColumns: [...state.projectColumns, ...cols],
          selectedProjectId: id,
        };
      }),

      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
      })),

      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter(p => p.id !== id),
        projectColumns: state.projectColumns.filter(c => c.projectId !== id),
        tasks: state.tasks.map(t => t.projectId === id ? { ...t, projectId: undefined } : t),
        selectedProjectId: state.selectedProjectId === id
          ? (state.projects.find(p => p.id !== id)?.id ?? null)
          : state.selectedProjectId,
      })),

      // ── ProjectColumns ─────────────────────────────────────────────────────
      addProjectColumn: (col) => set((state) => ({
        projectColumns: [...state.projectColumns, { ...col, id: uuidv4() }]
      })),

      updateProjectColumn: (id, updates) => set((state) => ({
        projectColumns: state.projectColumns.map(c => c.id === id ? { ...c, ...updates } : c)
      })),

      deleteProjectColumn: (id) => set((state) => ({
        projectColumns: state.projectColumns.filter(c => c.id !== id)
      })),

      reorderProjectColumns: (projectId, fromIndex, toIndex) => set((state) => {
        const cols = [...state.projectColumns.filter(c => c.projectId === projectId)]
          .sort((a, b) => a.order - b.order);
        const [moved] = cols.splice(fromIndex, 1);
        cols.splice(toIndex, 0, moved);
        const updated = cols.map((c, i) => ({ ...c, order: i }));
        return {
          projectColumns: state.projectColumns.map(c => {
            const u = updated.find(u => u.id === c.id);
            return u ?? c;
          })
        };
      }),

      // ── Settings ───────────────────────────────────────────────────────────
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),
    }),
    {
      name: 'nexus-store',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          persistedState.projects = persistedState.projects ?? [seedProjectWork, seedProjectPersonal];
          persistedState.projectColumns = persistedState.projectColumns ?? seedColumns;
          persistedState.selectedProjectId = persistedState.selectedProjectId ?? 'proj-work';
          persistedState.settings = {
            ...initialSettings,
            ...(persistedState.settings ?? {}),
            dashboardTaskClickBehavior:
              persistedState.settings?.dashboardTaskClickBehavior ?? 'auto-open',
          };
        }
        return persistedState;
      },
    }
  )
);