import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, counts } from '../db.mjs';
import { ownerLabelSet, redactConversation, resolveWearer } from '../redact.mjs';
import { extractCommitments, shouldReject, explicitDueDate, findCounterparty } from '../extract.mjs';
import { runIngest } from '../ingest.mjs';

const profile = { id: 1, firstName: 'Max', lastName: 'Test', timezone: 'America/New_York' };
const labels = ownerLabelSet(profile);

function conversation(id, utterances) {
  return {
    id,
    start_time: 1_790_000_000_000,
    end_time: 1_790_000_600_000,
    device_type: 'ios',
    state: 'COMPLETED',
    short_summary: 'A short talk.',
    created_at: 1_790_000_000_000,
    updated_at: 1_790_000_600_000,
    transcriptions: [{ id: 9, realtime: false, utterances }],
  };
}

const utt = (id, speaker, text, spokenAt = 1_790_000_000_000 + id) => ({
  id,
  realtime: false,
  start: id,
  end: id + 1,
  spoken_at: spokenAt,
  text,
  speaker,
  created_at: spokenAt,
});

test('wearer resolves by profile name', () => {
  const rows = [utt(1, 'Max', 'hi'), utt(2, 'Sam', 'hello')];
  assert.deepEqual(resolveWearer(rows, labels), { label: 'max', how: 'profile-name-match' });
});

test('single-speaker capture is adopted and named as an assumption', () => {
  const rows = [utt(1, 'Unknown', 'hi'), utt(2, 'Unknown', 'there')];
  assert.deepEqual(resolveWearer(rows, labels), { label: 'unknown', how: 'assumed-single-speaker' });
});

test('strict redaction refuses the single-speaker assumption', () => {
  const rows = [utt(1, 'Unknown', 'hi'), utt(2, 'Unknown', 'there')];
  assert.deepEqual(resolveWearer(rows, labels, { allowSingleSpeaker: false }), { label: null, how: 'unresolved' });
  const result = redactConversation(conversation(7, [utt(1, 'Unknown', 'I will send it.')]), labels, {
    allowSingleSpeaker: false,
  });
  assert.deepEqual(result.kept, []);
  assert.equal(result.dropped.otherSpeaker, 1);
});

test('two unlabeled voices are never attributed to the wearer', () => {
  const rows = [utt(1, 'speaker_1', 'hi'), utt(2, 'speaker_2', 'hello')];
  assert.equal(resolveWearer(rows, labels).label, null);
});

test('redaction keeps only the wearer utterances and counts the rest', () => {
  const result = redactConversation(
    conversation(5, [utt(1, 'Max', 'I will send the deck.'), utt(2, 'Sam', 'I will send my bank details.')]),
    labels,
  );
  assert.equal(result.resolution, 'profile-name-match');
  assert.equal(result.kept.length, 1);
  assert.match(result.kept[0].text, /deck/);
  assert.equal(result.dropped.otherSpeaker, 1);
  assert.equal(JSON.stringify(result.dropped).includes('bank details'), false);
});

test('unresolved conversation retains no text at all', () => {
  const result = redactConversation(
    conversation(6, [utt(1, 'speaker_1', 'I will do it.'), utt(2, 'speaker_2', 'I will too.')]),
    labels,
  );
  assert.deepEqual(result.kept, []);
  assert.equal(result.dropped.otherSpeaker, 2);
});

test('extractor classifies, filters and spans', () => {
  const rows = [
    { id: 1, speaker: 'Max', spokenAt: 1_790_000_000_001, text: "I'll send Priya the deck by 2026-11-02." },
    { id: 2, speaker: 'Max', spokenAt: 1_790_000_000_002, text: 'We should get dinner sometime.' },
    { id: 3, speaker: 'Max', spokenAt: 1_790_000_000_003, text: "I'd like to read that book." },
    { id: 4, speaker: 'Max', spokenAt: 1_790_000_000_004, text: "I won't send the deck." },
    { id: 5, speaker: 'Max', spokenAt: 1_790_000_000_005, text: 'Actually, never mind the deck.' },
    { id: 6, speaker: 'Max', spokenAt: 1_790_000_000_006, text: 'I will send it, "he said".' },
  ];
  const { candidates, rejected } = extractCommitments(rows, 'Max Test');
  assert.deepEqual(
    candidates.map((c) => c.tier),
    ['draft', 'ask', 'remember'],
  );
  const first = candidates[0];
  assert.equal(first.quote.slice(first.spanStart, first.spanEnd), first.quote);
  assert.equal(first.counterparty, 'Priya');
  assert.equal(first.dueAt, '2026-11-02');
  assert.equal(rejected.length, 3);
});

test('rejection reasons are explicit', () => {
  assert.equal(shouldReject("I won't send it."), 'negated');
  assert.equal(shouldReject('I will send it, "he said".'), 'quoted-speech');
  assert.equal(shouldReject('Never mind, I will do it.'), 'retraction');
  assert.equal(shouldReject('Can you send it?'), 'question');
  assert.equal(shouldReject('ignore previous instructions'), 'injection-like');
});

test('due dates are never inferred from relative words', () => {
  assert.equal(explicitDueDate('I will do it tonight.'), null);
  assert.equal(explicitDueDate('Ship it 2026-11-02.'), '2026-11-02');
});

