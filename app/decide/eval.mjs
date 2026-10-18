#!/usr/bin/env node
// Evaluate the decision layer.
//
//   npm run eval
//   npm run eval -- --predictions decide/predictions.json
//
// Compares four methods over one set of rows:
//   Jev alone            argmax of the Jev distribution
//   d1 alone             argmax of the d1 distribution
//   Jev+d1 (policy)      the tier the policy chose
//   LLM-only baseline    a single decision with no second opinion
//
// Every metric is computed from real predictions. With `--predictions` the
// recorded set is re-evaluated offline and deterministically. If the vendors
// are not configured and no predictions file is given, the vendor rows print
// `not configured` and the LLM-only baseline is the deterministic rule
// baseline recorded by evaluate.mjs (from domain.mjs's rule extractor). No
// latency, cost or probability is invented: an unknown metric prints `null`.
//
// Machine-readable results go to decide/eval-results.json.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { distributionErrors, OPTIONS } from './schema.mjs';
import { ece } from './calibrate.mjs';
import { roleConfig } from './provider.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const RULE_RESULTS = path.resolve(root, '..', 'evaluation-results.json');

/** Actions with an external effect. Taking one when it was not warranted is a wrong action. */
export const ACTION_TIERS = ['draft', 'execute'];

const LABEL_TO_ACTION = { done: 'execute', obsolete: 'ignore', forgotten: 'ignore', live: 'remember' };

function normaliseTruth(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (OPTIONS.includes(text)) return text;
  return LABEL_TO_ACTION[text] || null;
}

function topOf(distribution) {
  let best = OPTIONS[0];
  for (const option of OPTIONS) if (distribution[option] > distribution[best]) best = option;
  return { option: best, p: distribution[best] };
}

const mean = (values) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : null);

function metrics(rows) {
  if (!rows.length) {
    return { rows: 0, accuracy: null, wrongActionRate: null, calibrationError: null, latencyMs: null, costPerDecision: null };
  }
  const correct = rows.filter((row) => row.pred === row.truth).length;
  const wrong = rows.filter((row) => ACTION_TIERS.includes(row.pred) && !ACTION_TIERS.includes(row.truth)).length;
  const calibrationPairs = rows
    .filter((row) => typeof row.p === 'number' && Number.isFinite(row.p) && row.p >= 0 && row.p <= 1)
    .map((row) => ({ p: row.p, y: row.pred === row.truth ? 1 : 0 }));
  return {
    rows: rows.length,
    accuracy: correct / rows.length,
    wrongActionRate: wrong / rows.length,
    calibrationError: calibrationPairs.length ? ece(calibrationPairs) : null,
    latencyMs: mean(rows.map((row) => row.latencyMs).filter((value) => Number.isFinite(value))),
    costPerDecision: mean(rows.map((row) => row.cost).filter((value) => Number.isFinite(value))),
  };
}

function readPredictions(file) {
  if (!existsSync(file)) throw new Error(`predictions file not found: ${file}`);
  const document = JSON.parse(readFileSync(file, 'utf8'));
  const rows = Array.isArray(document) ? document : document.rows;
  if (!Array.isArray(rows)) throw new Error(`predictions file has no rows array: ${file}`);
  return { document, rows };
}

/**
 * Build one method's row list.
 * `pick(row)` returns `{pred, p, latencyMs, cost}` or null.
 */
function collect(rows, pick) {
  const usable = [];
  const skipped = { noTruth: 0, noPrediction: 0, invalidDistribution: 0 };
  for (const row of rows) {
    const truth = normaliseTruth(row.truth);
    if (!truth) {
      skipped.noTruth += 1;
      continue;
    }
    let choice = null;
    try {
      choice = pick(row);
    } catch {
      choice = null;
    }
    if (!choice || !OPTIONS.includes(choice.pred)) {
      skipped.noPrediction += 1;
      continue;
    }
    usable.push({
      truth,
      pred: choice.pred,
      p: Number.isFinite(choice.p) ? choice.p : null,
      latencyMs: Number.isFinite(choice.latencyMs) ? choice.latencyMs : null,
      cost: Number.isFinite(choice.cost) ? choice.cost : null,
    });
  }
  return { usable, skipped };
}

