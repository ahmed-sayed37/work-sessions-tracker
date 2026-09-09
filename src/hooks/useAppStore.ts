import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDefaultTask,
  createEmptySession,
  createEmptyProblem,
  createDefaultTimer,
} from '../lib/types';
import type { AppState, TaskData, WorkSession, Problem } from '../lib/types';
import {
  loadState,
  saveState,
  flushState,
  exportStateJson,
  importStateJson,
  localStorageHasValidState,
  tryRestoreFromIdb,
} from '../lib/storage';
import { sumSessionHours, toDatetimeLocalValue } from '../lib/time';

const DEBOUNCE_MS = 300;

export function useAppStore() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [toast, setToast] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  // If localStorage was empty/corrupt, restore from IndexedDB once on mount.
  useEffect(() => {
    if (localStorageHasValidState()) return;
    let cancelled = false;
    void (async () => {
      const restored = await tryRestoreFromIdb();
      if (!cancelled && restored) {
        setState(restored);
        showToast('Restored from IndexedDB backup');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // Debounced auto-save (~300ms)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const ok = saveState(stateRef.current);
      if (!ok) showToast('Storage full — export your data');
    }, DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, showToast]);

  // Flush on pagehide, visibility hidden, and beforeunload
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      saveState(stateRef.current);
    };
    const onVisibility = () => {
      if (document.hidden) flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const activeTask = useMemo(
    () => state.tasks.find((t) => t.id === state.activeTaskId) ?? state.tasks[0],
    [state],
  );

  const updateTask = useCallback((taskId: string, patch: Partial<TaskData> | ((t: TaskData) => TaskData)) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.id !== taskId) return t;
        return typeof patch === 'function' ? patch(t) : { ...t, ...patch };
      }),
    }));
  }, []);

  const setActiveTaskId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, activeTaskId: id }));
  }, []);

  const renameTask = useCallback((taskId: string, name: string) => {
    updateTask(taskId, { name: name.trim() || 'Untitled' });
  }, [updateTask]);

  const autoHours = useMemo(
    () => sumSessionHours(activeTask.sessions),
    [activeTask.sessions],
  );

  const effectiveTotal = useMemo(() => {
    if (activeTask.totalHoursOverride !== null && activeTask.totalHoursOverride !== undefined) {
      return activeTask.totalHoursOverride;
    }
    return autoHours;
  }, [activeTask.totalHoursOverride, autoHours]);

  const addSession = useCallback(() => {
    updateTask(activeTask.id, (t) => ({
      ...t,
      sessions: [...t.sessions, createEmptySession()],
      totalHoursOverride: null,
    }));
  }, [activeTask.id, updateTask]);

  const removeSession = useCallback((sessionId: string) => {
    updateTask(activeTask.id, (t) => {
      if (t.sessions.length <= 1) return t;
      return {
        ...t,
        sessions: t.sessions.filter((s) => s.id !== sessionId),
        totalHoursOverride: null,
      };
    });
  }, [activeTask.id, updateTask]);

  const updateSession = useCallback((sessionId: string, patch: Partial<WorkSession>) => {
    updateTask(activeTask.id, (t) => ({
      ...t,
      sessions: t.sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s)),
      totalHoursOverride: null,
    }));
  }, [activeTask.id, updateTask]);

  const setTotalHoursOverride = useCallback((value: number | null) => {
    updateTask(activeTask.id, { totalHoursOverride: value });
  }, [activeTask.id, updateTask]);

  const setEmails = useCallback((alignerrEmail: string, workforceEmail: string) => {
    updateTask(activeTask.id, { alignerrEmail, workforceEmail });
  }, [activeTask.id, updateTask]);

  const setComments = useCallback((comments: string) => {
    updateTask(activeTask.id, { comments });
  }, [activeTask.id, updateTask]);

  const addProblem = useCallback(() => {
    updateTask(activeTask.id, (t) => ({
      ...t,
      problems: [...t.problems, createEmptyProblem(t.problems.length + 1)],
    }));
  }, [activeTask.id, updateTask]);

  const removeProblem = useCallback((problemId: string) => {
    updateTask(activeTask.id, (t) => {
      if (t.problems.length <= 1) return t;
      return { ...t, problems: t.problems.filter((p) => p.id !== problemId) };
    });
  }, [activeTask.id, updateTask]);

  const updateProblem = useCallback((problemId: string, patch: Partial<Problem>) => {
    updateTask(activeTask.id, (t) => ({
      ...t,
      problems: t.problems.map((p) => (p.id === problemId ? { ...p, ...patch } : p)),
    }));
  }, [activeTask.id, updateTask]);

  const startTimer = useCallback(() => {
    updateTask(activeTask.id, (t) => {
      const now = new Date().toISOString();
      if (t.timer.status === 'paused') {
        return {
          ...t,
          timer: {
            ...t.timer,
            status: 'running',
            segmentStartedAt: now,
          },
        };
      }
      return {
        ...t,
        timer: {
          status: 'running',
          startedAt: now,
          accumulatedMs: 0,
          segmentStartedAt: now,
        },
      };
    });
  }, [activeTask.id, updateTask]);

  const pauseTimer = useCallback(() => {
    updateTask(activeTask.id, (t) => {
      if (t.timer.status !== 'running' || !t.timer.segmentStartedAt) return t;
      const extra = Date.now() - new Date(t.timer.segmentStartedAt).getTime();
      return {
        ...t,
        timer: {
          ...t.timer,
          status: 'paused',
          accumulatedMs: t.timer.accumulatedMs + Math.max(0, extra),
          segmentStartedAt: null,
        },
      };
    });
  }, [activeTask.id, updateTask]);

  const stopTimer = useCallback((confirmAppend = true) => {
    const t = stateRef.current.tasks.find((x) => x.id === stateRef.current.activeTaskId);
    if (!t) return;
    if (t.timer.status === 'idle') return;

    let accumulated = t.timer.accumulatedMs;
    if (t.timer.status === 'running' && t.timer.segmentStartedAt) {
      accumulated += Date.now() - new Date(t.timer.segmentStartedAt).getTime();
    }
    accumulated = Math.max(0, accumulated);

    // Start stays timer.startedAt; end = start + accumulatedMs so pauses are excluded from billed hours.
    const startIso = t.timer.startedAt || new Date(Date.now() - accumulated).toISOString();
    const endIso = new Date(new Date(startIso).getTime() + accumulated).toISOString();

    if (confirmAppend) {
      const ok = window.confirm(
        `Stop timer and append a work session?\n\nStart: ${new Date(startIso).toLocaleString()}\nEnd: ${new Date(endIso).toLocaleString()}\nDuration: ${(accumulated / 3_600_000).toFixed(2)} h (pauses excluded)`,
      );
      if (!ok) return;
    }

    const startLocal = toDatetimeLocalValue(startIso);
    const endLocal = toDatetimeLocalValue(endIso);

    updateTask(activeTask.id, (task) => {
      const firstEmpty = task.sessions.find((s) => !s.start && !s.end);
      let sessions: WorkSession[];
      if (firstEmpty) {
        sessions = task.sessions.map((s) =>
          s.id === firstEmpty.id ? { ...s, start: startLocal, end: endLocal } : s,
        );
      } else {
        sessions = [
          ...task.sessions,
          { id: crypto.randomUUID(), start: startLocal, end: endLocal },
        ];
      }
      return {
        ...task,
        sessions,
        totalHoursOverride: null,
        timer: createDefaultTimer(),
      };
    });
    showToast('Session appended from timer');
  }, [activeTask.id, updateTask, showToast]);

  const saveExplicit = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const next: AppState = {
      ...stateRef.current,
      tasks: stateRef.current.tasks.map((t) =>
        t.id === stateRef.current.activeTaskId
          ? {
              ...t,
              submittedHours:
                t.totalHoursOverride !== null && t.totalHoursOverride !== undefined
                  ? t.totalHoursOverride
                  : sumSessionHours(t.sessions),
            }
          : t,
      ),
    };
    setState(next);
    stateRef.current = next;
    const ok = await flushState(next);
    if (!ok) showToast('Storage full — export your data');
    else showToast('Saved');
  }, [showToast]);

  const resetCurrentTask = useCallback(async () => {
    const name = activeTask.name;
    const ok = window.confirm(
      `Reset "${name}"?\n\nThis CANNOT be undone. Sessions, problems, comments, timer, and submitted hours for this task will be permanently cleared. Other tasks are untouched.\n\nTip: Export a JSON backup first if you might need this data later.`,
    );
    if (!ok) return;
    // Only replace this one task in state — never clear storage keys globally.
    const next: AppState = {
      ...stateRef.current,
      tasks: stateRef.current.tasks.map((t) =>
        t.id === activeTask.id ? createDefaultTask(activeTask.id, name) : t,
      ),
    };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setState(next);
    stateRef.current = next;
    const saved = await flushState(next);
    if (!saved) showToast('Storage full — export your data');
    else showToast('Task reset');
  }, [activeTask.id, activeTask.name, showToast]);

  const refreshFromStorage = useCallback(() => {
    setState(loadState());
    showToast('Reloaded from storage');
  }, [showToast]);

  const exportJson = useCallback(() => {
    const json = exportStateJson(stateRef.current);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-sessions-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported JSON');
  }, [showToast]);

  const importJson = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const next = importStateJson(String(reader.result));
          if (saveTimer.current) clearTimeout(saveTimer.current);
          setState(next);
          stateRef.current = next;
          const ok = await flushState(next);
          if (!ok) showToast('Imported but storage full — export your data');
          else showToast('Imported backup');
        } catch (e) {
          showToast(e instanceof Error ? e.message : 'Import failed');
        }
      })();
    };
    reader.readAsText(file);
  }, [showToast]);

  return {
    state,
    activeTask,
    autoHours,
    effectiveTotal,
    toast,
    setActiveTaskId,
    renameTask,
    addSession,
    removeSession,
    updateSession,
    setTotalHoursOverride,
    setEmails,
    setComments,
    addProblem,
    removeProblem,
    updateProblem,
    startTimer,
    pauseTimer,
    stopTimer,
    saveExplicit,
    resetCurrentTask,
    refreshFromStorage,
    exportJson,
    importJson,
  };
}
