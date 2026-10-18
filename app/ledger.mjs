// The app layer: projects the ingested SQLite rows into the shapes the UI
// renders, and records what the wearer decides.
//
//   read side   commitments + conversations + facts + bee_todos  ->  items/stats
//   write side  approvals, dismissals, plans, receipts               ->  tables
//
// Nothing here invents a number. The Jev and d1 models have not scored these
// rows yet, so `confidence` is null and the UI says "unscored". Tiers come from
// the offline rule extractor and are labelled as provisional in evidence.

import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { STATES, counts } from './db.mjs';

const DAY = 86_400_000;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = process.env.LATENT_DATA_DIR || path.join(ROOT, 'data');

/** The five options every decision model scores. Declared once, used everywhere. */
export const OPTIONS = ['ignore', 'remember', 'ask', 'draft', 'execute'];

/**
 * Read a model's five-way distribution out of whatever the decision layer
 * stored. Accepts `{ distribution }`, `{ probabilities }` or a flat object, and
 * returns a normalised object only when all five options are real numbers.
 * Anything else returns null, because a half-parsed distribution is worse than
 * none: the Twin must not draw an arc it cannot justify.
 */
export function distributionOf(value) {
  if (!value || typeof value !== 'object') return null;
  const source =
    value.distribution && typeof value.distribution === 'object'
      ? value.distribution
      : value.probabilities && typeof value.probabilities === 'object'
        ? value.probabilities
        : value;
  const out = {};
  let sum = 0;
  for (const option of OPTIONS) {
    const number = source[option];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < 0) return null;
    out[option] = number;
    sum += number;
  }
  if (sum <= 0) return null;
  for (const option of OPTIONS) out[option] = out[option] / sum;
  return out;
}

/** Stakes are a pipeline output stored inside evidence; absent until a model runs. */
function stakesOf(evidence) {
  const stakes = evidence?.stakes;
  return typeof stakes === 'number' && Number.isFinite(stakes) && stakes > 0 ? stakes : null;
}

/** The wearer's decision for a row, derived from state and the provisional tier. */
export function decisionOf(row) {
  if (row.state === 'done') return 'execute';
  if (row.state === 'obsolete' || row.state === 'forgotten') return 'ignore';
  if (row.state === 'blocked') return 'ask';
  if (row.tier === 'ask' || row.tier === 'draft' || row.tier === 'remember') return row.tier;
  return 'unscored';
}

// What each decision means for action. Plain statements, no promises the code
// cannot keep.
const POLICY = {
  draft: 'Latent can prepare a draft. Nothing is sent or shared without your approval.',
  ask: 'Held back. The commitment is unclear or shared, so it needs your decision before any action.',
  remember: 'Remembered without interrupting. Surfaced again when it is relevant.',
  execute: 'Closed. No external action is pending for this item.',
  ignore: 'Retired. No task and no action follow from it.',
  unscored: 'No decision yet. The Jev and d1 models have not scored this item.',
};

const WHY = {
  'first-person-promise': 'A first-person promise in your own words.',
  'shared-intent': 'Shared phrasing ("we should", "let\'s"). Not a firm commitment on its own.',
  'stated-interest': 'A stated interest rather than a commitment.',
  'bee-todo': 'You wrote this as a Bee todo.',
};

const DECISIONS = ['draft', 'ask', 'remember', 'execute', 'ignore', 'unscored'];

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function dateFormatter(timezone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
}

function dayFormatter(timezone) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', month: 'short', day: 'numeric' });
  } catch {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  }
}

function dayOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function readSettings(db) {
  const get = (key) => {
    const row = db.prepare('SELECT value FROM ingest_state WHERE key=?').get(key);
    return row ? row.value : null;
  };
  return {
    owner: get('bee.owner'),
    timezone: get('bee.timezone'),
    cursor: get('bee.changed.cursor'),
    lastRun: get('bee.last_run'),
  };
}

