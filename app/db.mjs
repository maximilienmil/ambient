// SQLite storage for the ingest layer.
//
// The `commitments` table is the exact schema requested for the ledger. Every
// other table supports it (raw Bee mirrors, retained utterances, ingest state).
//
// Column meanings for the parts that are easy to get wrong:
//   span_start / span_end  character offsets of `quote` inside the retained
//                          utterance text, so a receipt can highlight exact words.
//   state                  live | done | obsolete | blocked | forgotten
//   tier                   ignore | remember | ask | draft | execute (NULL = unscored)
//   p                      calibrated probability; NULL until a model writes it
//   jev_scores / d1_scores JSON from the two decision models; '{}' until scored
//   evidence               JSON provenance (utterance id, speaker, spoken_at, rule, redaction)
//   closed_by              JSON { source, at } when a row leaves `live`

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';

export const STATES = ['live', 'done', 'obsolete', 'blocked', 'forgotten'];
export const TIERS = ['ignore', 'remember', 'ask', 'draft', 'execute'];

export function openDb(dbPath) {
  mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') {
    try {
      chmodSync(dbPath, 0o600);
    } catch {
      /* best effort on platforms without POSIX modes */
    }
  }
  db.exec('PRAGMA journal_mode=WAL');
  db.exec('PRAGMA foreign_keys=ON');
  migrate(db);
  return db;
}

