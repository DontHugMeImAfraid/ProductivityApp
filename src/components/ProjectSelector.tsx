import React, { useState } from 'react';
import { useAppStore } from '@/store';
import { Project } from '@/types';
import { Plus, FolderKanban, CheckCircle2, MoreVertical, Trash2, Edit2, Check, X, Archive } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const PRESET_COLORS = [
  '#6366f1', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f59e0b', '#10b981', '#ef4444', '#14b8a6',
];

interface ProjectCardProps {
  project: Project;
  isSelected: boolean;
  onSelect: () => void;
}

function ProjectCard({ project, isSelected, onSelect }: ProjectCardProps) {
  const { updateProject, deleteProject, tasks } = useAppStore();
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const doneTasks = projectTasks.filter(t => t.status === 'Done');
  const pct = projectTasks.length > 0 ? Math.round((doneTasks.length / projectTasks.length) * 100) : 0;

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateProject(project.id, {
      isCompleted: !project.isCompleted,
      completedAt: !project.isCompleted ? Date.now() : undefined,
    });
    setShowMenu(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    deleteProject(project.id);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editing) {
      if (editName.trim()) updateProject(project.id, { name: editName.trim() });
      setEditing(false);
    } else {
      setEditing(true);
      setShowMenu(false);
    }
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative flex flex-col gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 group",
        isSelected
          ? "border-violet-300 bg-violet-50/60 shadow-sm shadow-violet-100"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
        project.isCompleted && "opacity-60"
      )}
    >
      {/* Top bar */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-3 h-3 rounded-full shrink-0 mt-0.5"
            style={{ backgroundColor: project.color }}
          />
          {editing ? (
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRename(e as any);
                if (e.key === 'Escape') { setEditing(false); setEditName(project.name); }
              }}
              onClick={e => e.stopPropagation()}
              className="text-sm font-semibold text-slate-900 bg-transparent border-b border-violet-400 outline-none w-full"
            />
          ) : (
            <h3 className={cn("text-sm font-semibold text-slate-900 truncate", project.isCompleted && "line-through text-slate-500")}>
              {project.name}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {project.isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          <button
            onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3">
        <div className="text-xs text-slate-500">{projectTasks.length} tasks</div>
        {projectTasks.length > 0 && (
          <>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: project.color }}
              />
            </div>
            <div className="text-xs font-medium text-slate-600">{pct}%</div>
          </>
        )}
      </div>

      {project.createdAt && (
        <p className="text-[10px] text-slate-400">
          Created {format(project.createdAt, 'MMM d, yyyy')}
        </p>
      )}

      {/* Context menu */}
      {showMenu && (
        <div
          className="absolute top-8 right-2 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          onClick={e => e.stopPropagation()}
        >
          <button onClick={e => { handleRename(e); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <Edit2 className="w-3.5 h-3.5 text-slate-400" /> Rename
          </button>
          <button onClick={handleComplete} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <Archive className="w-3.5 h-3.5 text-slate-400" /> {project.isCompleted ? 'Reopen' : 'Mark Complete'}
          </button>
          <div className="h-px bg-slate-100 mx-3" />
          {confirmDelete ? (
            <div className="px-3 py-2">
              <p className="text-xs text-red-600 mb-2">Delete project & all its tasks?</p>
              <div className="flex gap-1.5">
                <button onClick={handleDelete} className="flex-1 py-1.5 bg-red-500 text-white text-xs rounded-md font-medium">Delete</button>
                <button onClick={e => { e.stopPropagation(); setConfirmDelete(false); }} className="flex-1 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-md">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={handleDelete} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface ProjectSelectorProps {
  onClose?: () => void;
}

export function ProjectSelector({ onClose }: ProjectSelectorProps) {
  const { workspace, projects, selectedProjectId, setSelectedProjectId, addProject } = useAppStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const workspaceProjects = projects.filter(p => p.workspace === workspace);
  const activeProjects = workspaceProjects.filter(p => !p.isCompleted);
  const completedProjects = workspaceProjects.filter(p => p.isCompleted);

  const handleCreate = () => {
    if (!newName.trim()) return;
    addProject({ name: newName.trim(), workspace, color: newColor, isCompleted: false });
    setNewName('');
    setNewColor(PRESET_COLORS[0]);
    setCreating(false);
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900">Projects</h2>
        <Button size="sm" onClick={() => setCreating(v => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Project
        </Button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="mb-4 p-4 bg-violet-50 border border-violet-200 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <Input
            autoFocus
            placeholder="Project name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
          />
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={cn("w-6 h-6 rounded-full transition-transform", newColor === c && "ring-2 ring-offset-2 ring-violet-500 scale-110")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2">
        {activeProjects.length === 0 && !creating && (
          <div className="text-center py-8 text-slate-400">
            <FolderKanban className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No projects yet</p>
          </div>
        )}
        {activeProjects.map(p => (
          <ProjectCard
            key={p.id}
            project={p}
            isSelected={selectedProjectId === p.id}
            onSelect={() => { setSelectedProjectId(p.id); onClose?.(); }}
          />
        ))}

        {completedProjects.length > 0 && (
          <>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest pt-2 pb-1">Completed</p>
            {completedProjects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                isSelected={selectedProjectId === p.id}
                onSelect={() => { setSelectedProjectId(p.id); onClose?.(); }}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
