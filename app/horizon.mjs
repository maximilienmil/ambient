// Calendar arithmetic for Horizon. Inputs are explicit estimates and dated
// availability, not model probabilities. This module never writes or calls APIs.

const MINUTE = 60_000;

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

function instant(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    invalid(`${field} must be an ISO timestamp with an explicit timezone.`);
  }
  const date = value.slice(0, 10);
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) invalid(`${field} contains an invalid calendar date.`);
  return Date.parse(value);
}

function interval(value, field) {
  const start = instant(value?.start, `${field}.start`);
  const end = instant(value?.end, `${field}.end`);
  if (end <= start) invalid(`${field} must end after it starts.`);
  return { start, end };
}

function merge(intervals) {
  const result = [];
  for (const item of intervals.slice().sort((a, b) => a.start - b.start || a.end - b.end)) {
    const last = result.at(-1);
    if (last && item.start <= last.end) last.end = Math.max(last.end, item.end);
    else result.push({ ...item });
  }
  return result;
}

const minutes = (start, end) => Math.max(0, (end - start) / MINUTE);
const iso = (value) => new Date(value).toISOString();

/** Overlapping availability/busy records are counted once. Past time is excluded. */
export function freeIntervals(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Supply a calendar input object.');
  const { asOf, availability = [], events = [] } = input;
  const now = instant(asOf, 'asOf');
  if (!Array.isArray(availability) || !Array.isArray(events) || availability.length > 1000 || events.length > 5000) {
    invalid('Supply at most 1,000 availability windows and 5,000 calendar events.');
  }
  const windows = merge(availability.map((item, index) => interval(item, `availability[${index}]`)))
    .map((item) => ({ start: Math.max(now, item.start), end: item.end }))
    .filter((item) => item.end > item.start);
  if (events.some((item) => !item || typeof item !== 'object')) invalid('Each calendar event must be an object.');
  const busy = merge(events.filter((item) => item.status !== 'cancelled' && item.transparency !== 'transparent')
    .map((item, index) => interval(item, `events[${index}]`)));
  const free = [];
  for (const window of windows) {
    let cursor = window.start;
    for (const event of busy) {
      if (event.end <= cursor) continue;
      if (event.start >= window.end) break;
      if (event.start > cursor) free.push({ start: cursor, end: Math.min(event.start, window.end) });
      cursor = Math.max(cursor, event.end);
      if (cursor >= window.end) break;
    }
    if (cursor < window.end) free.push({ start: cursor, end: window.end });
  }
  return free;
}

/**
 * A transparent earliest-deadline-first capacity scenario, not an optimal
 * scheduler or a prediction of behavior. remainingMinutes excludes work already
 * represented by a busy calendar event. Effort and focus block sizes are editable.
 */
export function evaluatePlan(input) {
  const free = freeIntervals(input);
  if (!Array.isArray(input.commitments) || input.commitments.length > 300) invalid('Supply at most 300 commitments.');
  if (input.commitments.some((item) => !item || typeof item !== 'object')) invalid('Each commitment must be an object.');
  const ids = new Set();
  const tasks = input.commitments.filter((task) => !['done', 'obsolete', 'dismissed'].includes(task.state)).map((task) => {
    if (typeof task.id !== 'string' || !task.id || ids.has(task.id)) invalid('Each commitment needs a unique nonempty id.');
    ids.add(task.id);
    if (typeof task.title !== 'string' || !task.title.trim()) invalid(`Commitment ${task.id} needs a title.`);
    const due = instant(task.dueAt, `${task.id}.dueAt`);
    const effort = task.remainingMinutes;
    const minimum = task.minBlockMinutes ?? 30;
    if (!Number.isSafeInteger(effort) || effort <= 0 || effort > 525600) invalid(`${task.id}.remainingMinutes must be a positive integer.`);
    if (!Number.isSafeInteger(minimum) || minimum <= 0 || minimum > effort) invalid(`${task.id}.minBlockMinutes must be between 1 and remainingMinutes.`);
    return { ...task, due, remaining: effort, minimum, blocks: [] };
  }).sort((a, b) => a.due - b.due || a.id.localeCompare(b.id));

  // Earlier-deadline work consumes the earliest usable windows. No calendar
  // changes are performed; these blocks are a proposal for subsequent review.
  for (const task of tasks) {
    for (const window of free) {
      const usable = minutes(window.start, window.end);
      const neededBlock = Math.min(task.minimum, task.remaining);
      if (usable < neededBlock) continue;
      const amount = Math.min(task.remaining, Math.floor(usable));
      const end = window.start + amount * MINUTE;
      task.blocks.push({ start: iso(window.start), end: iso(end), minutes: amount });
      window.start = end;
      task.remaining -= amount;
      if (task.remaining === 0) break;
    }
  }

  return {
    method: 'calendar-capacity-earliest-deadline-v1',
    asOf: iso(instant(input.asOf, 'asOf')),
    assumptions: [
      'Work is placed in earliest-deadline order within your supplied availability.',
      'Effort estimates are remaining unscheduled work; calendar events already occupy their own time.',
      'This scenario estimates capacity, not the probability that you will finish.',
    ],
    commitments: tasks.map((task) => {
      const scheduledBeforeDeadlineMinutes = task.blocks.reduce((total, block) => total + minutes(Date.parse(block.start), Math.min(Date.parse(block.end), task.due)), 0);
      return {
        id: task.id, title: task.title, dueAt: task.dueAt,
        requiredMinutes: task.remainingMinutes,
        scheduledBeforeDeadlineMinutes,
        shortfallMinutes: Math.max(0, task.remainingMinutes - scheduledBeforeDeadlineMinutes),
        unscheduledMinutes: task.remaining,
        estimatedFinishAt: task.remaining === 0 ? task.blocks.at(-1).end : null,
        status: scheduledBeforeDeadlineMinutes >= task.remainingMinutes ? 'fits' : 'at_risk',
        blocks: task.blocks,
        estimateSource: task.estimateSource ?? 'supplied-estimate',
      };
    }),
    unusedMinutes: free.reduce((total, window) => total + minutes(window.start, window.end), 0),
  };
}

/** Evaluate arbitrary independently supplied alternatives with the same engine. */
export function comparePlans(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Supply a comparison input object.');
  const { goalId, variants } = input;
  if (typeof goalId !== 'string' || !Array.isArray(variants) || variants.length < 2 || variants.length > 5) {
    invalid('Supply a goalId and between two and five variants.');
  }
  const ids = new Set();
  return {
    goalId,
    variants: variants.map((variant) => {
      if (!variant || typeof variant !== 'object') invalid('Each variant must be an object.');
      if (typeof variant.id !== 'string' || !variant.id || ids.has(variant.id)) invalid('Each variant needs a unique nonempty id.');
      ids.add(variant.id);
      const plan = evaluatePlan(variant.input);
      const goal = plan.commitments.find((task) => task.id === goalId);
      if (!goal) invalid(`Goal ${goalId} is missing from variant ${variant.id}.`);
      return { id: variant.id, title: variant.title, consequence: variant.consequence, goal, plan };
    }),
  };
}
