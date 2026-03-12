import React, { useState } from 'react';
import { useAppStore } from '@/store';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Plus, Search, FileText, Link as LinkIcon, Calendar as CalendarIcon, Trash2, ArrowLeft, FolderPlus, Folder } from 'lucide-react';
import { format } from 'date-fns';
import { NoteEditor } from '@/components/NoteEditor';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { Note } from '@/types';

type SortOption = 'updated' | 'a-z' | 'z-a';

export function Notes() {
  const { workspace, notes, noteSections, addNote, updateNote, deleteNote, addNoteSection, deleteNoteSection, selectedNoteId, setSelectedNoteId } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Note | null>(null);

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

  const handleCreateNote = (sectionId?: string) => {
    const baseTitle = 'Untitled Note';
    let newTitle = baseTitle;
    let counter = 1;
    const existingTitles = workspaceNotes.map(note => note.title);

    while (existingTitles.includes(newTitle)) {
      newTitle = `${baseTitle}(${counter})`;
      counter++;
    }

    const newNote = {
      title: newTitle,
      content: '',
      workspace,
      linkedTaskIds: [],
      sectionId
    };
    const id = crypto.randomUUID();
    useAppStore.getState().addNote({ ...newNote, id });
    setSelectedNoteId(id);
    setIsEditing(true);
    setIsEditingTitle(true);
    setEditingTitleValue(newTitle);
  };

  const handleCreateSection = () => {
    if (newSectionName.trim()) {
      addNoteSection({ name: newSectionName, workspace });
      setNewSectionName('');
      setIsAddingSection(false);
    }
  };

  const handleDeleteSection = (sectionId: string, sectionName: string) => {
    const notesInSectionCount = workspaceNotes.filter(n => n.sectionId === sectionId).length;
    const confirmationMessage = `Are you sure you want to delete the section "${sectionName}"?` + 
      (notesInSectionCount > 0 ? ` This will also delete ${notesInSectionCount} note(s) inside it.` : '');

    if (window.confirm(confirmationMessage)) {
      deleteNoteSection(sectionId);
    }
  };

  const handleDeleteNote = (note: Note) => {
    setShowDeleteConfirm(note);
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const note = notes.find(n => n.id === draggableId);
    if (!note) return;

    const newSectionId = destination.droppableId === 'uncategorized' ? undefined : destination.droppableId;

    if (note.sectionId !== newSectionId) {
      updateNote(draggableId, { sectionId: newSectionId });
    }
  };

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    if (!selectedNote || !editingTitleValue.trim() || editingTitleValue.trim() === selectedNote.title) {
      return;
    }

    let newTitle = editingTitleValue.trim();
    
    const baseTitle = newTitle;
    let counter = 1;
    const otherNoteTitles = workspaceNotes
      .filter(note => note.id !== selectedNote.id)
      .map(note => note.title);

    while (otherNoteTitles.includes(newTitle)) {
      newTitle = `${baseTitle}(${counter})`;
      counter++;
    }

    updateNote(selectedNote.id, { title: newTitle });
  };

  const renderNoteList = (notesToRender: typeof notes) => {
    return notesToRender.map((note, index) => (
      <Draggable key={note.id} draggableId={note.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => {
              setSelectedNoteId(note.id);
              setIsEditingTitle(false);
              setIsEditing(false);
            }}
            className={cn(
              'w-full text-left p-3 rounded-lg transition-all duration-200 active:scale-[0.98] mb-1 cursor-grab',
              selectedNoteId === note.id 
                ? 'bg-white border border-zinc-200 shadow-sm' 
                : 'bg-white border border-zinc-200/60 hover:border-zinc-300',
              snapshot.isDragging ? 'shadow-lg ring-2 ring-indigo-400' : ''
            )}
          >
            <h3 className="font-medium text-sm text-zinc-900 truncate">{note.title}</h3>
            <p className="text-xs text-zinc-500 truncate mt-1">{note.content.replace(/[#*`]/g, '')}</p>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-400">
              <CalendarIcon className="w-3 h-3" />
              {format(note.updatedAt, 'MMM d, yyyy')}
              {note.linkedTaskIds && note.linkedTaskIds.length > 0 && (
                <span className="flex items-center ml-auto">
                  <LinkIcon className="w-3 h-3 mr-1" />
                  {note.linkedTaskIds.length}
                </span>
              )}
            </div>
          </div>
        )}
      </Draggable>
    ));
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="h-full flex">
        {/* Sidebar for Notes List */}
        <div className={cn(
          "w-full md:w-80 border-r border-zinc-200 bg-zinc-50/50 flex flex-col shrink-0",
          selectedNoteId ? "hidden md:flex" : "flex"
        )}>
          <div className="p-4 border-b border-zinc-200 space-y-4 shrink-0">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-zinc-900">Notes</h2>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setIsAddingSection(true)} title="New Section">
                  <FolderPlus className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleCreateNote()} title="New Note">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input 
                  placeholder="Search notes..." 
                  className="pl-9 bg-white text-xs h-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select 
                className="text-xs border border-zinc-200 rounded-md px-2 bg-white"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="updated">Latest</option>
                <option value="a-z">A-Z</option>
                <option value="z-a">Z-A</option>
              </select>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {isAddingSection && (
              <div className="p-2 border border-zinc-200 rounded-lg bg-white shadow-sm flex gap-2">
                <Input 
                  autoFocus
                  placeholder="Section name" 
                  className="h-8 text-xs"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSection();
                    if (e.key === 'Escape') setIsAddingSection(false);
                  }}
                />
                <Button size="sm" className="h-8" onClick={handleCreateSection}>Add</Button>
              </div>
            )}

            {/* Render Sections */}
            {workspaceSections.map(section => {
              const sectionNotes = sortedNotes.filter(n => n.sectionId === section.id);
              return (
                <div key={section.id}>
                  <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider group">
                    <div className="flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5" />
                      {section.name}
                    </div>
                    <div className="flex items-center">
                      <Button size="icon" variant="ghost" className="h-5 w-5 hover:bg-zinc-200" onClick={() => handleCreateNote(section.id)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-zinc-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteSection(section.id, section.name)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <Droppable droppableId={section.id} key={section.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "rounded-lg transition-colors min-h-[40px] p-1",
                          snapshot.isDraggingOver ? "bg-zinc-200/50" : ""
                        )}
                      >
                        {renderNoteList(sectionNotes)}
                        {provided.placeholder}
                        {sectionNotes.length === 0 && !snapshot.isDraggingOver && (
                          <div className="px-2 py-2 text-xs text-zinc-400 italic text-center">Empty section</div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}

            {/* Render Uncategorized Notes */}
            <div className="space-y-1">
              {workspaceSections.length > 0 && (
                <div className="px-2 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-4">
                  Uncategorized
                </div>
              )}
              <Droppable droppableId="uncategorized">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "rounded-lg transition-colors min-h-[40px] p-1",
                      snapshot.isDraggingOver ? "bg-zinc-200/50" : ""
                    )}
                  >
                    {renderNoteList(sortedNotes.filter(n => !n.sectionId))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {filteredNotes.length === 0 && !isAddingSection && (
              <div className="p-4 text-center text-sm text-zinc-500">
                No notes found.
              </div>
            )}
          </div>
        </div>

        {/* Main Note Area */}
        <div className={cn(
          "flex-1 flex flex-col bg-white min-w-0",
          !selectedNoteId ? "hidden md:flex" : "flex"
        )}>
          {selectedNote ? (
            <>
              <div className="p-4 md:p-6 border-b border-zinc-200 shrink-0">
                <div className="max-w-[800px] mx-auto w-full flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div className="flex items-center gap-2 sm:hidden mb-2">
                    <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setSelectedNoteId(null)}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                  </div>
                  <div className="flex-1 min-w-0">
                    {isEditingTitle ? (
                      <Input 
                        value={editingTitleValue}
                        onChange={(e) => setEditingTitleValue(e.target.value)}
                        className="text-xl md:text-3xl font-bold border-none px-0 h-auto focus-visible:ring-0 bg-transparent"
                        autoFocus
                        onBlur={handleTitleSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleTitleSave();
                          } else if (e.key === 'Escape') {
                            setIsEditingTitle(false);
                          }
                        }}
                      />
                    ) : (
                      <h1 
                        className="text-xl md:text-3xl font-bold text-zinc-900 truncate cursor-text"
                        onClick={() => {
                          setIsEditingTitle(true);
                          setEditingTitleValue(selectedNote.title);
                        }}
                      >
                        {selectedNote.title}
                      </h1>
                    )}
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-3 text-xs md:text-sm text-zinc-500">
                      <span className="flex items-center">
                        <CalendarIcon className="w-3 h-3 md:w-4 md:h-4 mr-1.5" />
                        Last edited {format(selectedNote.updatedAt, 'MMM d, h:mm a')}
                      </span>
                      {selectedNote.sectionId && (
                        <span className="flex items-center bg-zinc-100 px-2 py-0.5 rounded-md">
                          <Folder className="w-3 h-3 mr-1" />
                          {workspaceSections.find(s => s.id === selectedNote.sectionId)?.name || 'Unknown'}
                        </span>
                      )}
                      {selectedNote.linkedTaskIds && selectedNote.linkedTaskIds.length > 0 && (
                        <span className="flex items-center text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          {selectedNote.linkedTaskIds.length} Linked Tasks
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start">
                    <Button size="sm" variant={isEditing ? "default" : "outline"} onClick={() => setIsEditing(!isEditing)}>
                      {isEditing ? 'Done' : 'Edit'}
                    </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => selectedNote && handleDeleteNote(selectedNote)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
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
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-4 text-center">
              <FileText className="w-12 h-12 mb-4 text-zinc-300" />
              <h3 className="text-lg font-medium text-zinc-900">No note selected</h3>
              <p className="mt-1 text-sm">Select a note from the sidebar or create a new one.</p>
              <Button className="mt-4" onClick={() => handleCreateNote()}>
                <Plus className="w-4 h-4 mr-2" />
                Create Note
              </Button>
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <h3 className="text-lg font-semibold text-zinc-900">Delete Note?</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Are you sure you want to delete the note "{showDeleteConfirm.title}"? This action cannot be undone.
              </p>
            </div>
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => {
                if (!showDeleteConfirm) return;
                deleteNote(showDeleteConfirm.id);
                setSelectedNoteId(null);
                setShowDeleteConfirm(null);
              }}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </DragDropContext>
  );
}