export function listItems(db, { limit } = {}) {
  const settings = readSettings(db);
  const stamp = dateFormatter(settings.timezone);
  const day = dayFormatter(settings.timezone);
  const now = Date.now();

  const conversations = new Map(
    db
      .prepare('SELECT id, start_time, short_summary FROM conversations')
      .all()
      .map((row) => [String(row.id), row]),
  );

  const sql = `SELECT id, text, quote, owner, counterparty, source_conversation_id,
                      span_start, span_end, created_at, due_at, state, tier, p,
                      jev_scores, d1_scores, evidence, closed_by
               FROM commitments
               WHERE source_conversation_id IS NULL
               ORDER BY created_at DESC, id ASC`;
  const rows = limit ? db.prepare(`${sql} LIMIT ?`).all(limit) : db.prepare(sql).all();

  return rows.map((row) => {
    const evidence = parseJson(row.evidence, {});
    const source = row.source_conversation_id ? conversations.get(String(row.source_conversation_id)) : null;
    const origin = evidence.origin === 'bee_todo' || !row.source_conversation_id ? 'bee_todo' : 'conversation';
    const created = new Date(row.created_at);
    const age = Number.isNaN(created.getTime()) ? 0 : Math.max(0, Math.floor((now - created.getTime()) / DAY));

    let sourceLabel;
    if (origin === 'conversation' && source) {
      sourceLabel = `Bee conversation · ${stamp.format(new Date(Number(source.start_time) || created))}`;
    } else if (origin === 'conversation') {
      sourceLabel = 'Bee conversation';
    } else {
      sourceLabel = `Bee todo · ${day.format(created)}`;
    }

    const jev = parseJson(row.jev_scores, {});
    const d1 = parseJson(row.d1_scores, {});
    const scored = row.p !== null || typeof jev.score === 'number' || typeof d1.score === 'number';

    return {
      id: row.id,
      title: row.text,
      quote: row.quote,
      owner: row.owner,
      person: row.counterparty || null,
      source: sourceLabel,
      sourceId: row.source_conversation_id ? String(row.source_conversation_id) : null,
      origin,
      /* What kind of source this was read from. Real ingestion only distinguishes
         a Bee todo from a Bee conversation; the preview dataset uses the richer
         set (call, class, email, todo) so the interface can be designed against
         the full range of source icons. */
      sourceKind: origin === 'bee_todo' ? 'todo' : 'conversation',
      decision: decisionOf(row),
      tier: row.tier,
      state: row.state,
      scored,
      confidence: typeof row.p === 'number' ? row.p : null,
      jev: typeof jev.score === 'number' ? { decision: jev.decision ?? null, score: jev.score } : null,
      d1: typeof d1.score === 'number' ? { decision: d1.decision ?? null, score: d1.score } : null,
      stakes: stakesOf(evidence),
      jevDist: distributionOf(jev),
      d1Dist: distributionOf(d1),
      why: WHY[evidence.rule] || (origin === 'bee_todo' ? WHY['bee-todo'] : 'Noted from a Bee conversation.'),
      policy: POLICY[decisionOf(row)],
      result: resultOf(row),
      age,
      createdAt: row.created_at,
      dueAt: row.due_at,
      dueDay: dayOnly(row.due_at),
      spanStart: row.span_start,
      spanEnd: row.span_end,
      redaction: evidence.redaction ?? null,
      speaker: evidence.speaker ?? null,
      rule: evidence.rule ?? (origin === 'bee_todo' ? 'bee-todo' : null),
      closedBy: parseJson(row.closed_by, null),
    };
  });
}

function resultOf(row) {
  const closedBy = parseJson(row.closed_by, null);
  const at = closedBy?.at ? new Date(closedBy.at).toISOString().slice(0, 10) : null;
  switch (row.state) {
    case 'done':
      return closedBy?.source === 'bee.todo'
        ? `Closed. Bee marked this todo complete${at ? ` on ${at}` : ''}.`
        : `Closed${at ? ` on ${at}` : ''}.`;
    case 'obsolete':
      return closedBy?.source === 'merge'
        ? 'Merged. Another copy of this row was kept.'
        : 'Retired. No action was taken.';
    case 'forgotten':
      return 'Forgotten. No action was taken.';
    case 'blocked':
      return 'Blocked. Waiting on an external decision.';
    default:
      return 'No action taken yet.';
  }
}

export function statsOf(items) {
  const stats = { total: items.length, open: 0, drafts: 0, asks: 0, handled: 0, obsolete: 0, unscored: 0 };
  for (const item of items) {
    if (item.state === 'live' || item.state === 'blocked') {
      stats.open += 1;
      if (item.decision === 'draft') stats.drafts += 1;
      if (item.decision === 'ask') stats.asks += 1;
      if (item.decision === 'unscored') stats.unscored += 1;
    }
    if (item.state === 'done') stats.handled += 1;
    if (item.state === 'obsolete' || item.state === 'forgotten') stats.obsolete += 1;
  }
  return stats;
}

export function privacyOf(db) {
  const one = (sql) => db.prepare(sql).get().n;
  return {
    conversations: one('SELECT COUNT(*) AS n FROM conversations'),
    utterancesKept: one('SELECT COALESCE(SUM(utterances_kept),0) AS n FROM conversations'),
    utterancesDroppedOther: one('SELECT COALESCE(SUM(utterances_dropped_other),0) AS n FROM conversations'),
    utterancesDroppedEmpty: one('SELECT COALESCE(SUM(utterances_dropped_empty),0) AS n FROM conversations'),
    assumedSingleSpeaker: one("SELECT COUNT(*) AS n FROM conversations WHERE redaction='assumed-single-speaker'"),
    nameMatched: one("SELECT COUNT(*) AS n FROM conversations WHERE redaction='profile-name-match'"),
  };
}

export function receiptFromIngest(row) {
  const detail = parseJson(row.counts, null);
  const parts = [];
  if (row.detail) parts.push(row.detail);
  if (detail && Number.isFinite(detail.utterancesDroppedOtherSpeaker)) {
    parts.push(`${detail.utterancesDroppedOtherSpeaker} bystander utterances dropped`);
  }
  return {
    id: `ingest:${row.id}`,
    at: row.at,
    kind: 'ingest',
    decision: 'ingest',
    title: 'Bee sync',
    detail: parts.join(' · '),
  };
}

