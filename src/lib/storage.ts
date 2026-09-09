import {
  STORAGE_KEY,
  createDefaultState,
  createDefaultTask,
  createDefaultTimer,
  createEmptySession,
  createEmptyProblem,
} from './types';
import type { AppState } from './types';

function normalizeTask(raw: Partial<AppState['tasks'][0]> & { id?: string; name?: string }): AppState['tasks'][0] {
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

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      return createDefaultState();
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
  } catch {
    return createDefaultState();
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportStateJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importStateJson(json: string): AppState {
  const parsed = JSON.parse(json) as Partial<AppState>;
  if (!parsed || !Array.isArray(parsed.tasks)) {
    throw new Error('Invalid backup: missing tasks array');
  }
  const tasks = parsed.tasks.map(normalizeTask);
  if (tasks.length === 0) throw new Error('Invalid backup: no tasks');
  while (tasks.length < 2) {
    tasks.push(createDefaultTask(`task-${tasks.length + 1}`, `Task ${tasks.length + 1}`));
  }
  const activeTaskId =
    parsed.activeTaskId && tasks.some((t) => t.id === parsed.activeTaskId)
      ? parsed.activeTaskId
      : tasks[0].id;
  return { version: 1, activeTaskId, tasks };
}
