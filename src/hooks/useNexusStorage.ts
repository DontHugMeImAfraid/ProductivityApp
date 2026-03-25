/**
 * useNexusStorage.ts
 *
 * Drop-in replacement for the inline useLocalStorage hook in SpendingManager.
 * Persists to localStorage (via NexusDB.lsSet/lsGet) with the same API.
 *
 * For spending data we use localStorage (values are modest in size).
 * If you want IDB for spending too, swap lsGet/lsSet for IDB calls.
 */

import { useState, useCallback, useEffect } from 'react';
import { NexusDB } from '@/store/storage';

export function useNexusStorage<T>(
  key: string,
  initialValue: T | (() => T),
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const init = typeof initialValue === 'function'
      ? (initialValue as () => T)()
      : initialValue;
    return NexusDB.lsGet<T>(key, init);
  });

  const setAndPersist: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (action) => {
      setValue((prev) => {
        const next = typeof action === 'function'
          ? (action as (p: T) => T)(prev)
          : action;
        NexusDB.lsSet(key, next);
        return next;
      });
    },
    [key],
  );

  return [value, setAndPersist];
}