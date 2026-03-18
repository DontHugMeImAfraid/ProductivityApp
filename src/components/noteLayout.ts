// src/lib/noteLayout.ts
// ─── Split-pane layout engine ─────────────────────────────────────────────────
// Recursive tree: every node is either a leaf (one pane with tabs)
// or a split (two children + a direction + a divider ratio).

export type TabId = string; // note ID

export interface Tab {
  id: TabId;         // note ID
  isPinned: boolean; // pinned = can't be closed / locked to left
  isDirty:  boolean; // unsaved indicator dot
}

export interface Pane {
  id: string;
  tabs: Tab[];
  activeTabId: TabId | null;
  scrollPos:   number;          // remember scroll per pane
}

export type Layout =
  | { type: 'leaf';  pane: Pane }
  | { type: 'split'; dir: 'h' | 'v'; ratio: number; left: Layout; right: Layout };

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function makePane(id?: string): Pane {
  return { id: id ?? crypto.randomUUID(), tabs: [], activeTabId: null, scrollPos: 0 };
}

export function makeLeaf(pane?: Pane): Layout {
  return { type: 'leaf', pane: pane ?? makePane() };
}

/** Find the leaf that contains a specific pane id */
export function findLeaf(layout: Layout, paneId: string): { type: 'leaf'; pane: Pane } | null {
  if (layout.type === 'leaf') return layout.pane.id === paneId ? layout : null;
  return findLeaf(layout.left, paneId) ?? findLeaf(layout.right, paneId);
}

/** Collect all panes in document order */
export function allPanes(layout: Layout): Pane[] {
  if (layout.type === 'leaf') return [layout.pane];
  return [...allPanes(layout.left), ...allPanes(layout.right)];
}

/** Deep-update a specific leaf by pane id */
export function updatePane(layout: Layout, paneId: string, fn: (p: Pane) => Pane): Layout {
  if (layout.type === 'leaf') {
    return layout.pane.id === paneId ? { ...layout, pane: fn(layout.pane) } : layout;
  }
  return { ...layout, left: updatePane(layout.left, paneId, fn), right: updatePane(layout.right, paneId, fn) };
}

/** Split a leaf into two, placing the new pane on the right/bottom */
export function splitPane(layout: Layout, paneId: string, dir: 'h' | 'v'): Layout {
  if (layout.type === 'leaf' && layout.pane.id === paneId) {
    const newPane = makePane();
    return { type: 'split', dir, ratio: 0.5, left: layout, right: makeLeaf(newPane) };
  }
  if (layout.type === 'split') {
    return { ...layout, left: splitPane(layout.left, paneId, dir), right: splitPane(layout.right, paneId, dir) };
  }
  return layout;
}

/** Remove a leaf by pane id, promoting the sibling */
export function closePane(layout: Layout, paneId: string): Layout | null {
  if (layout.type === 'leaf') return layout.pane.id === paneId ? null : layout;
  const newLeft  = closePane(layout.left,  paneId);
  const newRight = closePane(layout.right, paneId);
  if (!newLeft  && newRight) return newRight;
  if (newLeft   && !newRight) return newLeft;
  if (!newLeft  && !newRight) return null;
  return { ...layout, left: newLeft!, right: newRight! };
}

/** Move a tab from one pane to another */
export function moveTab(layout: Layout, tabId: TabId, fromPaneId: string, toPaneId: string): Layout {
  let movedTab: Tab | undefined;
  let result = updatePane(layout, fromPaneId, p => {
    movedTab = p.tabs.find(t => t.id === tabId);
    const tabs = p.tabs.filter(t => t.id !== tabId);
    return { ...p, tabs, activeTabId: tabs[tabs.length - 1]?.id ?? null };
  });
  if (!movedTab) return layout;
  const tab = movedTab;
  result = updatePane(result, toPaneId, p => ({
    ...p,
    tabs: p.tabs.some(t => t.id === tab.id) ? p.tabs : [...p.tabs, tab],
    activeTabId: tab.id,
  }));
  return result;
}

/** Open a note in a pane (add tab if not already open, make it active) */
export function openInPane(layout: Layout, paneId: string, noteId: TabId): Layout {
  return updatePane(layout, paneId, p => {
    const existing = p.tabs.find(t => t.id === noteId);
    if (existing) return { ...p, activeTabId: noteId };
    return { ...p, tabs: [...p.tabs, { id: noteId, isPinned: false, isDirty: false }], activeTabId: noteId };
  });
}

/** Reorder tabs within a pane */
export function reorderTabs(layout: Layout, paneId: string, fromIdx: number, toIdx: number): Layout {
  return updatePane(layout, paneId, p => {
    const tabs = [...p.tabs];
    const [moved] = tabs.splice(fromIdx, 1);
    tabs.splice(toIdx, 0, moved);
    return { ...p, tabs };
  });
}

/** Update divider ratio */
export function resizePane(layout: Layout, paneId: string, ratio: number): Layout {
  // paneId here refers to the split node — we identify it by left child pane id
  if (layout.type === 'split') {
    const leftPanes = allPanes(layout.left).map(p => p.id);
    if (leftPanes.includes(paneId)) {
      return { ...layout, ratio: Math.max(0.15, Math.min(0.85, ratio)) };
    }
    return { ...layout, left: resizePane(layout.left, paneId, ratio), right: resizePane(layout.right, paneId, ratio) };
  }
  return layout;
}
