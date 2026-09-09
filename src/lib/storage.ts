import {
  STORAGE_KEY,
  BACKUP_KEY,
  CORRUPT_KEY,
  createDefaultState,
  createDefaultTask,
  createDefaultTimer,
  createEmptySession,
  createEmptyProblem,
} from './types';
import type { AppState } from './types';

const IDB_NAME = 'workSessions';
const IDB_STORE = 'state';
const IDB_ID = 'v1';

function normalizeTask(
  raw: Partial<AppState['tasks'][0]> & { id?: string; name?: string },
): AppState['tasks'][0] {
  const id = raw.id || crypto.randomUUID();
  const name = raw.name || 'Task';
  const base = createDefaultTask(id, name);
  return {
    ...base,
    ...raw,
    id,
    name,
    sessions:
      Array.isArray(raw.sessions) && raw.sessions.length > 0
        ? raw.sessions.map((s) => ({
            id: s.id || crypto.randomUUID(),
            start: s.start || '',
            end: s.end || '',
          }))
        : [createEmptySession()],
    problems:
      Array.isArray(raw.problems) && raw.problems.length > 0
        ? raw.problems.map((p, i) => ({
            id: p.id || crypto.randomUUID(),
            title: p.title || `Problem ${i + 1}`,
            notes: p.notes || '',
          }))
        : [createEmptyProblem(1)],
    timer: {
      ...createDefaultTimer(),
      ...(raw.timer || {}),
    },
    totalHoursOverride:
      raw.totalHoursOverride === undefined ? null : raw.totalHoursOverride,
    submittedHours: typeof raw.submittedHours === 'number' ? raw.submittedHours : 0,
    comments: raw.comments || '',
    alignerrEmail: raw.alignerrEmail || '',
    workforceEmail: raw.workforceEmail || '',
  };
}

function normalizeParsed(parsed: Partial<AppState>): AppState | null {
  if (!parsed || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    return null;
  }
  const tasks = parsed.tasks.map(normalizeTask);
  while (tasks.length < 2) {
    tasks.push(createDefaultTask(`task-${tasks.length + 1}`, `Task ${tasks.length + 1}`));
  }
  const activeTaskId =
    parsed.activeTaskId && tasks.some((t) => t.id === parsed.activeTaskId)
      ? parsed.activeTaskId
      : tasks[0].id;
  return { version: 1, activeTaskId, tasks };
}

/** Parse raw JSON string into AppState, or null if invalid/corrupt. */
export function parseStateJson(raw: string): AppState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return normalizeParsed(parsed);
  } catch {
    return null;
  }
}

function dumpCorrupt(raw: string): void {
  try {
    localStorage.setItem(CORRUPT_KEY, raw);
  } catch {
    /* ignore quota on corrupt dump */
  }
}

function writeLocalStorage(json: string): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(BACKUP_KEY, json);
    return true;
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)
    ) {
      return false;
    }
    throw e;
  }
}

/* ---------- IndexedDB helpers ---------- */

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

export async function idbGet(): Promise<string | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_ID);
      req.onsuccess = () => {
        const v = req.result;
        resolve(typeof v === 'string' ? v : v == null ? null : JSON.stringify(v));
      };
      req.onerror = () => reject(req.error ?? new Error('idbGet failed'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

export async function idbSet(json: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(json, IDB_ID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('idbSet failed'));
    tx.oncomplete = () => db.close();
  });
}

/** True if primary or backup localStorage holds a valid state. */
export function localStorageHasValidState(): boolean {
  try {
    const primary = localStorage.getItem(STORAGE_KEY);
    if (primary && parseStateJson(primary)) return true;
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup && parseStateJson(backup)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Sync load: primary → backup → default empty.
 * On corrupt primary, copies raw string to corrupt key before falling back.
 * Does NOT wipe keys.
 */
export function loadState(): AppState {
  try {
    const primary = localStorage.getItem(STORAGE_KEY);
    if (primary) {
      const state = parseStateJson(primary);
      if (state) return state;
      dumpCorrupt(primary);
    }
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup) {
      const state = parseStateJson(backup);
      if (state) {
        try {
          localStorage.setItem(STORAGE_KEY, backup);
        } catch {
          /* ignore */
        }
        return state;
      }
    }
  } catch {
    /* fall through to default */
  }
  return createDefaultState();
}

/**
 * If localStorage is empty/corrupt but IndexedDB has data, restore and rewrite LS.
 * Call on mount when localStorageHasValidState() is false.
 */
export async function tryRestoreFromIdb(): Promise<AppState | null> {
  const raw = await idbGet();
  if (!raw) return null;
  const state = parseStateJson(raw);
  if (!state) return null;
  writeLocalStorage(raw);
  return state;
}

/**
 * Write primary + backup. Fire-and-forget IndexedDB mirror.
 * Returns false on QuotaExceededError (does not wipe existing keys).
 */
export function saveState(state: AppState): boolean {
  const json = JSON.stringify(state);
  const ok = writeLocalStorage(json);
  if (ok) {
    void idbSet(json).catch(() => {
      /* IDB mirror is best-effort */
    });
  }
  return ok;
}

/**
 * Sync localStorage write + await IndexedDB write (for explicit flush paths).
 */
export async function flushState(state: AppState): Promise<boolean> {
  const json = JSON.stringify(state);
  const ok = writeLocalStorage(json);
  if (!ok) return false;
  try {
    await idbSet(json);
  } catch {
    /* LS succeeded; IDB failure is non-fatal */
  }
  return true;
}

export function exportStateJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importStateJson(json: string): AppState {
  const parsed = JSON.parse(json) as Partial<AppState>;
  const state = normalizeParsed(parsed);
  if (!state) {
    throw new Error('Invalid backup: missing tasks array or empty tasks');
  }
  return state;
}
