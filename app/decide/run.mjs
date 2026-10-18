#!/usr/bin/env node
// Decide: read unscored commitments, build evidence, score with Jev and d1,
// apply the policy, and write the verdict back to SQLite.
//
//   npm run decide                     score every unscored commitment
//   npm run decide -- --limit 20       cap the batch
//   npm run decide -- --dry-run        score but write nothing
//   npm run decide -- --predictions decide/predictions.json
//
// If either decision model is not configured, this prints exactly which env
// vars are missing and exits non-zero WITHOUT writing anything. It never
// invents a probability, latency or cost.
//
// The models are called through decide/provider.mjs, which speaks the
// documented OpenAI Chat Completions contract
// (https://platform.openai.com/docs/api-reference/chat/create).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { openDb, writeDecision } from '../db.mjs';
import { describeRole, roleConfig } from './provider.mjs';
import { buildEvidence, resolveSignals } from './evidence.mjs';
import { scoreEvidence } from './score.mjs';
import { decide } from './policy.mjs';
import { OPTIONS } from './schema.mjs';
import { mapHandLabel } from './calibrate.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

const HELP = `Latent · decide

  node decide/run.mjs [options]

  --db PATH              SQLite file (default app/data/latent.sqlite)
  --limit N              score at most N unscored commitments
  --dry-run              score but write nothing back
  --predictions PATH     also write the scored batch as an eval prediction set
  --labels PATH          hand labels to attach as truth (default app/labels.json)
  --quiet                only print the final count

Env (per role): <ROLE>_BASE_URL, <ROLE>_API_KEY, <ROLE>_MODEL, and optionally
<ROLE>_PRICE_IN / <ROLE>_PRICE_OUT in USD per million tokens, <ROLE>_TIMEOUT_MS.
Roles: JEV, D1 (and EXTRACT for decide/extract.mjs).
`;

export function parseArgs(argv) {
  const options = {
    db: process.env.LATENT_DB || path.resolve(root, '..', 'data', 'latent.sqlite'),
    limit: null,
    dryRun: false,
    predictions: null,
    labels: path.resolve(root, '..', 'labels.json'),
    quiet: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--db') options.db = argv[++i];
    else if (arg === '--limit') options.limit = Number(argv[++i]) || null;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--predictions') options.predictions = argv[++i];
    else if (arg === '--labels') options.labels = argv[++i];
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
  }
  return options;
}

const UNSCORED_SQL = `SELECT id, text, quote, owner, counterparty, source_conversation_id,
                             span_start, span_end, created_at, due_at, state, tier, p,
                             jev_scores, d1_scores, evidence
                      FROM commitments
                      WHERE p IS NULL
                        AND (jev_scores IS NULL OR jev_scores = '{}' OR jev_scores = '')
                        AND (d1_scores IS NULL OR d1_scores = '{}' OR d1_scores = '')
                      ORDER BY created_at DESC, id ASC`;

/** Unscored = no model has written a probability or a score blob yet. */
export function listUnscored(db, { limit = null } = {}) {
  return limit ? db.prepare(`${UNSCORED_SQL} LIMIT ?`).all(limit) : db.prepare(UNSCORED_SQL).all();
}

