// One coherent fictional builder. No fabricated model outputs or probabilities.
// All fork metrics are calculated from these editable source inputs.
import { comparePlans, evaluatePlan } from '../horizon.mjs';

export function horizonDemo() {
  const availability = [19, 20, 21, 22, 23, 26].map((day) => ({
    start: `2026-10-${day}T09:00:00-04:00`, end: `2026-10-${day}T17:00:00-04:00`,
  }));
  const events = [
    { id: 'mon-busy', start: '2026-10-19T09:00:00-04:00', end: '2026-10-19T17:00:00-04:00' },
    { id: 'tue-busy', start: '2026-10-20T12:00:00-04:00', end: '2026-10-20T17:00:00-04:00' },
    { id: 'wed-busy', start: '2026-10-21T09:00:00-04:00', end: '2026-10-21T17:00:00-04:00' },
    { id: 'thu-busy', start: '2026-10-22T12:00:00-04:00', end: '2026-10-22T17:00:00-04:00' },
    { id: 'fri-busy', start: '2026-10-23T09:00:00-04:00', end: '2026-10-23T17:00:00-04:00' },
  ];
  const goal = {
    id: 'launch', title: 'Launch the first release', dueAt: '2026-10-23T17:00:00-04:00',
    remainingMinutes: 360, minBlockMinutes: 60, estimateSource: 'demo-person-reviewed-estimate',
  };
  const incoming = {
    id: 'deck', title: 'Polish Alex’s presentation', dueAt: '2026-10-22T17:00:00-04:00',
    remainingMinutes: 180, minBlockMinutes: 60, estimateSource: 'demo-person-reviewed-estimate',
    quote: 'Sure, I’ll polish the presentation by Thursday.', speaker: 'Alex Morgan',
    owner: 'Alex Morgan', counterparty: 'Alex Chen',
    source: { type: 'bee.utterance', id: 'demo-live-utterance', spokenAt: '2026-10-19T10:00:00-04:00' },
  };
  const input = { asOf: '2026-10-19T10:00:00-04:00', availability, events, commitments: [goal] };
  const variants = [
    { id: 'protect', title: 'Protect the launch', consequence: 'Ask Alex to move the presentation work to Monday.', input: { ...input, commitments: [goal, { ...incoming, dueAt: '2026-10-26T17:00:00-04:00' }] } },
    { id: 'keep', title: 'Keep every promise', consequence: 'Finish the presentation Thursday; the launch needs time after Friday.', input: { ...input, commitments: [goal, incoming] } },
    { id: 'smaller', title: 'Launch a smaller first release', consequence: 'Keep Friday and the presentation; defer half the release scope.', input: { ...input, commitments: [{ ...goal, remainingMinutes: 180 }, incoming] } },
  ];
  return {
    preview: true, synthetic: true,
    person: { name: 'Alex Morgan', timezone: 'America/New_York' },
    goalEvidence: { quote: 'I want the first release out this Friday.', sourceId: 'demo-goal-utterance', spokenAt: '2026-10-16T11:00:00-04:00' },
    incoming, input,
    baseline: evaluatePlan(input),
    comparison: comparePlans({ goalId: goal.id, variants }),
    models: { jev: 'not_run', systemOne: 'not_run' },
  };
}
