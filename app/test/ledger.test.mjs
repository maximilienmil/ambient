import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, saveCommitment, setState, logEvent, counts } from '../db.mjs';
import {
  approveCommitment,
  bankruptcyCandidates,
  buildLedger,
  cancelPlan,
  createPlan,
  decisionOf,
  dismissCommitment,
  distributionOf,
  editCommitment,
  executePlan,
  getItem,
  listItems,
  planIcs,
  restoreCommitments,
  retireObsolete,
  statsOf,
  approvePlan,
} from '../ledger.mjs';

function row(id, overrides = {}) {
  const quote = overrides.quote || 'I will send the deck.';
  return {
    id,
    text: overrides.text || 'Send the deck',
    quote,
    owner: 'Maximilian Milovidov',
    counterparty: overrides.counterparty ?? null,
    sourceConversationId: overrides.sourceConversationId ?? null,
    spanStart: 0,
    spanEnd: quote.length,
    createdAt: overrides.createdAt || '2026-10-01T12:00:00.000Z',
    dueAt: overrides.dueAt ?? null,
    state: overrides.state || 'live',
    tier: 'tier' in overrides ? overrides.tier : 'draft',
    evidence: overrides.evidence || { rule: 'first-person-promise' },
  };
}

test('a decision is derived from state and provisional tier, never invented', () => {
  assert.equal(decisionOf({ state: 'live', tier: 'draft' }), 'draft');
  assert.equal(decisionOf({ state: 'live', tier: 'ask' }), 'ask');
  assert.equal(decisionOf({ state: 'live', tier: null }), 'unscored');
  assert.equal(decisionOf({ state: 'done', tier: 'ask' }), 'execute');
  assert.equal(decisionOf({ state: 'obsolete', tier: 'draft' }), 'ignore');
  assert.equal(decisionOf({ state: 'blocked', tier: null }), 'ask');
  assert.equal(decisionOf({ state: 'forgotten', tier: 'remember' }), 'ignore');
});

test('items project the real row, keep the exact words, and admit what is unknown', () => {
  const db = openDb(':memory:');
  saveCommitment(db, row('a', { counterparty: 'Priya' }));
  saveCommitment(db, row('b', { tier: 'ask', quote: 'We should get dinner sometime.', text: 'Make dinner plans' }));
  const todoQuote = 'Pick up the dry cleaning';
  saveCommitment(db, row('c', {
    tier: null,
    quote: todoQuote,
    text: todoQuote,
    evidence: { origin: 'bee_todo', beeTodoId: '9' },
  }));
  const items = listItems(db);
  const a = items.find((item) => item.id === 'a');
  assert.equal(a.title, 'Send the deck');
  assert.equal(a.quote, 'I will send the deck.');
  assert.equal(a.person, 'Priya');
  assert.equal(a.why, 'A first-person promise in your own words.');
  assert.ok(a.policy.length > 20);
  assert.equal(a.confidence, null);
  assert.equal(a.scored, false);
  assert.equal(a.jev, null);
  assert.equal(a.d1, null);
  assert.equal(a.decision, 'draft');
  assert.ok(a.age >= 0);
  const c = items.find((item) => item.id === 'c');
  assert.equal(c.origin, 'bee_todo');
  assert.match(c.source, /Bee todo/);
  assert.equal(c.decision, 'unscored');
  assert.equal(c.why, 'You wrote this as a Bee todo.');
  db.close();
});

test('stats count real states and leave empties at zero', () => {
  const items = [
    { state: 'live', decision: 'draft' },
    { state: 'live', decision: 'ask' },
    { state: 'live', decision: 'unscored' },
    { state: 'blocked', decision: 'ask' },
    { state: 'done', decision: 'execute' },
    { state: 'obsolete', decision: 'ignore' },
    { state: 'forgotten', decision: 'ignore' },
  ];
  assert.deepEqual(statsOf(items), { total: 7, open: 4, drafts: 1, asks: 2, handled: 1, obsolete: 2, unscored: 1 });
  assert.deepEqual(statsOf([]), { total: 0, open: 0, drafts: 0, asks: 0, handled: 0, obsolete: 0, unscored: 0 });
});

