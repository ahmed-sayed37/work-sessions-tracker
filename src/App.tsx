import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './hooks/useAppStore';
import { formatHours, formatElapsed, timerElapsedMs } from './lib/time';
import {
  IconPlus,
  IconTrash,
  IconReset,
  IconSave,
  IconPlay,
  IconPause,
  IconStop,
  IconDownload,
  IconUpload,
  IconRefresh,
} from './components/Icons';

export default function App() {
  const store = useAppStore();
  const {
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
  } = store;

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [tick, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Live timer tick
  useEffect(() => {
    if (activeTask.timer.status !== 'running') return;
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [activeTask.timer.status]);

  void tick; // re-render driver

  const elapsed = timerElapsedMs(activeTask.timer);

  const beginRename = (id: string, name: string) => {
    setRenamingId(id);
    setRenameValue(name);
  };

  const commitRename = () => {
    if (renamingId) {
      renameTask(renamingId, renameValue);
      setRenamingId(null);
    }
  };

  const onTotalChange = (raw: string) => {
    if (raw.trim() === '') {
      setTotalHoursOverride(null);
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) {
      setTotalHoursOverride(Math.round(n * 100) / 100);
    }
  };

  return (
    <div className="app">
      <h1 className="page-title">New work session</h1>
      <p className="page-sub">
        Log the hours once, then add every Live Compare problem you worked on during that time.
      </p>

      <div className="tabs-row">
        {state.tasks.map((t) =>
          renamingId === t.id ? (
            <input
              key={t.id}
              className="rename-input"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenamingId(null);
              }}
              aria-label="Rename task"
            />
          ) : (
            <button
              key={t.id}
              type="button"
              className={`tab${state.activeTaskId === t.id ? ' active' : ''}`}
              onClick={() => setActiveTaskId(t.id)}
              onDoubleClick={() => beginRename(t.id, t.name)}
              title="Double-click to rename"
            >
              {t.name}
            </button>
          ),
        )}
        <button
          type="button"
          className="tab-rename"
          onClick={() => beginRename(activeTask.id, activeTask.name)}
        >
          Rename
        </button>

        <div className="toolbar">
          <button type="button" className="btn btn-sm" onClick={refreshFromStorage} title="Reload from localStorage">
            <IconRefresh /> Refresh
          </button>
          <button type="button" className="btn btn-sm" onClick={exportJson}>
            <IconDownload /> Export
          </button>
          <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            <IconUpload /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Emails */}
      <div className="card">
        <div className="grid-2">
          <div className="field">
            <label htmlFor="alignerr-email">Alignerr login email</label>
            <input
              id="alignerr-email"
              type="email"
              placeholder="user@email.com"
              value={activeTask.alignerrEmail}
              onChange={(e) => setEmails(e.target.value, activeTask.workforceEmail)}
            />
          </div>
          <div className="field">
            <label htmlFor="workforce-email">Google Workforce email</label>
            <input
              id="workforce-email"
              type="email"
              placeholder="workforce-id@alignerrworkforce.com"
              value={activeTask.workforceEmail}
              onChange={(e) => setEmails(activeTask.alignerrEmail, e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Live timer */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Live timer</h2>
            <p className="helper">
              Start / Pause / Stop. On stop, a work session is appended. Running timer persists across refresh.
            </p>
          </div>
        </div>
        <div className="timer-panel">
          <div className="timer-display">{formatElapsed(elapsed)}</div>
          <div className={`timer-status ${activeTask.timer.status}`}>
            {activeTask.timer.status}
          </div>
          <div className="timer-actions">
            {(activeTask.timer.status === 'idle' || activeTask.timer.status === 'paused') && (
              <button type="button" className="btn" onClick={startTimer}>
                <IconPlay /> {activeTask.timer.status === 'paused' ? 'Resume' : 'Start'}
              </button>
            )}
            {activeTask.timer.status === 'running' && (
              <button type="button" className="btn" onClick={pauseTimer}>
                <IconPause /> Pause
              </button>
            )}
            {activeTask.timer.status !== 'idle' && (
              <button type="button" className="btn" onClick={() => stopTimer(true)}>
                <IconStop /> Stop
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Work sessions */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Work sessions</h2>
            <p className="helper">
              Add one row for each active work period. These hours are paid once, even when multiple
              problems are logged below.
            </p>
          </div>
          <span className="badge badge-auto">Auto: {formatHours(autoHours)} hours</span>
        </div>

        {activeTask.sessions.map((session, index) => (
          <div className="subcard" key={session.id}>
            <div className="subcard-top">
              <span className="session-label">SESSION {index + 1}</span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={activeTask.sessions.length <= 1}
                onClick={() => removeSession(session.id)}
              >
                <IconTrash /> Remove
              </button>
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor={`start-${session.id}`}>Session {index + 1} start time</label>
                <input
                  id={`start-${session.id}`}
                  type="datetime-local"
                  value={session.start}
                  onChange={(e) => updateSession(session.id, { start: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`end-${session.id}`}>Session {index + 1} end time</label>
                <input
                  id={`end-${session.id}`}
                  type="datetime-local"
                  value={session.end}
                  onChange={(e) => updateSession(session.id, { end: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="add-row">
          <button type="button" className="btn btn-outline" onClick={addSession}>
            <IconPlus /> Add work session
          </button>
        </div>
      </div>

      {/* Total hours */}
      <div className="card">
        <div className="total-row">
          <div className="field">
            <label htmlFor="total-hours">Total hours</label>
            <input
              id="total-hours"
              type="number"
              min={0}
              step={0.01}
              value={
                activeTask.totalHoursOverride !== null && activeTask.totalHoursOverride !== undefined
                  ? activeTask.totalHoursOverride
                  : autoHours
              }
              onChange={(e) => onTotalChange(e.target.value)}
            />
            <span className="field-hint">
              Auto-calculated from work sessions. Edit this field to override.
            </span>
          </div>
          <span className="badge badge-submitted">
            Submitted: {formatHours(activeTask.submittedHours)} hours
          </span>
        </div>
      </div>

      {/* Problems */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Problems worked in this session</h2>
            <p className="helper">
              Add every problem you touched. The same session hours apply to the whole group and are
              not split.
            </p>
          </div>
          <button type="button" className="btn btn-outline" onClick={addProblem}>
            <IconPlus /> Add another problem
          </button>
        </div>

        {activeTask.problems.map((problem, index) => (
          <div className="subcard" key={problem.id}>
            <div className="subcard-top">
              <div className="problem-title-row">
                <strong>Problem {index + 1}</strong>
                <span>Problem details and turn categories.</span>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                disabled={activeTask.problems.length <= 1}
                onClick={() => removeProblem(problem.id)}
              >
                <IconTrash /> Remove problem
              </button>
            </div>
            <div className="grid-2" style={{ marginBottom: 10 }}>
              <div className="field">
                <label htmlFor={`ptitle-${problem.id}`}>Title</label>
                <input
                  id={`ptitle-${problem.id}`}
                  type="text"
                  value={problem.title}
                  onChange={(e) => updateProblem(problem.id, { title: e.target.value })}
                  placeholder={`Problem ${index + 1}`}
                />
              </div>
              <div className="field">
                <label htmlFor={`pnotes-${problem.id}`}>Notes</label>
                <input
                  id={`pnotes-${problem.id}`}
                  type="text"
                  value={problem.notes}
                  onChange={(e) => updateProblem(problem.id, { notes: e.target.value })}
                  placeholder="Details and turn categories"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comments */}
      <div className="card">
        <div className="field">
          <label htmlFor="comments">Any comments</label>
          <textarea
            id="comments"
            value={activeTask.comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder=""
          />
        </div>

        <div className="footer-actions">
          <button type="button" className="btn" onClick={resetCurrentTask}>
            <IconReset /> Reset
          </button>
          <button type="button" className="btn btn-save" onClick={saveExplicit}>
            <IconSave /> Save
          </button>
        </div>
      </div>

      {/* Effective total hint for debugging clarity */}
      <p className="page-sub" style={{ marginTop: 8, fontSize: '0.8rem' }}>
        Effective total for {activeTask.name}: {formatHours(effectiveTotal)} hours
        {activeTask.totalHoursOverride !== null ? ' (override)' : ' (auto)'} · Data auto-saves to
        localStorage.
      </p>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