function parseEvidence(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Run the whole decision for one row, without touching the database.
 * Returns `{tier, p, reason, jev, d1, evidence, usage, latencyMs, cost}`.
 */
export async function runDecision({
  row,
  extraction = null,
  signals = null,
  clients = {},
  env = process.env,
  fetchImpl = null,
  timeoutMs = null,
  options = OPTIONS,
} = {}) {
  const facts = parseEvidence(row?.evidence);
  const injection = facts.injection?.rejected
    ? facts.injection
    : extraction?.rejected
      ? { rejected: true, rule: extraction.rule ?? null, reason: extraction.reason ?? null }
      : null;
  const evidence = buildEvidence(row, {
    extraction: extraction?.ok ? extraction.extraction : null,
    signals,
    injection,
  });

  // A refused span is never scored: no model call, no probability.
  if (injection) {
    const decision = decide({ jev: null, d1: null, evidence });
    return { ...decision, jev: null, d1: null, evidence, usage: null, latencyMs: null, cost: null, scored: false };
  }

  const scores = await scoreEvidence(evidence, { clients, env, fetchImpl, timeoutMs, options });
  const decision = decide({ jev: scores.jev.distribution, d1: scores.d1.distribution, evidence });
  return {
    ...decision,
    jev: scores.jev,
    d1: scores.d1,
    evidence,
    usage: scores.usage,
    latencyMs: scores.latencyMs,
    cost: scores.cost,
    scored: true,
  };
}

function scoreRow(row, model) {
  return {
    distribution: model.distribution,
    top: model.top,
    topProbability: model.topProbability,
    model: model.model,
    usage: model.usage,
    latencyMs: model.latencyMs,
    cost: model.cost,
  };
}

function loadTruth(labelsPath) {
  try {
    const document = JSON.parse(readFileSync(labelsPath, 'utf8'));
    const rows = Array.isArray(document) ? document : document.rows;
    const map = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const action = mapHandLabel(row?.label);
      if (row?.id && action) map.set(row.id, action);
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Score a batch. Split from the CLI so tests can drive it with injected clients.
 * Returns `{ok, decided, notConfigured, missingByRole, predictions, log}`.
 */
export async function runDecide(options = {}, deps = {}) {
  const env = options.env || deps.env || process.env;
  const log = [];
  const emit = (line) => {
    log.push(line);
    if (!options.quiet) console.log(line);
  };

  // Configuration is checked BEFORE the database is touched. Nothing is written.
  const configs = ['jev', 'd1'].map((role) => roleConfig(role, env));
  const missingByRole = configs
    .filter((config) => !config.configured)
    .map((config) => ({ role: config.role, missing: config.missing }));
  if (missingByRole.length) {
    for (const { role, missing } of missingByRole) {
      console.error(`not configured: ${role} — missing ${missing.join(', ')}`);
    }
    console.error('See decide/README.md. Nothing was written.');
    return { ok: false, reason: 'not-configured', missingByRole, decided: 0, predictions: null, log };
  }

  for (const role of ['jev', 'd1']) {
    const description = describeRole(role, env);
    emit(`configured: ${role} -> ${description.baseUrl} (${description.model})${description.priced ? '' : ' · price unset, cost will be null'}`);
  }

  const ownsDb = !deps.db;
  const db = deps.db || openDb(options.db);
  const truth = loadTruth(options.labels);
  const predictions = { generatedAt: null, source: 'decide/run.mjs', labels: options.labels, rows: [] };
  let decided = 0;

  try {
    const rows = listUnscored(db, { limit: options.limit });
    emit(`unscored commitments: ${rows.length}`);
    if (!rows.length) {
      emit('Nothing to do.');
      return { ok: true, decided: 0, missingByRole: [], predictions: null, log };
    }

    for (const row of rows) {
      const signals = await resolveSignals(options.signals || deps.signals || null, row);
      const result = await runDecision({
        row,
        signals,
        clients: deps.clients || {},
        env,
        fetchImpl: deps.fetchImpl || null,
        timeoutMs: options.timeoutMs || null,
        options: OPTIONS,
      });

      const existing = parseEvidence(row.evidence);
      const evidence = {
        ...existing,
        ...result.evidence,
        decision: {
          tier: result.tier,
          p: result.p,
          reason: result.reason,
          jevTop: result.jev?.top ?? null,
          d1Top: result.d1?.top ?? null,
          model: result.jev?.model ?? null,
          latencyMs: Number.isFinite(result.latencyMs) ? result.latencyMs : null,
          cost: Number.isFinite(result.cost) ? result.cost : null,
          scored: result.scored,
        },
      };

      if (!options.dryRun) {
        writeDecision(db, row.id, {
          tier: result.tier,
          p: result.p,
          jevScores: result.jev ? scoreRow(row, result.jev) : {},
          d1Scores: result.d1 ? scoreRow(row, result.d1) : {},
          evidence,
        });
      }

      const jTop = result.jev?.top ?? '(none)';
      const dTop = result.d1?.top ?? '(none)';
      const pText = result.p === null ? 'null' : result.p.toFixed(3);
      emit(`${row.id}  ${result.tier}  p=${pText}  jev=${jTop}  d1=${dTop}${options.dryRun ? '  (dry-run)' : ''}`);
      decided += 1;

      predictions.rows.push({
        id: row.id,
        truth: truth.get(row.id) ?? null,
        truthSource: truth.has(row.id) ? 'labels.json' : 'unlabelled',
        jev: result.jev ? scoreRow(row, result.jev) : null,
        d1: result.d1 ? scoreRow(row, result.d1) : null,
        combined: {
          tier: result.tier,
          p: result.p,
          latencyMs: Number.isFinite(result.latencyMs) ? result.latencyMs : null,
          cost: Number.isFinite(result.cost) ? result.cost : null,
        },
        // The provisional tier written by the offline rule extractor, if any.
        llm: row.tier ? { tier: row.tier, p: null, latencyMs: null, cost: null } : null,
      });
    }

    emit(`decided: ${decided}${options.dryRun ? ' (nothing written)' : ''}`);

    if (options.predictions && !options.dryRun) {
      predictions.generatedAt = new Date().toISOString();
      const { writeFileSync } = await import('node:fs');
      writeFileSync(options.predictions, `${JSON.stringify(predictions, null, 2)}\n`);
      emit(`predictions written: ${options.predictions}`);
    }

    return { ok: true, decided, missingByRole: [], predictions, log };
  } finally {
    if (ownsDb) db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    process.exit(0);
  }
  runDecide(options)
    .then((result) => process.exit(result.ok ? 0 : 1))
    .catch((error) => {
      console.error(`\nDecide failed: ${error.message}`);
      if (error.code === 'schema_violation') {
        for (const detail of error.errors) console.error(`  ${detail.field}: ${detail.message}`);
      }
      process.exit(1);
    });
}
