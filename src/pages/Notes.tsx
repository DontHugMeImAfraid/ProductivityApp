import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '@/store';
import { Note, NoteSection } from '@/types';
import {
  Plus, Folder, FolderOpen, FileText, Search, MoreHorizontal,
  Trash2, Edit2, Copy, ChevronRight, ChevronDown, Calendar as CalendarIcon,
  Link as LinkIcon, ExternalLink, SortAsc, AlignLeft, X, AlertTriangle,
  GripVertical, CheckSquare
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { NoteEditor } from '@/components/NoteEditor';

// ── Confirmation Dialog ───────────────────────────────────────────────────────
function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onCancel
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="p-6">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
          <div className="text-sm text-slate-500">{message}</div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Notes() {
  const {
    workspace, notes, noteSections, selectedNoteId,
    setSelectedNoteId, addNote, updateNote, deleteNote,
    addNoteSection, deleteNoteSection, tasks, updateTask,
    setSelectedTaskId, setCurrentView, setSelectedProjectId,
  } = useAppStore();

  const [searchQuery, setSearchQuery]       = useState('');
  const [sortBy, setSortBy]                 = useState<'updated' | 'a-z' | 'z-a'>('updated');
  const [isEditing, setIsEditing]           = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName]   = useState('');
  const [contextMenu, setContextMenu]         = useState<{ x: number; y: number; note: Note } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [renamingNoteId, setRenamingNoteId]   = useState<string | null>(null);
  const [renameValue, setRenameValue]         = useState('');
  const [showDeleteNoteConfirm, setShowDeleteNoteConfirm] = useState<Note | null>(null);
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState<NoteSection | null>(null);
  const [dragConflict, setDragConflict]       = useState<{ noteId: string; targetSectionId: string | undefined; newName: string } | null>(null);
  const [sidebarWidth, setSidebarWidth]       = useState(260);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

  const workspaceNotes    = notes.filter(n => n.workspace === workspace);
  const workspaceSections = noteSections.filter(s => s.workspace === workspace);

  const filteredNotes = workspaceNotes.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (sortBy === 'updated') return b.updatedAt - a.updatedAt;
    if (sortBy === 'a-z')     return a.title.localeCompare(b.title);
    if (sortBy === 'z-a')     return b.title.localeCompare(a.title);
    return 0;
  });

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  useEffect(() => {
    if (!contextMenu) return;
    const h = () => setContextMenu(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [contextMenu]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // Sidebar resize
  useEffect(() => {
    if (!isDraggingSidebar) return;
    const onMove = (e: MouseEvent) => {
      setSidebarWidth(Math.max(200, Math.min(480, e.clientX - 64)));
    };
    const onUp = () => setIsDraggingSidebar(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDraggingSidebar]);

  const getUniqueName = useCallback(
    (baseName: string, sectionId: string | undefined, excludeId?: string) => {
      const existing = new Set(
        workspaceNotes
          .filter(n => n.sectionId === sectionId && n.id !== excludeId)
          .map(n => n.title)
      );
      if (!existing.has(baseName)) return baseName;
      let i = 1;
      while (existing.has(`${baseName} ${i}`)) i++;
      return `${baseName} ${i}`;
    },
    [workspaceNotes]
  );

  // FIX: generate id once here and pass it into addNote so both sides agree
  const handleCreateNote = (sectionId?: string) => {
    const uniqueName = getUniqueName('Untitled Note', sectionId);
    const id = uuidv4();
    addNote({ id, title: uniqueName, content: '', workspace, linkedTaskIds: [], sectionId } as any);
    setSelectedNoteId(id);
    setIsEditing(true);
    setRenamingNoteId(id);
    setRenameValue(uniqueName);
  };

  const handleCreateSection = () => {
    if (newSectionName.trim()) {
      addNoteSection({ name: newSectionName, workspace });
      setNewSectionName('');
      setIsAddingSection(false);
    }
  };

  const handleDeleteNote = (note: Note) => {
    setContextMenu(null);
    setShowDeleteNoteConfirm(note);
  };

  const confirmDeleteNote = (note: Note) => {
    // unlink from tasks
    (note.linkedTaskIds ?? []).forEach(tid => {
      const t = tasks.find(t => t.id === tid);
      if (t) updateTask(tid, { linkedNoteIds: (t.linkedNoteIds ?? []).filter(id => id !== note.id) });
    });
    deleteNote(note.id);
    if (selectedNoteId === note.id) setSelectedNoteId(null);
    setShowDeleteNoteConfirm(null);
  };

  const confirmDeleteFolder = (section: NoteSection) => {
    deleteNoteSection(section.id);
    setShowDeleteFolderConfirm(null);
  };

  const handleRenameNote = (note: Note) => {
    setContextMenu(null);
    setRenamingNoteId(note.id);
    setRenameValue(note.title);
  };

  const saveRename = (note: Note) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== note.title) {
      const unique = getUniqueName(trimmed, note.sectionId, note.id);
      updateNote(note.id, { title: unique });
    }
    setRenamingNoteId(null);
  };

  const handleTitleSave = () => {
    if (!selectedNote) return;
    const trimmed = editingTitleValue.trim();
    if (trimmed && trimmed !== selectedNote.title) {
      const unique = getUniqueName(trimmed, selectedNote.sectionId, selectedNote.id);
      updateNote(selectedNote.id, { title: unique });
    }
    setIsEditingTitle(false);
  };

  // Unlink note from a task (called from the note detail panel)
  const handleUnlinkTask = (taskId: string) => {
    if (!selectedNote) return;
    updateNote(selectedNote.id, {
      linkedTaskIds: (selectedNote.linkedTaskIds ?? []).filter(id => id !== taskId)
    });
    const t = tasks.find(t => t.id === taskId);
    if (t) updateTask(taskId, { linkedNoteIds: (t.linkedNoteIds ?? []).filter(id => id !== selectedNote.id) });
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const note = notes.find(n => n.id === draggableId);
    if (!note) return;
    const targetSectionId = destination.droppableId === '__none__' ? undefined : destination.droppableId;
    if (note.sectionId === targetSectionId) return;

    const nameConflict = workspaceNotes.find(
      n => n.sectionId === targetSectionId && n.title === note.title && n.id !== note.id
    );
    if (nameConflict) {
      setDragConflict({ noteId: note.id, targetSectionId, newName: note.title });
    } else {
      updateNote(note.id, { sectionId: targetSectionId });
    }
  };

  const handleDragConflictConfirm = () => {
    if (!dragConflict) return;
    updateNote(dragConflict.noteId, { sectionId: dragConflict.targetSectionId, title: dragConflict.newName.trim() });
    setDragConflict(null);
  };

  // Sections: unsectioned + each section
  const unsectionedNotes = sortedNotes.filter(n => !n.sectionId);
  const getSectionNotes  = (sectionId: string) => sortedNotes.filter(n => n.sectionId === sectionId);

  const toggleSection = (id: string) =>
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  const isSectionExpanded = (id: string) => expandedSections[id] !== false;

  const renderNoteItem = (note: Note, index: number, provided?: any, snapshot?: any) => {
    const isSelected  = selectedNoteId === note.id;
    const isRenaming  = renamingNoteId === note.id;
    const linkedCount = (note.linkedTaskIds ?? []).length;

    return (
      <div
        ref={provided?.innerRef}
        {...(provided?.draggableProps ?? {})}
        {...(provided?.dragHandleProps ?? {})}
        key={note.id}
        onClick={() => { setSelectedNoteId(note.id); setIsEditing(false); }}
        onContextMenu={e => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, note });
        }}
        className={cn(
          "group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer select-none",
          // Only transition colors/shadow, never transform (conflicts with dnd)
          "transition-[background-color,box-shadow] duration-150",
          isSelected && !snapshot?.isDragging
            ? "bg-violet-50 text-violet-700"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
          // Clean lift when dragging — no rotation, no opacity change
          snapshot?.isDragging && "bg-white shadow-lg ring-2 ring-violet-400 ring-offset-1 text-violet-700"
        )}
      >
        <FileText className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-violet-500" : "text-slate-400")} />
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={() => saveRename(note)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveRename(note);
              if (e.key === 'Escape') setRenamingNoteId(null);
            }}
            onClick={e => e.stopPropagation()}
            className="flex-1 text-sm bg-white border border-violet-300 rounded px-1 py-0.5 outline-none text-slate-900 min-w-0"
          />
        ) : (
          <span className="flex-1 text-sm truncate min-w-0">{note.title}</span>
        )}
        {linkedCount > 0 && (
          <span className="shrink-0 text-[10px] text-violet-400 flex items-center gap-0.5">
            <LinkIcon className="w-2.5 h-2.5" />{linkedCount}
          </span>
        )}
        <button
          onClick={e => { e.stopPropagation(); setContextMenu({ x: e.currentTarget.getBoundingClientRect().right, y: e.currentTarget.getBoundingClientRect().bottom, note }); }}
          className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-all"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  // Linked tasks shown in the note detail panel
  const linkedTasks = selectedNote
    ? tasks.filter(t => (selectedNote.linkedTaskIds ?? []).includes(t.id))
    : [];

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full overflow-hidden bg-white">

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div
          className="flex flex-col border-r border-slate-200 bg-slate-50/60 shrink-0 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Search + actions */}
          <div className="p-3 space-y-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                placeholder="Search notes…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
              />
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleCreateNote()}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> New Note
              </button>
              <button
                onClick={() => setIsAddingSection(v => !v)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors"
                title="New folder"
              >
                <Folder className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSortBy(s => s === 'updated' ? 'a-z' : s === 'a-z' ? 'z-a' : 'updated')}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors"
                title={`Sort: ${sortBy}`}
              >
                <SortAsc className="w-3.5 h-3.5" />
              </button>
            </div>

            {isAddingSection && (
              <div className="flex gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <input
                  autoFocus
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateSection();
                    if (e.key === 'Escape') setIsAddingSection(false);
                  }}
                  placeholder="Folder name…"
                  className="flex-1 text-sm border border-violet-300 rounded-lg px-2 py-1.5 outline-none bg-white"
                />
                <button
                  onClick={handleCreateSection}
                  className="px-2.5 bg-violet-600 text-white rounded-lg text-xs"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Note tree */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Unsectioned */}
            <Droppable droppableId="__none__">
              {(drop, dropSnap) => (
                <div
                  ref={drop.innerRef}
                  {...drop.droppableProps}
                  className={cn(
                    "space-y-0.5 min-h-[28px] rounded-lg transition-colors duration-150",
                    dropSnap.isDraggingOver
                      ? "bg-violet-50 ring-2 ring-violet-200 ring-inset"
                      : ""
                  )}
                >
                  {unsectionedNotes.map((note, i) => (
                    <Draggable key={note.id} draggableId={note.id} index={i}>
                      {(drag, snap) => renderNoteItem(note, i, drag, snap)}
                    </Draggable>
                  ))}
                  {drop.placeholder}
                </div>
              )}
            </Droppable>

            {/* Sections */}
            {workspaceSections.map(section => {
              const secNotes  = getSectionNotes(section.id);
              const isOpen    = isSectionExpanded(section.id);
              return (
                <div key={section.id}>
                  <div
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-slate-500 hover:text-slate-800 hover:bg-slate-100 group transition-colors"
                    onClick={() => toggleSection(section.id)}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); toggleSection(section.id); }}
                      className="w-4 h-4 flex items-center justify-center shrink-0"
                    >
                      {isOpen
                        ? <ChevronDown className="w-3 h-3" />
                        : <ChevronRight className="w-3 h-3" />}
                    </button>
                    {isOpen ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-violet-400" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
                    <span className="flex-1 text-xs font-semibold truncate">{section.name}</span>
                    <span className="text-[10px] text-slate-400 mr-1">{secNotes.length}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={e => { e.stopPropagation(); handleCreateNote(section.id); }}
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setShowDeleteFolderConfirm(section); }}
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <Droppable droppableId={section.id}>
                      {(drop, dropSnap) => (
                        <div
                          ref={drop.innerRef}
                          {...drop.droppableProps}
                          className={cn(
                            "ml-4 space-y-0.5 min-h-[28px] rounded-lg transition-colors duration-150",
                            dropSnap.isDraggingOver
                              ? "bg-violet-50 ring-2 ring-violet-200 ring-inset"
                              : ""
                          )}
                        >
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
              <div className="text-center py-8 text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No notes yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={() => setIsDraggingSidebar(true)}
          className="w-1 cursor-col-resize hover:bg-violet-300 bg-slate-200 transition-colors shrink-0 z-10"
        />

        {/* ── Editor panel ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedNote ? (
            <>
              {/* Note header */}
              <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {isEditingTitle ? (
                    <input
                      autoFocus
                      value={editingTitleValue}
                      onChange={e => setEditingTitleValue(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleTitleSave();
                        if (e.key === 'Escape') setIsEditingTitle(false);
                      }}
                      className="text-xl md:text-2xl font-bold text-slate-900 border-b-2 border-violet-400 outline-none bg-transparent w-full pb-0.5"
                    />
                  ) : (
                    <h1
                      className="text-xl md:text-2xl font-bold text-slate-900 truncate cursor-text hover:bg-slate-50 rounded px-1 -ml-1 py-0.5 transition-colors"
                      onDoubleClick={() => { setIsEditingTitle(true); setEditingTitleValue(selectedNote.title); }}
                      title="Double-click to rename"
                    >
                      {selectedNote.title}
                    </h1>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {format(selectedNote.updatedAt, 'MMM d, h:mm a')}
                    </span>
                    {selectedNote.sectionId && (() => {
                      const sec = workspaceSections.find(s => s.id === selectedNote.sectionId);
                      return sec ? (
                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-500">
                          <Folder className="w-3 h-3" />{sec.name}
                        </span>
                      ) : null;
                    })()}
                    {linkedTasks.length > 0 && (
                      <span className="flex items-center gap-1 bg-violet-50 text-violet-500 px-2 py-0.5 rounded-full">
                        <LinkIcon className="w-3 h-3" />
                        {linkedTasks.length} task{linkedTasks.length !== 1 ? 's' : ''} linked
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant={isEditing ? 'default' : 'outline'}
                    className={cn("h-8 text-xs", isEditing && "bg-violet-600 hover:bg-violet-700 text-white")}
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? 'Preview' : 'Edit'}
                  </Button>
                </div>
              </div>

              {/* Linked tasks strip */}
              {linkedTasks.length > 0 && (
                <div className="px-6 py-3 border-b border-slate-100 bg-violet-50/40 flex items-center gap-2 flex-wrap">
                  <CheckSquare className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="text-xs font-medium text-violet-600 mr-1">Linked tasks:</span>
                  {linkedTasks.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-violet-200 rounded-full text-xs text-violet-700 group"
                    >
                      <button
                        onClick={() => {
                          if (t.projectId) setSelectedProjectId(t.projectId);
                          setSelectedTaskId(t.id);
                          setCurrentView('tasks');
                        }}
                        className="hover:underline"
                      >
                        {t.title}
                      </button>
                      <button
                        onClick={() => handleUnlinkTask(t.id)}
                        className="opacity-0 group-hover:opacity-100 text-violet-400 hover:text-red-500 transition-all"
                        title="Unlink task"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Editor — scales with screen */}
              <div className="flex-1 overflow-y-auto">
                {isEditing ? (
                  <textarea
                    className="w-full h-full min-h-full p-6 text-sm text-slate-800 bg-white resize-none outline-none font-mono leading-relaxed"
                    value={selectedNote.content}
                    onChange={e => updateNote(selectedNote.id, { content: e.target.value })}
                    placeholder="Start writing…"
                    style={{ minHeight: '100%' }}
                  />
                ) : (
                  <div className="p-6">
                    <NoteEditor
                      content={selectedNote.content}
                      isEditing={false}
                      setIsEditing={setIsEditing}
                      onChange={content => updateNote(selectedNote.id, { content })}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
              <FileText className="w-12 h-12 opacity-20" />
              <p className="text-sm">Select a note or create one</p>
              <Button size="sm" onClick={() => handleCreateNote()}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> New Note
              </Button>
            </div>
          )}
        </div>

        {/* ── Context Menu ─────────────────────────────────────────────── */}
        {contextMenu && (
          <div
            className="fixed z-50 w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 192) }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => handleRenameNote(contextMenu.note)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-400" /> Rename
            </button>
            <button
              onClick={() => {
                const n = contextMenu.note;
                const copy = getUniqueName(`${n.title} Copy`, n.sectionId);
                addNote({ title: copy, content: n.content, workspace, sectionId: n.sectionId } as any);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" /> Duplicate
            </button>
            <button
              onClick={() => {
                sessionStorage.setItem('nexus_open_note', contextMenu.note.id);
                window.open(window.location.href, '_blank');
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" /> Open in New Tab
            </button>
            <div className="h-px bg-slate-100 mx-3" />
            <button
              onClick={() => handleDeleteNote(contextMenu.note)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}

        {/* ── Confirm delete note ───────────────────────────────────────── */}
        {showDeleteNoteConfirm && (
          <ConfirmDialog
            title="Delete Note"
            message={<>Are you sure you want to delete <strong>"{showDeleteNoteConfirm.title}"</strong>? This cannot be undone.</>}
            confirmLabel="Delete Note"
            onConfirm={() => confirmDeleteNote(showDeleteNoteConfirm)}
            onCancel={() => setShowDeleteNoteConfirm(null)}
          />
        )}

        {/* ── Confirm delete folder ─────────────────────────────────────── */}
        {showDeleteFolderConfirm && (() => {
          const count = workspaceNotes.filter(n => n.sectionId === showDeleteFolderConfirm.id).length;
          return (
            <ConfirmDialog
              title="Delete Folder"
              message={
                <>
                  Delete <strong>"{showDeleteFolderConfirm.name}"</strong>?
                  {count > 0 && (
                    <span className="block mt-2 text-red-600 font-medium">
                      ⚠ This will move {count} note{count > 1 ? 's' : ''} out of the folder.
                    </span>
                  )}
                </>
              }
              confirmLabel="Delete Folder"
              onConfirm={() => confirmDeleteFolder(showDeleteFolderConfirm)}
              onCancel={() => setShowDeleteFolderConfirm(null)}
            />
          );
        })()}

        {/* ── Drag conflict modal ───────────────────────────────────────── */}
        {dragConflict && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
              <div className="p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-1">Name conflict</h3>
                <p className="text-sm text-slate-500 mb-4">
                  A note with this name exists in that folder. Enter a new name:
                </p>
                <Input
                  autoFocus
                  value={dragConflict.newName}
                  onChange={e => setDragConflict({ ...dragConflict, newName: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleDragConflictConfirm();
                    if (e.key === 'Escape') setDragConflict(null);
                  }}
                  placeholder="New file name…"
                />
              </div>
              <div className="px-6 pb-5 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setDragConflict(null)}>Cancel</Button>
                <Button size="sm" onClick={handleDragConflictConfirm} disabled={!dragConflict.newName.trim()}>
                  Move & Rename
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DragDropContext>
  );
}