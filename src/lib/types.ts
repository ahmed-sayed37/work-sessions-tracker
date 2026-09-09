export interface WorkSession {
  id: string;
  start: string; // ISO or empty
  end: string;   // ISO or empty
}

export interface Problem {
  id: string;
  title: string;
  notes: string;
}

export interface TimerState {
  status: 'idle' | 'running' | 'paused';
  startedAt: string | null; // ISO when running/paused segment started
  accumulatedMs: number;    // paused elapsed so far
  segmentStartedAt: string | null; // ISO of current running segment
}

export interface TaskData {
  id: string;
  name: string;
  alignerrEmail: string;
  workforceEmail: string;
  sessions: WorkSession[];
  totalHoursOverride: number | null;
  submittedHours: number;
  comments: string;
  problems: Problem[];
  timer: TimerState;
}

export interface AppState {
  version: 1;
  activeTaskId: string;
  tasks: TaskData[];
}

export const STORAGE_KEY = 'workSessions.v1.tasks';

export function createEmptySession(): WorkSession {
  return { id: crypto.randomUUID(), start: '', end: '' };
}

export function createEmptyProblem(index: number): Problem {
  return {
    id: crypto.randomUUID(),
    title: `Problem ${index}`,
    notes: '',
  };
}

export function createDefaultTimer(): TimerState {
  return {
    status: 'idle',
    startedAt: null,
    accumulatedMs: 0,
    segmentStartedAt: null,
  };
}

export function createDefaultTask(id: string, name: string): TaskData {
  return {
    id,
    name,
    alignerrEmail: '',
    workforceEmail: '',
    sessions: [createEmptySession()],
    totalHoursOverride: null,
    submittedHours: 0,
    comments: '',
    problems: [createEmptyProblem(1)],
    timer: createDefaultTimer(),
  };
}

export function createDefaultState(): AppState {
  const t1 = createDefaultTask('task-1', 'Task 1');
  const t2 = createDefaultTask('task-2', 'Task 2');
  return {
    version: 1,
    activeTaskId: t1.id,
    tasks: [t1, t2],
  };
}
