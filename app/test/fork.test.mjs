import test from 'node:test';
import assert from 'node:assert/strict';
import { forkWeek, isoLocal } from '../fork.mjs';

const at = (d, h) => new Date(2026, 9, d, h, 0, 0, 0).getTime();

test('fork the week: a favor that eats the goal’s hours makes "protect the goal" the recommendation', () => {
  // Monday Oct 19, 8am. Open only Tue and Thu 9 to 12: six hours before Friday.
  const busy = (d, s, e) => ({ start: isoLocal(at(d, s)), end: isoLocal(at(d, e)) });
  const events = [busy(19, 9, 17), busy(20, 12, 17), busy(21, 9, 17), busy(22, 12, 17), busy(23, 9, 17)];
  const result = forkWeek({
    now: at(19, 8),
    events,
    goal: { title: 'Ship the release', minutes: 360, dueAt: isoLocal(at(23, 17)) },
    promise: { title: 'Help Jordan with the deck', minutes: 180, dueAt: isoLocal(at(22, 17)) },
  });
  const v = Object.fromEntries(result.variants.map((x) => [x.id, x]));
  assert.equal(v.B.goal.status, 'at_risk', 'keeping both on their dates leaves the goal short');
  assert.equal(v.B.goal.shortfallMinutes, 180);
  assert.equal(v.A.goal.status, 'fits', 'moving the favor a week protects the goal');
  assert.equal(v.C.goal.status, 'fits', 'half the goal fits next to the favor');
  assert.equal(result.recommended, 'A');
  assert.match(result.note, /request is not their agreement|still has to agree/);
  assert.ok(result.assumptions.some((a) => /not a prediction/.test(a)));
});

test('fork the week refuses to guess missing inputs', () => {
  assert.throws(() => forkWeek({ promise: { title: 'x', dueAt: isoLocal(Date.now()) }, goal: { title: 'g', minutes: 60, dueAt: isoLocal(Date.now()) } }), /promise.minutes is required/);
});
