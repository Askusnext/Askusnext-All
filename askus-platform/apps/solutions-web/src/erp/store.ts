import { useCallback, useSyncExternalStore } from 'react';
import { message } from 'antd';
import { STAFF_KEYS, authFetch } from '../api/session';
import { SEEDS } from './seed';

/**
 * Data layer for the Business Suite apps (Sales, Customers, Policies, Staff, Money, Settings).
 *
 * Live mode (NEXT_PUBLIC_API_BASE_URL set): every list is loaded from and saved to the AskUs API
 * (`/api/business/<list>`, PostgreSQL schema `business`). Changes appear instantly and are rolled back with an
 * error message if the server refuses them.
 *
 * Offline demo mode (no API URL): lists live in this browser's localStorage, seeded with sample data.
 *
 * Pages only use `useCollection`, `collectionApi` and `getCollection`, so they work the same in both modes.
 */
export type Row = { id: string; [field: string]: any };

export const LIVE = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
const PREFIX = 'askus_erp_v2:';
const STALE_MS = 60_000;

const cache = new Map<string, Row[]>();
const loadedAt = new Map<string, number>();
const loading = new Map<string, Promise<void>>();
const listeners = new Map<string, Set<() => void>>();
const EMPTY: Row[] = [];

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

const notify = (key: string) => listeners.get(key)?.forEach((fn) => fn());
const set = (key: string, rows: Row[]) => {
  cache.set(key, rows);
  if (!LIVE) { try { localStorage.setItem(PREFIX + key, JSON.stringify(rows)); } catch { /* storage full or blocked */ } }
  notify(key);
};
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

// ───────────────────────── Loading ─────────────────────────

function loadLive(key: string, force = false) {
  if (loading.has(key)) return loading.get(key)!;
  if (!force && cache.has(key) && Date.now() - (loadedAt.get(key) ?? 0) < STALE_MS) return Promise.resolve();
  const p = authFetch<Row[]>(STAFF_KEYS, `/business/${key}`)
    .then((rows) => { loadedAt.set(key, Date.now()); set(key, Array.isArray(rows) ? rows : []); })
    .catch((e) => {
      loadedAt.set(key, Date.now());
      if (!cache.has(key)) set(key, []);
      // A list the person may not open (e.g. salaries) simply stays empty.
      if (!/forbidden/i.test(errorText(e))) message.error({ content: `Could not load data: ${errorText(e)}`, key: 'erp-load' });
    })
    .finally(() => loading.delete(key));
  loading.set(key, p);
  return p;
}

function loadOffline(key: string): Row[] {
  let rows: Row[] | null = null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) rows = parsed.filter((r) => r && typeof r === 'object' && typeof r.id === 'string');
  } catch { rows = null; }
  if (!rows) {
    rows = (SEEDS[key]?.() ?? []).map((r) => ({ id: newId(), ...r }));
    try { localStorage.setItem(PREFIX + key, JSON.stringify(rows)); } catch { /* ignore */ }
  }
  cache.set(key, rows);
  return rows;
}

function read(key: string): Row[] {
  if (key === '__none__') return EMPTY;
  if (!LIVE) return cache.get(key) ?? loadOffline(key);
  if (!cache.has(key) || Date.now() - (loadedAt.get(key) ?? 0) >= STALE_MS) void loadLive(key);
  return cache.get(key) ?? EMPTY;
}

/** Current rows (starts loading in live mode if needed). */
export const getCollection = (key: string) => read(key);

/** Forget everything (e.g. on sign-out) so the next person never sees the previous person's data. */
export function clearCollectionCache() {
  const keys = [...cache.keys()];
  cache.clear();
  loadedAt.clear();
  keys.forEach(notify);
}

// ───────────────────────── Writes ─────────────────────────

/** Replace an optimistic row with what the server stored (it may have merged into an existing row). */
function settle(key: string, tempId: string, saved: Row) {
  const rows = (cache.get(key) ?? []).filter((r) => r.id !== saved.id || r.id === tempId);
  set(key, rows.some((r) => r.id === tempId) ? rows.map((r) => (r.id === tempId ? saved : r)) : [saved, ...rows]);
}

export const collectionApi = (key: string) => ({
  add: (row: Omit<Row, 'id'> & { id?: string }) => {
    const created = { ...row, id: row.id ?? newId(), createdAt: row.createdAt ?? new Date().toISOString() } as Row;
    set(key, [created, ...read(key)]);
    if (LIVE) {
      authFetch<Row>(STAFF_KEYS, `/business/${key}`, { method: 'POST', body: created })
        .then((saved) => settle(key, created.id, saved))
        .catch((e) => {
          set(key, (cache.get(key) ?? []).filter((r) => r.id !== created.id));
          message.error(`Not saved: ${errorText(e)}`);
        });
    }
    return created;
  },
  update: (id: string, patch: Partial<Row>) => {
    const before = read(key);
    set(key, before.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (LIVE) {
      authFetch<Row>(STAFF_KEYS, `/business/${key}/${id}`, { method: 'PATCH', body: patch })
        .then((saved) => settle(key, id, saved))
        .catch((e) => {
          set(key, before);
          message.error(`Not saved: ${errorText(e)}`);
        });
    }
  },
  remove: (id: string) => {
    const before = read(key);
    set(key, before.filter((r) => r.id !== id));
    if (LIVE) {
      authFetch<void>(STAFF_KEYS, `/business/${key}/${id}`, { method: 'DELETE' }).catch((e) => {
        set(key, before);
        message.error(`Not deleted: ${errorText(e)}`);
      });
    }
  },
  replace: (rows: Row[]) => set(key, rows),
  reload: () => (LIVE ? loadLive(key, true) : Promise.resolve()),
});

function subscribe(key: string, fn: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => { listeners.get(key)?.delete(fn); };
}

/** Live rows of a list plus add/update/remove helpers. `loading` is true until the first load finishes. */
export function useCollection(key: string) {
  const rows = useSyncExternalStore(
    useCallback((fn) => subscribe(key, fn), [key]),
    () => read(key),
    () => read(key),
  );
  return { rows, loading: LIVE && key !== '__none__' && !loadedAt.has(key), ...collectionApi(key) };
}

// ── Formatting helpers ─────────────────────────────────────────────────────────
export const inr = (n: unknown) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const date = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function downloadCsv(filename: string, header: string[], lines: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    // Neutralise spreadsheet formulas and quote every cell.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [header, ...lines].map((l) => l.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
