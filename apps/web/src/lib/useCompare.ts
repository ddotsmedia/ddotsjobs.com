'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'ddj-compare';
const EVENT = 'ddj-compare-change';
const MAX = 3;

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as string[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}
function write(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(EVENT));
}

// Shared localStorage-backed job comparison selection (max 3).
export function useCompare() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(read());
    const sync = () => setIds(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const cur = read();
    if (cur.includes(id)) write(cur.filter((x) => x !== id));
    else if (cur.length < MAX) write([...cur, id]);
  }, []);

  const remove = useCallback((id: string) => write(read().filter((x) => x !== id)), []);
  const clear = useCallback(() => write([]), []);

  return { ids, toggle, remove, clear, has: (id: string) => ids.includes(id), full: ids.length >= MAX, MAX };
}
