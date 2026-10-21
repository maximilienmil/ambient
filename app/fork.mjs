// Fork the week: three alternatives for one new promise against one goal,
// evaluated by the same calendar-capacity engine the app uses. Calendar
// arithmetic only: no model, no probability, nothing written.

import { comparePlans } from './horizon.mjs';

const DAY = 86_400_000;
const pad = (n) => String(n).padStart(2, '0');

/** ISO timestamp in the host's local zone with an explicit offset. */
export function isoLocal(ms) {
  const d = new Date(ms);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

/** Weekday working windows (default 9 to 5 local) from `now` until `to`. A stated assumption. */
export function weekdayAvailability(now, to, { startHour = 9, endHour = 17 } = {}) {
  const out = [];
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  for (let d = day.getTime(); d < to; d += DAY) {
    const date = new Date(d);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const s = new Date(d); s.setHours(startHour, 0, 0, 0);
    const e = new Date(d); e.setHours(endHour, 0, 0, 0);
    const start = Math.max(s.getTime(), now);
    const end = Math.min(e.getTime(), to);
    if (end > start) out.push({ start: isoLocal(start), end: isoLocal(end) });
  }
  return out;
}

function need(value, field) {
  if (value === undefined || value === null || value === '') throw Object.assign(new Error(`${field} is required.`), { status: 400, code: -32602 });
  return value;
}

/**
 * @param {{title:string, minutes:number, dueAt:string}} promise  the new commitment
 * @param {{title:string, minutes:number, dueAt:string}} goal     what the person is protecting
 * @param {Array} events  calendar events with start/end ISO strings
 */
export function forkWeek({ promise, goal, events = [], now = Date.now() }) {
  need(promise?.title, 'promise.title'); need(promise?.minutes, 'promise.minutes'); need(promise?.dueAt, 'promise.dueAt');
  need(goal?.title, 'goal.title'); need(goal?.minutes, 'goal.minutes'); need(goal?.dueAt, 'goal.dueAt');
  const promiseDue = Date.parse(promise.dueAt);
  const goalDue = Date.parse(goal.dueAt);
  if (!Number.isFinite(promiseDue) || !Number.isFinite(goalDue)) throw Object.assign(new Error('dueAt must be an ISO timestamp.'), { status: 400, code: -32602 });
  const horizon = Math.max(goalDue, promiseDue + 7 * DAY) + DAY;
  const window = events.filter((e) => e?.start && e?.end && !e.allDay && Date.parse(e.end) > now && Date.parse(e.start) < horizon);
  const base = {
    asOf: isoLocal(now),
    availability: weekdayAvailability(now, horizon),
    events: window.map((e) => ({ start: e.start, end: e.end, status: e.status, transparency: e.transparency })),
  };
  const g = { id: 'goal', title: String(goal.title).slice(0, 160), dueAt: isoLocal(goalDue), remainingMinutes: Math.round(goal.minutes), minBlockMinutes: Math.min(60, Math.round(goal.minutes)) };
  const p = { id: 'promise', title: String(promise.title).slice(0, 160), dueAt: isoLocal(promiseDue), remainingMinutes: Math.round(promise.minutes), minBlockMinutes: Math.min(60, Math.round(promise.minutes)) };
  const half = Math.max(30, Math.round(g.remainingMinutes / 2 / 30) * 30);
  const comparison = comparePlans({ goalId: 'goal', variants: [
    { id: 'A', title: 'Protect the goal', consequence: 'Ask to move the new promise one week later.', input: { ...base, commitments: [g, { ...p, dueAt: isoLocal(promiseDue + 7 * DAY) }] } },
    { id: 'B', title: 'Keep every promise', consequence: 'Do both on their current dates.', input: { ...base, commitments: [g, p] } },
    { id: 'C', title: 'Shrink the goal', consequence: 'Keep the promise and do half the goal now.', input: { ...base, commitments: [{ ...g, remainingMinutes: half }, p] } },
  ] });
  const summary = comparison.variants.map((v) => {
    const pr = v.plan.commitments.find((c) => c.id === 'promise');
    return {
      id: v.id,
      title: v.title,
      consequence: v.consequence,
      goal: { status: v.goal.status, scheduledMinutes: v.goal.scheduledBeforeDeadlineMinutes, shortfallMinutes: v.goal.shortfallMinutes },
      promise: { status: pr?.status, shortfallMinutes: pr?.shortfallMinutes ?? null },
      blocks: v.plan.commitments.flatMap((c) => c.blocks.map((b) => ({ for: c.id, start: b.start, end: b.end }))),
    };
  });
  const both = (id) => { const v = summary.find((x) => x.id === id); return v.goal.status === 'fits' && v.promise.status === 'fits'; };
  const recommended = both('B') ? 'B' : summary.find((x) => x.id === 'A').goal.status === 'fits' ? 'A' : both('C') ? 'C' : 'A';
  return {
    method: 'calendar-capacity-earliest-deadline-v1',
    assumptions: ['Weekdays 9 to 5 local are workable.', 'Effort is the remaining focused work you estimated.', 'This is capacity arithmetic, not a prediction of what you will do.'],
    calendarEventsConsidered: window.length,
    variants: summary,
    recommended,
    note: recommended === 'A' ? 'Asking to move a promise is a request. The other person still has to agree.' : null,
  };
}