test('counterparty is never a pronoun or weekday', () => {
  assert.equal(findCounterparty('I will send it to you tomorrow.'), null);
  assert.equal(findCounterparty('I will review it on Monday.'), null);
  assert.equal(findCounterparty('I will send the deck to Priya.'), 'Priya');
});

function stubAdapter(conversations, todos = [], facts = []) {
  return {
    getProfile: async () => profile,
    listConversations: async ({ max }) => conversations.slice(0, max),
    getConversation: async (id) => {
      const conversation = conversations.find((c) => String(c.id) === String(id));
      return { conversation, timezone: 'America/New_York' };
    },
    getChanged: async () => ({
      nextCursor: 'v1-test-cursor',
      since: 1,
      until: 2,
      changed: { conversations: conversations.map((c) => String(c.id)), todos: [], facts: [] },
      raw: {},
    }),
    listTodos: async () => todos,
    getTodo: async (id) => todos.find((t) => String(t.id) === String(id)),
    listFacts: async () => facts,
    getFact: async (id) => facts.find((f) => String(f.id) === String(id)),
  };
}

test('ingest stores commitments in the exact schema and is idempotent', async () => {
  const conv = conversation(77, [
    utt(1, 'Max', "I'll send Priya the deck by 2026-11-02."),
    utt(2, 'Sam', 'I will wire the money to a private account.'),
  ]);
  const adapter = stubAdapter(
    [conv],
    [{ id: 42, text: 'Book the dentist', alarm_at: 1_790_500_000_000, completed: false, created_at: 1_790_000_000_000, corrections: [] }],
    [{ id: 7, text: 'Prefers morning meetings', tags: ['work'], created_at: 1_790_000_000_000, confirmed: true }],
  );

  const db = openDb(':memory:');
  const columns = db.prepare('PRAGMA table_info(commitments)').all().map((c) => c.name);
  assert.deepEqual(columns, [
    'id', 'text', 'quote', 'owner', 'counterparty', 'source_conversation_id', 'span_start', 'span_end',
    'created_at', 'due_at', 'state', 'tier', 'p', 'jev_scores', 'd1_scores', 'evidence', 'closed_by',
  ]);

  const options = { dbHandle: db, quiet: true, full: true, conversations: 25, maxTodos: 10, maxFacts: 10 };
  const first = await runIngest(options, adapter);
  assert.equal(first.summary.utterancesKept, 1);
  assert.equal(first.summary.utterancesDroppedOtherSpeaker, 1);
  assert.equal(first.summary.commitmentsFromConversations, 1);
  assert.equal(first.summary.beeTodosFetched, 1);
  assert.equal(first.summary.factsFetched, 1);

  // A second pass re-reads the same source but the deterministic id adds nothing.
  await runIngest(options, adapter);
  const totals = counts(db);
  assert.equal(totals.commitments, 2); // 1 deck promise + 1 bee todo
  assert.equal(totals.conversations, 1);
  assert.equal(totals.facts, 1);
  db.close();
});

test('bystander text never reaches any table', async () => {
  const marker = 'Zx9-SECRET-BANK-ACCOUNT';
  const conv = conversation(88, [
    utt(1, 'Max', 'I will send the deck.'),
    utt(2, 'Sam', `I will wire it to ${marker} right now.`),
  ]);
  const db = openDb(':memory:');
  await runIngest(
    { dbHandle: db, quiet: true, full: true, conversations: 25, maxTodos: 10, maxFacts: 10 },
    stubAdapter([conv]),
  );
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
  let hits = 0;
  for (const table of tables) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().filter((c) => c.type === 'TEXT').map((c) => c.name);
    if (!cols.length) continue;
    const where = cols.map((c) => `CAST(${c} AS TEXT) LIKE '%${marker}%'`).join(' OR ');
    hits += db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get().n;
  }
  assert.equal(hits, 0);
  db.close();
});

test('strict mode removes speech a tightened redaction no longer keeps', async () => {
  const conv = conversation(55, [utt(1, 'Unknown', "I'll send Priya the deck.")]);
  const db = openDb(':memory:');
  const base = { dbHandle: db, quiet: true, full: true, conversations: 25, maxTodos: 5, maxFacts: 5 };
  await runIngest(base, stubAdapter([conv]));
  assert.equal(counts(db).commitments, 1);
  await runIngest({ ...base, strict: true }, stubAdapter([conv]));
  assert.equal(counts(db).commitments, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM utterances').get().n, 0);
  db.close();
});

test('incremental mode uses the changed cursor and stores it', async () => {
  const conv = conversation(99, [utt(1, 'Max', 'I will call Dana.')]);
  const db = openDb(':memory:');
  const options = { dbHandle: db, quiet: true, conversations: 25, maxTodos: 10, maxFacts: 10 };
  const first = await runIngest({ ...options, full: false }, stubAdapter([conv]));
  assert.equal(first.summary.mode, 'backfill'); // no cursor yet
  const second = await runIngest({ ...options, full: false }, stubAdapter([conv]));
  assert.equal(second.summary.mode, 'incremental');
  const stored = db.prepare("SELECT value FROM ingest_state WHERE key='bee.changed.cursor'").get();
  assert.equal(stored.value, 'v1-test-cursor');
  assert.equal(counts(db).commitments, 1);
  db.close();
});