export function listReceipts(db, limit = 60) {
  const stored = db
    .prepare(
      `SELECT id, at, kind, decision, title, detail, commitment_id AS commitmentId, plan_id AS planId
       FROM receipts ORDER BY at DESC LIMIT ?`,
    )
    .all(limit);
  const ingested = db
    .prepare('SELECT id, at, event, detail, counts FROM ingest_log ORDER BY at DESC LIMIT ?')
    .all(limit)
    .map(receiptFromIngest);
  return [...stored, ...ingested].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

export function insertReceipt(db, { kind, decision = null, title, detail, commitmentId = null, planId = null }) {
  const receipt = {
    id: randomUUID(),
    at: new Date().toISOString(),
    kind,
    decision,
    title,
    detail,
  };
  db.prepare(
    'INSERT INTO receipts (id, at, kind, decision, title, detail, commitment_id, plan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(receipt.id, receipt.at, kind, decision, title, detail, commitmentId, planId);
  return receipt;
}

export function getItem(db, id) {
  return listItems(db).find((item) => item.id === id) || null;
}

// --- wearer actions ---------------------------------------------------------

export function approveCommitment(db, id) {
  const item = getItem(db, id);
  if (!item) fail('That commitment no longer exists.', 404);
  if (item.state !== 'live' && item.state !== 'blocked') fail('This commitment is already closed.', 409);

  const at = new Date().toISOString();
  let title;
  let detail;
  let decision;

  if (item.decision === 'ask') {
    // Approval authorises drafting only; the row stays open and is re-tiered.
    db.prepare("UPDATE commitments SET tier='draft', state='live' WHERE id=?").run(id);
    decision = 'draft';
    title = `Draft preparation approved: ${item.title}`;
    detail = 'You authorised drafting. No external action was performed.';
  } else if (item.decision === 'draft') {
    db.prepare('UPDATE commitments SET state=?, closed_by=? WHERE id=?').run(
      'done',
      JSON.stringify({ source: 'user', at }),
      id,
    );
    decision = 'execute';
    title = `Approved: ${item.title}`;
    detail = 'Marked complete by you. No external system was modified.';
  } else {
    db.prepare('UPDATE commitments SET state=?, closed_by=? WHERE id=?').run(
      'done',
      JSON.stringify({ source: 'user', at }),
      id,
    );
    decision = 'execute';
    title = `Handled: ${item.title}`;
    detail = 'Marked complete by you.';
  }

  const receipt = insertReceipt(db, { kind: decision, decision, title, detail, commitmentId: id });
  return { item: getItem(db, id), receipt };
}

export function dismissCommitment(db, id) {
  const item = getItem(db, id);
  if (!item) fail('That commitment no longer exists.', 404);
  if (item.state === 'obsolete' || item.state === 'forgotten') fail('This commitment is already retired.', 409);
  const at = new Date().toISOString();
  db.prepare('UPDATE commitments SET state=?, closed_by=? WHERE id=?').run(
    'obsolete',
    JSON.stringify({ source: 'user', at }),
    id,
  );
  const receipt = insertReceipt(db, {
    kind: 'ignore',
    decision: 'ignore',
    title: `Retired: ${item.title}`,
    detail: 'You rejected the inferred commitment. No action was taken.',
    commitmentId: id,
  });
  return { item: getItem(db, id), receipt };
}

/**
 * The rows the bankruptcy action retires: everything the ledger already treats
 * as ignore — items the pipeline tiered `ignore`, plus items retired by hand —
 * that has not been cleared yet. Nothing else is ever a candidate, so the count
 * on the button is a real count and zero means zero.
 */
export function bankruptcyCandidates(db) {
  return listItems(db).filter((item) => item.decision === 'ignore' && item.state !== 'forgotten');
}

export function retireObsolete(db) {
  const candidates = bankruptcyCandidates(db);
  if (!candidates.length) fail('Nothing is marked obsolete, so nothing can be retired.', 409);
  const retire = db.prepare("UPDATE commitments SET state='forgotten' WHERE id=?");
  const retired = candidates.map((item) => ({ id: item.id, priorState: item.state, title: item.title }));
  for (const entry of retired) retire.run(entry.id);
  const receipt = insertReceipt(db, {
    kind: 'ignore',
    decision: 'ignore',
    title: `${retired.length} obsolete commitment${retired.length === 1 ? '' : 's'} retired`,
    detail: 'Every item the ledger marked obsolete was retired in one action. This is reversible for ten seconds; their source conversations were not touched.',
  });
  return { removed: retired.length, retired, receipt };
}

/** Undo for the bankruptcy action: put every row back in the state it had. */
export function restoreCommitments(db, entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) fail('Nothing to restore.');
  const put = db.prepare('UPDATE commitments SET state=? WHERE id=?');
  let restored = 0;
  for (const entry of list) {
    const id = String(entry?.id ?? '');
    const state = String(entry?.priorState ?? '');
    if (!id || !STATES.includes(state)) continue;
    const result = put.run(state, id);
    if (result.changes) restored += 1;
  }
  const receipt = insertReceipt(db, {
    kind: 'remember',
    decision: 'remember',
    title: `Restored ${restored} commitment${restored === 1 ? '' : 's'}`,
    detail: 'The bankruptcy action was undone. Every restored row is back in the state it had before.',
  });
  return { restored, receipt };
}

/**
 * Hand-correct the extracted text or due date. The extractor is a guess about
 * what you said; this is the correction path, and it records who changed what.
 */
/**
 * Merge duplicate rows. The copy carrying a due date wins, because it holds
 * information the others do not; otherwise the oldest wins. Every other row is
 * retired with a receipt pointing at the keeper, so the merge is visible and
 * reversible rather than a delete.
 */
export function mergeCommitments(db, ids) {
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map(String))];
  if (unique.length < 2) fail('Pick at least two copies to merge.');
  const marks = unique.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT id, text, state, created_at, due_at FROM commitments
       WHERE id IN (${marks}) AND source_conversation_id IS NULL`,
    )
    .all(...unique);
  if (rows.length !== unique.length) fail('One of those rows is not a Bee todo.', 404);
  if (rows.some((row) => !['live', 'blocked'].includes(row.state))) fail('Only open rows can be merged.');

  const keeper = rows
    .slice()
    .sort((a, b) => (a.due_at ? 0 : 1) - (b.due_at ? 0 : 1) || (a.created_at < b.created_at ? -1 : 1))[0];
  const at = new Date().toISOString();
  const retire = db.prepare("UPDATE commitments SET state='obsolete', closed_by=? WHERE id=?");
  for (const row of rows) {
    if (row.id === keeper.id) continue;
    retire.run(JSON.stringify({ source: 'merge', into: keeper.id, at }), row.id);
  }

  const receipt = insertReceipt(db, {
    kind: 'merge',
    title: `Merged ${rows.length} copies`,
    detail: `Kept one copy of ${keeper.text} and retired ${rows.length - 1}.`,
    commitmentId: keeper.id,
  });
  return { merged: rows.length - 1, kept: keeper.id, receipt };
}

/**
 * Merge every duplicate group at once. Each group still writes its own
 * receipt, so the audit trail reads the same as six separate merges.
 */
export function mergeAllDuplicates(db) {
  const open = listItems(db).filter((item) => ['live', 'blocked'].includes(item.state));
  const groups = new Map();
  for (const item of open) {
    const key = item.title.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item.id);
  }
  let merged = 0;
  let count = 0;
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    merged += mergeCommitments(db, ids).merged;
    count += 1;
  }
  return { groups: count, merged };
}

export function editCommitment(db, id, body = {}) {
  const item = getItem(db, id);
  if (!item) fail('That commitment no longer exists.', 404);
  const text = String(body.text ?? item.title).trim();
  if (!text) fail('A commitment needs its sentence.');
  if (text.length > 300) fail('Keep the commitment sentence under 300 characters.');
  const dueAt = body.dueAt === null || body.dueAt === undefined || body.dueAt === '' ? null : String(body.dueAt);
  if (dueAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) fail('Due date must be YYYY-MM-DD or empty.');

  const at = new Date().toISOString();
  const row = db.prepare('SELECT evidence FROM commitments WHERE id=?').get(id);
  const evidence = parseJson(row?.evidence, {});
  evidence.editedBy = 'user';
  evidence.editedAt = at;
  db.prepare('UPDATE commitments SET text=?, due_at=?, evidence=? WHERE id=?').run(
    text,
    dueAt,
    JSON.stringify(evidence),
    id,
  );
  const receipt = insertReceipt(db, {
    kind: 'draft',
    decision: 'draft',
    title: `Corrected by hand: ${text}`,
    detail: `You edited the extracted sentence${dueAt ? ` and set the due date to ${dueAt}` : ' and cleared the due date'}. The source quote was not changed.`,
    commitmentId: id,
  });
  return { item: getItem(db, id), receipt };
}

// --- plans (agent coordination with consent and two approvals) --------------

export function listPlans(db) {
  return db
    .prepare(
      `SELECT id, commitment_id AS commitmentId, title, date, participants, approvals, consent,
              state, created_at AS createdAt, updated_at AS updatedAt
       FROM plans ORDER BY created_at DESC`,
    )
    .all()
    .map((row) => {
      const participants = parseJson(row.participants, []);
      const approvals = parseJson(row.approvals, {});
      return {
        ...row,
        consent: Boolean(row.consent),
        participants,
        approvals,
        approvedBy: Object.keys(approvals),
        awaiting: participants.filter((p) => !approvals[p]),
      };
    });
}

export function getPlan(db, id) {
  return listPlans(db).find((plan) => plan.id === id) || null;
}

export function createPlan(db, body) {
  const { commitmentId, date, participants, consent } = body || {};
  const item = commitmentId ? getItem(db, commitmentId) : null;
  if (!item) fail('Pick a commitment to plan from.');
  if (consent !== true) fail('Consent is required before a plan can be proposed.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) fail('Pick a date as YYYY-MM-DD.');
  const when = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(when.getTime()) || when.toISOString().slice(0, 10) !== date) fail('That date is not valid.');
  if (date < new Date().toISOString().slice(0, 10)) fail('Pick a date that has not already passed.');
  const names = (Array.isArray(participants) ? participants : [])
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  const unique = [...new Set(names)];
  if (unique.length !== 2) fail('A plan needs exactly two distinct participants.');

  const at = new Date().toISOString();
  const plan = {
    id: randomUUID(),
    commitmentId: item.id,
    title: String(body.title || item.title).slice(0, 200),
    date,
    participants: JSON.stringify(unique),
    approvals: '{}',
    consent: 1,
    state: 'proposed',
  };
  db.prepare(
    `INSERT INTO plans (id, commitment_id, title, date, participants, consent, approvals, state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(plan.id, plan.commitmentId, plan.title, plan.date, plan.participants, 1, plan.approvals, plan.state, at, at);
  const receipt = insertReceipt(db, {
    kind: 'ask',
    decision: 'ask',
    title: `Plan proposed: ${plan.title}`,
    detail: `${unique.join(' and ')} must each approve before anything is dispatched. Nothing was sent.`,
    commitmentId: item.id,
    planId: plan.id,
  });
  return { plan: getPlan(db, plan.id), receipt };
}

