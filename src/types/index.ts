export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type Status = 'Backlog' | 'To Do' | 'In Progress' | 'In Review' | 'Done';
export type Workspace = 'Personal' | 'Work' | string;
export type TaskType = 'Epic' | 'Story' | 'Task' | 'Bug';

export interface Profile {
  id: string;
  name: string;
  color: string;      // hex color e.g. "#6366f1"
  icon: string;       // lucide icon name e.g. "Briefcase"
  isDefault?: boolean;
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
  defaultTaskDuration: number; // minutes

  // Notes / Markdown
  markdownRenderMode: 'always' | 'dynamic' | 'never';

  // Appearance
  uiDensity: 'compact' | 'comfortable';
  sidebarBehavior: 'auto-hide' | 'icons-only' | 'full';
  defaultLandingPage: 'dashboard' | 'calendar' | 'daily-note' | 'task-kanban';
  statusColors: Record<Status, string>;

  // Productivity Behaviors
  dailyResetTime: string;        // HH:MM e.g. "04:00"
  celebrationEffects: boolean;   // confetti on task completion
  streakTracking: boolean;
  nuclearMode: boolean;          // suppress all non-active-profile notifications

  // Privacy
  cloakMode: boolean;            // blur sensitive content globally

  // Notifications
  reminderLeadTime: number;      // minutes before event
  morningDigest: boolean;
  eveningDigest: boolean;

  // Data & Security
  autoArchive: '1-day' | '7-days' | '30-days' | 'never';
  trashRetention: number;        // days
  biometricLock: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  workspace: Workspace;
  createdAt: number;
  startDate?: number;
  dueDate?: number;
  time?: string;                 // HH:MM
  addToCalendar?: boolean;
  linkedNoteIds?: string[];
  effort?: number;
  impact?: number;
  sprint?: string;
  order?: number;
  parentId?: string;
  type?: TaskType;
  recurringInterval?: number;    // days after completion (smart recursive)
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
  recurringDays?: number[];      // 0=Sun, 1=Mon...
}

export interface AppState {
  workspace: Workspace;
  currentView: string;
  selectedNoteId: string | null;
  selectedTaskId: string | null;
  tasks: Task[];
  notes: Note[];
  noteSections: NoteSection[];
  events: CalendarEvent[];
  profiles: Profile[];
  settings: Settings;

  setWorkspace: (workspace: Workspace) => void;
  setCurrentView: (view: string) => void;
  setSelectedNoteId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;

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

  updateSettings: (updates: Partial<Settings>) => void;
}