export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS commitments (
      id                     TEXT PRIMARY KEY,
      text                   TEXT NOT NULL,
      quote                  TEXT NOT NULL,
      owner                  TEXT NOT NULL,
      counterparty           TEXT,
      source_conversation_id TEXT,
      span_start             INTEGER,
      span_end               INTEGER,
      created_at             TEXT NOT NULL,
      due_at                 TEXT,
      state                  TEXT NOT NULL DEFAULT 'live'
                             CHECK (state IN ('live','done','obsolete','blocked','forgotten')),
      tier                   TEXT
                             CHECK (tier IS NULL OR tier IN ('ignore','remember','ask','draft','execute')),
      p                      REAL,
      jev_scores             TEXT NOT NULL DEFAULT '{}',
      d1_scores              TEXT NOT NULL DEFAULT '{}',
      evidence               TEXT NOT NULL DEFAULT '{}',
      closed_by              TEXT
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id                        TEXT PRIMARY KEY,
      start_time                INTEGER,
      end_time                  INTEGER,
      device_type               TEXT,
      state                     TEXT,
      short_summary             TEXT,
      utterances_total          INTEGER NOT NULL DEFAULT 0,
      utterances_kept           INTEGER NOT NULL DEFAULT 0,
      utterances_dropped_other  INTEGER NOT NULL DEFAULT 0,
      utterances_dropped_empty  INTEGER NOT NULL DEFAULT 0,
      wearer_label              TEXT,
      redaction                 TEXT,
      dropped_by_speaker        TEXT NOT NULL DEFAULT '{}',
      bee_updated_at            INTEGER,
      ingested_at               TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS utterances (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      speaker         TEXT,
      spoken_at       INTEGER,
      start           REAL,
      end             REAL,
      text            TEXT NOT NULL,
      ingested_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS facts (
      id              TEXT PRIMARY KEY,
      text            TEXT NOT NULL,
      tags            TEXT NOT NULL DEFAULT '[]',
      confirmed       INTEGER NOT NULL DEFAULT 0,
      bee_created_at  INTEGER,
      ingested_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bee_todos (
      id              TEXT PRIMARY KEY,
      text            TEXT NOT NULL,
      alarm_at        INTEGER,
      completed       INTEGER NOT NULL DEFAULT 0,
      bee_created_at  INTEGER,
      corrections     TEXT NOT NULL DEFAULT '[]',
      ingested_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingest_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingest_log (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      at     TEXT NOT NULL,
      event  TEXT NOT NULL,
      detail TEXT,
      counts TEXT
    );

    -- What the wearer decided. The tables above hold what Bee said (facts,
    -- refreshed by the importer); these two hold user actions and are never
    -- rewritten by an ingest pass.
    CREATE TABLE IF NOT EXISTS plans (
      id            TEXT PRIMARY KEY,
      commitment_id TEXT NOT NULL,
      title         TEXT NOT NULL,
      date          TEXT NOT NULL,
      participants  TEXT NOT NULL DEFAULT '[]',
      consent       INTEGER NOT NULL DEFAULT 0,
      approvals     TEXT NOT NULL DEFAULT '{}',
      state         TEXT NOT NULL DEFAULT 'proposed'
                    CHECK (state IN ('proposed','approved','executed','cancelled')),
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id            TEXT PRIMARY KEY,
      at            TEXT NOT NULL,
      kind          TEXT NOT NULL,
      decision      TEXT,
      title         TEXT NOT NULL,
      detail        TEXT NOT NULL,
      commitment_id TEXT,
      plan_id       TEXT
    );

    CREATE INDEX IF NOT EXISTS commitments_state_idx  ON commitments (state);
    CREATE INDEX IF NOT EXISTS commitments_source_idx ON commitments (source_conversation_id);
    CREATE INDEX IF NOT EXISTS utterances_conv_idx    ON utterances (conversation_id);
    CREATE INDEX IF NOT EXISTS plans_commitment_idx   ON plans (commitment_id);
    CREATE INDEX IF NOT EXISTS receipts_at_idx        ON receipts (at DESC);
  `);

  // Rows written before the fix above carry the ingest time in `at`, which made
  // 32 old todos look like they were kept this week. Bee has no completion
  // timestamp, so the date is removed rather than guessed.
  db.exec(`
    UPDATE commitments
       SET closed_by = json_set(closed_by, '$.at', NULL)
     WHERE json_extract(closed_by, '$.source') = 'bee.todo'
       AND json_extract(closed_by, '$.at') IS NOT NULL
  `);
}

const nowIso = () => new Date().toISOString();

export function getState(db, key) {
  const row = db.prepare('SELECT value FROM ingest_state WHERE key=?').get(key);
  return row ? row.value : null;
}

export function setState(db, key, value) {
  db.prepare(
    'INSERT INTO ingest_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
  ).run(key, String(value));
}

export function logEvent(db, event, detail = '', counts = null) {
  db.prepare('INSERT INTO ingest_log (at, event, detail, counts) VALUES (?, ?, ?, ?)').run(
    nowIso(),
    event,
    detail,
    counts ? JSON.stringify(counts) : null,
  );
}

export function upsertConversation(db, conversation, redaction) {
  const at = nowIso();
  db.prepare(
    `INSERT INTO conversations (id, start_time, end_time, device_type, state, short_summary,
        utterances_total, utterances_kept, utterances_dropped_other, utterances_dropped_empty,
        wearer_label, redaction, dropped_by_speaker, bee_updated_at, ingested_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
        start_time=excluded.start_time, end_time=excluded.end_time,
        device_type=excluded.device_type, state=excluded.state,
        short_summary=excluded.short_summary,
        utterances_total=excluded.utterances_total, utterances_kept=excluded.utterances_kept,
        utterances_dropped_other=excluded.utterances_dropped_other,
        utterances_dropped_empty=excluded.utterances_dropped_empty,
        wearer_label=excluded.wearer_label, redaction=excluded.redaction,
        dropped_by_speaker=excluded.dropped_by_speaker,
        bee_updated_at=excluded.bee_updated_at, ingested_at=excluded.ingested_at`,
  ).run(
    String(conversation.id),
    numOrNull(conversation.start_time),
    numOrNull(conversation.end_time),
    strOrNull(conversation.device_type),
    strOrNull(conversation.state),
    strOrNull(conversation.short_summary),
    redaction.dropped.total,
    redaction.dropped.kept,
    redaction.dropped.otherSpeaker,
    redaction.dropped.empty,
    redaction.wearerLabel,
    redaction.resolution,
    JSON.stringify(redaction.dropped.bySpeaker),
    numOrNull(conversation.updated_at),
    at,
  );
}

export function upsertUtterances(db, conversationId, kept) {
  const at = nowIso();
  // Retained text for this conversation is replaced each pass so a corrected
  // transcript on Bee's side cannot leave stale bystander text behind.
  db.prepare('DELETE FROM utterances WHERE conversation_id=?').run(String(conversationId));
  const insert = db.prepare(
    'INSERT OR REPLACE INTO utterances (id, conversation_id, speaker, spoken_at, start, end, text, ingested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  for (const utterance of kept) {
    if (utterance.id === null || utterance.id === undefined) continue;
    insert.run(
      String(utterance.id),
      String(conversationId),
      utterance.speaker ?? null,
      numOrNull(utterance.spokenAt),
      numOrNull(utterance.start),
      numOrNull(utterance.end),
      utterance.text,
      at,
    );
  }
}

/** Insert a commitment if new; otherwise refresh the source-owned fields only. */
export function saveCommitment(db, row) {
  const existing = db.prepare('SELECT id FROM commitments WHERE id=?').get(row.id);
  if (!existing) {
    db.prepare(
      `INSERT INTO commitments (id, text, quote, owner, counterparty, source_conversation_id,
          span_start, span_end, created_at, due_at, state, tier, p, jev_scores, d1_scores, evidence, closed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id,
      row.text,
      row.quote,
      row.owner,
      row.counterparty ?? null,
      row.sourceConversationId ?? null,
      numOrNull(row.spanStart),
      numOrNull(row.spanEnd),
      row.createdAt ?? nowIso(),
      row.dueAt ?? null,
      row.state ?? 'live',
      row.tier ?? null,
      row.p ?? null,
      JSON.stringify(row.jevScores ?? {}),
      JSON.stringify(row.d1Scores ?? {}),
      JSON.stringify(row.evidence ?? {}),
      row.closedBy ? JSON.stringify(row.closedBy) : null,
    );
    return { created: true, updated: false };
  }
  // Never overwrite a stored tier, probability, model score, state or closure —
  // those may have been written by the decision layer or a human. Refresh only
  // what the source owns.
  db.prepare(
    `UPDATE commitments SET
        text=?, quote=?, counterparty=COALESCE(?, counterparty), due_at=COALESCE(?, due_at),
        span_start=?, span_end=?, evidence=?
     WHERE id=?`,
  ).run(
    row.text,
    row.quote,
    row.counterparty ?? null,
    row.dueAt ?? null,
    numOrNull(row.spanStart),
    numOrNull(row.spanEnd),
    JSON.stringify(row.evidence ?? {}),
    row.id,
  );
  return { created: false, updated: true };
}

/**
 * Write the decision layer's verdict back onto a commitment row.
 *
 * Only the five columns the decision layer owns are touched: `tier`, `p`,
 * `jev_scores`, `d1_scores` and `evidence`. `state`, `closed_by` and every
 * source-owned field are left exactly as they were, so a decision pass can be
 * re-run without clobbering a human's resolution.
 *
 * `decision`:
 *   tier       one of TIERS (or null)
 *   p          a probability in [0, 1] (or null when no model was configured)
 *   jevScores  JSON-serialisable object from the Jev model
 *   d1Scores   JSON-serialisable object from the d1 model
 *   evidence   JSON-serialisable evidence block (already merged with provenance)
 */
export function writeDecision(db, id, decision = {}) {
  const p = Number.isFinite(decision.p) ? decision.p : null;
  db.prepare(
    'UPDATE commitments SET tier=?, p=?, jev_scores=?, d1_scores=?, evidence=? WHERE id=?',
  ).run(
    decision.tier ?? null,
    p,
    JSON.stringify(decision.jevScores ?? {}),
    JSON.stringify(decision.d1Scores ?? {}),
    JSON.stringify(decision.evidence ?? {}),
    id,
  );
  const row = db
    .prepare(
      `SELECT id, tier, p, jev_scores AS jevScores, d1_scores AS d1Scores, evidence
       FROM commitments WHERE id=?`,
    )
    .get(id);
  return row
    ? {
        ...row,
        jevScores: parseJson(row.jevScores, {}),
        d1Scores: parseJson(row.d1Scores, {}),
        evidence: parseJson(row.evidence, {}),
      }
    : null;
}

function parseJson(value, fallback) {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Reconcile a Bee todo's completion state with its commitment row.
 * Bee's `completed` flag is authoritative while the row is still owned by Bee.
 */
export function reconcileTodoState(db, id, completed, beeCreatedAt) {
  const row = db.prepare('SELECT state, closed_by FROM commitments WHERE id=?').get(id);
  if (!row) return null;
  const closedBy = row.closed_by ? JSON.parse(row.closed_by) : null;
  const ownedByBee = !closedBy || closedBy.source === 'bee.todo';
  if (completed && row.state === 'live' && ownedByBee) {
    db.prepare('UPDATE commitments SET state=?, closed_by=? WHERE id=?').run(
      'done',
      // Bee exposes a completed flag but no completion time, so the honest
      // value is null. Writing the ingest time here made every old todo look
      // like it had been kept "this week".
      JSON.stringify({ source: 'bee.todo', at: null }),
      id,
    );
    return 'done';
  }
  if (!completed && row.state === 'done' && ownedByBee) {
    db.prepare('UPDATE commitments SET state=?, closed_by=NULL WHERE id=?').run('live', id);
    return 'live';
  }
  return row.state;
}

/**
 * Remove conversation-derived rows that a new redaction pass no longer produces.
 * Only rows still owned by the importer (live, not closed by a human) are
 * removed, so a tightened redaction cannot delete work the user has resolved.
 */
export function removeStaleConversationCommitments(db, conversationId, keepIds) {
  const rows = db
    .prepare("SELECT id FROM commitments WHERE source_conversation_id=? AND state='live' AND closed_by IS NULL")
    .all(String(conversationId));
  const keep = new Set(keepIds);
  const remove = db.prepare('DELETE FROM commitments WHERE id=?');
  let removed = 0;
  for (const row of rows) {
    if (!keep.has(row.id)) {
      remove.run(row.id);
      removed += 1;
    }
  }
  return removed;
}

export function upsertFact(db, fact) {
  db.prepare(
    `INSERT INTO facts (id, text, tags, confirmed, bee_created_at, ingested_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET text=excluded.text, tags=excluded.tags,
       confirmed=excluded.confirmed, bee_created_at=excluded.bee_created_at, ingested_at=excluded.ingested_at`,
  ).run(
    String(fact.id),
    String(fact.text ?? ''),
    JSON.stringify(Array.isArray(fact.tags) ? fact.tags : []),
    fact.confirmed ? 1 : 0,
    numOrNull(fact.created_at),
    nowIso(),
  );
}

export function upsertBeeTodo(db, todo) {
  db.prepare(
    `INSERT INTO bee_todos (id, text, alarm_at, completed, bee_created_at, corrections, ingested_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET text=excluded.text, alarm_at=excluded.alarm_at,
       completed=excluded.completed, bee_created_at=excluded.bee_created_at,
       corrections=excluded.corrections, ingested_at=excluded.ingested_at`,
  ).run(
    String(todo.id),
    String(todo.text ?? ''),
    numOrNull(todo.alarm_at),
    todo.completed ? 1 : 0,
    numOrNull(todo.created_at),
    JSON.stringify(Array.isArray(todo.corrections) ? todo.corrections : []),
    nowIso(),
  );
}

export function counts(db) {
  const one = (sql) => db.prepare(sql).get().n;
  return {
    commitments: one('SELECT COUNT(*) AS n FROM commitments'),
    live: one("SELECT COUNT(*) AS n FROM commitments WHERE state='live'"),
    conversations: one('SELECT COUNT(*) AS n FROM conversations'),
    utterances: one('SELECT COUNT(*) AS n FROM utterances'),
    facts: one('SELECT COUNT(*) AS n FROM facts'),
    beeTodos: one('SELECT COUNT(*) AS n FROM bee_todos'),
  };
}

function numOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function strOrNull(value) {
  return typeof value === 'string' && value ? value : null;
}
