#!/usr/bin/env node
// Dump a random sample of commitments so they can be hand-labelled.
//
//   npm run labels:export           30 random commitments -> labels.json
//   npm run labels:export -- --n 50 --out /tmp/round1.json
//
// Fill in each row's `label` with one of: done | obsolete | live | forgotten.
// Re-running keeps labels already filled in for ids that come back in the sample.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, STATES } from './db.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const options = { n: 30, out: path.join(root, 'labels.json') };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--n') options.n = Math.max(1, Number(argv[++i]) || 30);
    else if (argv[i] === '--out') options.out = argv[++i];
  }
  return options;
}

function readExisting(outPath) {
  try {
    const prior = JSON.parse(readFileSync(outPath, 'utf8'));
    const rows = Array.isArray(prior) ? prior : prior.rows;
    const map = new Map();
    for (const row of Array.isArray(rows) ? rows : []) if (row?.id) map.set(row.id, row.label ?? null);
    return map;
  } catch {
    return new Map();
  }
}

export function exportLabels({ db, n = 30, out }) {
  const existing = readExisting(out);
  const rows = db
    .prepare(
      `SELECT id, text, quote, owner, counterparty, source_conversation_id AS conversationId,
              created_at AS createdAt, due_at AS dueAt, state, tier, p
       FROM commitments
       ORDER BY RANDOM()
       LIMIT ?`,
    )
    .all(n);

  const payload = rows.map((row) => ({
    id: row.id,
    label: existing.get(row.id) ?? null,
    allowed_labels: STATES.filter((s) => ['live', 'done', 'obsolete', 'forgotten'].includes(s)),
    text: row.text,
    quote: row.quote,
    owner: row.owner,
    counterparty: row.counterparty,
    conversation_id: row.conversationId,
    created_at: row.createdAt,
    due_at: row.dueAt,
    state: row.state,
    tier: row.tier,
    p: row.p,
  }));

  const document = {
    generated_at: new Date().toISOString(),
    instructions:
      'Set each row label to done, obsolete, live or forgotten. Save the file, then run `npm run labels:import` (if wired) or hand it to the evaluator.',
    count: payload.length,
    rows: payload,
  };
  writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`);
  return { out, count: payload.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  const db = openDb(process.env.AMBIENT_DB || path.join(root, 'data', 'ambient.sqlite'));
  try {
    const total = db.prepare('SELECT COUNT(*) AS n FROM commitments').get().n;
    if (total === 0) {
      console.error('No commitments stored yet. Run `npm run ingest` first.');
      process.exit(1);
    }
    const result = exportLabels({ db, n: options.n, out: options.out });
    console.log(`Wrote ${result.count} of ${total} commitments to ${result.out}`);
    console.log('Label each row: done | obsolete | live | forgotten.');
  } finally {
    db.close();
  }
}