test('approving an ask authorises drafting only; approving a draft closes it', () => {
  const db = openDb(':memory:');
  saveCommitment(db, row('ask-1', { tier: 'ask' }));
  saveCommitment(db, row('draft-1', { tier: 'draft' }));

  const first = approveCommitment(db, 'ask-1');
  assert.equal(first.item.tier, 'draft');
  assert.equal(first.item.state, 'live');
  assert.equal(first.receipt.title, 'Draft preparation approved: Send the deck');

  const second = approveCommitment(db, 'draft-1');
  assert.equal(second.item.state, 'done');
  assert.deepEqual(second.item.closedBy.source, 'user');
  assert.equal(second.receipt.decision, 'execute');
  assert.throws(() => approveCommitment(db, 'draft-1'), /already closed/);
  assert.throws(() => approveCommitment(db, 'nope'), /no longer exists/);
  db.close();
});

test('dismissing retires a row, the bankruptcy action clears it, and undo restores it', () => {
  const db = openDb(':memory:');
  saveCommitment(db, row('x'));
  const dismissed = dismissCommitment(db, 'x');
  assert.equal(dismissed.item.state, 'obsolete');
  assert.equal(dismissed.item.decision, 'ignore');
  assert.throws(() => dismissCommitment(db, 'x'), /already retired/);

  assert.equal(bankruptcyCandidates(db).length, 1);
  const cleared = retireObsolete(db);
  assert.equal(cleared.removed, 1);
  assert.equal(cleared.retired[0].priorState, 'obsolete');
  assert.equal(listItems(db)[0].state, 'forgotten');
  assert.equal(bankruptcyCandidates(db).length, 0);
  assert.throws(() => retireObsolete(db), /Nothing is marked obsolete/);

  // The ten-second undo puts every row back in the state it had.
  const undone = restoreCommitments(db, cleared.retired);
  assert.equal(undone.restored, 1);
  assert.equal(listItems(db)[0].state, 'obsolete');
  assert.throws(() => restoreCommitments(db, []), /Nothing to restore/);
  db.close();
});

test('editing corrects the sentence and the due date without touching the quote', () => {
  const db = openDb(':memory:');
  saveCommitment(db, row('e'));
  const before = getItem(db, 'e');
  const edited = editCommitment(db, 'e', { text: 'Send the deck to Priya', dueAt: '2099-03-04' });
  assert.equal(edited.item.title, 'Send the deck to Priya');
  assert.equal(edited.item.dueDay, '2099-03-04');
  assert.equal(edited.item.quote, before.quote);
  assert.match(edited.receipt.detail, /source quote was not changed/);
  assert.throws(() => editCommitment(db, 'e', { text: '   ' }), /needs its sentence/);
  assert.throws(() => editCommitment(db, 'e', { text: 'ok', dueAt: '04/03/2099' }), /YYYY-MM-DD/);
  db.close();
});

test('a model distribution is only read back when all five options are real', () => {
  assert.deepEqual(distributionOf({ distribution: { ignore: 1, remember: 1, ask: 1, draft: 1, execute: 0 } }), {
    ignore: 0.25,
    remember: 0.25,
    ask: 0.25,
    draft: 0.25,
    execute: 0,
  });
  assert.deepEqual(distributionOf({ ignore: 0, remember: 0, ask: 0, draft: 0, execute: 2 }), {
    ignore: 0,
    remember: 0,
    ask: 0,
    draft: 0,
    execute: 1,
  });
  // A partial or malformed distribution returns null, so the Twin draws no arc.
  assert.equal(distributionOf({ draft: 0.9, execute: 0.1 }), null);
  assert.equal(distributionOf({ ignore: 0, remember: 0, ask: 0, draft: 0, execute: -1 }), null);
  assert.equal(distributionOf({}), null);
  assert.equal(distributionOf(null), null);
});

