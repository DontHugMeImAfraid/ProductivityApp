import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plus, Search, FileText, Link as LinkIcon, Calendar as CalendarIcon,
  Trash2, ArrowLeft, FolderPlus, Folder, Copy, Eye, Edit3,
  MoreVertical, ExternalLink, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { NoteEditor } from '@/components/NoteEditor';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { Note, NoteSection } from '@/types';

type SortOption = 'updated' | 'a-z' | 'z-a';

interface ContextMenuState {
  x: number;
  y: number;
  noteId: string;
}

interface DragConflictState {
  noteId: string;
  targetSectionId: string | undefined;
  originalSectionId: string | undefined;
  suggestedName: string;
  newName: string;
}

export function Notes() {
  const {
    workspace, notes, noteSections,
    addNote, updateNote, deleteNote,
    addNoteSection, deleteNoteSection,
    selectedNoteId, setSelectedNoteId
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // Delete confirmations
  const [showDeleteNoteConfirm, setShowDeleteNoteConfirm] = useState<Note | null>(null);
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState<NoteSection | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Rename in sidebar
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Highlight (Show in Explorer)
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null);

  // Drag conflict
  const [dragConflict, setDragConflict] = useState<DragConflictState | null>(null);

  const workspaceNotes = notes.filter(n => n.workspace === workspace);
  const workspaceSections = noteSections.filter(s => s.workspace === workspace);

  const filteredNotes = workspaceNotes.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (sortBy === 'updated') return b.updatedAt - a.updatedAt;
    if (sortBy === 'a-z') return a.title.localeCompare(b.title);
    if (sortBy === 'z-a') return b.title.localeCompare(a.title);
    return 0;
  });

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Close context menu on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // ─── Name deduplication per section ───────────────────────────────────────
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

  // ─── Create note ──────────────────────────────────────────────────────────
  const handleCreateNote = (sectionId?: string) => {
    const uniqueName = getUniqueName('Untitled Note', sectionId);
    const id = crypto.randomUUID();
    addNote({ id, title: uniqueName, content: '', workspace, linkedTaskIds: [], sectionId });
    setSelectedNoteId(id);
    setIsEditing(false);
    setIsEditingTitle(false);
    // Start renaming immediately in sidebar
    setRenamingNoteId(id);
    setRenameValue(uniqueName);
  };

  // ─── Create section ───────────────────────────────────────────────────────
  const handleCreateSection = () => {
    if (newSectionName.trim()) {
      addNoteSection({ name: newSectionName, workspace });
      setNewSectionName('');
      setIsAddingSection(false);
    }
  };

  // ─── Delete note ──────────────────────────────────────────────────────────
  const handleDeleteNote = (note: Note) => {
    setContextMenu(null);
    setShowDeleteNoteConfirm(note);
  };

  const confirmDeleteNote = (note: Note) => {
    deleteNote(note.id);
    if (selectedNoteId === note.id) setSelectedNoteId(null);
    setShowDeleteNoteConfirm(null);
  };

  // ─── Delete folder ────────────────────────────────────────────────────────
  const handleDeleteFolder = (section: NoteSection) => {
    setShowDeleteFolderConfirm(section);
  };

  const confirmDeleteFolder = (section: NoteSection) => {
    deleteNoteSection(section.id);
    setShowDeleteFolderConfirm(null);
  };

  // ─── Context menu ─────────────────────────────────────────────────────────
  const handleContextMenu = (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, noteId });
  };

  const handleOpenInNewTab = (noteId: string) => {
    sessionStorage.setItem('nexus_open_note', noteId);
    window.open(window.location.href, '_blank');
    setContextMenu(null);
  };

  const handleMakeCopy = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const copyName = getUniqueName(`${note.title} copy`, note.sectionId);
    const id = crypto.randomUUID();
    addNote({
      id,
      title: copyName,
      content: note.content,
      workspace: note.workspace,
      linkedTaskIds: [...(note.linkedTaskIds || [])],
      sectionId: note.sectionId,
    });
    setContextMenu(null);
  };

  const handleShowInExplorer = (noteId: string) => {
    setContextMenu(null);
    setSelectedNoteId(noteId);
    setHighlightedNoteId(noteId);
    // Scroll to note element
    setTimeout(() => {
      const el = document.querySelector(`[data-note-id="${noteId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
    setTimeout(() => setHighlightedNoteId(null), 2000);
  };

  const handleRenameStart = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    setRenamingNoteId(noteId);
    setRenameValue(note.title);
    setContextMenu(null);
  };

  const handleRenameSave = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    setRenamingNoteId(null);
    if (!note) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === note.title) return;
    const uniqueName = getUniqueName(trimmed, note.sectionId, noteId);
    updateNote(noteId, { title: uniqueName });
  };

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const note = notes.find(n => n.id === draggableId);
    if (!note) return;

    const targetSectionId = destination.droppableId === 'uncategorized' ? undefined : destination.droppableId;

    if (note.sectionId !== targetSectionId) {
      const conflict = workspaceNotes.find(
        n => n.sectionId === targetSectionId && n.title === note.title && n.id !== draggableId
      );
      if (conflict) {
        const suggested = getUniqueName(note.title, targetSectionId, draggableId);
        setDragConflict({
          noteId: draggableId,
          targetSectionId,
          originalSectionId: note.sectionId,
          suggestedName: suggested,
          newName: suggested,
        });
        return; // Don't move yet — wait for user input
      }
    }

    updateNote(draggableId, { sectionId: targetSectionId });
  };

  const handleDragConflictConfirm = () => {
    if (!dragConflict) return;
    const trimmed = dragConflict.newName.trim();
    if (!trimmed) return;
    const uniqueName = getUniqueName(trimmed, dragConflict.targetSectionId, dragConflict.noteId);
    updateNote(dragConflict.noteId, { sectionId: dragConflict.targetSectionId, title: uniqueName });
    setDragConflict(null);
  };

  const handleDragConflictCancel = () => {
    // Cancel = leave note in original section (no updateNote called)
    setDragConflict(null);
  };

  // ─── Title save (main panel) ───────────────────────────────────────────────
  const handleTitleSave = () => {
    setIsEditingTitle(false);
    if (!selectedNote || !editingTitleValue.trim()) return;
    const trimmed = editingTitleValue.trim();
    if (trimmed === selectedNote.title) return;
    const uniqueName = getUniqueName(trimmed, selectedNote.sectionId, selectedNote.id);
    updateNote(selectedNote.id, { title: uniqueName });
  };

  // ─── Render note list item ────────────────────────────────────────────────
  const renderNoteItem = (note: Note, index: number) => (
    <Draggable key={note.id} draggableId={note.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          data-note-id={note.id}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onContextMenu={(e) => handleContextMenu(e, note.id)}
          onClick={() => {
            if (renamingNoteId === note.id) return;
            setSelectedNoteId(note.id);
            setIsEditingTitle(false);
            setIsEditing(false);
          }}
          className={cn(
            'w-full text-left p-3 rounded-lg transition-all duration-150 active:scale-[0.98] mb-1 cursor-pointer relative group select-none',
            selectedNoteId === note.id
              ? 'bg-white border border-zinc-200 shadow-sm'
              : 'bg-white border border-zinc-200/60 hover:border-zinc-300 hover:shadow-sm',
            snapshot.isDragging ? 'shadow-lg ring-2 ring-indigo-400 rotate-1' : '',
            highlightedNoteId === note.id
              ? 'ring-2 ring-amber-400 bg-amber-50/60 border-amber-300'
              : ''
          )}
        >
          {renamingNoteId === note.id ? (
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => handleRenameSave(note.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleRenameSave(note.id); }
                if (e.key === 'Escape') { setRenamingNoteId(null); }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-7 text-sm py-0 px-1.5 border-indigo-300 focus-visible:ring-1 focus-visible:ring-indigo-400"
            />
          ) : (
            <>
              <h3 className="font-medium text-sm text-zinc-900 truncate pr-7 leading-snug">
                {note.title}
              </h3>
              <p className="text-xs text-zinc-400 truncate mt-0.5 leading-relaxed">
                {note.content.replace(/^---[\s\S]*?---\n?/, '').replace(/[#*`>\-\[\]]/g, '').trim().slice(0, 70) || 'Empty note'}
              </p>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-400">
                <CalendarIcon className="w-3 h-3 shrink-0" />
                <span>{format(note.updatedAt, 'MMM d, yyyy')}</span>
                {note.linkedTaskIds && note.linkedTaskIds.length > 0 && (
                  <span className="flex items-center ml-auto">
                    <LinkIcon className="w-3 h-3 mr-0.5" />
                    {note.linkedTaskIds.length}
                  </span>
                )}
              </div>
              {/* Three-dot menu */}
              <button
                className="absolute right-2 top-2.5 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-100 transition-all"
                onClick={(e) => { e.stopPropagation(); handleContextMenu(e, note.id); }}
                tabIndex={-1}
              >
                <MoreVertical className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </>
          )}
        </div>
      )}
    </Draggable>
  );

  // ─── Context menu position ────────────────────────────────────────────────
  const getMenuStyle = () => {
    if (!contextMenu) return {};
    const menuW = 210;
    const menuH = 220;
    return {
      left: Math.min(contextMenu.x, window.innerWidth - menuW - 8),
      top: Math.min(contextMenu.y, window.innerHeight - menuH - 8),
    };
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="h-full flex relative" onClick={() => contextMenu && setContextMenu(null)}>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div className={cn(
          'w-full md:w-72 border-r border-zinc-200 bg-zinc-50/50 flex flex-col shrink-0',
          selectedNoteId ? 'hidden md:flex' : 'flex'
        )}>
          {/* Sidebar header */}
          <div className="p-4 border-b border-zinc-200 space-y-3 shrink-0">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-zinc-900 text-sm">Notes</h2>
              <div className="flex gap-0.5">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsAddingSection(true)} title="New Folder">
                  <FolderPlus className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCreateNote()} title="New Note">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Search notes…"
                  className="pl-8 bg-white text-xs h-7 border-zinc-200"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="text-xs border border-zinc-200 rounded-md px-1.5 bg-white text-zinc-600 h-7"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="updated">Recent</option>
                <option value="a-z">A → Z</option>
                <option value="z-a">Z → A</option>
              </select>
            </div>
          </div>

          {/* Note list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {/* Add section input */}
            {isAddingSection && (
              <div className="p-2 border border-indigo-200 rounded-lg bg-white shadow-sm flex gap-2">
                <Input
                  autoFocus
                  placeholder="Folder name…"
                  className="h-7 text-xs border-zinc-200"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSection();
                    if (e.key === 'Escape') setIsAddingSection(false);
                  }}
                />
                <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCreateSection}>Add</Button>
              </div>
            )}

            {/* Sections */}
            {workspaceSections.map(section => {
              const sectionNotes = sortedNotes.filter(n => n.sectionId === section.id);
              return (
                <div key={section.id}>
                  <div className="flex items-center justify-between px-1.5 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest group">
                    <div className="flex items-center gap-1.5">
                      <Folder className="w-3 h-3" />
                      {section.name}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="w-5 h-5 rounded hover:bg-zinc-200 flex items-center justify-center"
                        onClick={() => handleCreateNote(section.id)}
                        title="Add note to folder"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        className="w-5 h-5 rounded hover:bg-red-100 text-zinc-400 hover:text-red-500 flex items-center justify-center"
                        onClick={() => handleDeleteFolder(section)}
                        title="Delete folder"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <Droppable droppableId={section.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          'rounded-lg transition-all min-h-[36px] p-1',
                          snapshot.isDraggingOver
                            ? 'bg-indigo-50 ring-1 ring-indigo-200'
                            : ''
                        )}
                      >
                        {sectionNotes.map((note, i) => renderNoteItem(note, i))}
                        {provided.placeholder}
                        {sectionNotes.length === 0 && !snapshot.isDraggingOver && (
                          <p className="px-2 py-2 text-[11px] text-zinc-400 italic text-center">
                            Drop notes here
                          </p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}

            {/* Uncategorised */}
            <div>
              {workspaceSections.length > 0 && (
                <div className="px-1.5 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mt-2">
                  Uncategorized
                </div>
              )}
              <Droppable droppableId="uncategorized">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'rounded-lg transition-all min-h-[36px] p-1',
                      snapshot.isDraggingOver ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''
                    )}
                  >
                    {sortedNotes.filter(n => !n.sectionId).map((note, i) => renderNoteItem(note, i))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {filteredNotes.length === 0 && !isAddingSection && (
              <div className="p-6 text-center">
                <FileText className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">No notes found</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Main note panel ────────────────────────────────────────────── */}
        <div className={cn(
          'flex-1 flex flex-col bg-white min-w-0',
          !selectedNoteId ? 'hidden md:flex' : 'flex'
        )}>
          {selectedNote ? (
            <>
              {/* Note header */}
              <div className="p-4 md:p-6 border-b border-zinc-100 shrink-0 bg-white">
                <div className="max-w-[800px] mx-auto w-full">
                  {/* Mobile back */}
                  <div className="flex items-center gap-2 md:hidden mb-3">
                    <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={() => setSelectedNoteId(null)}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {isEditingTitle ? (
                        <Input
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          className="text-xl md:text-2xl font-bold border-none px-0 h-auto focus-visible:ring-0 bg-transparent shadow-none"
                          autoFocus
                          onBlur={handleTitleSave}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleTitleSave();
                            else if (e.key === 'Escape') setIsEditingTitle(false);
                          }}
                        />
                      ) : (
                        <h1
                          className="text-xl md:text-2xl font-bold text-zinc-900 truncate cursor-text hover:bg-zinc-50 rounded px-1 -ml-1 py-0.5 transition-colors"
                          onDoubleClick={() => {
                            setIsEditingTitle(true);
                            setEditingTitleValue(selectedNote.title);
                          }}
                          title="Double-click to rename"
                        >
                          {selectedNote.title}
                        </h1>
                      )}

                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {format(selectedNote.updatedAt, 'MMM d, h:mm a')}
                        </span>
                        {selectedNote.sectionId && (() => {
                          const sec = workspaceSections.find(s => s.id === selectedNote.sectionId);
                          return sec ? (
                            <span className="flex items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded-md text-zinc-500">
                              <Folder className="w-3 h-3" />
                              {sec.name}
                            </span>
                          ) : null;
                        })()}
                        {selectedNote.linkedTaskIds && selectedNote.linkedTaskIds.length > 0 && (
                          <span className="flex items-center gap-1 bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full">
                            <LinkIcon className="w-3 h-3" />
                            {selectedNote.linkedTaskIds.length} linked
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant={isEditing ? 'default' : 'outline'}
                        className="h-8 text-xs"
                        onClick={() => setIsEditing(!isEditing)}
                      >
                        {isEditing ? 'Done' : 'Edit'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50"
                        onClick={() => handleDeleteNote(selectedNote)}
                        title="Delete note"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Note content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <NoteEditor
                  content={selectedNote.content}
                  onChange={(content) => updateNote(selectedNote.id, { content })}
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
              <FileText className="w-14 h-14 mb-4 text-zinc-200" />
              <h3 className="text-base font-semibold text-zinc-700">No note selected</h3>
              <p className="mt-1 text-sm">Pick a note from the sidebar or create a new one.</p>
              <Button className="mt-5" onClick={() => handleCreateNote()}>
                <Plus className="w-4 h-4 mr-2" />
                New Note
              </Button>
            </div>
          )}
        </div>

        {/* ── Context Menu ──────────────────────────────────────────────── */}
        {contextMenu && (() => {
          const ctxNote = notes.find(n => n.id === contextMenu.noteId);
          if (!ctxNote) return null;
          const style = getMenuStyle();

          return (
            <div
              className="fixed z-[200] bg-white border border-zinc-200 rounded-xl shadow-2xl py-1.5 min-w-[210px] overflow-hidden"
              style={style}
              onClick={(e) => e.stopPropagation()}
            >
              <ContextMenuItem
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                label="Open in New Tab"
                onClick={() => handleOpenInNewTab(contextMenu.noteId)}
              />
              <ContextMenuItem
                icon={<Copy className="w-3.5 h-3.5" />}
                label="Make a Copy"
                onClick={() => handleMakeCopy(contextMenu.noteId)}
              />
              <ContextMenuItem
                icon={<Eye className="w-3.5 h-3.5" />}
                label="Show in Explorer"
                onClick={() => handleShowInExplorer(contextMenu.noteId)}
              />
              <div className="border-t border-zinc-100 my-1" />
              <ContextMenuItem
                icon={<Edit3 className="w-3.5 h-3.5" />}
                label="Rename"
                onClick={() => handleRenameStart(contextMenu.noteId)}
              />
              <ContextMenuItem
                icon={<Trash2 className="w-3.5 h-3.5" />}
                label="Delete"
                danger
                onClick={() => handleDeleteNote(ctxNote)}
              />
            </div>
          );
        })()}

        {/* ── Delete Note Modal ─────────────────────────────────────────── */}
        {showDeleteNoteConfirm && (
          <ConfirmModal
            icon={<Trash2 className="w-6 h-6 text-red-500" />}
            iconBg="bg-red-100"
            title="Delete Note?"
            message={
              <>Are you sure you want to delete{' '}
                <span className="font-semibold">"{showDeleteNoteConfirm.title}"</span>?
                {' '}This action cannot be undone.
              </>
            }
            confirmLabel="Delete Note"
            onConfirm={() => confirmDeleteNote(showDeleteNoteConfirm)}
            onCancel={() => setShowDeleteNoteConfirm(null)}
          />
        )}

        {/* ── Delete Folder Modal ───────────────────────────────────────── */}
        {showDeleteFolderConfirm && (() => {
          const count = workspaceNotes.filter(n => n.sectionId === showDeleteFolderConfirm.id).length;
          return (
            <ConfirmModal
              icon={<Folder className="w-6 h-6 text-red-500" />}
              iconBg="bg-red-100"
              title="Delete Folder?"
              message={
                <>
                  Are you sure you want to delete the folder{' '}
                  <span className="font-semibold">"{showDeleteFolderConfirm.name}"</span>?
                  {count > 0 && (
                    <span className="block mt-2 text-red-600 font-medium">
                      ⚠ This will permanently delete {count} note{count > 1 ? 's' : ''} inside it.
                    </span>
                  )}
                </>
              }
              confirmLabel={count > 0 ? `Delete Folder & ${count} Note${count > 1 ? 's' : ''}` : 'Delete Folder'}
              onConfirm={() => confirmDeleteFolder(showDeleteFolderConfirm)}
              onCancel={() => setShowDeleteFolderConfirm(null)}
            />
          );
        })()}

        {/* ── Drag Conflict Modal ───────────────────────────────────────── */}
        {dragConflict && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-base font-semibold text-zinc-900 mb-1">Name Already Exists</h3>
                <p className="text-sm text-zinc-500 mb-4">
                  A note with this name already exists in the target folder. Enter a new name to continue:
                </p>
                <Input
                  autoFocus
                  value={dragConflict.newName}
                  onChange={(e) => setDragConflict({ ...dragConflict, newName: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDragConflictConfirm();
                    if (e.key === 'Escape') handleDragConflictCancel();
                  }}
                  placeholder="Enter new file name…"
                  className="border-zinc-300"
                />
              </div>
              <div className="px-6 pb-5 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleDragConflictCancel}>
                  Cancel
                </Button>
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

// ─── Helper components ────────────────────────────────────────────────────────

function ContextMenuItem({
  icon, label, onClick, danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-zinc-700 hover:bg-zinc-50'
      )}
      onClick={onClick}
    >
      <span className={cn('opacity-60', danger && 'opacity-80')}>{icon}</span>
      {label}
    </button>
  );
}

function ConfirmModal({
  icon, iconBg, title, message, confirmLabel, onConfirm, onCancel,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-4', iconBg)}>
            {icon}
          </div>
          <h3 className="text-base font-semibold text-zinc-900 mb-2">{title}</h3>
          <p className="text-sm text-zinc-600 leading-relaxed">{message}</p>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}