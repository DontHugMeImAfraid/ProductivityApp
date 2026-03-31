import React, {
  useState, useEffect, useCallback, useRef, useMemo, useReducer,
} from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '@/store';
import { Note, NoteSection } from '@/types';
import {
  Plus, Folder, FolderOpen, FileText, Search, MoreHorizontal,
  Trash2, Edit2, Copy, ChevronRight, ChevronDown, Calendar as CalendarIcon,
  Link as LinkIcon, ExternalLink, SortAsc, X, AlertTriangle,
  CheckSquare, Zap, Pin, Clock, Hash,
  Layout, BookOpen, Users, DollarSign, Lightbulb,
  Sparkles, PanelRight, PanelRightClose,
  SplitSquareHorizontal, SplitSquareVertical, Share, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { NoteEditor } from '@/components/NoteEditor';
import { useTheme } from '@/contexts/ThemeSystem';
import { IndentIncrease } from 'lucide-react';
import { keymap } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';


// ─── Layout types ─────────────────────────────────────────────────────────────

interface Tab { id: string; isPinned: boolean; isDirty: boolean; }
interface Pane { id: string; tabs: Tab[]; activeTabId: string | null; scrollPos: number; }
type Layout =
  | { type: 'leaf';  pane: Pane }
  | { type: 'split'; dir: 'h' | 'v'; ratio: number; left: Layout; right: Layout };

type LayoutAction =
  | { type: 'OPEN';        paneId: string; noteId: string }
  | { type: 'CLOSE_TAB';   paneId: string; tabId: string }
  | { type: 'ACTIVATE';    paneId: string; tabId: string }
  | { type: 'PIN_TAB';     paneId: string; tabId: string }
  | { type: 'REORDER';     paneId: string; fromIdx: number; toIdx: number }
  | { type: 'SPLIT';       paneId: string; dir: 'h' | 'v' }
  | { type: 'CLOSE_PANE';  paneId: string }
  | { type: 'MOVE_TAB';    tabId: string; fromPaneId: string; toPaneId: string }
  | { type: 'RESIZE';      splitLeftPaneId: string; ratio: number }
  | { type: 'MARK_DIRTY';  noteId: string }
  | { type: 'MARK_CLEAN';  noteId: string }
  | { type: 'SET_ACTIVE_PANE'; paneId: string };

interface LayoutState { layout: Layout; activePaneId: string; }

// ─── Layout helpers ───────────────────────────────────────────────────────────

function makePane(id?: string): Pane {
  return { id: id ?? uuidv4(), tabs: [], activeTabId: null, scrollPos: 0 };
}
function makeLeaf(pane?: Pane): Layout { return { type: 'leaf', pane: pane ?? makePane() }; }

function allPanes(l: Layout): Pane[] {
  if (l.type === 'leaf') return [l.pane];
  return [...allPanes(l.left), ...allPanes(l.right)];
}

function updatePane(l: Layout, paneId: string, fn: (p: Pane) => Pane): Layout {
  if (l.type === 'leaf') return l.pane.id === paneId ? { ...l, pane: fn(l.pane) } : l;
  return { ...l, left: updatePane(l.left, paneId, fn), right: updatePane(l.right, paneId, fn) };
}

function splitPane(l: Layout, paneId: string, dir: 'h' | 'v'): Layout {
  if (l.type === 'leaf' && l.pane.id === paneId)
    return { type: 'split', dir, ratio: 0.5, left: l, right: makeLeaf() };
  if (l.type === 'split')
    return { ...l, left: splitPane(l.left, paneId, dir), right: splitPane(l.right, paneId, dir) };
  return l;
}

function closePane(l: Layout, paneId: string): Layout | null {
  if (l.type === 'leaf') return l.pane.id === paneId ? null : l;
  const nl = closePane(l.left, paneId), nr = closePane(l.right, paneId);
  if (!nl && nr) return nr;
  if (nl && !nr) return nl;
  if (!nl && !nr) return null;
  return { ...l, left: nl!, right: nr! };
}

function moveTab(l: Layout, tabId: string, fromId: string, toId: string): Layout {
  let moved: Tab | undefined;
  let r = updatePane(l, fromId, p => {
    moved = p.tabs.find(t => t.id === tabId);
    const tabs = p.tabs.filter(t => t.id !== tabId);
    return { ...p, tabs, activeTabId: tabs[tabs.length - 1]?.id ?? null };
  });
  if (!moved) return l;
  const tab = moved;
  return updatePane(r, toId, p => ({
    ...p,
    tabs: p.tabs.some(t => t.id === tab.id) ? p.tabs : [...p.tabs, tab],
    activeTabId: tab.id,
  }));
}

function markDirtyInAll(l: Layout, noteId: string, dirty: boolean): Layout {
  if (l.type === 'leaf')
    return { ...l, pane: { ...l.pane, tabs: l.pane.tabs.map(t => t.id === noteId ? { ...t, isDirty: dirty } : t) } };
  return { ...l, left: markDirtyInAll(l.left, noteId, dirty), right: markDirtyInAll(l.right, noteId, dirty) };
}

function resizeSplit(l: Layout, leftPaneId: string, ratio: number): Layout {
  if (l.type === 'split') {
    const leftHas = allPanes(l.left).some(p => p.id === leftPaneId);
    if (leftHas) return { ...l, ratio: Math.max(0.15, Math.min(0.85, ratio)) };
    return { ...l, left: resizeSplit(l.left, leftPaneId, ratio), right: resizeSplit(l.right, leftPaneId, ratio) };
  }
  return l;
}

// ─── Layout reducer ───────────────────────────────────────────────────────────

function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  const { layout, activePaneId } = state;
  switch (action.type) {
    case 'OPEN': {
      const newLayout = updatePane(layout, action.paneId, p => {
        const exists = p.tabs.find(t => t.id === action.noteId);
        return exists
          ? { ...p, activeTabId: action.noteId }
          : { ...p, tabs: [...p.tabs, { id: action.noteId, isPinned: false, isDirty: false }], activeTabId: action.noteId };
      });
      return { layout: newLayout, activePaneId: action.paneId };
    }
    case 'CLOSE_TAB': {
      const newLayout = updatePane(layout, action.paneId, p => {
        const tab = p.tabs.find(t => t.id === action.tabId);
        if (tab?.isPinned) return p;
        const tabs = p.tabs.filter(t => t.id !== action.tabId);
        const nextActive = p.activeTabId === action.tabId
          ? (tabs[tabs.length - 1]?.id ?? null) : p.activeTabId;
        return { ...p, tabs, activeTabId: nextActive };
      });
      return { ...state, layout: newLayout };
    }
    case 'ACTIVATE':
      return { layout: updatePane(layout, action.paneId, p => ({ ...p, activeTabId: action.tabId })), activePaneId: action.paneId };
    case 'PIN_TAB':
      return { ...state, layout: updatePane(layout, action.paneId, p => ({
        ...p,
        tabs: p.tabs.map(t => t.id === action.tabId ? { ...t, isPinned: !t.isPinned } : t),
      }))};
    case 'REORDER':
      return { ...state, layout: updatePane(layout, action.paneId, p => {
        const tabs = [...p.tabs];
        const [moved] = tabs.splice(action.fromIdx, 1);
        tabs.splice(action.toIdx, 0, moved);
        return { ...p, tabs };
      })};
    case 'SPLIT': {
      const newLayout = splitPane(layout, action.paneId, action.dir);
      const oldPaneIds = new Set(allPanes(layout).map(p => p.id));
      const newPaneId  = allPanes(newLayout).find(p => !oldPaneIds.has(p.id))?.id ?? activePaneId;
      return { layout: newLayout, activePaneId: newPaneId };
    }
    case 'CLOSE_PANE': {
      if (allPanes(layout).length <= 1) return state;
      const newLayout = closePane(layout, action.paneId);
      if (!newLayout) return state;
      const remaining = allPanes(newLayout);
      return { layout: newLayout, activePaneId: remaining[0].id };
    }
    case 'MOVE_TAB':
      return { ...state, layout: moveTab(layout, action.tabId, action.fromPaneId, action.toPaneId) };
    case 'RESIZE':
      return { ...state, layout: resizeSplit(layout, action.splitLeftPaneId, action.ratio) };
    case 'MARK_DIRTY':
      return { ...state, layout: markDirtyInAll(layout, action.noteId, true) };
    case 'MARK_CLEAN':
      return { ...state, layout: markDirtyInAll(layout, action.noteId, false) };
    case 'SET_ACTIVE_PANE':
      return { ...state, activePaneId: action.paneId };
    default:
      return state;
  }
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function timeAgo(ts: number) { return formatDistanceToNow(ts, { addSuffix: true }); }

function extractTags(content: string): string[] {
  return [...new Set((content.match(/#[\w-]+/g) ?? []))].slice(0, 4);
}

function extractPreview(content: string): string {
  const stripped = content
    .replace(/^---[\s\S]*?---\n?/, '')
    .replace(/[#*`>_~]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim();
  const line = stripped.split('\n').find(l => l.trim().length > 0) ?? '';
  return line.slice(0, 90) + (line.length > 90 ? '…' : '');
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES = [
  { id:'meeting', label:'Meeting Notes', icon:Users, color:'#6366f1', bg:'#eef2ff',
    content: `# Meeting Notes\n**Date:** ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}\n**Attendees:** \n\n## Agenda\n- \n\n## Discussion\n\n## Action Items\n- [ ] \n` },
  { id:'daily', label:'Daily Notes', icon:CalendarIcon, color:'#f59e0b', bg:'#fffbeb',
    content: `# Daily Notes — ${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}\n\n## Today's Focus\n- [ ] \n\n## Notes\n\n## Reflection\n` },
  { id:'financial', label:'Financial Review', icon:DollarSign, color:'#10b981', bg:'#f0fdf4',
    content: `# Financial Review\n**Period:** \n\n## Income\n| Source | Amount |\n|--------|--------|\n|  |  |\n\n## Expenses\n| Category | Budget | Actual |\n|----------|--------|--------|\n|  |  |  |\n` },
  { id:'idea', label:'Idea Capture', icon:Lightbulb, color:'#8b5cf6', bg:'#f5f3ff',
    content: `# 💡 Idea: \n\n## The Problem\n\n## The Solution\n\n## Why It Matters\n\n## Next Steps\n- [ ] \n` },
];

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: {
  title: string; message: React.ReactNode; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  const { theme } = useTheme();
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}` }}>
        <div className="p-6">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: theme.colors.textPrimary }}>{title}</h3>
          <div className="text-sm" style={{ color: theme.colors.textSecondary }}>{message}</div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Capture ────────────────────────────────────────────────────────────

function QuickCaptureBar({ onClose, onCapture, sections }: {
  onClose: () => void;
  onCapture: (title: string, content?: string, sectionId?: string) => void;
  sections: NoteSection[];
}) {
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [body,  setBody]  = useState('');
  const [ok,    setOk]    = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const save = () => {
    const t = title.trim(); if (!t) return;
    const inMatch = t.match(/^(.+?)\s+in\s+(.+)$/i);
    let finalTitle = t, secId: string | undefined;
    if (inMatch) {
      finalTitle = inMatch[1].charAt(0).toUpperCase() + inMatch[1].slice(1);
      secId = sections.find(s => s.name.toLowerCase().includes(inMatch[2].toLowerCase()))?.id;
    }
    onCapture(finalTitle, body.trim() ? `# ${finalTitle}\n\n${body}` : '', secId);
    setOk(`✓ Created "${finalTitle}"`);
    setTimeout(onClose, 800);
  };

  const SUGGESTIONS = ['Meeting Notes', 'Idea: ', 'Standup ', 'Action Items'];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden quick-capture-overlay" style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
          <Zap className="w-4 h-4 shrink-0" style={{ color: theme.colors.accent }} />
          <input ref={ref} value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) save(); if (e.key === 'Escape') onClose(); }}
            placeholder='Title · "Meeting notes" · "Idea in Meetings"'
            style={{ background: 'transparent', color: theme.colors.textPrimary }}
            className="flex-1 text-sm outline-none font-medium placeholder:opacity-50" />
          <button onClick={onClose} style={{ color: theme.colors.textMuted }}><X className="w-4 h-4" /></button>
        </div>
        {ok ? (
          <div className="px-4 py-3 text-sm font-medium" style={{ color: theme.colors.success }}>{ok}</div>
        ) : (
          <>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
              placeholder="Optional: start writing…" rows={3}
              style={{ background: theme.colors.bgSecondary, color: theme.colors.textPrimary, borderBottom: `1px solid ${theme.colors.border}` }}
              className="w-full px-4 py-3 text-sm outline-none resize-none placeholder:opacity-40" />
            <div className="p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: theme.colors.textMuted }}>Quick create</p>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => setTitle(s)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-colors"
                  style={{ color: theme.colors.textSecondary }}
                  onMouseEnter={e => (e.currentTarget.style.background = theme.colors.bgTertiary)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: theme.colors.textMuted }} />{s}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
          <div className="flex gap-3">
            <span className="text-[10px]" style={{ color: theme.colors.textMuted }}><kbd className="px-1 rounded" style={{ background: theme.colors.bgTertiary }}>Enter</kbd> create</span>
            <span className="text-[10px]" style={{ color: theme.colors.textMuted }}><kbd className="px-1 rounded" style={{ background: theme.colors.bgTertiary }}>Esc</kbd> close</span>
          </div>
          <button onClick={save} disabled={!title.trim()}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
            style={{ background: theme.colors.accent, color: theme.colors.buttonText }}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notes Home Dashboard ─────────────────────────────────────────────────────

function NotesDashboard({ notes, sections, pinnedIds, onOpenNote, onCreateNote, onCreateFromTemplate, onTogglePin }: {
  notes: Note[]; sections: NoteSection[]; pinnedIds: Set<string>;
  onOpenNote: (id: string) => void; onCreateNote: (sectionId?: string) => void;
  onCreateFromTemplate: (tpl: typeof TEMPLATES[0]) => void; onTogglePin: (id: string) => void;
}) {
  const { theme } = useTheme();
  const recent = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  const pinned = notes.filter(n => pinnedIds.has(n.id));

  const NoteCard = ({ note }: { note: Note }) => {
    const section = sections.find(s => s.id === note.sectionId);
    const tags    = extractTags(note.content);
    const preview = extractPreview(note.content);
    return (
      <div onClick={() => onOpenNote(note.id)}
        className="note-dashboard-card group p-3.5 rounded-xl cursor-pointer transition-all"
        style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}` }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = theme.colors.accent; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = theme.colors.border; }}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-semibold truncate" style={{ color: theme.colors.textPrimary }}>{note.title}</p>
          <button onClick={e => { e.stopPropagation(); onTogglePin(note.id); }}
            className="shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
            style={{ color: pinnedIds.has(note.id) ? '#f59e0b' : theme.colors.textMuted }}>
            <Pin className="w-3 h-3" />
          </button>
        </div>
        {preview && <p className="text-xs leading-relaxed mb-2 line-clamp-2" style={{ color: theme.colors.textMuted }}>{preview}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] flex items-center gap-1" style={{ color: theme.colors.textMuted }}><Clock className="w-2.5 h-2.5" />{timeAgo(note.updatedAt)}</span>
          {section && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1" style={{ background: theme.colors.bgTertiary, color: theme.colors.textSecondary }}><Folder className="w-2.5 h-2.5" />{section.name}</span>}
          {tags.map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: theme.colors.accentLight, color: theme.colors.accentText }}>{tag}</span>)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8" style={{ background: theme.colors.bgSecondary }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: theme.colors.textPrimary }}>Notes</h2>
          <p className="text-xs mt-0.5" style={{ color: theme.colors.textMuted }}>{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
        </div>
        <Button size="sm" onClick={() => onCreateNote()}><Plus className="w-3.5 h-3.5 mr-1.5" />New Note</Button>
      </div>

      {pinned.length > 0 && (
        <section className="mb-7">
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: theme.colors.textMuted }}><Pin className="w-3 h-3" />Pinned</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pinned.map(n => <NoteCard key={n.id} note={n} />)}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mb-7">
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: theme.colors.textMuted }}><Clock className="w-3 h-3" />Recent</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {recent.map(n => <NoteCard key={n.id} note={n} />)}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: theme.colors.textMuted }}><Layout className="w-3 h-3" />Templates</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TEMPLATES.map(tpl => {
            const Icon = tpl.icon;
            return (
              <button key={tpl.id} onClick={() => onCreateFromTemplate(tpl)}
                className="note-template-card group flex flex-col items-start gap-2 p-3.5 rounded-xl text-left transition-all"
                style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = theme.colors.accent; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = theme.colors.border; }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: tpl.bg }}>
                  <Icon className="w-4 h-4" style={{ color: tpl.color }} />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: theme.colors.textPrimary }}>{tpl.label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: theme.colors.textMuted }}>Use template</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {notes.length === 0 && (
        <div className="mt-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: theme.colors.accentLight }}>
            <BookOpen className="w-8 h-8" style={{ color: theme.colors.accent, opacity: 0.6 }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: theme.colors.textSecondary }}>No notes yet</p>
          <p className="text-xs mb-4" style={{ color: theme.colors.textMuted }}>Start with a template or create a blank note</p>
          <button onClick={() => onCreateNote()} className="px-4 py-2 text-sm font-medium rounded-xl transition-colors"
            style={{ background: theme.colors.accent, color: theme.colors.buttonText }}>
            Create first note
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

interface TabBarProps {
  pane: Pane; notes: Note[]; isActive: boolean;
  onActivate: () => void; onOpen: (tabId: string) => void; onClose: (tabId: string) => void;
  onPin: (tabId: string) => void; onReorder: (fromIdx: number, toIdx: number) => void;
  onSplitH: () => void; onSplitV: () => void; onClosePane: () => void;
  canClosePane: boolean; onNew: () => void;
}

function TabBar({ pane, notes, isActive, onActivate, onOpen, onClose, onPin, onReorder, onSplitH, onSplitV, onClosePane, canClosePane, onNew }: TabBarProps) {
  const { theme } = useTheme();
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const MAX_VISIBLE = 6;
  const pinnedTabs  = pane.tabs.filter(t => t.isPinned);
  const normalTabs  = pane.tabs.filter(t => !t.isPinned);
  const orderedTabs = [...pinnedTabs, ...normalTabs];
  const visibleTabs = orderedTabs.slice(0, MAX_VISIBLE);
  const overflow    = orderedTabs.slice(MAX_VISIBLE);
  const [showOverflow, setShowOverflow] = useState(false);

  return (
    <div
      onClick={onActivate}
      className="note-tab-bar flex items-stretch h-9 shrink-0 overflow-hidden"
      style={{
        background: theme.colors.bgSecondary,
        borderBottom: `1px solid ${theme.colors.border}`,
        outline: isActive ? `1px solid ${theme.colors.accent}30` : 'none',
      }}
    >
      <div className="flex items-end flex-1 overflow-hidden px-1 pt-1 gap-0 min-w-0">
        {visibleTabs.map((tab, idx) => {
          const note    = notes.find(n => n.id === tab.id);
          const isAct   = pane.activeTabId === tab.id;
          const isDragT = dragOver === idx;
          return (
            <div key={tab.id}
              draggable
              onDragStart={() => { dragIdx.current = idx; }}
              onDragOver={e => { e.preventDefault(); setDragOver(idx); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => { if (dragIdx.current !== null && dragIdx.current !== idx) onReorder(dragIdx.current, idx); dragIdx.current = null; setDragOver(null); }}
              onDragEnd={() => { dragIdx.current = null; setDragOver(null); }}
              onClick={e => { e.stopPropagation(); onOpen(tab.id); }}
              className={cn('note-tab group flex items-center gap-1.5 px-2.5 py-1.5 max-w-[160px] min-w-0 rounded-t-lg text-xs font-medium cursor-pointer select-none shrink-0 transition-all relative border border-b-0',
                isAct ? 'active -mb-px z-10' : '',
                isDragT ? 'border-l-2' : '')}
              style={{
                background: isAct ? theme.colors.cardBg : 'transparent',
                borderColor: isAct ? theme.colors.border : 'transparent',
                borderLeftColor: isDragT ? theme.colors.accent : undefined,
                color: isAct ? theme.colors.accentText : theme.colors.textMuted,
              }}
            >
              <GripVertical className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 -ml-1 transition-opacity" style={{ color: theme.colors.textMuted }} />
              <FileText className="w-3 h-3 shrink-0" style={{ color: isAct ? theme.colors.accent : theme.colors.textMuted }} />
              <span className="truncate">{note?.title ?? 'Untitled'}</span>
              {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: theme.colors.accent }} />}
              {tab.isPinned && <Pin className="w-2.5 h-2.5 shrink-0" style={{ color: '#f59e0b' }} />}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 shrink-0">
                <button onClick={e => { e.stopPropagation(); onPin(tab.id); }}
                  className="w-3.5 h-3.5 rounded flex items-center justify-center transition-colors"
                  style={{ color: theme.colors.textMuted }}>
                  <Pin className="w-2.5 h-2.5" />
                </button>
                {!tab.isPinned && (
                  <button onClick={e => { e.stopPropagation(); onClose(tab.id); }}
                    className="w-3.5 h-3.5 rounded flex items-center justify-center transition-colors"
                    style={{ color: theme.colors.textMuted }}>
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {overflow.length > 0 && (
          <div className="relative shrink-0">
            <button onClick={e => { e.stopPropagation(); setShowOverflow(v => !v); }}
              className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-t-lg transition-colors"
              style={{ color: theme.colors.textMuted }}>
              +{overflow.length}
            </button>
            {showOverflow && (
              <div className="absolute left-0 top-full z-30 rounded-xl shadow-lg overflow-hidden w-48 mt-1" style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}` }}>
                {overflow.map(tab => {
                  const note = notes.find(n => n.id === tab.id);
                  return (
                    <button key={tab.id} onClick={() => { onOpen(tab.id); setShowOverflow(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors"
                      style={{ color: theme.colors.textSecondary }}
                      onMouseEnter={e => (e.currentTarget.style.background = theme.colors.bgTertiary)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: theme.colors.textMuted }} />
                      <span className="truncate">{note?.title ?? 'Untitled'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button onClick={e => { e.stopPropagation(); onNew(); }}
          className="flex items-center justify-center w-7 h-7 mt-0.5 rounded transition-colors shrink-0 ml-0.5"
          style={{ color: theme.colors.textMuted }}
          title="New note">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-0.5 px-2 shrink-0 ml-1" style={{ borderLeft: `1px solid ${theme.colors.border}` }}>
        <button onClick={e => { e.stopPropagation(); onSplitH(); }} title="Split right"
          className="p-1 rounded transition-colors" style={{ color: theme.colors.textMuted }}>
          <SplitSquareHorizontal className="w-3.5 h-3.5" />
        </button>
        <button onClick={e => { e.stopPropagation(); onSplitV(); }} title="Split down"
          className="p-1 rounded transition-colors" style={{ color: theme.colors.textMuted }}>
          <SplitSquareVertical className="w-3.5 h-3.5" />
        </button>
        {canClosePane && (
          <button onClick={e => { e.stopPropagation(); onClosePane(); }} title="Close pane"
            className="p-1 rounded transition-colors" style={{ color: theme.colors.textMuted }}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Single Pane Editor ───────────────────────────────────────────────────────

interface PaneEditorProps {
  pane: Pane; notes: Note[]; sections: NoteSection[];
  tasks: ReturnType<typeof useAppStore>['tasks'];
  isActive: boolean; pinnedIds: Set<string>; showContextPanel: boolean;
  canClosePane: boolean; dispatch: React.Dispatch<LayoutAction>;
  onCreateNote: (paneId: string, sectionId?: string) => void;
  updateNote: (id: string, updates: any) => void;
  onGoToTask: (taskId: string, projectId?: string) => void;
  onUnlinkTask: (noteId: string, taskId: string) => void;
  onTogglePin: (noteId: string) => void; onDeleteNote: (note: Note) => void;
  onToggleContextPanel: () => void; workspaceSections: NoteSection[];
  onBackToDashboard: () => void;
  getUniqueName: (base: string, sectionId: string | undefined, excludeId?: string) => string;
}

function PaneEditor({ pane, notes, sections, tasks, isActive, pinnedIds, showContextPanel, canClosePane, dispatch,
  onCreateNote, updateNote, onGoToTask, onUnlinkTask, onTogglePin, onDeleteNote, onToggleContextPanel, workspaceSections, onBackToDashboard, getUniqueName }: PaneEditorProps) {
  const { theme } = useTheme();
  const note = notes.find(n => n.id === pane.activeTabId);
  const [isEditing,      setIsEditing]      = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleVal,   setEditTitleVal]   = useState('');
  const [selection,      setSelection]      = useState<{ text: string; x: number; y: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    const el = editorRef.current;
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) { setSelection(null); return; }
      const text = sel.toString().trim();
      if (text.length < 3 || text.length > 200) { setSelection(null); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelection({ text, x: rect.left + rect.width / 2, y: rect.top - 8 });
    };
    el.addEventListener('mouseup', handler);
    return () => el.removeEventListener('mouseup', handler);
  }, [note?.id]);

  const linkedTasks = useMemo(() =>
    note ? tasks.filter(t => (note.linkedTaskIds ?? []).includes(t.id)) : [],
    [note, tasks]
  );

  const handleTitleSave = () => {
    if (!note) return;
    const trimmed = editTitleVal.trim();
    if (trimmed && trimmed !== note.title)
      updateNote(note.id, { title: getUniqueName(trimmed, note.sectionId, note.id) });
    setIsEditingTitle(false);
  };

  const handleUnlinkTask = (taskId: string) => { if (note) onUnlinkTask(note.id, taskId); };

  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: theme.colors.textMuted }}>
        <FileText className="w-10 h-10 opacity-20" />
        <p className="text-sm">No note open</p>
        <button onClick={() => onCreateNote(pane.id)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5"
          style={{ background: theme.colors.accent, color: theme.colors.buttonText }}>
          <Plus className="w-3.5 h-3.5" /> New note
        </button>
      </div>
    );
  }

  const section = workspaceSections.find(s => s.id === note.sectionId);

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        {/* Header */}
        <div className="note-breadcrumb-area px-5 pt-3.5 pb-0 shrink-0" style={{ background: theme.colors.cardBg, borderBottom: `1px solid ${theme.colors.border}` }}>
          <nav className="flex items-center gap-1 text-xs mb-2.5 font-medium" style={{ color: theme.colors.textMuted }}>
            <button onClick={onBackToDashboard} className="transition-colors hover:opacity-80" style={{ color: theme.colors.textMuted }}>Notes</button>
            {section && <>
              <ChevronRight className="w-3 h-3 shrink-0" style={{ color: theme.colors.border }} />
              <span style={{ color: theme.colors.textSecondary }}>{section.name}</span>
            </>}
            <ChevronRight className="w-3 h-3 shrink-0" style={{ color: theme.colors.border }} />
            <span className="font-semibold truncate max-w-[180px]" style={{ color: theme.colors.textPrimary }}>{note.title}</span>
          </nav>

          <div className="flex items-start justify-between gap-4 pb-3">
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <input autoFocus value={editTitleVal} onChange={e => setEditTitleVal(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setIsEditingTitle(false); }}
                  className="text-lg md:text-xl font-bold outline-none bg-transparent w-full pb-0.5"
                  style={{ color: theme.colors.textPrimary, borderBottom: `2px solid ${theme.colors.accent}` }} />
              ) : (
                <h1 className="text-lg md:text-xl font-bold truncate cursor-text rounded px-1 -ml-1 py-0.5 transition-colors"
                  style={{ color: theme.colors.textPrimary }}
                  onDoubleClick={() => { setIsEditingTitle(true); setEditTitleVal(note.title); }}>
                  {note.title}
                </h1>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs" style={{ color: theme.colors.textMuted }}>
                <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" />{format(note.updatedAt, 'MMM d, h:mm a')}</span>
                {section && <span className="flex items-center gap-1 px-2 py-0.5 rounded-md font-medium" style={{ background: theme.colors.accentLight, color: theme.colors.accentText }}><Folder className="w-3 h-3" />{section.name}</span>}
                {linkedTasks.length > 0 && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full font-medium" style={{ background: theme.colors.accentLight, color: theme.colors.accentText }}><LinkIcon className="w-3 h-3" />{linkedTasks.length} task{linkedTasks.length !== 1 ? 's' : ''}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onTogglePin(note.id)} title={pinnedIds.has(note.id) ? 'Unpin' : 'Pin'}
                className="p-1.5 rounded-lg transition-all"
                style={{ color: pinnedIds.has(note.id) ? '#f59e0b' : theme.colors.textMuted, background: pinnedIds.has(note.id) ? '#fffbeb' : 'transparent' }}>
                <Pin className="w-4 h-4" />
              </button>
              <button onClick={onToggleContextPanel}
                className="p-1.5 rounded-lg transition-all"
                style={{ color: showContextPanel ? theme.colors.accent : theme.colors.textMuted, background: showContextPanel ? theme.colors.accentLight : 'transparent' }}>
                <PanelRight className="w-4 h-4" />
              </button>
              <button onClick={() => onDeleteNote(note)}
                className="p-1.5 rounded-lg transition-all"
                style={{ color: theme.colors.textMuted }}>
                <Trash2 className="w-4 h-4" />
              </button>
              <Button size="sm" variant={isEditing ? 'default' : 'outline'}
                className={cn('h-8 text-xs ml-1', isEditing && 'text-white')}
                style={isEditing ? { background: theme.colors.accent } : {}}
                onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? 'Preview' : 'Edit'}
              </Button>
            </div>
          </div>
        </div>

        {/* Linked tasks bar */}
        {linkedTasks.length > 0 && (
          <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap shrink-0" style={{ background: theme.colors.accentLight, borderBottom: `1px solid ${theme.colors.border}` }}>
            <CheckSquare className="w-3.5 h-3.5 shrink-0" style={{ color: theme.colors.accent }} />
            {linkedTasks.map(t => (
              <div key={t.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs group"
                style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}`, color: theme.colors.accentText }}>
                <button onClick={() => onGoToTask(t.id, t.projectId)} className="hover:underline">{t.title}</button>
                <button onClick={() => handleUnlinkTask(t.id)} className="opacity-0 group-hover:opacity-100 transition-all" style={{ color: theme.colors.textMuted }}><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Editor area */}
        <div ref={editorRef} className="flex-1 overflow-y-auto relative" style={{ background: theme.colors.bgSecondary }}>
          {isEditing ? (
            <textarea
              className="note-textarea-editor w-full h-full min-h-full p-5 md:p-7 text-sm resize-none outline-none font-mono leading-relaxed"
              style={{ background: theme.colors.editorBg, color: theme.colors.textPrimary, minHeight: '100%' }}
              value={note.content}
              onChange={e => {
                
                updateNote(note.id, { content: e.target.value });
                dispatch({ type: 'MARK_DIRTY', noteId: note.id });
  
              }}
              onBlur={() => dispatch({ type: 'MARK_CLEAN', noteId: note.id })}
              placeholder="Start writing…"
            />
          ) : (
            <div className="note-preview-area p-5 md:p-9 min-h-full shadow-sm" style={{ background: theme.colors.cardBg }}>
                 <NoteEditor content={note.content} isEditing={false} setIsEditing={setIsEditing}
                onChange={content => {
                  console.log("Note Change")
                  updateNote(note.id, { content }); dispatch({ type: 'MARK_DIRTY', noteId: note.id

                   }); }} />
            </div>
          )}

          {selection && (
            <div className="fixed z-40 rounded-xl shadow-2xl overflow-hidden flex"
              style={{ left: Math.min(selection.x - 90, window.innerWidth - 300), top: selection.y - 48, transform: 'translateY(-100%)', background: theme.colors.bgTertiary, border: `1px solid ${theme.colors.border}` }}>
              <button onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }}
                className="px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5"
                style={{ color: theme.colors.textSecondary, borderRight: `1px solid ${theme.colors.border}` }}>
                <CheckSquare className="w-3 h-3" style={{ color: theme.colors.accent }} /> Create task
              </button>
              <button onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }}
                className="px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5"
                style={{ color: theme.colors.textSecondary, borderRight: `1px solid ${theme.colors.border}` }}>
                <CalendarIcon className="w-3 h-3" style={{ color: theme.colors.info }} /> Schedule
              </button>
              <button onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }}
                className="px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5"
                style={{ color: theme.colors.textSecondary }}>
                <DollarSign className="w-3 h-3" style={{ color: theme.colors.success }} /> Log transaction
              </button>
            </div>
          )}
        </div>
      </div>

      {showContextPanel && (
        <ContextPanel note={note} tasks={tasks}
          onGoToTask={onGoToTask} onUnlinkTask={handleUnlinkTask}
          onClose={onToggleContextPanel} />
      )}
    </div>
  );
}

// ─── Context Panel ────────────────────────────────────────────────────────────

function ContextPanel({ note, tasks, onGoToTask, onUnlinkTask, onClose }: {
  note: Note; tasks: any[]; onGoToTask: (id: string, pid?: string) => void;
  onUnlinkTask: (taskId: string) => void; onClose: () => void;
}) {
  const { theme } = useTheme();
  const linked = tasks.filter(t => (note.linkedTaskIds ?? []).includes(t.id));
  const tags   = extractTags(note.content);
  const money  = [...new Set((note.content.match(/£[\d,]+(?:\.\d{2})?/g) ?? []).slice(0, 5))];
  const words  = note.content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="note-context-panel w-56 shrink-0 flex flex-col overflow-hidden"
      style={{ background: theme.colors.bgSecondary, borderLeft: `1px solid ${theme.colors.border}` }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.colors.textMuted }}>Context</span>
        <button onClick={onClose} className="transition-colors" style={{ color: theme.colors.textMuted }}><PanelRightClose className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {linked.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: theme.colors.textMuted }}><CheckSquare className="w-3 h-3" />Linked Tasks</p>
            <div className="space-y-1.5">
              {linked.map(t => (
                <div key={t.id} className="group flex items-start gap-2 p-2 rounded-lg transition-colors"
                  style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = theme.colors.accent)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = theme.colors.border)}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: theme.colors.accent }} />
                  <div className="flex-1 min-w-0">
                    <button onClick={() => onGoToTask(t.id, t.projectId)} className="text-xs font-medium text-left truncate block w-full hover:underline" style={{ color: theme.colors.textSecondary }}>{t.title}</button>
                    <span className="text-[10px] capitalize" style={{ color: theme.colors.textMuted }}>{t.status}</span>
                  </div>
                  <button onClick={() => onUnlinkTask(t.id)} className="opacity-0 group-hover:opacity-100 transition-all shrink-0" style={{ color: theme.colors.textMuted }}><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
        {money.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: theme.colors.textMuted }}><DollarSign className="w-3 h-3" />Amounts</p>
            <div className="flex flex-wrap gap-1.5">
              {money.map(m => <span key={m} className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: `${theme.colors.success}20`, color: theme.colors.success }}>{m}</span>)}
            </div>
          </div>
        )}
        {tags.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: theme.colors.textMuted }}><Hash className="w-3 h-3" />Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => <span key={tag} className="text-[10px] font-medium px-2 py-1 rounded-full" style={{ background: theme.colors.accentLight, color: theme.colors.accentText }}>{tag}</span>)}
            </div>
          </div>
        )}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: theme.colors.textMuted }}><Sparkles className="w-3 h-3" />Stats</p>
          <div className="space-y-1 text-xs" style={{ color: theme.colors.textSecondary }}>
            <div className="flex justify-between"><span>Words</span><span className="font-medium" style={{ color: theme.colors.textPrimary }}>{words}</span></div>
            <div className="flex justify-between"><span>Characters</span><span className="font-medium" style={{ color: theme.colors.textPrimary }}>{note.content.length}</span></div>
            <div className="flex justify-between"><span>Modified</span><span className="font-medium" style={{ color: theme.colors.textPrimary }}>{timeAgo(note.updatedAt)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Recursive layout renderer ────────────────────────────────────────────────

interface LayoutRendererProps {
  layout: Layout; activePaneId: string; notes: Note[]; sections: NoteSection[];
  tasks: any[]; pinnedIds: Set<string>; showContextPanelFor: string | null;
  dispatch: React.Dispatch<LayoutAction>;
  onCreateNote: (paneId: string, sectionId?: string) => void;
  updateNote: (id: string, updates: any) => void;
  onGoToTask: (taskId: string, projectId?: string) => void;
  onUnlinkTask: (noteId: string, taskId: string) => void;
  onTogglePin: (noteId: string) => void; onDeleteNote: (note: Note) => void;
  toggleContextPanel: (paneId: string) => void; totalPanes: number;
  workspaceSections: NoteSection[]; onBackToDashboard: (paneId: string) => void;
  getUniqueName: (base: string, sectionId: string | undefined, excludeId?: string) => string;
  allNotes: Note[];
}

function LayoutRenderer(props: LayoutRendererProps) {
  const { layout, activePaneId, dispatch, totalPanes } = props;
  const { theme } = useTheme();

  if (layout.type === 'leaf') {
    const { pane } = layout;
    const isActive = pane.id === activePaneId;
    const showCtx  = props.showContextPanelFor === pane.id;

    return (
      <div className={cn('flex flex-col min-h-0 min-w-0 h-full')}
        style={{ outline: isActive ? `1px solid ${theme.colors.accent}30` : 'none' }}
        onClick={() => dispatch({ type: 'SET_ACTIVE_PANE', paneId: pane.id })}>
        <TabBar
          pane={pane} notes={props.allNotes} isActive={isActive}
          onActivate={() => dispatch({ type: 'SET_ACTIVE_PANE', paneId: pane.id })}
          onOpen={tabId => dispatch({ type: 'ACTIVATE', paneId: pane.id, tabId })}
          onClose={tabId => dispatch({ type: 'CLOSE_TAB', paneId: pane.id, tabId })}
          onPin={tabId => dispatch({ type: 'PIN_TAB', paneId: pane.id, tabId })}
          onReorder={(f, t) => dispatch({ type: 'REORDER', paneId: pane.id, fromIdx: f, toIdx: t })}
          onSplitH={() => dispatch({ type: 'SPLIT', paneId: pane.id, dir: 'h' })}
          onSplitV={() => dispatch({ type: 'SPLIT', paneId: pane.id, dir: 'v' })}
          onClosePane={() => dispatch({ type: 'CLOSE_PANE', paneId: pane.id })}
          canClosePane={totalPanes > 1}
          onNew={() => props.onCreateNote(pane.id)}
        />
        <PaneEditor pane={pane} notes={props.notes} sections={props.sections} tasks={props.tasks}
          isActive={isActive} pinnedIds={props.pinnedIds} showContextPanel={showCtx}
          canClosePane={totalPanes > 1} dispatch={dispatch}
          onCreateNote={props.onCreateNote} updateNote={props.updateNote}
          onGoToTask={props.onGoToTask} onUnlinkTask={props.onUnlinkTask}
          onTogglePin={props.onTogglePin} onDeleteNote={props.onDeleteNote}
          onToggleContextPanel={() => props.toggleContextPanel(pane.id)}
          workspaceSections={props.workspaceSections}
          onBackToDashboard={() => props.onBackToDashboard(pane.id)}
          getUniqueName={props.getUniqueName}
        />
      </div>
    );
  }

  const splitRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const ratio = layout.dir === 'h'
        ? (ev.clientX - rect.left) / rect.width
        : (ev.clientY - rect.top)  / rect.height;
      const leftPaneId = allPanes(layout.left)[0]?.id;
      if (leftPaneId) dispatch({ type: 'RESIZE', splitLeftPaneId: leftPaneId, ratio });
    };
    const onUp = () => { dragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const isH = layout.dir === 'h';
  const pct  = Math.round(layout.ratio * 100);

  return (
    <div ref={splitRef} className={cn('flex h-full min-h-0 min-w-0', isH ? 'flex-row' : 'flex-col')}>
      <div style={isH ? { width: `${pct}%` } : { height: `${pct}%` }} className="min-w-0 min-h-0 overflow-hidden">
        <LayoutRenderer {...props} layout={layout.left} />
      </div>
      <div onMouseDown={startResize}
        className={cn('shrink-0 relative group z-10 transition-colors',
          isH ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize')}
        style={{ background: theme.colors.border }}
        onMouseEnter={e => (e.currentTarget.style.background = theme.colors.accent)}
        onMouseLeave={e => (e.currentTarget.style.background = theme.colors.border)}
      />
      <div style={isH ? { width: `${100 - pct}%` } : { height: `${100 - pct}%` }} className="min-w-0 min-h-0 overflow-hidden">
        <LayoutRenderer {...props} layout={layout.right} />
      </div>
    </div>
  );
}

// ─── Notes Page ───────────────────────────────────────────────────────────────

export function Notes() {
  const {
    workspace, notes, noteSections, selectedNoteId,
    setSelectedNoteId, addNote, updateNote, deleteNote,
    addNoteSection, deleteNoteSection, tasks, updateTask,
    setSelectedTaskId, setCurrentView, setSelectedProjectId,
  } = useAppStore();
  const { theme } = useTheme();

  const initPane = useMemo(() => makePane(), []);
  const [ls, dispatch] = useReducer(layoutReducer, {
    layout: makeLeaf(initPane),
    activePaneId: initPane.id,
  });

  const [searchQuery,       setSearchQuery]       = useState('');
  const [sortBy,            setSortBy]            = useState<'updated'|'a-z'|'z-a'>('updated');
  const [isAddingSection,   setIsAddingSection]   = useState(false);
  const [newSectionName,    setNewSectionName]    = useState('');
  const [contextMenu,       setContextMenu]       = useState<{ x: number; y: number; note: Note }|null>(null);
  const [folderMenu,        setFolderMenu]        = useState<{ x: number; y: number; section: NoteSection }|null>(null);
  const [expandedSections,  setExpandedSections]  = useState<Record<string,boolean>>({});
  const [renamingNoteId,    setRenamingNoteId]    = useState<string|null>(null);
  const [renameValue,       setRenameValue]       = useState('');
  const [showDeleteNote,    setShowDeleteNote]    = useState<Note|null>(null);
  const [showDeleteFolder,  setShowDeleteFolder]  = useState<NoteSection|null>(null);
  const [dragConflict,      setDragConflict]      = useState<{ noteId: string; targetSectionId: string|undefined; newName: string }|null>(null);
  const [sidebarWidth,      setSidebarWidth]      = useState(264);
  const [isDraggingBar,     setIsDraggingBar]     = useState(false);
  const [pinnedIds,         setPinnedIds]         = useState<Set<string>>(new Set());
  const [showCtxPanelFor,   setShowCtxPanelFor]   = useState<string|null>(null);
  const [showQuickCapture,  setShowQuickCapture]  = useState(false);
  const [showDashboard,     setShowDashboard]     = useState(false);
  const [showSidebar,       setShowSidebar]       = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileMenu,    setShowMobileMenu]    = useState(false);


  const workspaceNotes    = useMemo(() => notes.filter(n => n.workspace === workspace), [notes, workspace]);
  const workspaceSections = useMemo(() => noteSections.filter(s => s.workspace === workspace), [noteSections, workspace]);

  const filteredNotes = useMemo(() => workspaceNotes.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  ), [workspaceNotes, searchQuery]);

  const sortedNotes = useMemo(() => [...filteredNotes].sort((a, b) => {
    if (sortBy === 'updated') return b.updatedAt - a.updatedAt;
    if (sortBy === 'a-z')     return a.title.localeCompare(b.title);
    return b.title.localeCompare(a.title);
  }), [filteredNotes, sortBy]);

  const panes      = useMemo(() => allPanes(ls.layout), [ls.layout]);
  const totalPanes = panes.length;
  const activePane = panes.find(p => p.id === ls.activePaneId) ?? panes[0];

  useEffect(() => {
    if (activePane?.activeTabId) setSelectedNoteId(activePane.activeTabId);
  }, [activePane?.activeTabId, setSelectedNoteId]);

  useEffect(() => {
    if (selectedNoteId && activePane && !activePane.tabs.find(t => t.id === selectedNoteId)) {
      dispatch({ type: 'OPEN', paneId: activePane.id, noteId: selectedNoteId });
    }
  }, [selectedNoteId]);

  useEffect(() => {
    if (!contextMenu && !folderMenu) return;
    const h = () => { setContextMenu(null); setFolderMenu(null); };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [contextMenu, folderMenu]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setContextMenu(null); setFolderMenu(null); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && activePane) {
        e.preventDefault();
        const tabs = activePane.tabs;
        if (tabs.length < 2) return;
        const idx = tabs.findIndex(t => t.id === activePane.activeTabId);
        const next = tabs[(idx + 1) % tabs.length];
        dispatch({ type: 'ACTIVATE', paneId: activePane.id, tabId: next.id });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w' && activePane?.activeTabId) {
        e.preventDefault();
        dispatch({ type: 'CLOSE_TAB', paneId: activePane.id, tabId: activePane.activeTabId });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); setShowQuickCapture(true); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [activePane]);

  useEffect(() => {
    if (!isDraggingBar) return;
    const onMove = (e: MouseEvent) => setSidebarWidth(Math.max(200, Math.min(480, e.clientX - 64)));
    const onUp   = () => setIsDraggingBar(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [isDraggingBar]);

  const getUniqueName = useCallback((baseName: string, sectionId: string|undefined, excludeId?: string) => {
    const existing = new Set(workspaceNotes.filter(n => n.sectionId === sectionId && n.id !== excludeId).map(n => n.title));
    if (!existing.has(baseName)) return baseName;
    let i = 1; while (existing.has(`${baseName} ${i}`)) i++;
    return `${baseName} ${i}`;
  }, [workspaceNotes]);

  const handleCreateNote = useCallback((paneId?: string, sectionId?: string, initialContent?: string) => {
    const uniqueName = getUniqueName('Untitled Note', sectionId);
    const id = uuidv4();
    addNote({ id, title: uniqueName, content: initialContent ?? '', workspace, linkedTaskIds: [], sectionId } as any);
    const targetPaneId = paneId ?? ls.activePaneId;
    dispatch({ type: 'OPEN', paneId: targetPaneId, noteId: id });
    setShowDashboard(false);
  }, [getUniqueName, addNote, workspace, ls.activePaneId]);

  const handleCreateFromTemplate = useCallback((tpl: typeof TEMPLATES[0]) => {
    const title = `${tpl.label} — ${format(new Date(), 'MMM d')}`;
    const uniqueName = getUniqueName(title, undefined);
    const id = uuidv4();
    addNote({ id, title: uniqueName, content: tpl.content, workspace, linkedTaskIds: [] } as any);
    dispatch({ type: 'OPEN', paneId: ls.activePaneId, noteId: id });
    setShowDashboard(false);
  }, [getUniqueName, addNote, workspace, ls.activePaneId]);

  const handleCreateSection = () => {
    if (newSectionName.trim()) { addNoteSection({ name: newSectionName, workspace }); setNewSectionName(''); setIsAddingSection(false); }
  };

  const confirmDeleteNote = (note: Note) => {
    // 1. Safely extract the array, even if the database returned a string
    let taskIds = [];
    if (Array.isArray(note.linkedTaskIds)) {
      taskIds = note.linkedTaskIds;
    } else if (typeof note.linkedTaskIds === 'string') {
      try { 
        taskIds = JSON.parse(note.linkedTaskIds); 
      } catch (e) { 
        console.warn("Failed to parse linkedTaskIds:", note.linkedTaskIds); 
      }
    }

    // 2. Iterate over the guaranteed array
    taskIds.forEach(tid => {
      const t = tasks.find(t => t.id === tid);
      if (t) {
        // 3. Apply the same safety check to the Task's linked notes array!
        const noteIds = Array.isArray(t.linkedNoteIds) ? t.linkedNoteIds : [];
        updateTask(tid, { linkedNoteIds: noteIds.filter(id => id !== note.id) });
      }
    });
    
    // 4. Close all tabs containing this note across all panes
    allPanes(ls.layout).forEach(pane => {
      const hasTab = pane.tabs.find(t => t.id === note.id);
      if (hasTab) {
        dispatch({ type: 'CLOSE_TAB', paneId: pane.id, tabId: note.id });
      }
    });
    
    deleteNote(note.id);
    setShowDeleteNote(null);
  };

  const handleUnlinkTask = (noteId: string, taskId: string) => {
    const n = notes.find(x => x.id === noteId);
    if (!n) return;
    updateNote(noteId, { linkedTaskIds: (n.linkedTaskIds ?? []).filter(id => id !== taskId) });
    const t = tasks.find(t => t.id === taskId);
    if (t) updateTask(taskId, { linkedNoteIds: (t.linkedNoteIds ?? []).filter(id => id !== noteId) });
  };

  const togglePin = (noteId: string) => setPinnedIds(prev => { const n = new Set(prev); n.has(noteId) ? n.delete(noteId) : n.add(noteId); return n; });
  const toggleContextPanel = (paneId: string) => setShowCtxPanelFor(prev => prev === paneId ? null : paneId);

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const note = notes.find(n => n.id === draggableId);
    if (!note) return;
    const targetSectionId = destination.droppableId === '__none__' ? undefined : destination.droppableId;
    if (note.sectionId === targetSectionId) return;
    const conflict = workspaceNotes.find(n => n.sectionId === targetSectionId && n.title === note.title && n.id !== note.id);
    if (conflict) setDragConflict({ noteId: note.id, targetSectionId, newName: note.title });
    else updateNote(note.id, { sectionId: targetSectionId });
  };

  const openNoteInActivePane = (noteId: string) => {
    dispatch({ type: 'OPEN', paneId: ls.activePaneId, noteId });
    setShowDashboard(false);
  };

  const unsectionedNotes = sortedNotes.filter(n => !n.sectionId);
  const getSectionNotes  = (sectionId: string) => sortedNotes.filter(n => n.sectionId === sectionId);
  const toggleSection    = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  const isSectionExpanded = (id: string) => expandedSections[id] !== false;

  // ── Note list item ──────────────────────────────────────────────────────────
  const renderNoteItem = (note: Note, index: number, provided?: any, snapshot?: any) => {
    const isSelected  = !!panes.some(p => p.activeTabId === note.id);
    const isRenaming  = renamingNoteId === note.id;
    const linkedCount = (note.linkedTaskIds ?? []).length;
    const tags        = extractTags(note.content);
    const isPinned    = pinnedIds.has(note.id);

    const saveRename = (n: Note) => {
      const trimmed = renameValue.trim();
      if (trimmed && trimmed !== n.title) updateNote(n.id, { title: getUniqueName(trimmed, n.sectionId, n.id) });
      setRenamingNoteId(null);
    };

    return (
      <div ref={provided?.innerRef} {...(provided?.draggableProps ?? {})} {...(provided?.dragHandleProps ?? {})}
        key={note.id}
        onClick={() => { openNoteInActivePane(note.id); setShowSidebar(false); }}
        onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, note }); }}
        className="note-list-item group flex flex-col gap-0.5 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-all"
        style={{
          background: isSelected && !snapshot?.isDragging ? theme.colors.accentLight : snapshot?.isDragging ? theme.colors.cardBg : 'transparent',
          color: isSelected ? theme.colors.accentText : theme.colors.textSecondary,
          outline: snapshot?.isDragging ? `2px solid ${theme.colors.accent}` : 'none',
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = theme.colors.bgTertiary; }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: isSelected ? theme.colors.accent : theme.colors.textMuted }} />
          {isRenaming ? (
            <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onBlur={() => saveRename(note)}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(note); if (e.key === 'Escape') setRenamingNoteId(null); }}
              onClick={e => e.stopPropagation()}
              className="flex-1 text-sm rounded px-1 py-0.5 outline-none min-w-0"
              style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.accent}`, color: theme.colors.textPrimary }} />
          ) : (
            <span className="flex-1 text-sm font-medium truncate min-w-0">{note.title}</span>
          )}
          {isPinned && <Pin className="w-2.5 h-2.5 shrink-0" style={{ color: '#f59e0b' }} />}
          <button onClick={e => { e.stopPropagation(); setContextMenu({ x: e.currentTarget.getBoundingClientRect().right, y: e.currentTarget.getBoundingClientRect().bottom, note }); }}
            className="shrink-0 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: theme.colors.textMuted }}>
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2 pl-5 flex-wrap">
          <span className="text-[10px]" style={{ color: theme.colors.textMuted }}>{timeAgo(note.updatedAt)}</span>
          {linkedCount > 0 && <span className="text-[10px] flex items-center gap-0.5" style={{ color: isSelected ? theme.colors.accentText : theme.colors.textMuted }}><LinkIcon className="w-2.5 h-2.5" />{linkedCount}</span>}
          {tags.slice(0, 2).map(tag => <span key={tag} className="text-[10px] px-1 rounded font-medium" style={{ background: theme.colors.bgTertiary, color: theme.colors.textMuted }}>{tag}</span>)}
        </div>
      </div>
    );
  };

  const showHome = showDashboard || !activePane?.activeTabId;

  // ─── Context menus ──────────────────────────────────────────────────────────
  const CtxMenuItem = ({ onClick, icon: Icon, label, danger = false }: { onClick: () => void; icon: any; label: string; danger?: boolean }) => (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left"
      style={{ color: danger ? theme.colors.danger : theme.colors.textSecondary }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? `${theme.colors.danger}15` : theme.colors.bgTertiary)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <Icon className="w-3.5 h-3.5" style={{ color: danger ? theme.colors.danger : theme.colors.textMuted }} />{label}
    </button>
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full overflow-hidden notes-sidebar" style={{ background: theme.colors.bgSecondary }}>

        {/* Mobile sidebar toggle button */}
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="md:hidden fixed bottom-6 left-6 z-40 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all"
        >
          <FileText className="w-6 h-6" />
        </button>

        {/* Mobile sidebar for file explorer */}
        {showMobileSidebar && (
          <div 
            className="fixed inset-0 z-50 lg:hidden"
            onClick={() => setShowMobileSidebar(false)}
          >
            <div 
              className="absolute inset-y-0 left-0 w-80 bg-white shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Your file explorer content here */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Notes</h2>
                  <button 
                    onClick={() => setShowMobileSidebar(false)}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Render your notes list/sections here */}
                {workspaceNotes.map(note => (
                  <button
                    key={note.id}
                    onClick={() => {
                      openNote(note.id);
                      setShowMobileSidebar(false);
                    }}
                    className="w-full text-left p-3 hover:bg-gray-50 rounded"
                  >
                    {note.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Mobile context menu */}
        {showMobileMenu && (
          <div 
            className="fixed inset-0 z-50 lg:hidden"
            onClick={() => setShowMobileMenu(false)}
          >
            <div 
              className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
                
                {/* Menu actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-lg"
                  >
                    <Edit2 className="w-5 h-5" />
                    <span>Edit Note</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      // Delete logic
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-red-50 rounded-lg text-red-600"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>Delete Note</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      // Share logic
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-lg"
                  >
                    <Share className="w-5 h-5" />
                    <span>Share Note</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Mobile backdrop */}
        {showMobileSidebar && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setShowMobileSidebar(false)}
          />
        )}

        {/* Mobile overlay */}
        {showSidebar && (
          <div 
            className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div className={cn(
          "notes-sidebar flex flex-col shrink-0 overflow-hidden transition-transform duration-300 ease-in-out",
          "md:relative md:translate-x-0",
          "fixed inset-y-0 left-0 z-40",
          showSidebar ? "translate-x-0" : "-translate-x-full"
        )} style={{ width: sidebarWidth, background: theme.colors.bgSecondary, borderRight: `1px solid ${theme.colors.border}` }}>
          
          {/* Close button for mobile */}
          <div className="md:hidden flex justify-end p-2" style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
            <button
              onClick={() => setShowSidebar(false)}
              className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 space-y-2" style={{ borderBottom: `1px solid ${theme.colors.border}`, background: theme.colors.cardBg }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: theme.colors.textMuted }} />
              <input placeholder="Search notes…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg outline-none"
                style={{ background: theme.colors.inputBg, border: `1px solid ${theme.colors.inputBorder}`, color: theme.colors.textPrimary }} />
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => handleCreateNote()} title="New note"
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-colors"
                style={{ background: theme.colors.accent, color: theme.colors.buttonText }}>
                <Plus className="w-3.5 h-3.5" /> New Note
              </button>
              <button onClick={() => setShowQuickCapture(true)} title="Quick capture (Ctrl+N)"
                className="px-2.5 py-1.5 rounded-lg transition-colors"
                style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}`, color: theme.colors.textMuted }}>
                <Zap className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsAddingSection(v => !v)} title="New folder"
                className="px-2.5 py-1.5 rounded-lg transition-colors"
                style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}`, color: theme.colors.textMuted }}>
                <Folder className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setSortBy(s => s === 'updated' ? 'a-z' : s === 'a-z' ? 'z-a' : 'updated')}
                className="px-2.5 py-1.5 rounded-lg transition-colors"
                style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}`, color: theme.colors.textMuted }}>
                <SortAsc className="w-3.5 h-3.5" />
              </button>
            </div>
            {isAddingSection && (
              <div className="flex gap-1.5">
                <input autoFocus value={newSectionName} onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateSection(); if (e.key === 'Escape') setIsAddingSection(false); }}
                  placeholder="Section name…"
                  className="flex-1 text-xs rounded-lg px-2.5 py-1.5 outline-none"
                  style={{ border: `1px solid ${theme.colors.accent}`, background: theme.colors.inputBg, color: theme.colors.textPrimary }} />
                <button onClick={handleCreateSection} className="px-3 py-1.5 text-xs font-medium rounded-lg"
                  style={{ background: theme.colors.accent, color: theme.colors.buttonText }}>Add</button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            <Droppable droppableId="__none__">
              {(drop, dropSnap) => (
                <div ref={drop.innerRef} {...drop.droppableProps}
                  className="min-h-[4px] rounded-lg transition-colors"
                  style={{ background: dropSnap.isDraggingOver ? theme.colors.accentLight : 'transparent', outline: dropSnap.isDraggingOver ? `2px solid ${theme.colors.accent}40` : 'none' }}>
                  {unsectionedNotes.map((note, i) => (
                    <Draggable key={note.id} draggableId={note.id} index={i}>
                      {(drag, snap) => renderNoteItem(note, i, drag, snap)}
                    </Draggable>
                  ))}
                  {drop.placeholder}
                </div>
              )}
            </Droppable>

            {workspaceSections.map(section => {
              const secNotes = getSectionNotes(section.id);
              const isOpen   = isSectionExpanded(section.id);
              return (
                <div key={section.id}>
                  <div className="notes-section-header flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors"
                    style={{ color: theme.colors.textMuted }}
                    onClick={() => toggleSection(section.id)}
                    onContextMenu={e => { e.preventDefault(); setFolderMenu({ x: e.clientX, y: e.clientY, section }); }}
                    onMouseEnter={e => (e.currentTarget.style.background = theme.colors.bgTertiary)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <button onClick={e => { e.stopPropagation(); toggleSection(section.id); }} className="w-4 h-4 flex items-center justify-center shrink-0">
                      {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                    {isOpen ? <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: theme.colors.accent }} /> : <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: theme.colors.textMuted }} />}
                    <span className="flex-1 text-xs font-semibold truncate" style={{ color: theme.colors.textSecondary }}>{section.name}</span>
                    <span className="text-[10px] mr-1" style={{ color: theme.colors.textMuted }}>{secNotes.length}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button onClick={e => { e.stopPropagation(); handleCreateNote(undefined, section.id); }}
                        className="w-5 h-5 flex items-center justify-center rounded transition-colors" style={{ color: theme.colors.textMuted }}><Plus className="w-3 h-3" /></button>
                      <button onClick={e => { e.stopPropagation(); setFolderMenu({ x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().bottom, section }); }}
                        className="w-5 h-5 flex items-center justify-center rounded transition-colors" style={{ color: theme.colors.textMuted }}><MoreHorizontal className="w-3 h-3" /></button>
                    </div>
                  </div>
                  {isOpen && (
                    <Droppable droppableId={section.id}>
                      {(drop, dropSnap) => (
                        <div ref={drop.innerRef} {...drop.droppableProps}
                          className="ml-4 space-y-0.5 min-h-[28px] rounded-lg transition-colors"
                          style={{ background: dropSnap.isDraggingOver ? theme.colors.accentLight : 'transparent', outline: dropSnap.isDraggingOver ? `2px solid ${theme.colors.accent}40` : 'none' }}>
                          {secNotes.map((note, i) => (
                            <Draggable key={note.id} draggableId={note.id} index={i}>
                              {(drag, snap) => renderNoteItem(note, i, drag, snap)}
                            </Draggable>
                          ))}
                          {drop.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
              );
            })}

            {workspaceNotes.length === 0 && (
              <div className="text-center py-8" style={{ color: theme.colors.textMuted }}>
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No notes yet</p>
                <button onClick={() => setShowQuickCapture(true)} className="mt-2 text-xs font-medium transition-colors" style={{ color: theme.colors.accent }}>
                  Quick capture (Ctrl+N)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Resize handle */}
        <div onMouseDown={() => setIsDraggingBar(true)}
          className="w-1 cursor-col-resize shrink-0 z-10 transition-colors"
          style={{ background: theme.colors.border }}
          onMouseEnter={e => (e.currentTarget.style.background = theme.colors.accent)}
          onMouseLeave={e => (e.currentTarget.style.background = theme.colors.border)} />

        {/* ── Main area ─────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: theme.colors.bgSecondary }}>
          {showHome ? (
            <NotesDashboard
              notes={workspaceNotes} sections={workspaceSections} pinnedIds={pinnedIds}
              onOpenNote={openNoteInActivePane}
              onCreateNote={sectionId => handleCreateNote(undefined, sectionId)}
              onCreateFromTemplate={handleCreateFromTemplate}
              onTogglePin={togglePin}
            />
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden">
              <LayoutRenderer
                layout={ls.layout} activePaneId={ls.activePaneId}
                notes={workspaceNotes} allNotes={notes} sections={workspaceSections}
                tasks={tasks} pinnedIds={pinnedIds}
                showContextPanelFor={showCtxPanelFor}
                dispatch={dispatch} totalPanes={totalPanes}
                onCreateNote={(paneId, sectionId) => handleCreateNote(paneId, sectionId)}
                updateNote={updateNote}
                onGoToTask={(taskId, projectId) => { if (projectId) setSelectedProjectId(projectId); setSelectedTaskId(taskId); setCurrentView('tasks'); }}
                onUnlinkTask={handleUnlinkTask}
                onTogglePin={togglePin}
                onDeleteNote={note => setShowDeleteNote(note)}
                toggleContextPanel={toggleContextPanel}
                workspaceSections={workspaceSections}
                onBackToDashboard={() => setShowDashboard(true)}
                getUniqueName={getUniqueName}
              />
            </div>
          )}
        </div>

        {/* ── Context menus ──────────────────────────────────────────────────── */}
        {contextMenu && (
          <div className="fixed z-50 w-48 rounded-xl shadow-xl overflow-hidden"
            style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 200), background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}` }}
            onClick={e => e.stopPropagation()}>
            <CtxMenuItem onClick={() => { setRenamingNoteId(contextMenu.note.id); setRenameValue(contextMenu.note.title); setContextMenu(null); }} icon={Edit2} label="Rename" />
            <CtxMenuItem onClick={() => { togglePin(contextMenu.note.id); setContextMenu(null); }} icon={Pin} label={pinnedIds.has(contextMenu.note.id) ? 'Unpin' : 'Pin'} />
            <CtxMenuItem onClick={() => { const n=contextMenu.note,copy=getUniqueName(`${n.title} Copy`,n.sectionId),id=uuidv4(); addNote({id,title:copy,content:n.content,workspace,sectionId:n.sectionId} as any); setContextMenu(null); }} icon={Copy} label="Duplicate" />
            <CtxMenuItem onClick={() => { sessionStorage.setItem('nexus_open_note',contextMenu.note.id); window.open(window.location.href,'_blank'); setContextMenu(null); }} icon={ExternalLink} label="Open in New Tab" />
            <div className="h-px mx-3" style={{ background: theme.colors.border }} />
            <CtxMenuItem onClick={() => { setShowDeleteNote(contextMenu.note); setContextMenu(null); }} icon={Trash2} label="Delete" danger />
          </div>
        )}
        {folderMenu && (
          <div className="fixed z-50 w-48 rounded-xl shadow-xl overflow-hidden"
            style={{ top: folderMenu.y, left: Math.min(folderMenu.x, window.innerWidth - 200), background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}` }}
            onClick={e => e.stopPropagation()}>
            <CtxMenuItem onClick={() => { handleCreateNote(undefined, folderMenu.section.id); setFolderMenu(null); }} icon={Plus} label="New note inside" />
            <div className="h-px mx-3" style={{ background: theme.colors.border }} />
            <CtxMenuItem onClick={() => { setShowDeleteFolder(folderMenu.section); setFolderMenu(null); }} icon={Trash2} label="Delete folder" danger />
          </div>
        )}

        {/* ── Confirm modals ────────────────────────────────────────────────── */}
        {showDeleteNote && (
          <ConfirmDialog title="Delete Note"
            message={<>Delete <strong>"{showDeleteNote.title}"</strong>? This cannot be undone.</>}
            confirmLabel="Delete Note"
            onConfirm={() => confirmDeleteNote(showDeleteNote)}
            onCancel={() => setShowDeleteNote(null)} />
        )}
        {showDeleteFolder && (() => {
          const count = workspaceNotes.filter(n => n.sectionId === showDeleteFolder.id).length;
          return (
            <ConfirmDialog title="Delete Folder"
              message={<>Delete <strong>"{showDeleteFolder.name}"</strong>?{count > 0 && <span className="block mt-2 font-medium" style={{ color: theme.colors.danger }}>⚠ Moves {count} note{count>1?'s':''} out of folder.</span>}</>}
              confirmLabel="Delete Folder"
              onConfirm={() => { deleteNoteSection(showDeleteFolder.id); setShowDeleteFolder(null); }}
              onCancel={() => setShowDeleteFolder(null)} />
          );
        })()}
        {dragConflict && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="rounded-2xl shadow-2xl w-full max-w-sm" style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.border}` }}>
              <div className="p-6">
                <h3 className="text-base font-semibold mb-1" style={{ color: theme.colors.textPrimary }}>Name conflict</h3>
                <p className="text-sm mb-4" style={{ color: theme.colors.textSecondary }}>A note with this name already exists. Enter a new name:</p>
                <Input autoFocus value={dragConflict.newName} onChange={e => setDragConflict({...dragConflict,newName:e.target.value})}
                  onKeyDown={e => { if(e.key==='Enter'){updateNote(dragConflict.noteId,{sectionId:dragConflict.targetSectionId,title:dragConflict.newName.trim()});setDragConflict(null);}if(e.key==='Escape')setDragConflict(null);}}
                  placeholder="New file name…" />
              </div>
              <div className="px-6 pb-5 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setDragConflict(null)}>Cancel</Button>
                <Button size="sm" disabled={!dragConflict.newName.trim()}
                  onClick={() => { updateNote(dragConflict.noteId,{sectionId:dragConflict.targetSectionId,title:dragConflict.newName.trim()}); setDragConflict(null); }}>Move & Rename</Button>
              </div>
            </div>
          </div>
        )}

        {showQuickCapture && (
          <QuickCaptureBar onClose={() => setShowQuickCapture(false)} sections={workspaceSections}
            onCapture={(title, content, sectionId) => { handleCreateNote(undefined, sectionId, content); }} />
        )}
      </div>
    </DragDropContext>
  );
}