export function approvePlan(db, id, actor) {
  const plan = getPlan(db, id);
  if (!plan) fail('That plan no longer exists.', 404);
  if (plan.state === 'cancelled') fail('This plan was cancelled.', 409);
  if (plan.state === 'executed') fail('This plan was already executed.', 409);
  const name = String(actor || '').trim();
  if (!plan.participants.includes(name)) fail(`${name || 'That person'} is not part of this plan.`);
  if (plan.approvals[name]) return { plan };

  const approvals = { ...plan.approvals, [name]: new Date().toISOString() };
  const everyone = plan.participants.every((p) => approvals[p]);
  const state = everyone ? 'approved' : 'proposed';
  db.prepare('UPDATE plans SET approvals=?, state=?, updated_at=? WHERE id=?').run(
    JSON.stringify(approvals),
    state,
    new Date().toISOString(),
    id,
  );
  const receipt = insertReceipt(db, {
    kind: 'draft',
    decision: 'draft',
    title: `${name} approved: ${plan.title}`,
    detail: everyone
      ? 'Both participants approved. Nothing has been dispatched.'
      : `${plan.participants.filter((p) => !approvals[p]).join(', ')} still has to approve.`,
    commitmentId: plan.commitmentId,
    planId: plan.id,
  });
  return { plan: getPlan(db, id), receipt };
}

