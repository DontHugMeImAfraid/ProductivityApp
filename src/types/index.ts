export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type Status = 'To Do' | 'In Progress' | 'In Review' | 'Done';
export type Workspace = 'Personal' | 'Work' | string;
export type TaskType = 'Epic' | 'Story' | 'Task' | 'Bug';

export interface Profile {
  id: string;
  name: string;
  color: string;
  icon: string;
  isDefault?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  workspace: Workspace;
  color: string; // hex color
  isCompleted: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface ProjectColumn {
  id: string;
  projectId: string;
  status: Status;
  label: string; // display name (can be renamed)
  color: string; // hex
  isHidden: boolean;
  order: number;
  width?: number; // px, for resizing
}

export interface Settings {
  // Task Creation
  allowBackDatingTasks: boolean;
  hideCompletedTasks: boolean;

  // Metrics & Scales
  enablePriority: boolean;
  enableImpact: boolean;
  enableEffort: boolean;
  scaleSystem: '1-5' | '1-10';

  // Calendar
  taskToCalendarAutomation: 'always' | 'prompt' | 'if-time' | 'never';
  defaultTaskDuration: number;

  // Notes / Markdown
  markdownRenderMode: 'always' | 'dynamic' | 'never';

  // Appearance
  uiDensity: 'compact' | 'comfortable';
  sidebarBehavior: 'auto-hide' | 'icons-only' | 'full';
  defaultLandingPage: 'dashboard' | 'calendar' | 'daily-note' | 'task-kanban';
  statusColors: Record<Status, string>;

  // Dashboard task click behavior
  dashboardTaskClickBehavior: 'auto-open' | 'highlight';

  // Productivity Behaviors
  dailyResetTime: string;
  celebrationEffects: boolean;
  streakTracking: boolean;
  nuclearMode: boolean;

  // Privacy
  cloakMode: boolean;

  // Notifications
  reminderLeadTime: number;
  morningDigest: boolean;
  eveningDigest: boolean;

  // Data & Security
  autoArchive: '1-day' | '7-days' | '30-days' | 'never';
  trashRetention: number;
  biometricLock: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  workspace: Workspace;
  projectId?: string; // links task to a project
  createdAt: number;
  startDate?: number;
  dueDate?: number;
  time?: string;
  addToCalendar?: boolean;
  linkedNoteIds?: string[];
  effort?: number;
  impact?: number;
  sprint?: string;
  order?: number;
  parentId?: string;
  type?: TaskType;
  recurringInterval?: number;
  streakCount?: number;
}

export interface NoteSection {
  id: string;
  name: string;
  workspace: Workspace;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  workspace: Workspace;
  createdAt: number;
  updatedAt: number;
  linkedTaskIds?: string[];
  sectionId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  workspace: Workspace;
  isPrivate: boolean;
  linkedNoteId?: string;
  linkedTaskId?: string;
  isRecurring?: boolean;
  recurringDays?: number[];
}


export interface AppState {
  workspace: Workspace;
  currentView: string;
  selectedNoteId: string | null;
  selectedTaskId: string | null;
  selectedProjectId: string | null;
  tasks: Task[];
  notes: Note[];
  noteSections: NoteSection[];
  events: CalendarEvent[];
  profiles: Profile[];
  projects: Project[];
  projectColumns: ProjectColumn[];
  settings: Settings;

  setWorkspace: (workspace: Workspace) => void;
  setCurrentView: (view: string) => void;
  setSelectedNoteId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;
  setSelectedProjectId: (id: string | null) => void;

  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newStatus: Status) => void;
  reorderTasks: (startIndex: number, endIndex: number, status: Status) => void;

  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;

  addNoteSection: (section: Omit<NoteSection, 'id'>) => void;
  deleteNoteSection: (id: string) => void;

  addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;

  addProfile: (profile: Omit<Profile, 'id'>) => void;
  updateProfile: (id: string, updates: Partial<Profile>) => void;
  deleteProfile: (id: string) => void;

  addProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  addProjectColumn: (col: Omit<ProjectColumn, 'id'>) => void;
  updateProjectColumn: (id: string, updates: Partial<ProjectColumn>) => void;
  deleteProjectColumn: (id: string) => void;
  reorderProjectColumns: (projectId: string, fromIndex: number, toIndex: number) => void;

  updateSettings: (updates: Partial<Settings>) => void;
}