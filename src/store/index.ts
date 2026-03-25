import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  AppState, Status, Task, Note, Workspace,
  NoteSection, CalendarEvent, Profile, Settings,
  Project, ProjectColumn
} from '../types';
import { NexusDB } from './storage';

// ─── Default columns factory ──────────────────────────────────────────────────

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

// ─── Helper: build CalendarEvent from Task ────────────────────────────────────

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
  },
];

const initialNoteSections: NoteSection[] = [
  { id: 's1', name: 'Meetings', workspace: 'Work' },
  { id: 's2', name: 'Ideas',    workspace: 'Personal' },
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
    sectionId: 's1',
  },
];

const initialEvents: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Team Standup',
    startTime: new Date().setHours(10, 0, 0, 0),
    endTime:   new Date().setHours(10, 30, 0, 0),
    workspace: 'Work',
    isPrivate: false,
  },
  {
    id: 'e2',
    title: 'Lunch with Sarah',
    startTime: new Date().setHours(12, 30, 0, 0),
    endTime:   new Date().setHours(13, 30, 0, 0),
    workspace: 'Personal',
    isPrivate: true,
  },
];

const initialProfiles: Profile[] = [
  { id: '1', name: 'Work',     color: '#6366f1', icon: 'Briefcase' },
  { id: '2', name: 'Personal', color: '#3b82f6', icon: 'Home' },
  { id: '3', name: 'Gym',      color: '#22c55e', icon: 'Dumbbell' },
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

// ─── Persistence helpers ──────────────────────────────────────────────────────

// Debounce IDB writes so rapid mutations don't flood the DB
const writeTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function debouncedWrite(store: 'notes' | 'tasks' | 'events' | 'projects' | 'projectColumns', items: any[], delay = 300) {
  clearTimeout(writeTimers[store]);
  writeTimers[store] = setTimeout(() => {
    NexusDB.replaceAll(store, items).catch(err =>
      console.warn(`[store] background write failed for ${store}`, err)
    );
  }, delay);
}

// ─── Initialise store from IndexedDB (async, called once on startup) ──────────

let _initDone = false;

async function loadPersistedState(): Promise<Partial<AppState>> {
  // 1. Try to migrate from old Zustand localStorage key
  const legacy = await NexusDB.migrateFromLegacy();
  if (legacy) {
    // Write legacy data into IDB
    await Promise.all([
      NexusDB.replaceAll('notes',          legacy.notes),
      NexusDB.replaceAll('tasks',          legacy.tasks),
      NexusDB.replaceAll('events',         legacy.events),
      NexusDB.replaceAll('projects',       legacy.projects),
      NexusDB.replaceAll('projectColumns', legacy.projectColumns),
    ]);
    // Save lightweight config from legacy
    if (legacy.settings)     NexusDB.lsSet('settings',     legacy.settings);
    if (legacy.profiles)     NexusDB.lsSet('profiles',     legacy.profiles);
    if (legacy.noteSections) NexusDB.lsSet('noteSections', legacy.noteSections);
    // Remove old key to prevent re-migration
    NexusDB.clearLegacy();
  }

  // 2. Load IDB collections
  const [notes, tasks, events, projects, projectColumns] = await Promise.all([
    NexusDB.loadAll<Note>('notes'),
    NexusDB.loadAll<Task>('tasks'),
    NexusDB.loadAll<CalendarEvent>('events'),
    NexusDB.loadAll<Project>('projects'),
    NexusDB.loadAll<ProjectColumn>('projectColumns'),
  ]);

  // 3. Load lightweight LS config
  const settings     = NexusDB.lsGet<Settings>('settings',     initialSettings);
  const profiles     = NexusDB.lsGet<Profile[]>('profiles',     initialProfiles);
  const noteSections = NexusDB.lsGet<NoteSection[]>('noteSections', initialNoteSections);

  // 4. If IDB was empty (fresh install), use seed data
  const hasTasks    = tasks.length > 0;
  const hasProjects = projects.length > 0;

  return {
    notes:          notes.length  > 0 ? notes  : initialNotes,
    tasks:          hasTasks             ? tasks  : initialTasks,
    events:         events.length > 0 ? events : initialEvents,
    projects:       hasProjects          ? projects       : [seedProjectWork, seedProjectPersonal],
    projectColumns: projectColumns.length > 0 ? projectColumns : seedColumns,
    settings,
    profiles,
    noteSections,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  // UI state (not persisted to IDB — ephemeral)
  workspace:         'Work',
  currentView:       'dashboard',
  selectedNoteId:    null,
  selectedTaskId:    null,
  selectedProjectId: 'proj-work',

  // Data (seeded synchronously, then overwritten async from IDB)
  tasks:          initialTasks,
  notes:          initialNotes,
  noteSections:   initialNoteSections,
  events:         initialEvents,
  profiles:       initialProfiles,
  projects:       [seedProjectWork, seedProjectPersonal],
  projectColumns: seedColumns,
  settings:       initialSettings,

  // ── UI actions (no persistence needed) ────────────────────────────────────
  setWorkspace:          (workspace)          => set({ workspace }),
  setCurrentView:        (currentView)        => set({ currentView }),
  setSelectedNoteId:     (selectedNoteId)     => set({ selectedNoteId }),
  setSelectedTaskId:     (selectedTaskId)     => set({ selectedTaskId }),
  setSelectedProjectId:  (selectedProjectId)  => set({ selectedProjectId }),

  // ── Tasks ─────────────────────────────────────────────────────────────────
  addTask: (task) => set((state) => {
    const id = uuidv4();
    const statusTasks = state.tasks.filter(
      t => t.status === task.status && t.projectId === task.projectId
    );
    const maxOrder = statusTasks.length > 0
      ? Math.max(...statusTasks.map(t => t.order ?? 0)) + 1 : 0;
    const newTask: Task = { ...task, id, createdAt: Date.now(), order: maxOrder };

    let newEvents = state.events;
    if (task.addToCalendar && task.dueDate) {
      const event = buildEventFromTask({ ...newTask, id }, state.settings.defaultTaskDuration ?? 30);
      newEvents = [...state.events, event];
      NexusDB.put('events', event);
    }

    NexusDB.put('tasks', newTask);
    return { tasks: [...state.tasks, newTask], events: newEvents };
  }),

  updateTask: (id, updates) => set((state) => {
    const existing = state.tasks.find(t => t.id === id);
    if (!existing) return { tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t) };

    const updated: Task = { ...existing, ...updates };
    let newEvents = state.events;

    if (updated.addToCalendar && updated.dueDate) {
      const linkedIdx = state.events.findIndex(e => e.linkedTaskId === id);
      if (linkedIdx === -1) {
        const event = buildEventFromTask({ ...updated, id }, state.settings.defaultTaskDuration ?? 30);
        newEvents = [...state.events, event];
        NexusDB.put('events', event);
      } else {
        newEvents = state.events.map((e, idx) => {
          if (idx !== linkedIdx) return e;
          const [h, m] = updated.time ? updated.time.split(':').map(Number) : [9, 0];
          const base = new Date(updated.dueDate!);
          base.setHours(h, m, 0, 0);
          const ev = {
            ...e,
            title: updated.title ?? e.title,
            startTime: base.getTime(),
            endTime: base.getTime() + (state.settings.defaultTaskDuration ?? 30) * 60_000,
          };
          NexusDB.put('events', ev);
          return ev;
        });
      }
    }

    NexusDB.put('tasks', updated);
    return { tasks: state.tasks.map(t => t.id === id ? updated : t), events: newEvents };
  }),

  deleteTask: (id) => set((state) => {
    NexusDB.delete('tasks', id);
    // also remove linked calendar events
    const linkedEvents = state.events.filter(e => e.linkedTaskId === id);
    linkedEvents.forEach(e => NexusDB.delete('events', e.id));
    return {
      tasks:  state.tasks.filter(t => t.id !== id),
      events: state.events.filter(e => e.linkedTaskId !== id),
      notes:  state.notes.map(n => ({
        ...n,
        linkedTaskIds: (n.linkedTaskIds ?? []).filter(tid => tid !== id),
      })),
    };
  }),

  moveTask: (id, newStatus) => set((state) => {
    const tasks = state.tasks.map(t => {
      if (t.id !== id) return t;
      const statusTasks = state.tasks.filter(st => st.status === newStatus);
      const updated = { ...t, status: newStatus, order: statusTasks.length };
      NexusDB.put('tasks', updated);
      return updated;
    });
    return { tasks };
  }),

  reorderTasks: (startIndex, endIndex, status) => set((state) => {
    const statusTasks = [...state.tasks.filter(t => t.status === status)]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const [removed] = statusTasks.splice(startIndex, 1);
    statusTasks.splice(endIndex, 0, removed);
    const reordered = statusTasks.map((t, i) => ({ ...t, order: i }));
    debouncedWrite('tasks', state.tasks.map(t => reordered.find(r => r.id === t.id) ?? t));
    return {
      tasks: state.tasks.map(t => {
        const updated = reordered.find(r => r.id === t.id);
        return updated ?? t;
      }),
    };
  }),

  // ── Notes ─────────────────────────────────────────────────────────────────
  addNote: (note) => set((state) => {
    const newNote: Note = {
      ...note,
      id: (note as any).id ?? uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    NexusDB.put('notes', newNote);
    return { notes: [...state.notes, newNote] };
  }),

  updateNote: (id, updates) => set((state) => {
    const updated = state.notes.map(n =>
      n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n
    );
    const note = updated.find(n => n.id === id);
    if (note) NexusDB.put('notes', note);
    return { notes: updated };
  }),

  deleteNote: (id) => set((state) => {
    NexusDB.delete('notes', id);
    return {
      notes:  state.notes.filter(n => n.id !== id),
      events: state.events.map(e => e.linkedNoteId === id ? { ...e, linkedNoteId: undefined } : e),
      tasks:  state.tasks.map(t => ({
        ...t,
        linkedNoteIds: (t.linkedNoteIds ?? []).filter(nid => nid !== id),
      })),
    };
  }),

  addNoteSection: (section) => set((state) => {
    const newSection = { ...section, id: uuidv4() };
    const noteSections = [...state.noteSections, newSection];
    NexusDB.lsSet('noteSections', noteSections);
    return { noteSections };
  }),

  deleteNoteSection: (id) => set((state) => {
    const noteSections = state.noteSections.filter(s => s.id !== id);
    NexusDB.lsSet('noteSections', noteSections);
    return { noteSections };
  }),

  // ── Events ────────────────────────────────────────────────────────────────
  addEvent: (event) => set((state) => {
    const newEvent: CalendarEvent = { ...event, id: uuidv4() };
    NexusDB.put('events', newEvent);
    return { events: [...state.events, newEvent] };
  }),

  updateEvent: (id, updates) => set((state) => {
    const updated = state.events.map(e => e.id === id ? { ...e, ...updates } : e);
    const event = updated.find(e => e.id === id);
    if (event) NexusDB.put('events', event);
    return { events: updated };
  }),

  deleteEvent: (id) => set((state) => {
    const event = state.events.find(e => e.id === id);
    NexusDB.delete('events', id);
    return {
      events: state.events.filter(e => e.id !== id),
      tasks:  event?.linkedTaskId
        ? state.tasks.map(t =>
            t.id === event.linkedTaskId ? { ...t, addToCalendar: false } : t
          )
        : state.tasks,
    };
  }),

  // ── Profiles ──────────────────────────────────────────────────────────────
  addProfile: (profile) => set((state) => {
    const profiles = [...state.profiles, { ...profile, id: uuidv4() }];
    NexusDB.lsSet('profiles', profiles);
    return { profiles };
  }),

  updateProfile: (id, updates) => set((state) => {
    const profiles = state.profiles.map(p => p.id === id ? { ...p, ...updates } : p);
    NexusDB.lsSet('profiles', profiles);
    return { profiles };
  }),

  deleteProfile: (id) => set((state) => {
    const profiles = state.profiles.filter(p => p.id !== id);
    NexusDB.lsSet('profiles', profiles);
    return { profiles };
  }),

  // ── Projects ──────────────────────────────────────────────────────────────
  addProject: (project) => set((state) => {
    const id = uuidv4();
    const newProject: Project = { ...project, id, createdAt: Date.now() };
    const cols = makeDefaultColumns(id);
    NexusDB.put('projects', newProject);
    cols.forEach(c => NexusDB.put('projectColumns', c));
    return {
      projects:       [...state.projects, newProject],
      projectColumns: [...state.projectColumns, ...cols],
      selectedProjectId: id,
    };
  }),

  updateProject: (id, updates) => set((state) => {
    const projects = state.projects.map(p => p.id === id ? { ...p, ...updates } : p);
    const project  = projects.find(p => p.id === id);
    if (project) NexusDB.put('projects', project);
    return { projects };
  }),

  deleteProject: (id) => set((state) => {
    NexusDB.delete('projects', id);
    const removedCols = state.projectColumns.filter(c => c.projectId === id);
    removedCols.forEach(c => NexusDB.delete('projectColumns', c.id));
    return {
      projects:       state.projects.filter(p => p.id !== id),
      projectColumns: state.projectColumns.filter(c => c.projectId !== id),
      tasks:          state.tasks.map(t => t.projectId === id ? { ...t, projectId: undefined } : t),
      selectedProjectId: state.selectedProjectId === id
        ? (state.projects.find(p => p.id !== id)?.id ?? null)
        : state.selectedProjectId,
    };
  }),

  // ── ProjectColumns ────────────────────────────────────────────────────────
  addProjectColumn: (col) => set((state) => {
    const newCol = { ...col, id: uuidv4() };
    NexusDB.put('projectColumns', newCol);
    return { projectColumns: [...state.projectColumns, newCol] };
  }),

  updateProjectColumn: (id, updates) => set((state) => {
    const projectColumns = state.projectColumns.map(c => c.id === id ? { ...c, ...updates } : c);
    const col = projectColumns.find(c => c.id === id);
    if (col) NexusDB.put('projectColumns', col);
    return { projectColumns };
  }),

  deleteProjectColumn: (id) => set((state) => {
    NexusDB.delete('projectColumns', id);
    return { projectColumns: state.projectColumns.filter(c => c.id !== id) };
  }),

  reorderProjectColumns: (projectId, fromIndex, toIndex) => set((state) => {
    const cols = [...state.projectColumns.filter(c => c.projectId === projectId)]
      .sort((a, b) => a.order - b.order);
    const [moved] = cols.splice(fromIndex, 1);
    cols.splice(toIndex, 0, moved);
    const updated = cols.map((c, i) => ({ ...c, order: i }));
    debouncedWrite('projectColumns', state.projectColumns.map(c => updated.find(u => u.id === c.id) ?? c));
    return {
      projectColumns: state.projectColumns.map(c => {
        const u = updated.find(u => u.id === c.id);
        return u ?? c;
      }),
    };
  }),

  // ── Settings ──────────────────────────────────────────────────────────────
  updateSettings: (updates) => set((state) => {
    const settings = { ...state.settings, ...updates };
    NexusDB.lsSet('settings', settings);
    return { settings };
  }),
}));

// ─── Hydrate store from IndexedDB on startup ──────────────────────────────────

export async function hydrateStore(): Promise<void> {
  if (_initDone) return;
  _initDone = true;

  try {
    const persisted = await loadPersistedState();
    useAppStore.setState({
      ...persisted,
      // Restore last active workspace/project from LS
      workspace:         NexusDB.lsGet('workspace',         'Work'),
      selectedProjectId: NexusDB.lsGet('selectedProjectId', 'proj-work'),
    });
  } catch (err) {
    console.error('[store] Failed to hydrate from IndexedDB:', err);
    // App continues with seed data — user loses persisted state but app stays functional
  }
}

// Save lightweight UI state on change
useAppStore.subscribe((state) => {
  NexusDB.lsSet('workspace',         state.workspace);
  NexusDB.lsSet('selectedProjectId', state.selectedProjectId ?? 'proj-work');
});