export function executePlan(db, id) {
  const plan = getPlan(db, id);
  if (!plan) fail('That plan no longer exists.', 404);
  if (plan.state === 'cancelled') fail('This plan was cancelled.', 409);
  if (plan.state !== 'approved') fail('Both participants must approve before this plan can be dispatched.', 409);
  db.prepare("UPDATE plans SET state='executed', updated_at=? WHERE id=?").run(new Date().toISOString(), id);
  const receipt = insertReceipt(db, {
    kind: 'execute',
    decision: 'execute',
    title: `Plan dispatched: ${plan.title}`,
    detail: `Calendar export is available. No message was sent to ${plan.participants.join(' or ')}.`,
    commitmentId: plan.commitmentId,
    planId: plan.id,
  });
  return { plan: getPlan(db, id), receipt };
}

export function cancelPlan(db, id) {
  const plan = getPlan(db, id);
  if (!plan) fail('That plan no longer exists.', 404);
  db.prepare("UPDATE plans SET state='cancelled', updated_at=? WHERE id=?").run(new Date().toISOString(), id);
  const receipt = insertReceipt(db, {
    kind: 'ignore',
    decision: 'ignore',
    title: `Plan cancelled: ${plan.title}`,
    detail: 'Approvals were revoked and the export was removed.',
    commitmentId: plan.commitmentId,
    planId: plan.id,
  });
  return { plan: getPlan(db, id), receipt };
}

function icsEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export function planIcs(db, id) {
  const plan = getPlan(db, id);
  if (!plan) fail('That plan no longer exists.', 404);
  if (plan.state !== 'executed') fail('No calendar file exists for a plan that was not dispatched.', 404);
  const day = plan.date.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Latent//Local//EN',
    'BEGIN:VEVENT',
    `UID:${plan.id}@latent.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `SUMMARY:${icsEscape(plan.title)}`,
    `DESCRIPTION:${icsEscape(`Proposed by Latent with ${plan.participants.join(', ')}.`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
  return { filename: `${plan.id}.ics`, content };
}

// --- the four-week norm -----------------------------------------------------

const MIN_NORM_DAYS = 7;
const NORM_WINDOW_DAYS = 28;

function openLoad(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM commitments WHERE state IN ('live','blocked')").get().n;
}

/**
 * A rolling four-week sample of open load, one sample per calendar day, kept in
 * a small JSON file beside the database. Until there are seven earlier days the
 * norm is provisional and equals today's load; the UI says so out loud rather
 * than presenting a fresh install's first day as a baseline.
 */
export function normsOf(db, dataDir = DEFAULT_DATA_DIR) {
  const today = new Date().toISOString().slice(0, 10);
  const load = openLoad(db);
  const file = path.join(dataDir, 'load-history.json');
  let samples = [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (Array.isArray(parsed)) samples = parsed;
  } catch {
    samples = [];
  }
  samples = samples.filter(
    (sample) => sample && typeof sample.date === 'string' && Number.isFinite(sample.open),
  );
  const existing = samples.find((sample) => sample.date === today);
  if (existing) existing.open = load;
  else samples.push({ date: today, open: load });
  samples.sort((a, b) => (a.date < b.date ? -1 : 1));
  const kept = samples.slice(-NORM_WINDOW_DAYS);
  try {
    writeFileSync(file, `${JSON.stringify(kept)}\n`, { mode: 0o600 });
  } catch {
    /* the norm is a convenience; a read-only data dir must not break the ledger */
  }
  const earlier = kept.filter((sample) => sample.date !== today);
  const provisional = earlier.length < MIN_NORM_DAYS;
  const mean = earlier.length
    ? earlier.reduce((total, sample) => total + sample.open, 0) / earlier.length
    : load;
  return {
    load,
    norm: Math.round(mean * 10) / 10,
    days: earlier.length,
    minimumDays: MIN_NORM_DAYS,
    provisional,
  };
}

// --- negotiation ------------------------------------------------------------

/**
 * The negotiation timeline for each plan: two sides exchanging proposals over
 * the three fields a plan may carry. Every event is rebuilt from rows on this
 * machine, so the counterparty side is marked simulated — no message was sent
 * and no second device exists. Each event lists what that side put on the table
 * and what it withheld, because the withheld list is the point.
 */
export function negotiationOf(db) {
  return listPlans(db).map((plan) => {
    const events = [
      {
        at: plan.createdAt,
        actor: 'Latent',
        role: 'proposer',
        simulated: false,
        kind: 'proposed',
        title: `Proposed “${plan.title}”`,
        detail: `Date offered: ${plan.date}.`,
        disclosed: ['commitment sentence', 'date', 'the two names'],
        withheld: ['conversation transcript', 'every other commitment'],
      },
    ];
    for (const name of plan.approvedBy) {
      events.push({
        at: plan.approvals[name],
        actor: name,
        role: 'counterparty',
        simulated: true,
        kind: 'approved',
        title: `${name} accepted ${plan.date}`,
        detail: 'Recorded on this device. No message was sent and nobody was notified.',
        disclosed: ['accepted the date'],
        withheld: ['everything else'],
      });
    }
    if (plan.state === 'executed') {
      events.push({
        at: plan.updatedAt,
        actor: 'Latent',
        role: 'proposer',
        simulated: false,
        kind: 'dispatched',
        title: 'Wrote the calendar file',
        detail: 'A calendar file was produced locally. Nothing was transmitted.',
        disclosed: ['commitment sentence', 'date'],
        withheld: ['conversation transcript'],
      });
    }
    if (plan.state === 'cancelled') {
      events.push({
        at: plan.updatedAt,
        actor: 'Latent',
        role: 'proposer',
        simulated: false,
        kind: 'cancelled',
        title: 'Cancelled',
        detail: 'Approvals were revoked. No file remains.',
        disclosed: [],
        withheld: ['the proposal'],
      });
    }
    events.sort((a, b) => (a.at < b.at ? -1 : 1));
    return { ...plan, events };
  });
}

// --- the whole read model the UI needs in one call --------------------------

// --- the three screens the interface is built around ------------------------
//
// Everything below is computed from rows on this machine. Where a number cannot
// be computed — no completion label, no held-out set, no audio — the shape
// carries an explicit `available: false` and the reason, and the interface
// renders the reason instead of a zero or a guess.

const WEEK = 7 * 86_400_000;
const MIN_N = 10;

const RULE_LABEL = {
  'first-person-promise': 'Your own promise',
  'shared-intent': 'Shared wording',
  'stated-interest': 'A stated interest',
  'bee-todo': 'Written as a Bee todo',
};

const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];

/** Monday 00:00 UTC of the week containing this instant, as YYYY-MM-DD. */
function weekKeyOf(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

/**
 * Why this one might slip, from what is actually stored. Rank 0 is the strongest
 * signal. Every reason names a fact about the row, so the interface never has to
 * present a probability it cannot compute.
 */
function slipSignal(item, weekLoad) {
  if (item.rule === 'shared-intent') {
    return { rank: 0, reason: 'Shared wording, so it was nobody’s single promise' };
  }
  if (item.rule === 'stated-interest') return { rank: 0, reason: 'An interest you stated, not a promise' };
  if (!item.dueAt && item.rule === 'first-person-promise') return { rank: 1, reason: 'No date was ever stated' };
  if (item.age >= 30) return { rank: 2, reason: `Open ${item.age} days without closing` };
  if (weekLoad >= 3) return { rank: 2, reason: `${ORDINALS[weekLoad] || weekLoad} promise that week` };
  return { rank: 3, reason: 'Open, with no other signal in the record' };
}

export function todayOf(db, items) {
  const now = Date.now();
  const withinWeek = (value) => {
    const stamp = new Date(value).getTime();
    return Number.isFinite(stamp) && now - stamp >= 0 && now - stamp <= WEEK;
  };

  const open = items.filter((item) => item.state === 'live' || item.state === 'blocked');
  const madeThisWeek = items.filter((item) => withinWeek(item.createdAt));
  const closed = items
    .filter((item) => item.state === 'done' && item.closedBy?.at && withinWeek(item.closedBy.at))
    .sort((a, b) => (a.closedBy.at < b.closedBy.at ? 1 : -1));

  const perWeek = new Map();
  for (const item of items) {
    if (item.rule !== 'first-person-promise') continue;
    const key = weekKeyOf(item.createdAt);
    if (!key) continue;
    perWeek.set(key, (perWeek.get(key) || 0) + 1);
  }

  const longest = open.reduce((max, item) => Math.max(max, item.age), 0);
  const ranked = open
    .map((item) => ({
      id: item.id,
      openDays: item.age,
      ...slipSignal(item, perWeek.get(weekKeyOf(item.createdAt)) || 1),
    }))
    .sort((a, b) => a.rank - b.rank || b.openDays - a.openDays);

  const todo = db.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(completed),0) AS done FROM bee_todos').get();
  const norms = normsOf(db);

  const kinds = new Map();
  for (const item of items) kinds.set(item.sourceKind, (kinds.get(item.sourceKind) || 0) + 1);

  // Four week buckets, newest first, counted by how long the item has been open
  // for the open ones and by when it closed for the settled ones. The last
  // bucket has no upper edge, so every item lands in exactly one bucket. The
  // Twin selects by the same four buckets, and the two screens have to agree.
  const weeks = [];
  for (let week = 0; week < 4; week += 1) {
    const from = week * 7;
    const to = from + 7;
    const inBucket = (value) => {
      const stamp = new Date(value).getTime();
      if (!Number.isFinite(stamp)) return false;
      const days = (now - stamp) / 86_400_000;
      return week === 3 ? days >= from : days >= from && days < to;
    };
    weeks.push({
      week,
      label: week === 0 ? 'This week' : week === 1 ? 'Last week' : week === 3 ? '3+ weeks ago' : `${week} weeks ago`,
      open: open.filter((item) => inBucket(item.createdAt)).length,
      kept: items.filter((item) => item.state === 'done' && item.closedBy?.at && inBucket(item.closedBy.at)).length,
      slipped: items.filter(
        (item) =>
          ['obsolete', 'forgotten'].includes(item.state) &&
          item.closedBy?.at &&
          item.closedBy?.source !== 'merge' &&
          inBucket(item.closedBy.at),
      ).length,
    });
  }

  // The same words recorded more than once. Bee writes a todo again every time
  // a conversation mentions it, so one task can arrive three times. Merging
  // keeps one row and retires the copies, which is the only action on this
  // screen that visibly lowers the count.
  const duplicateGroups = new Map();
  for (const item of open) {
    const key = item.title.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key) continue;
    if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
    duplicateGroups.get(key).push(item);
  }
  const duplicates = [...duplicateGroups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      text: group[0].title,
      count: group.length,
      ids: group.map((item) => item.id).sort(),
      openDays: Math.max(...group.map((item) => item.age)),
    }))
    .sort((a, b) => b.count - a.count || b.openDays - a.openDays);

  const hour = new Date().getHours();
  return {
    windowDays: 7,
    greeting: hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening',
    /**
     * Bee's API exposes completed conversations, not a live stream, so there is
     * nothing to listen to. The card that would show it renders its empty state.
     */
    listening: null,
    weeks,
    madeThisWeek: madeThisWeek.length,
    fromConversations: madeThisWeek.filter((item) => item.sourceKind !== 'todo').length,
    openCount: open.length,
    duplicates,
    duplicateRows: duplicates.reduce((total, group) => total + group.count - 1, 0),
    likelyToSlip: ranked.slice(0, 8).map((entry) => ({
      ...entry,
      bar: longest ? Math.round((entry.openDays / longest) * 100) : 0,
    })),
    strongestOpenDays: longest,
    signalled: ranked.filter((entry) => entry.rank < 3).length,
    closedThisWeek: closed.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.title,
      proof: item.closedBy?.source === 'bee.todo' ? 'Bee marked the whole todo complete' : 'Closed by you here',
      at: item.closedBy?.at || null,
    })),
    closedThisWeekTotal: closed.length,
    // The one honest base rate in the data: Bee's own completed/not-completed flag.
    baseRate:
      todo.total > 0
        ? { done: todo.done, total: todo.total, rate: todo.done / todo.total, source: 'Bee todos' }
        : null,
    capacity: {
      open: open.length,
      norm: norms.norm,
      provisional: norms.provisional,
      days: norms.days,
      minimumDays: norms.minimumDays,
    },
    kinds: [...kinds].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    /** No completion model has been fitted, so no per-item risk exists. */
    risk: { available: false, why: 'No completion model has been fitted yet. The reason below is read from the record.' },
  };
}

