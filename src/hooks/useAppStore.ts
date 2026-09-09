import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDefaultTask,
  createEmptySession,
  createEmptyProblem,
  createDefaultTimer,
} from '../lib/types';
import type { AppState, TaskData, WorkSession, Problem } from '../lib/types';
import { loadState, saveState, exportStateJson, importStateJson } from '../lib/storage';
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

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveState(stateRef.current);
    }, DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  useEffect(() => {
    const flush = () => saveState(stateRef.current);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
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
    const startIso = t.timer.startedAt || new Date(Date.now() - accumulated).toISOString();
    const endIso = new Date().toISOString();

    if (confirmAppend) {
      const ok = window.confirm(
        `Stop timer and append a work session?\n\nStart: ${new Date(startIso).toLocaleString()}\nEnd: ${new Date(endIso).toLocaleString()}`,
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

  const saveExplicit = useCallback(() => {
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
    saveState(next);
    showToast('Saved');
  }, [showToast]);

  const resetCurrentTask = useCallback(() => {
    const name = activeTask.name;
    const ok = window.confirm(
      `Reset "${name}"?\n\nThis clears sessions, problems, comments, timer, and submitted hours for this task only.`,
    );
    if (!ok) return;
    updateTask(activeTask.id, () => ({
      ...createDefaultTask(activeTask.id, name),
    }));
    showToast('Task reset');
  }, [activeTask.id, activeTask.name, updateTask, showToast]);

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
      try {
        const next = importStateJson(String(reader.result));
        setState(next);
        saveState(next);
        showToast('Imported backup');
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Import failed');
      }
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
