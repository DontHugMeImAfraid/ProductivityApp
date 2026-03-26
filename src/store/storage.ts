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
 * All data is scoped per-user via a userId prefix so no two Cognito
 * accounts ever share the same IndexedDB database or localStorage keys.
 *
 * Call NexusDB.setUserId(sub) before any read/write (done in hydrateStore).
 */

// ─── User scoping ─────────────────────────────────────────────────────────────

let _userId: string = 'anonymous';

/** Call this with the Cognito user's `sub` before hydrating the store. */
export function setStorageUserId(id: string) {
  _userId = id || 'anonymous';
  // Reset cached DB handle so next openDB() opens the correct per-user database
  _db = null;
}

// ─── IndexedDB bootstrap ──────────────────────────────────────────────────────

const DB_VERSION = 1;

function dbName() {
  return `nexus-db-${_userId}`;
}

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName(), DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
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

// ─── Key helpers ──────────────────────────────────────────────────────────────

function lsKey(key: string) {
  return `nexus-ls-${_userId}-${key}`;
}

function lsFallbackKey(store: string) {
  return `nexus-idb-fallback-${_userId}-${store}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type IDBStoreName = 'notes' | 'tasks' | 'events' | 'projects' | 'projectColumns';

export const NexusDB = {
  /** Scope all storage to this user. Must be called before any read/write. */
  setUserId: setStorageUserId,

  async loadAll<T>(store: IDBStoreName): Promise<T[]> {
    try {
      return await idbGetAll<T>(store);
    } catch (err) {
      console.warn(`[NexusDB] IDB read failed for "${store}", falling back to localStorage`, err);
      try {
        const raw = localStorage.getItem(lsFallbackKey(store));
        return raw ? (JSON.parse(raw) as T[]) : [];
      } catch {
        return [];
      }
    }
  },

  async put<T>(store: IDBStoreName, item: T): Promise<void> {
    try {
      await idbPut(store, item);
    } catch (err) {
      console.warn(`[NexusDB] IDB put failed for "${store}"`, err);
      try {
        const existing = JSON.parse(localStorage.getItem(lsFallbackKey(store)) ?? '[]') as T[];
        const id = (item as any).id;
        const merged = [...existing.filter((x: any) => x.id !== id), item];
        localStorage.setItem(lsFallbackKey(store), JSON.stringify(merged));
      } catch { /* quota exceeded */ }
    }
  },

  async delete(store: IDBStoreName, id: string): Promise<void> {
    try {
      await idbDelete(store, id);
    } catch (err) {
      console.warn(`[NexusDB] IDB delete failed for "${store}"`, err);
      try {
        const existing = JSON.parse(localStorage.getItem(lsFallbackKey(store)) ?? '[]') as any[];
        localStorage.setItem(lsFallbackKey(store), JSON.stringify(existing.filter(x => x.id !== id)));
      } catch { /* ignore */ }
    }
  },

  async replaceAll<T>(store: IDBStoreName, items: T[]): Promise<void> {
    try {
      await idbPutAll(store, items);
    } catch (err) {
      console.warn(`[NexusDB] IDB replaceAll failed for "${store}"`, err);
      try {
        localStorage.setItem(lsFallbackKey(store), JSON.stringify(items));
      } catch { /* quota exceeded */ }
    }
  },

  lsGet<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(lsKey(key));
      return raw !== null ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },

  lsSet<T>(key: string, value: T): void {
    try {
      localStorage.setItem(lsKey(key), JSON.stringify(value));
    } catch (err) {
      console.warn(`[NexusDB] localStorage write failed for "${key}"`, err);
    }
  },

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

  clearLegacy(): void {
    localStorage.removeItem('nexus-store');
  },
};