export function recordOf(db, items) {
  const todo = db.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(completed),0) AS done FROM bee_todos').get();
  const settled = items.filter((item) => ['done', 'obsolete', 'forgotten'].includes(item.state));
  const done = items.filter((item) => item.state === 'done');

  const classes = new Map();
  for (const item of items) {
    const key = item.rule || 'unclassified';
    if (!classes.has(key)) classes.set(key, { rule: key, total: 0, done: 0 });
    const entry = classes.get(key);
    entry.total += 1;
    if (item.state === 'done') entry.done += 1;
  }
  const phrases = [...classes.values()]
    .map((entry) => ({
      rule: entry.rule,
      label: RULE_LABEL[entry.rule] || entry.rule,
      total: entry.total,
      done: entry.done,
      rate: entry.total ? entry.done / entry.total : 0,
      // a rate from fewer than ten cases is not shown at all
      enough: entry.total >= MIN_N,
    }))
    .sort((a, b) => b.total - a.total);

  const audience = new Map();
  for (const item of items) {
    if (!item.person) continue;
    if (!audience.has(item.person)) audience.set(item.person, { person: item.person, total: 0, done: 0 });
    const entry = audience.get(item.person);
    entry.total += 1;
    if (item.state === 'done') entry.done += 1;
  }
  const audiences = [...audience.values()]
    .map((entry) => ({ ...entry, rate: entry.total ? entry.done / entry.total : 0, enough: entry.total >= MIN_N }))
    .sort((a, b) => b.total - a.total);

  const stamps = items.map((item) => new Date(item.createdAt).getTime()).filter(Number.isFinite);
  const first = stamps.length ? new Date(Math.min(...stamps)) : null;
  const last = stamps.length ? new Date(Math.max(...stamps)) : null;
  const days = first && last ? Math.max(1, Math.round((last - first) / 86_400_000)) : 0;

  const aimed = phrases.find((entry) => entry.rule === 'first-person-promise');
  const shared = phrases.find((entry) => entry.rule === 'shared-intent');
  const finding =
    aimed && shared && shared.total > aimed.total
      ? {
          title: 'Most of what you say is not a promise',
          body: `${shared.total} of ${items.length} items are shared wording like “we should”. Only ${aimed.total} are promises in your own voice.`,
        }
      : aimed
        ? {
            title: 'You mostly promise in your own voice',
            body: `${aimed.total} of ${items.length} items are first-person promises. ${shared ? `${shared.total} are shared wording.` : ''}`.trim(),
          }
        : null;

  return {
    span: {
      from: first ? first.toISOString() : null,
      to: last ? last.toISOString() : null,
      days,
    },
    kept: {
      done: done.length,
      settled: settled.length,
      total: items.length,
      // Done out of everything ever recorded, not out of the rows that happen
      // to be settled. The old denominator turned 32 done and 0 retired into
      // "100% kept".
      rate: items.length ? done.length / items.length : null,
    },
    todoRate: todo.total ? { done: todo.done, total: todo.total, rate: todo.done / todo.total } : null,
    phrases,
    audiences,
    minimumN: MIN_N,
    hiddenPhrases: phrases.filter((entry) => !entry.enough).length,
    /**
     * Bee's API returns a boolean for a todo and no timestamp for the moment it
     * was completed, so hour-of-day follow-through is not derivable.
     */
    hours: {
      available: false,
      why: 'Bee reports whether a todo is complete, not when it was completed, so this cannot be computed.',
    },
    /** Held-out scores only exist once the decision pipeline has run on labels. */
    calibration: {
      available: false,
      why: 'No held-out set yet. Export commitments with npm run labels:export, label them, then fit the curve.',
    },
    finding,
  };
}

