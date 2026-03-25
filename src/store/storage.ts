/**
 * storage.ts
 *
 * Persistence layer for Nexus.
 *
 * Strategy:
 *  - IndexedDB (via a tiny hand-rolled wrapper) for data-heavy stores:
 *      notes, tasks, events, projects, projectColumns
 *  - localStorage for lightweight config:
 *      settings, profiles, noteSections, workspaces, ui-state
 *
 * All APIs are async-safe and fall back gracefully to localStorage if
 * IndexedDB is unavailable (private browsing, storage quota exceeded, etc.)
 */

const DB_NAME    = 'nexus-db';
const DB_VERSION = 1;

// ─── IndexedDB bootstrap ──────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // One object store per collection, keyed by id
      ['notes', 'tasks', 'events', 'projects', 'projectColumns'].forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess  = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db!); };
    req.onerror    = ()  => reject(req.error);
  });
}

// ─── Generic IDB helpers ──────────────────────────────────────────────────────

async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPutAll<T>(store: string, items: T[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    // clear then re-insert — simplest way to handle deletes
    const clearReq = os.clear();
    clearReq.onsuccess = () => {
      items.forEach(item => os.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    };
    clearReq.onerror = () => reject(clearReq.error);
  });
}

async function idbDelete(store: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbPut<T>(store: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(item);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** IDB-backed stores */
export type IDBStoreName = 'notes' | 'tasks' | 'events' | 'projects' | 'projectColumns';

export const NexusDB = {
  /** Load all records from an IDB store */
  async loadAll<T>(store: IDBStoreName): Promise<T[]> {
    try {
      return await idbGetAll<T>(store);
    } catch (err) {
      console.warn(`[NexusDB] IDB read failed for "${store}", falling back to localStorage`, err);
      try {
        const raw = localStorage.getItem(`nexus-idb-fallback-${store}`);
        return raw ? (JSON.parse(raw) as T[]) : [];
      } catch {
        return [];
      }
    }
  },

  /** Persist a single item (upsert) */
  async put<T>(store: IDBStoreName, item: T): Promise<void> {
    try {
      await idbPut(store, item);
    } catch (err) {
      console.warn(`[NexusDB] IDB put failed for "${store}"`, err);
      // best-effort fallback: load existing, merge, write back
      try {
        const existing = JSON.parse(localStorage.getItem(`nexus-idb-fallback-${store}`) ?? '[]') as T[];
        const id = (item as any).id;
        const merged = [...existing.filter((x: any) => x.id !== id), item];
        localStorage.setItem(`nexus-idb-fallback-${store}`, JSON.stringify(merged));
      } catch { /* quota exceeded — nothing we can do */ }
    }
  },

  /** Remove a record by id */
  async delete(store: IDBStoreName, id: string): Promise<void> {
    try {
      await idbDelete(store, id);
    } catch (err) {
      console.warn(`[NexusDB] IDB delete failed for "${store}"`, err);
      try {
        const existing = JSON.parse(localStorage.getItem(`nexus-idb-fallback-${store}`) ?? '[]') as any[];
        localStorage.setItem(`nexus-idb-fallback-${store}`, JSON.stringify(existing.filter(x => x.id !== id)));
      } catch { /* ignore */ }
    }
  },

  /** Replace entire collection (used on bulk actions) */
  async replaceAll<T>(store: IDBStoreName, items: T[]): Promise<void> {
    try {
      await idbPutAll(store, items);
    } catch (err) {
      console.warn(`[NexusDB] IDB replaceAll failed for "${store}"`, err);
      try {
        localStorage.setItem(`nexus-idb-fallback-${store}`, JSON.stringify(items));
      } catch { /* quota exceeded */ }
    }
  },

  // ── localStorage helpers for lightweight config ──────────────────────────

  /** Read a JSON value from localStorage */
  lsGet<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`nexus-ls-${key}`);
      return raw !== null ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },

  /** Write a JSON value to localStorage */
  lsSet<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`nexus-ls-${key}`, JSON.stringify(value));
    } catch (err) {
      console.warn(`[NexusDB] localStorage write failed for "${key}"`, err);
    }
  },

  /** Migrate from the old nexus-store Zustand key if it exists */
  async migrateFromLegacy(): Promise<{
    notes: any[]; tasks: any[]; events: any[];
    projects: any[]; projectColumns: any[];
    settings?: any; profiles?: any[]; noteSections?: any[];
  } | null> {
    const legacyKey = 'nexus-store';
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const state  = parsed?.state ?? parsed;
      return {
        notes:          state.notes          ?? [],
        tasks:          state.tasks          ?? [],
        events:         state.events         ?? [],
        projects:       state.projects       ?? [],
        projectColumns: state.projectColumns ?? [],
        settings:       state.settings,
        profiles:       state.profiles,
        noteSections:   state.noteSections,
      };
    } catch {
      return null;
    }
  },

  /** Clear the legacy nexus-store key after successful migration */
  clearLegacy(): void {
    localStorage.removeItem('nexus-store');
  },
};