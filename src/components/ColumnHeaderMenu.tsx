import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store';
import { ProjectColumn, Status } from '@/types';
import { MoreVertical, EyeOff, Trash2, Edit2, Palette, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#6366f1', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f59e0b', '#10b981', '#ef4444', '#14b8a6',
  '#f97316', '#64748b', '#0ea5e9', '#d946ef',
];

interface ColumnHeaderMenuProps {
  column: ProjectColumn;
}

export function ColumnHeaderMenu({ column }: ColumnHeaderMenuProps) {
  const { updateProjectColumn, deleteProjectColumn } = useAppStore();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'rename' | 'color' | 'confirm-delete'>('menu');
  const [renameVal, setRenameVal] = useState(column.label);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMode('menu');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleHide = () => {
    updateProjectColumn(column.id, { isHidden: true });
    setOpen(false);
  };

  const handleDelete = () => {
    if (mode !== 'confirm-delete') { setMode('confirm-delete'); return; }
    deleteProjectColumn(column.id);
    setOpen(false);
  };

  const handleRename = () => {
    if (renameVal.trim()) {
      updateProjectColumn(column.id, { label: renameVal.trim() });
    }
    setOpen(false);
    setMode('menu');
  };

  const handleColorSelect = (color: string) => {
    updateProjectColumn(column.id, { color });
    setOpen(false);
    setMode('menu');
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => { setOpen(v => !v); setMode('menu'); }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all opacity-0 group-hover/col:opacity-100"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute top-7 right-0 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {mode === 'menu' && (
            <>
              <button onClick={() => setMode('rename')} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <Edit2 className="w-3.5 h-3.5 text-slate-400" /> Rename Section
              </button>
              <button onClick={() => setMode('color')} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <Palette className="w-3.5 h-3.5 text-slate-400" /> Change Colour
              </button>
              <button onClick={handleHide} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <EyeOff className="w-3.5 h-3.5 text-slate-400" /> Hide Section
              </button>
              <div className="h-px bg-slate-100 mx-3" />
              <button onClick={() => setMode('confirm-delete')} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" /> Delete Section
              </button>
            </>
          )}

          {mode === 'rename' && (
            <div className="p-3 space-y-2">
              <p className="text-xs font-medium text-slate-600">Rename section</p>
              <input
                autoFocus
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setMode('menu'); setRenameVal(column.label); } }}
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-violet-400"
              />
              <div className="flex gap-1.5">
                <button onClick={handleRename} className="flex-1 py-1.5 bg-violet-600 text-white text-xs rounded-lg font-medium hover:bg-violet-700">Save</button>
                <button onClick={() => { setMode('menu'); setRenameVal(column.label); }} className="flex-1 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          {mode === 'color' && (
            <div className="p-3 space-y-2">
              <p className="text-xs font-medium text-slate-600">Choose colour</p>
              <div className="grid grid-cols-6 gap-1.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => handleColorSelect(c)}
                    className={cn("w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                      column.color === c ? "border-slate-700 scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button onClick={() => setMode('menu')} className="text-xs text-slate-500 hover:text-slate-700">← Back</button>
            </div>
          )}

          {mode === 'confirm-delete' && (
            <div className="p-3">
              <p className="text-xs text-red-600 mb-2 font-medium">Delete "{column.label}"?</p>
              <p className="text-xs text-slate-500 mb-3">Tasks in this section will remain but lose their column.</p>
              <div className="flex gap-1.5">
                <button onClick={handleDelete} className="flex-1 py-1.5 bg-red-500 text-white text-xs rounded-lg font-medium">Delete</button>
                <button onClick={() => setMode('menu')} className="flex-1 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
