import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plus, Search, FileText, Link as LinkIcon, Calendar as CalendarIcon,
  Trash2, ArrowLeft, FolderPlus, Folder, AlertTriangle, ChevronDown,
  ChevronRight, Hash, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { NoteEditor } from '@/components/NoteEditor';
import { cn } from '@/lib/utils';

type SortOption = 'updated' | 'a-z' | 'z-a' | 'created';

// ── Wikilink Validator ───────────────────────────────────────────────────────
function useBrokenLinks() {
  const { notes } = useAppStore();
  return useMemo(() => {
    const broken: { noteId: string; noteTitle: string; link: string }[] = [];
    const noteTitles = new Set(notes.map(n => n.title.toLowerCase()));
    for (const note of notes) {
      const matches = [...note.content.matchAll(/\[\[([^\]]+)\]\]/g)];
      for (const m of matches) {
        if (!noteTitles.has(m[1].toLowerCase())) {
          broken.push({ noteId: note.id, noteTitle: note.title, link: m[1] });
        }
      }
    }
    return broken;
  }, [notes]);
}

// ── Backlinks Panel ──────────────────────────────────────────────────────────
function BacklinksPanel({ noteId, noteTitle }: { noteId: string; noteTitle: string }) {
  const { notes, setSelectedNoteId } = useAppStore();
  const [open, setOpen] = useState(false);

  const backlinks = useMemo(() =>
    notes.filter(n => n.id !== noteId && n.content.toLowerCase().includes(`[[${noteTitle.toLowerCase()}`)),
    [notes, noteId, noteTitle]
  );

  if (backlinks.length === 0) return null;

  return (
    <div className="border-t border-zinc-100 pt-3 mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 w-full"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Hash className="w-3 h-3" />
        {backlinks.length} backlink{backlinks.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {backlinks.map(n => (
            <button
              key={n.id}
              onClick={() => setSelectedNoteId(n.id)}
              className="w-full text-left text-xs text-indigo-600 hover:underline px-2 py-1 rounded hover:bg-indigo-50 truncate flex items-center gap-1"
            >
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              {n.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Link Validator Banner ────────────────────────────────────────────────────
function LinkValidatorBanner() {
  const { notes, setSelectedNoteId } = useAppStore();
  const [dismissed, setDismissed] = useState(false);
  const broken = useBrokenLinks();

  if (broken.length === 0 || dismissed) return null;

  return (
    <div className="mx-2 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="w-3.5 h-3.5" />
          {broken.length} broken wikilink{broken.length !== 1 ? 's' : ''}
        </span>
        <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700">✕</button>
      </div>
      <div className="space-y-0.5 mt-1">
        {broken.slice(0, 3).map((b, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-amber-500">→</span>
            <button
              className="underline hover:text-amber-900"
              onClick={() => setSelectedNoteId(b.noteId)}
            >
              {b.noteTitle}
            </button>
            <span className="text-amber-400">→</span>
            <span className="font-mono text-amber-600">[[{b.link}]]</span>
          </div>
        ))}
        {broken.length > 3 && <div className="text-amber-500">+{broken.length - 3} more…</div>}
      </div>
    </div>
  );
}

// ── Main Notes Component ─────────────────────────────────────────────────────
export function Notes() {
  const {
    workspace, notes, noteSections,
    addNote, updateNote, deleteNote,
    addNoteSection, deleteNoteSection,
    selectedNoteId, setSelectedNoteId
  } = useAppStore();

  const [searchQuery, setSearchQuery]       = useState('');
  const [isEditing, setIsEditing]           = useState(false);
  const [sortBy, setSortBy]                 = useState<SortOption>('updated');
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const workspaceNotes    = notes.filter(n => n.workspace === workspace);
  const workspaceSections = noteSections.filter(s => s.workspace === workspace);

  const filteredNotes = workspaceNotes.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (sortBy === 'updated') return b.updatedAt - a.updatedAt;
    if (sortBy === 'created') return b.createdAt - a.createdAt;
    if (sortBy === 'a-z')    return a.title.localeCompare(b.title);
    if (sortBy === 'z-a')    return b.title.localeCompare(a.title);
    return 0;
  });

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  const handleCreateNote = (sectionId?: string) => {
    const id = crypto.randomUUID();
    addNote({ id, title: 'Untitled Note', content: '', workspace, linkedTaskIds: [], sectionId } as any);
    setSelectedNoteId(id);
    setIsEditing(true);
  };

  const handleCreateSection = () => {
    if (newSectionName.trim()) {
      addNoteSection({ name: newSectionName, workspace });
      setNewSectionName('');
      setIsAddingSection(false);
    }
  };

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Word count for current note
  const wordCount = selectedNote
    ? selectedNote.content.replace(/[#*`\-\[\]_~]/g, ' ').trim().split(/\s+/).filter(Boolean).length
    : 0;

  const renderNoteList = (notesToRender: typeof notes) => {
    if (notesToRender.length === 0) return null;
    return (
      <div className="space-y-0.5">
        {notesToRender.map(note => {
          const preview = note.content.replace(/[#*`\-\[\]]/g, '').trim().slice(0, 80);
          const hasLinks = note.content.includes('[[');
          return (
            <button
              key={note.id}
              onClick={() => { setSelectedNoteId(note.id); setIsEditing(false); }}
              className={cn(
                "w-full text-left p-2.5 rounded-lg transition-all duration-150 active:scale-[0.98] group",
                selectedNoteId === note.id
                  ? "bg-white border border-zinc-200 shadow-sm"
                  : "hover:bg-white/60 border border-transparent hover:border-zinc-200/80"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <h3 className="font-medium text-xs text-zinc-900 truncate flex-1">{note.title}</h3>
                {hasLinks && <Hash className="w-2.5 h-2.5 text-indigo-400 shrink-0 mt-0.5" />}
              </div>
              {preview && (
                <p className="text-[11px] text-zinc-400 truncate mt-0.5 leading-relaxed">{preview}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-300">
                <CalendarIcon className="w-2.5 h-2.5" />
                {format(note.updatedAt, 'MMM d')}
                {note.linkedTaskIds && note.linkedTaskIds.length > 0 && (
                  <span className="flex items-center ml-auto text-indigo-400">
                    <LinkIcon className="w-2.5 h-2.5 mr-0.5" />
                    {note.linkedTaskIds.length}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex">

      {/* ── Left Sidebar ──────────────────────────────────────────────────── */}
      <div className={cn(
        "w-full md:w-72 border-r border-zinc-200 bg-zinc-50/50 flex flex-col shrink-0",
        selectedNoteId ? "hidden md:flex" : "flex"
      )}>
        {/* Header */}
        <div className="p-3 border-b border-zinc-200 space-y-2 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-sm text-zinc-900">Notes</h2>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsAddingSection(true)} title="New Section">
                <FolderPlus className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCreateNote()} title="New Note">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search notes…"
                className="pl-7 bg-white text-xs h-7"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="text-[11px] border border-zinc-200 rounded-md px-1.5 bg-white text-zinc-600"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="updated">Latest</option>
              <option value="created">Created</option>
              <option value="a-z">A–Z</option>
              <option value="z-a">Z–A</option>
            </select>
          </div>
        </div>

        {/* Broken link validator */}
        <LinkValidatorBanner />

        {/* Note list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {isAddingSection && (
            <div className="p-2 border border-zinc-200 rounded-lg bg-white shadow-sm flex gap-1.5">
              <Input
                autoFocus
                placeholder="Section name"
                className="h-7 text-xs"
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
            const isCollapsed = collapsedSections.has(section.id);
            return (
              <div key={section.id} className="space-y-0.5">
                <div className="flex items-center justify-between px-1 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <button
                    className="flex items-center gap-1 hover:text-zinc-700 transition-colors"
                    onClick={() => toggleSection(section.id)}
                  >
                    {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    <Folder className="w-3 h-3" />
                    {section.name}
                    <span className="text-zinc-400 font-normal ml-0.5">({sectionNotes.length})</span>
                  </button>
                  <div className="flex gap-0.5">
                    <Button size="icon" variant="ghost" className="h-5 w-5 hover:bg-zinc-200" onClick={() => handleCreateNote(section.id)}>
                      <Plus className="w-2.5 h-2.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-5 w-5 hover:bg-red-50 hover:text-red-500"
                      onClick={() => deleteNoteSection(section.id)}
                      title="Delete section"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </Button>
                  </div>
                </div>
                {!isCollapsed && (
                  <>
                    {renderNoteList(sectionNotes)}
                    {sectionNotes.length === 0 && (
                      <div className="px-3 py-2 text-[11px] text-zinc-400 italic">Empty section</div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* Uncategorized */}
          <div className="space-y-0.5">
            {workspaceSections.length > 0 && (
              <div className="px-1 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Uncategorized
              </div>
            )}
            {renderNoteList(sortedNotes.filter(n => !n.sectionId))}
          </div>

          {filteredNotes.length === 0 && !isAddingSection && (
            <div className="p-6 text-center text-sm text-zinc-500 space-y-3">
              <FileText className="w-8 h-8 mx-auto text-zinc-200" />
              <p>No notes found.</p>
              <Button size="sm" variant="outline" onClick={() => handleCreateNote()}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Note
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Editor Area ───────────────────────────────────────────────── */}
      <div className={cn(
        "flex-1 flex flex-col bg-white min-w-0",
        !selectedNoteId ? "hidden md:flex" : "flex"
      )}>
        {selectedNote ? (
          <>
            {/* Note header */}
            <div className="p-4 md:p-6 border-b border-zinc-100 shrink-0">
              <div className="max-w-[800px] mx-auto w-full">
                {/* Mobile back */}
                <div className="flex items-center gap-2 md:hidden mb-3">
                  <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setSelectedNoteId(null)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <Input
                        value={selectedNote.title}
                        onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
                        className="text-2xl md:text-3xl font-bold border-none px-0 h-auto focus-visible:ring-0 bg-transparent shadow-none"
                        placeholder="Untitled"
                      />
                    ) : (
                      <h1
                        className="text-2xl md:text-3xl font-bold text-zinc-900 cursor-text hover:text-zinc-700 transition-colors truncate"
                        onClick={() => setIsEditing(true)}
                      >
                        {selectedNote.title || <span className="text-zinc-300">Untitled</span>}
                      </h1>
                    )}

                    {/* Metadata row */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {format(selectedNote.updatedAt, 'MMM d, h:mm a')}
                      </span>
                      <span className="text-zinc-300">·</span>
                      <span>{wordCount} words</span>

                      {selectedNote.sectionId && (
                        <>
                          <span className="text-zinc-300">·</span>
                          <span className="flex items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded-md">
                            <Folder className="w-2.5 h-2.5" />
                            {workspaceSections.find(s => s.id === selectedNote.sectionId)?.name}
                          </span>
                        </>
                      )}

                      {selectedNote.linkedTaskIds && selectedNote.linkedTaskIds.length > 0 && (
                        <span className="flex items-center gap-1 text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                          <LinkIcon className="w-2.5 h-2.5" />
                          {selectedNote.linkedTaskIds.length} linked task{selectedNote.linkedTaskIds.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-start shrink-0">
                    <Button
                      size="sm"
                      variant={isEditing ? "default" : "outline"}
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? 'Done' : 'Edit'}
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => { deleteNote(selectedNote.id); setSelectedNoteId(null); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <NoteEditor
                content={selectedNote.content}
                onChange={(content) => updateNote(selectedNote.id, { content })}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
              />

              {/* Backlinks */}
              <div className="max-w-[800px] mx-auto mt-4">
                <BacklinksPanel noteId={selectedNote.id} noteTitle={selectedNote.title} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
            <FileText className="w-12 h-12 mb-4 text-zinc-200" />
            <h3 className="text-base font-medium text-zinc-900">No note selected</h3>
            <p className="mt-1 text-sm">Select a note or create a new one.</p>
            <Button className="mt-4" onClick={() => handleCreateNote()}>
              <Plus className="w-4 h-4 mr-2" />
              Create Note
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}