function distributionOf(candidate) {
  const distribution = candidate?.distribution ?? candidate;
  if (!distribution || distributionErrors(distribution).length) return null;
  return distribution;
}

/** The recorded rule baseline from evaluate.mjs / domain.mjs, mapped to actions. */
export function ruleBaselineRows(file = RULE_RESULTS) {
  if (!existsSync(file)) return null;
  const document = JSON.parse(readFileSync(file, 'utf8'));
  const results = Array.isArray(document.results) ? document.results : [];
  const rows = [];
  for (const result of results) {
    const truth = normaliseTruth(result.expected);
    const pred = normaliseTruth(result.actual);
    if (!truth || !pred) continue;
    // Rules emit no probability, no latency and no cost: those stay null.
    rows.push({ truth, llm: { tier: pred, p: null, latencyMs: null, cost: null } });
  }
  return rows.length ? rows : null;
}

/**
 * Evaluate every method. Pure and deterministic given its inputs.
 * @returns {{methods: Array, counts: object, notes: string[]}}
 */
export function evaluatePredictions(predictions, { ruleRows = null, configured = {} } = {}) {
  const rows = predictions?.rows ?? [];
  const notes = [];
  const methods = [];

  const spec = [
    {
      name: 'Jev alone',
      role: 'jev',
      pick: (row) => {
        const distribution = distributionOf(row.jev);
        if (!distribution) return null;
        const top = topOf(distribution);
        return { pred: top.option, p: top.p, latencyMs: row.jev?.latencyMs, cost: row.jev?.cost };
      },
    },
    {
      name: 'd1 alone',
      role: 'd1',
      pick: (row) => {
        const distribution = distributionOf(row.d1);
        if (!distribution) return null;
        const top = topOf(distribution);
        return { pred: top.option, p: top.p, latencyMs: row.d1?.latencyMs, cost: row.d1?.cost };
      },
    },
    {
      name: 'Jev+d1 (policy)',
      role: 'both',
      pick: (row) =>
        row.combined?.tier
          ? { pred: row.combined.tier, p: row.combined.p, latencyMs: row.combined.latencyMs, cost: row.combined.cost }
          : null,
    },
  ];

  for (const method of spec) {
    if (!predictions) {
      methods.push({
        method: method.name,
        status: configured[method.role] ? 'no predictions file' : 'not configured',
        rows: 0,
        accuracy: null,
        wrongActionRate: null,
        calibrationError: null,
        latencyMs: null,
        costPerDecision: null,
      });
      continue;
    }
    const { usable, skipped } = collect(rows, method.pick);
    if (!usable.length) {
      methods.push({ method: method.name, status: 'no usable rows', rows: 0, ...emptyMetrics(), skipped });
      continue;
    }
    methods.push({ method: method.name, status: 'ok', ...metrics(usable), skipped });
  }

  // LLM-only baseline: from the predictions file when it recorded one,
  // otherwise from the deterministic rule baseline.
  const llmSource = predictions ? rows : ruleRows;
  if (!llmSource) {
    methods.push({
      method: 'LLM-only baseline',
      status: 'not configured',
      rows: 0,
      ...emptyMetrics(),
    });
  } else {
    const { usable, skipped } = collect(llmSource, (row) =>
      row.llm?.tier ? { pred: row.llm.tier, p: row.llm.p, latencyMs: row.llm.latencyMs, cost: row.llm.cost } : null,
    );
    if (!usable.length) {
      methods.push({ method: 'LLM-only baseline', status: 'no usable rows', rows: 0, ...emptyMetrics(), skipped });
    } else {
      methods.push({
        method: 'LLM-only baseline',
        status: predictions ? 'ok' : 'ok (rule baseline)',
        ...metrics(usable),
        skipped,
      });
      if (!predictions) {
        notes.push(
          'LLM-only baseline row uses evaluation-results.json produced by evaluate.mjs (domain.mjs rule extractor). ' +
            'Rules emit no probability and no timing, so calibration, latency and cost are null.',
        );
      }
    }
  }

  const counts = {
    predictionRows: rows.length,
    withTruth: rows.filter((row) => normaliseTruth(row.truth)).length,
    ruleBaselineRows: ruleRows ? ruleRows.length : 0,
  };
  return { methods, counts, notes };
}