export function trustOf(db) {
  const privacy = privacyOf(db);
  const rows = db
    .prepare(
      `SELECT id, start_time, utterances_kept, utterances_dropped_other, utterances_dropped_empty,
              redaction, short_summary
         FROM conversations
        ORDER BY start_time DESC`,
    )
    .all();

  // The transcript as it is actually stored, read back out of the table the app
  // wrote. This is the point of the screen: it is the same text the extractor
  // saw, so a reader can check the rule against the record rather than trust a
  // description of it.
  const newest = rows[0];
  const transcript = newest
    ? db
        .prepare(
          `SELECT speaker, text FROM utterances
            WHERE conversation_id = ?
            ORDER BY COALESCE(start, 0) ASC
            LIMIT 5`,
        )
        .all(String(newest.id))
        .map((row) => ({
          speaker: 'you',
          label: row.speaker || null,
          text: String(row.text || '').replace(/\s+/g, ' ').trim(),
        }))
    : [];

  return {
    ...privacy,
    conversationCount: rows.length,
    // Speakers other than the wearer are discarded before storage, so by
    // construction nothing in the database belongs to anyone else.
    othersRetained: 0,
    keptRule: 'Your words and the minimum context around them. Other speakers are dropped before anything is written.',
    transcript,
    preview: false,
    conversationList: rows.map((row) => ({
      id: String(row.id),
      at: row.start_time ? new Date(Number(row.start_time)).toISOString() : null,
      kept: row.utterances_kept,
      droppedOther: row.utterances_dropped_other,
      droppedEmpty: row.utterances_dropped_empty,
      redaction: row.redaction,
      summary: row.short_summary || null,
    })),
  };
}

export function buildLedger(db) {
  const settings = readSettings(db);
  const items = listItems(db);
  const latest = db.prepare('SELECT id, at, event, detail, counts FROM ingest_log ORDER BY at DESC LIMIT 1').get();
  const candidates = bankruptcyCandidates(db);
  return {
    owner: settings.owner,
    timezone: settings.timezone,
    connected: Boolean(settings.owner),
    lastRun: settings.lastRun,
    cursor: settings.cursor,
    sync: latest ? receiptFromIngest(latest) : null,
    stats: statsOf(items),
    privacy: privacyOf(db),
    items,
    plans: listPlans(db),
    receipts: listReceipts(db),
    decisions: DECISIONS,
    options: OPTIONS,
    norms: normsOf(db),
    bankruptcy: { count: candidates.length, ids: candidates.map((item) => item.id) },
    negotiation: negotiationOf(db),
    today: todayOf(db, items),
    record: recordOf(db, items),
    trust: trustOf(db),
    preview: false,
    totals: counts(db),
  };
}
