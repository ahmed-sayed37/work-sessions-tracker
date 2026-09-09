/**
 * Mirrors src/lib/time.ts sessionHours / sumSessionHours for a quick sanity check.
 * Run: node scripts/verify-hours.mjs
 */

function parseDateTime(value) {
  if (!value || !String(value).trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function sessionHours(start, end) {
  const s = parseDateTime(start);
  const e = parseDateTime(end);
  if (!s || !e) return 0;
  const ms = e.getTime() - s.getTime();
  if (ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

function sumSessionHours(sessions) {
  const total = sessions.reduce((acc, sess) => acc + sessionHours(sess.start, sess.end), 0);
  return Math.round(total * 100) / 100;
}

// Use fixed local-style datetime-local strings (parsed as local by Date).
// 9:00 PM – 10:30 PM same day = 1.5h
const s1 = { start: '2026-09-09T21:00', end: '2026-09-09T22:30' };
// 12:30 AM next day – 2:00 AM = 1.5h
const s2 = { start: '2026-09-10T00:30', end: '2026-09-10T02:00' };

const h1 = sessionHours(s1.start, s1.end);
const h2 = sessionHours(s2.start, s2.end);
const sum = sumSessionHours([s1, s2]);

const assert = (cond, msg) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
};

assert(h1 === 1.5, `9PM–10:30PM = 1.5 (got ${h1})`);
assert(h2 === 1.5, `12:30AM–2AM = 1.5 (got ${h2})`);
assert(sum === 3.0, `sum = 3.0 (got ${sum})`);

if (process.exitCode) {
  console.error('verify-hours: FAILED');
  process.exit(1);
}
console.log('verify-hours: all assertions passed');