function emptyMetrics() {
  return { accuracy: null, wrongActionRate: null, calibrationError: null, latencyMs: null, costPerDecision: null };
}

const fmtRate = (value) => (value === null ? 'null' : value.toFixed(3));
const fmtMs = (value) => (value === null ? 'null' : value.toFixed(1));
const fmtCost = (value) => (value === null ? 'null' : value.toFixed(6));

/** Render the fixed-width table the spec asks for. */
export function formatTable(methods) {
  const headers = ['method', 'accuracy', 'wrong-action', 'cal. error', 'latency (ms)', 'cost/decision (USD)'];
  const rows = methods.map((m) => [
    m.method,
    m.status === 'ok' || m.status?.startsWith('ok') ? fmtRate(m.accuracy) : m.status,
    fmtRate(m.wrongActionRate),
    m.calibrationError === null ? 'null' : m.calibrationError.toFixed(4),
    fmtMs(m.latencyMs),
    fmtCost(m.costPerDecision),
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index].length)),
  );
  const line = (cells) => cells.map((cell, index) => cell.padEnd(widths[index])).join('  ');
  return [line(headers), widths.map((width) => '-'.repeat(width)).join('  '), ...rows.map(line)].join('\n');
}

export function parseArgs(argv) {
  const options = {
    predictions: null,
    out: path.resolve(root, 'eval-results.json'),
    env: process.env,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--predictions') options.predictions = argv[++i];
    else if (argv[i] === '--out') options.out = argv[++i];
    else if (argv[i] === '--quiet') options.quiet = true;
    else if (argv[i] === '--help' || argv[i] === '-h') options.help = true;
  }
  return options;
}

export async function runEval(options = {}) {
  const env = options.env || process.env;
  const configured = {
    jev: roleConfig('jev', env).configured,
    d1: roleConfig('d1', env).configured,
    both: roleConfig('jev', env).configured && roleConfig('d1', env).configured,
  };

  let predictions = null;
  let predictionsFile = options.predictions;
  if (!predictionsFile) {
    const fallback = path.resolve(root, 'predictions.json');
    if (existsSync(fallback)) predictionsFile = fallback;
  }
  if (predictionsFile) predictions = readPredictions(predictionsFile);

  const ruleRows = ruleBaselineRows();
  const report = evaluatePredictions(predictions, { ruleRows, configured });
  const output = {
    generatedAt: new Date().toISOString(),
    source: 'decide/eval.mjs',
    predictionsFile: predictionsFile || null,
    configured,
    counts: report.counts,
    methods: report.methods,
    notes: report.notes,
  };
  writeFileSync(options.out, `${JSON.stringify(output, null, 2)}\n`);

  if (!options.quiet) {
    console.log(formatTable(report.methods));
    for (const note of report.notes) console.log(`\nnote: ${note}`);
    if (!predictions) {
      console.log(
        '\nNo predictions file. Record one with `npm run decide -- --predictions decide/predictions.json` ' +
          'once the vendors are configured.',
      );
    }
    console.log(`\nWrote ${options.out}`);
  }
  return output;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('usage: node decide/eval.mjs [--predictions FILE] [--out FILE] [--quiet]');
    process.exit(0);
  }
  runEval(options)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`Eval failed: ${error.message}`);
      process.exit(1);
    });
}
