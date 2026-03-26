/**
 * useNexusSpendingStorage.ts
 *
 * Drop-in replacements for the `useLocalStorage` calls in SpendingManager.
 *
 * Strategy (mirrors the rest of NexusDB):
 *  - On mount: loadAll from Supabase (falls back to IDB when offline).
 *  - On every write: diff old vs new array, call NexusDB.put for every
 *    added / changed record and NexusDB.delete for every removed record.
 *    This keeps Supabase as the source of truth with the same write-through
 *    pattern used by tasks, notes, events, etc.
 *
 * Usage in SpendingManager:
 *
 *   // Transactions & Goals  (have `id` fields)
 *   const [transactions, setTransactions] = useNexusItems<Transaction>('spendingTransactions', makeSeed);
 *   const [goals,        setGoals]        = useNexusItems<Goal>('spendingGoals', defaultGoals);
 *
 *   // Budgets  (keyed by `category`, no `id`)
 *   const [budgets, setBudgets] = useNexusBudgets(DEFAULT_BUDGETS);
 *
 * Both hooks are API-compatible with the old useLocalStorage hook so all
 * existing setTransactions / setBudgets / setGoals call-sites stay unchanged.
 */

import { useCallback, useEffect, useState } from 'react';
import { NexusDB, IDBStoreName } from '@/store/storage'; // adjust path if needed

// ─── Generic hook for stores whose records have an `id: string` field ────────

/**
 * useNexusItems<T>
 *
 * Loads T[] from Supabase/IDB on mount, then syncs every setState call back
 * via fine-grained NexusDB.put / NexusDB.delete calls.
 *
 * @param store        One of the IDBStoreName spending stores.
 * @param initialValue Seed data shown instantly before the async load resolves.
 */
export function useNexusItems<T extends { id: string }>(
  store: IDBStoreName,
  initialValue: T[] | (() => T[]),
): [T[], React.Dispatch<React.SetStateAction<T[]>>] {
  const [value, setValue] = useState<T[]>(() =>
    typeof initialValue === 'function'
      ? (initialValue as () => T[])()
      : initialValue,
  );

  // Hydrate from Supabase (or IDB fallback) once on mount.
  useEffect(() => {
    NexusDB.loadAll<T>(store)
      .then(data => {
        if (data.length > 0) setValue(data);
      })
      .catch(() => {
        // Stays on seed data — NexusDB already logged the warning.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  /**
   * Wraps every state update so it also persists to IDB + Supabase.
   * Works with both plain values and functional updaters, identical to the
   * original useLocalStorage API.
   */
  const setAndPersist: React.Dispatch<React.SetStateAction<T[]>> = useCallback(
    action => {
      setValue(prev => {
        const next =
          typeof action === 'function'
            ? (action as (p: T[]) => T[])(prev)
            : action;

        // Build lookup maps for O(n) diffing.
        const prevMap = new Map(prev.map(i => [i.id, i]));
        const nextMap = new Map(next.map(i => [i.id, i]));

        // Delete records that were removed from the array.
        prev.forEach(item => {
          if (!nextMap.has(item.id)) {
            NexusDB.delete(store, item.id).catch(() => {});
          }
        });

        // Upsert records that are new or have changed.
        next.forEach(item => {
          const old = prevMap.get(item.id);
          if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
            NexusDB.put(store, item).catch(() => {});
          }
        });

        return next;
      });
    },
    [store],
  );

  return [value, setAndPersist];
}

// ─── Budget hook  (Budget has no `id`, keyed by `category`) ──────────────────

/**
 * Budget shape as stored — adds a synthetic `id` so NexusDB can key the row.
 * The id is simply the category name, which is already unique.
 */
type BudgetRecord = { id: string; category: string; limit: number };

/**
 * useNexusBudgets
 *
 * Same API as useLocalStorage for Budget[], but persisted via NexusDB.
 * Because Budget has no `id` field we synthesise one from `category`.
 */
export function useNexusBudgets<Budget extends { category: string; limit: number }>(
  initialValue: Budget[],
): [Budget[], React.Dispatch<React.SetStateAction<Budget[]>>] {
  const [value, setValue] = useState<Budget[]>(initialValue);

  // Hydrate from Supabase/IDB on mount, strip the synthetic id before storing
  // in component state.
  useEffect(() => {
    NexusDB.loadAll<BudgetRecord>('spendingBudgets')
      .then(data => {
        if (data.length > 0) {
          // Strip the synthetic `id` field before handing to the component.
          setValue(
            data.map(({ id: _id, ...rest }) => rest as unknown as Budget),
          );
        }
      })
      .catch(() => {});
  }, []);

  const setAndPersist: React.Dispatch<React.SetStateAction<Budget[]>> =
    useCallback(action => {
      setValue(prev => {
        const next =
          typeof action === 'function'
            ? (action as (p: Budget[]) => Budget[])(prev)
            : action;

        const prevCats = new Set(prev.map(b => b.category));
        const nextCats = new Set(next.map(b => b.category));

        // Delete any categories that were removed.
        prev.forEach(b => {
          if (!nextCats.has(b.category)) {
            NexusDB.delete('spendingBudgets', b.category).catch(() => {});
          }
        });

        // Upsert changed / new budgets (id = category).
        next.forEach(b => {
          const old = prev.find(p => p.category === b.category);
          if (!old || old.limit !== b.limit || !prevCats.has(b.category)) {
            NexusDB.put('spendingBudgets', {
              ...b,
              id: b.category, // synthetic primary key
            } as BudgetRecord).catch(() => {});
          }
        });

        return next;
      });
    }, []);

  return [value, setAndPersist];
}