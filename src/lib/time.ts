/** Parse ISO or datetime-local value to Date, or null if invalid/empty */
export function parseDateTime(value: string): Date | null {
  if (!value || !value.trim()) return null;
  // datetime-local is "YYYY-MM-DDTHH:mm" — treat as local
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Duration in hours between start and end. Overnight OK when end > start chronologically. */
export function sessionHours(start: string, end: string): number {
  const s = parseDateTime(start);
  const e = parseDateTime(end);
  if (!s || !e) return 0;
  const ms = e.getTime() - s.getTime();
  if (ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export function sumSessionHours(
  sessions: { start: string; end: string }[],
): number {
  const total = sessions.reduce(
    (acc, sess) => acc + sessionHours(sess.start, sess.end),
    0,
  );
  return Math.round(total * 100) / 100;
}

/** Format hours to X.XX */
export function formatHours(h: number): string {
  return (Math.round(h * 100) / 100).toFixed(2);
}

/** Convert Date / ISO to datetime-local value (YYYY-MM-DDTHH:mm) in local TZ */
export function toDatetimeLocalValue(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert datetime-local value to ISO string */
export function datetimeLocalToIso(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

/** Display as MM/DD/YYYY hh:mm AM/PM */
export function formatDisplayDateTime(isoOrLocal: string): string {
  const d = parseDateTime(isoOrLocal);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(hours)}:${pad(d.getMinutes())} ${ampm}`;
}

/** Format ms as HH:MM:SS */
export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function timerElapsedMs(timer: {
  status: string;
  accumulatedMs: number;
  segmentStartedAt: string | null;
}): number {
  let ms = timer.accumulatedMs;
  if (timer.status === 'running' && timer.segmentStartedAt) {
    ms += Date.now() - new Date(timer.segmentStartedAt).getTime();
  }
  return Math.max(0, ms);
}