test('a plan needs consent, two distinct people, a future date, and both approvals', () => {
  const db = openDb(':memory:');
  saveCommitment(db, row('p'));
  const base = { commitmentId: 'p', date: '2099-01-02', participants: ['You', 'Sam'] };

  assert.throws(() => createPlan(db, { ...base, consent: false }), /Consent is required/);
  assert.throws(() => createPlan(db, { ...base, consent: true, participants: ['You', 'You'] }), /two distinct participants/);
  assert.throws(() => createPlan(db, { ...base, consent: true, participants: ['You'] }), /two distinct participants/);
  assert.throws(() => createPlan(db, { ...base, consent: true, date: '2001-01-01' }), /has not already passed/);
  assert.throws(() => createPlan(db, { ...base, consent: true, date: '02/03/2099' }), /YYYY-MM-DD/);
  assert.throws(() => createPlan(db, { commitmentId: 'missing', consent: true, date: '2099-01-02', participants: ['a', 'b'] }), /Pick a commitment/);

  const { plan } = createPlan(db, { ...base, consent: true });
  assert.equal(plan.state, 'proposed');
  assert.deepEqual(plan.awaiting, ['You', 'Sam']);
  assert.equal(plan.consent, true);

  assert.throws(() => approvePlan(db, plan.id, 'Nobody'), /not part of this plan/);
  assert.throws(() => executePlan(db, plan.id), /Both participants/);
  assert.equal(approvePlan(db, plan.id, 'You').plan.state, 'proposed');
  assert.equal(approvePlan(db, plan.id, 'You').plan.awaiting.length, 1, 'the same approval is not counted twice');
  assert.equal(approvePlan(db, plan.id, 'Sam').plan.state, 'approved');
  assert.throws(() => planIcs(db, plan.id), /No calendar file/);

  const executed = executePlan(db, plan.id);
  assert.equal(executed.plan.state, 'executed');
  const file = planIcs(db, plan.id);
  assert.match(file.content, /BEGIN:VCALENDAR/);
  assert.match(file.content, /DTSTART;VALUE=DATE:20990102/);
  assert.match(file.content, /END:VCALENDAR/);

  const cancelled = cancelPlan(db, plan.id);
  assert.equal(cancelled.plan.state, 'cancelled');
  assert.throws(() => planIcs(db, plan.id), /No calendar file/);
  assert.throws(() => executePlan(db, plan.id), /cancelled/);
  db.close();
});

test('the calendar file escapes text and the ledger merges real ingest receipts', () => {
  const db = openDb(':memory:');
  saveCommitment(db, row('q', { text: 'Review, then send; notes' }));
  const { plan } = createPlan(db, {
    commitmentId: 'q',
    date: '2099-01-02',
    participants: ['You', 'Sam'],
    consent: true,
  });
  approvePlan(db, plan.id, 'You');
  approvePlan(db, plan.id, 'Sam');
  executePlan(db, plan.id);
  const file = planIcs(db, plan.id);
  assert.match(file.content, /SUMMARY:Review\\, then send\\; notes/);

  setState(db, 'bee.owner', 'Maximilian Milovidov');
  setState(db, 'bee.last_run', '2026-10-17T16:54:50.102Z');
  logEvent(db, 'ingest', 'backfill: 2 conversations, 1 todos, 1 facts', { utterancesDroppedOtherSpeaker: 3 });

  const ledger = buildLedger(db);
  assert.equal(ledger.owner, 'Maximilian Milovidov');
  assert.equal(ledger.connected, true);
  assert.equal(ledger.items.length, 1);
  assert.equal(ledger.plans.length, 1);
  assert.ok(ledger.receipts.some((receipt) => receipt.kind === 'ingest'));
  const syncReceipt = ledger.receipts.find((receipt) => receipt.kind === 'ingest');
  assert.match(syncReceipt.detail, /3 bystander utterances dropped/);
  assert.equal(ledger.totals.commitments, counts(db).commitments);
  assert.deepEqual(ledger.decisions, ['draft', 'ask', 'remember', 'execute', 'ignore', 'unscored']);
  db.close();
});

test('an empty database reports true zeros, not placeholders', () => {
  const db = openDb(':memory:');
  const ledger = buildLedger(db);
  assert.equal(ledger.connected, false);
  assert.equal(ledger.owner, null);
  assert.equal(ledger.sync, null);
  assert.deepEqual(ledger.items, []);
  assert.deepEqual(ledger.receipts, []);
  assert.deepEqual(ledger.stats, { total: 0, open: 0, drafts: 0, asks: 0, handled: 0, obsolete: 0, unscored: 0 });
  assert.equal(ledger.privacy.conversations, 0);
  assert.equal(ledger.privacy.utterancesKept, 0);
  assert.equal(ledger.privacy.utterancesDroppedOther, 0);
  db.close();
});
