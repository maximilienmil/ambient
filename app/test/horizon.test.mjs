import test from 'node:test';
import assert from 'node:assert/strict';
import { freeIntervals, evaluatePlan, comparePlans } from '../horizon.mjs';
import { horizonDemo } from '../fixtures/horizon-scenario.mjs';

test('fork metrics follow the same calendar arithmetic and recover the launch time', () => {
  const demo = horizonDemo();
  const [protect, keep, smaller] = demo.comparison.variants;
  assert.equal(demo.baseline.commitments[0].scheduledBeforeDeadlineMinutes, 360);
  assert.equal(protect.goal.shortfallMinutes, 0);
  assert.equal(keep.goal.scheduledBeforeDeadlineMinutes, 180);
  assert.equal(keep.goal.shortfallMinutes, 180);
  assert.equal(keep.goal.estimatedFinishAt, '2026-10-26T16:00:00.000Z');
  assert.equal(smaller.goal.shortfallMinutes, 0);
  assert.equal(smaller.goal.requiredMinutes, 180);
  assert.equal(demo.models.jev, 'not_run');
});

test('busy intervals are unioned, clipped, timezone aware, and past time is unavailable', () => {
  const result = freeIntervals({
    asOf: '2026-10-19T10:00:00-04:00',
    availability: [{ start: '2026-10-19T09:00:00-04:00', end: '2026-10-19T17:00:00-04:00' }],
    events: [
      { start: '2026-10-19T14:00:00Z', end: '2026-10-19T16:00:00Z' },
      { start: '2026-10-19T15:00:00Z', end: '2026-10-19T17:00:00Z' },
      { start: '2026-10-19T16:00:00-04:00', end: '2026-10-19T20:00:00-04:00' },
      { start: '2026-10-19T13:00:00-04:00', end: '2026-10-19T14:00:00-04:00', status: 'cancelled' },
      { start: '2026-10-19T14:00:00-04:00', end: '2026-10-19T15:00:00-04:00', transparency: 'transparent' },
    ],
  });
  assert.deepEqual(result.map((item) => [new Date(item.start).toISOString(), new Date(item.end).toISOString()]), [
    ['2026-10-19T17:00:00.000Z', '2026-10-19T20:00:00.000Z'],
  ]);
});

test('adding calendar load never improves available goal time across the demo horizon', () => {
  const { input } = horizonDemo();
  const baseline = evaluatePlan(input).commitments[0];
  for (let hour = 9; hour < 17; hour++) {
    const events = [...input.events, { start: `2026-10-20T${String(hour).padStart(2, '0')}:00:00-04:00`, end: `2026-10-20T${String(hour + 1).padStart(2, '0')}:00:00-04:00` }];
    const goal = evaluatePlan({ ...input, events }).commitments[0];
    assert.ok(goal.scheduledBeforeDeadlineMinutes <= baseline.scheduledBeforeDeadlineMinutes);
    assert.ok(goal.shortfallMinutes >= baseline.shortfallMinutes);
  }
});

test('fragmented time is not counted as usable focus time; no input is mutated', () => {
  const { input } = horizonDemo();
  const original = structuredClone(input);
  const events = [...input.events, { start: '2026-10-20T09:30:00-04:00', end: '2026-10-20T11:30:00-04:00' }];
  const goal = evaluatePlan({ ...input, events }).commitments[0];
  assert.equal(goal.scheduledBeforeDeadlineMinutes, 180);
  assert.equal(goal.unscheduledMinutes, 0, 'the following Monday supplies the remaining time');
  assert.deepEqual(input, original);
});

test('missing effort, ambiguous timestamps, duplicate variants and invalid references fail explicitly', () => {
  const { input } = horizonDemo();
  assert.throws(() => evaluatePlan({ ...input, commitments: [{ ...input.commitments[0], remainingMinutes: null }] }), /remainingMinutes/);
  assert.throws(() => evaluatePlan({ ...input, asOf: '2026-10-19' }), /timezone/);
  assert.throws(() => comparePlans({ goalId: 'missing', variants: [{ id: 'a', input }, { id: 'b', input }] }), /missing/);
  assert.throws(() => comparePlans({ goalId: 'launch', variants: [{ id: 'a', input }, { id: 'a', input }] }), /unique/);
  assert.throws(() => evaluatePlan({ ...input, asOf: '2026-02-30T10:00:00Z' }), /invalid calendar date/);
  assert.throws(() => evaluatePlan({ ...input, commitments: [null] }), /object/);
  assert.throws(() => comparePlans(null), /object/);
});
