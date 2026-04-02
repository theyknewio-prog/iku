"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Reactive localStorage hook.
 * Returns [value, setValue] where value stays in sync across hook instances
 * that share the same key (via the "storage" event).
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const next =
          typeof value === "function"
            ? (value as (prev: T) => T)(storedValue)
            : value;
        setStoredValue(next);
        if (typeof window !== "undefined") {
          localStorage.setItem(key, JSON.stringify(next));
        }
      } catch {
        // ignore
      }
    },
    [key, storedValue]
  );

  /* Keep in sync when another tab/component writes the same key */
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return;
      try {
        if (e.newValue !== null) {
          setStoredValue(JSON.parse(e.newValue) as T);
        }
      } catch {
        // ignore
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return [storedValue, setValue];
}
