import { supabase } from '@/lib/supabase';
/**
 * storage.ts
 *
 * Persistence layer for Nexus.
 *
 * Strategy:
 *  - Supabase (primary, cloud) for all IDB stores
 *  - IndexedDB (local cache / offline fallback) for the same stores
 *  - localStorage for lightweight config:
 *      settings, profiles, noteSections, workspaces, ui-state
 *
 * All data is scoped per-user via a userId prefix so no two accounts
 * ever share the same IndexedDB database or localStorage keys.
 *
 * Call NexusDB.setUserId(sub) before any read/write (done in hydrateStore).
 */

// ─── Supabase table map ───────────────────────────────────────────────────────

const SUPABASE_TABLES: Partial<Record<IDBStoreName, string>> = {
  notes:                'notes',
  tasks:                'tasks',
  events:               'events',
  projects:             'projects',
  projectColumns:       'project_columns',
  spendingTransactions: 'spending_transactions',
  spendingBudgets:      'spending_budgets',
  spendingGoals:        'spending_goals',
};

// ─── User scoping ─────────────────────────────────────────────────────────────

let _userId: string = 'anonymous';

export function setStorageUserId(id: string) {
  _userId = id || 'anonymous';
  _db = null;
}

// ─── IndexedDB bootstrap ──────────────────────────────────────────────────────

const DB_VERSION = 2; // bumped from 1 → adds spending stores

function dbName() {
  return `nexus-db-${_userId}`;
}

let _db: IDBDatabase | null = null;

const ALL_IDB_STORES = [
  'notes', 'tasks', 'events', 'projects', 'projectColumns',
  'spendingTransactions', 'spendingBudgets', 'spendingGoals',
];

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName(), DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      ALL_IDB_STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db!); };
    req.onerror   = ()  => reject(req.error);
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

export type IDBStoreName =
  | 'notes' | 'tasks' | 'events' | 'projects' | 'projectColumns'
  | 'spendingTransactions' | 'spendingBudgets' | 'spendingGoals';

export const NexusDB = {
  setUserId: setStorageUserId,

  /**
   * Load all records for a store.
   * 1. Try Supabase (source of truth), refresh local IDB cache.
   * 2. Fall back to IDB when offline.
   */
  async loadAll<T>(store: IDBStoreName): Promise<T[]> {
    const table = SUPABASE_TABLES[store];
    if (table) {
      try {
        const { data, error } = await supabase.from(table).select('*');
        if (!error && data) {
          idbPutAll(store, data).catch(() => {});
          return data as T[];
        }
      } catch (err) {
        console.warn(`[NexusDB] Supabase loadAll failed for "${store}", falling back to IDB`, err);
      }
    }
    return idbGetAll<T>(store);
  },

  /**
   * Upsert a single record.
   * Writes to IDB immediately (instant UI), then syncs to Supabase.
   */
  async put<T>(store: IDBStoreName, item: T): Promise<void> {
    try {
      await idbPut(store, item);
    } catch (err) {
      console.warn(`[NexusDB] IDB put failed for "${store}"`, err);
    }
    const table = SUPABASE_TABLES[store];
    if (table) {
      supabase.from(table).upsert(item).then(({ error }) => {
        if (error) console.warn(`[NexusDB] Supabase upsert failed for "${store}"`, error);
      });
    }
  },

  /**
   * Delete a record by id from IDB and Supabase.
   */
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
    const table = SUPABASE_TABLES[store];
    if (table) {
      supabase.from(table).delete().eq('id', id).then(({ error }) => {
        if (error) console.warn(`[NexusDB] Supabase delete failed for "${store}"`, error);
      });
    }
  },

  /**
   * Replace all records in a store (bulk reorders / migrations).
   */
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

  // ── localStorage helpers ──────────────────────────────────────────────────

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

  // ── Legacy migration ──────────────────────────────────────────────────────

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
        spendingTransactions: state.spendingTransactions,
        spendingBudgets:      state.spendingBudgets,
        spendingGoals:        state.spendingGoals,
      };
    } catch {
      return null;
    }
  },

  clearLegacy(): void {
    localStorage.removeItem('nexus-store');
  },
};