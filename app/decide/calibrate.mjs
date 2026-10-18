// Real calibrators, fitted on hand labels, plus an ECE implementation.
//
//   temperature scaling  - one positive parameter T; p' = sigmoid(logit(p)/T).
//   isotonic regression  - pool-adjacent-violators; a monotone step function.
//
// Both are fitted on `labels.json` rows and reported as calibration error
// BEFORE and AFTER on the same rows. If no row can be used, the report says
// 'no labelled rows' and prints no number.
//
// Hand-label -> action mapping, and its assumption:
//
//   done      -> execute   a finished commitment is the label that corresponds
//                          to the action "carry it out"
//   obsolete  -> ignore    retired, nothing should follow
//   forgotten -> ignore    retired, nothing should follow
//   live      -> remember  still open; the safe action is to hold it without
//                          taking an external action
//
// Assumption: a hand label records the OUTCOME state the owner observed, not
// the action a policy should have chosen. The mapping above is the only
// defensible correspondence between the two closed sets: it never maps a state
// to 'ask' or 'draft', because a hand label carries no information about
// whether drafting or asking was the right call. Rows that cannot be mapped
// (a null or unrecognised label) are excluded, and the count of exclusions is
// reported per reason.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPTIONS } from './schema.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

export const LABEL_TO_ACTION = Object.freeze({
  done: 'execute',
  obsolete: 'ignore',
  forgotten: 'ignore',
  live: 'remember',
});

export function mapHandLabel(label) {
  if (typeof label !== 'string') return null;
  return LABEL_TO_ACTION[label.trim().toLowerCase()] || null;
}

const EPS = 1e-6;
const clampP = (p) => Math.min(1 - EPS, Math.max(EPS, p));
export const logit = (p) => Math.log(clampP(p) / (1 - clampP(p)));
export const sigmoid = (z) => 1 / (1 + Math.exp(-z));

export const clamp01 = (p) => Math.min(1, Math.max(0, p));

/** Temperature scaling in probability space: p' = sigmoid(logit(p) / T). */
export function applyTemperature(p, T) {
  if (!Number.isFinite(T) || T <= 0) return clamp01(p);
  return sigmoid(logit(p) / T);
}

/** Mean negative log-likelihood of a set of `{p, y}` pairs. */
export function logLoss(pairs) {
  if (!pairs.length) return null;
  let total = 0;
  for (const { p, y } of pairs) {
    const q = clampP(p);
    total += -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
  }
  return total / pairs.length;
}

/**
 * Expected calibration error over `bins` equal-width confidence bins.
 * `y` is 1 when the decision was right. Returns null for an empty set.
 */
export function ece(pairs, bins = 10) {
  if (!pairs.length) return null;
  let total = 0;
  for (let i = 0; i < bins; i += 1) {
    const lo = i / bins;
    const hi = (i + 1) / bins;
    const bin = pairs.filter(({ p }) => p >= lo && (i === bins - 1 ? p <= hi : p < hi));
    if (!bin.length) continue;
    const confidence = bin.reduce((sum, pair) => sum + pair.p, 0) / bin.length;
    const accuracy = bin.reduce((sum, pair) => sum + pair.y, 0) / bin.length;
    total += (bin.length / pairs.length) * Math.abs(accuracy - confidence);
  }
  return total;
}

/**
 * Fit temperature by minimising mean log-loss on a deterministic grid.
 * Deterministic: fixed candidates, fixed tie-break (smaller T wins).
 */
export function fitTemperature(pairs) {
  if (!pairs.length) return 1;
  let bestT = 1;
  let bestLoss = Infinity;
  for (let i = 0; i <= 400; i += 1) {
    // log-spaced candidates from 0.05 to 20
    const T = 0.05 * (20 / 0.05) ** (i / 400);
    const loss = logLoss(pairs.map(({ p, y }) => ({ p: applyTemperature(p, T), y })));
    if (loss < bestLoss - 1e-12) {
      bestLoss = loss;
      bestT = T;
    }
  }
  return bestT;
}

/**
 * Fit isotonic regression with the pool-adjacent-violators algorithm.
 * Returns `{ kind: 'isotonic', blocks: [{p, y}] }` with non-decreasing `y`.
 */
export function fitIsotonic(pairs) {
  // Group identical input probabilities first, so a fitted function never
  // returns two different values for the same `p`.
  const byP = new Map();
  for (const { p, y } of pairs) {
    const key = clamp01(p);
    const entry = byP.get(key) || { p: key, sum: 0, n: 0 };
    entry.sum += y;
    entry.n += 1;
    byP.set(key, entry);
  }
  const groups = [...byP.values()].sort((a, b) => a.p - b.p);
  const blocks = [];
  for (const group of groups) {
    blocks.push({ sum: group.sum, n: group.n, p: group.p });
    while (blocks.length > 1) {
      const last = blocks[blocks.length - 1];
      const prev = blocks[blocks.length - 2];
      if (prev.sum / prev.n > last.sum / last.n) {
        blocks.pop();
        blocks.pop();
        blocks.push({ sum: prev.sum + last.sum, n: prev.n + last.n, p: last.p });
      } else break;
    }
  }
  return { kind: 'isotonic', blocks: blocks.map((block) => ({ p: block.p, y: block.sum / block.n })) };
}

/** Evaluate a fitted isotonic step function. Monotone non-decreasing in p. */
export function applyIsotonic(model, p) {
  const blocks = model?.blocks;
  if (!Array.isArray(blocks) || !blocks.length) return clamp01(p);
  let value = blocks[0].y;
  for (const block of blocks) {
    if (p >= block.p) value = block.y;
    else break;
  }
  return value;
}

/** Is the calibrated value non-decreasing as the input probability increases? */
export function isMonotone(apply, pairs, steps = 200) {
  const sorted = pairs.map(({ p }) => p).sort((a, b) => a - b);
  if (sorted.length < 2) return true;
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  let previous = -Infinity;
  for (let i = 0; i <= steps; i += 1) {
    const p = lo + ((hi - lo) * i) / steps;
    const value = apply(p);
    if (value < previous - 1e-9) return false;
    previous = value;
  }
  return true;
}

/**
 * Turn label rows into `{id, p, y}` calibration pairs.
 * y = 1 when the row's chosen tier matches the mapped hand label.
 */
export function usablePairs(rows) {
  const pairs = [];
  const excludedByReason = {};
  const bump = (reason) => {
    excludedByReason[reason] = (excludedByReason[reason] || 0) + 1;
  };
  for (const row of Array.isArray(rows) ? rows : []) {
    const action = mapHandLabel(row?.label);
    if (!action) {
      bump('unmapped-label');
      continue;
    }
    const p = row?.p;
    if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) {
      bump('no-probability');
      continue;
    }
    if (!OPTIONS.includes(row?.tier)) {
      bump('no-predicted-tier');
      continue;
    }
    pairs.push({ id: row.id ?? null, p, y: row.tier === action ? 1 : 0 });
  }
  const total = Array.isArray(rows) ? rows.length : 0;
  return {
    pairs,
    total,
    usable: pairs.length,
    excluded: total - pairs.length,
    excludedByReason,
  };
}

/**
 * Calibration report on the same rows for both methods.
 * @returns {{status: 'ok'|'no labelled rows', ...}}
 */
export function calibrationReport(rows) {
  const { pairs, ...counts } = usablePairs(rows);
  const base = { ...counts, mapping: { ...LABEL_TO_ACTION } };
  if (!pairs.length) return { status: 'no labelled rows', ...base };

  const T = fitTemperature(pairs);
  const temperaturePairs = pairs.map(({ p, y }) => ({ p: applyTemperature(p, T), y }));
  const isotonic = fitIsotonic(pairs);
  const isotonicPairs = pairs.map(({ p, y }) => ({ p: applyIsotonic(isotonic, p), y }));

  return {
    status: 'ok',
    ...base,
    eceBefore: ece(pairs),
    temperature: {
      T,
      eceBefore: ece(pairs),
      eceAfter: ece(temperaturePairs),
      logLossBefore: logLoss(pairs),
      logLossAfter: logLoss(temperaturePairs),
      monotone: isMonotone((p) => applyTemperature(p, T), pairs),
    },
    isotonic: {
      eceBefore: ece(pairs),
      eceAfter: ece(isotonicPairs),
      logLossBefore: logLoss(pairs),
      logLossAfter: logLoss(isotonicPairs),
      steps: isotonic.blocks.length,
      monotone: isMonotone((p) => applyIsotonic(isotonic, p), pairs),
    },
  };
}

export function loadLabelRows(file) {
  const document = JSON.parse(readFileSync(file, 'utf8'));
  const rows = Array.isArray(document) ? document : document.rows;
  return Array.isArray(rows) ? rows : [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let labelsPath = path.resolve(root, '..', 'labels.json');
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--labels') labelsPath = args[i + 1];
  }
  const report = calibrationReport(loadLabelRows(labelsPath));
  if (report.status !== 'ok') {
    // Required wording: no number is printed when no row is usable.
    console.log('no labelled rows');
    process.exit(0);
  }
  console.log(`calibration on ${report.usable} usable rows (${report.excluded} excluded)`);
  console.log(`  excluded: ${JSON.stringify(report.excludedByReason)}`);
  console.log(`  temperature T=${report.temperature.T.toFixed(4)}`);
  console.log(`    ECE before ${report.eceBefore.toFixed(4)} -> after ${report.temperature.eceAfter.toFixed(4)}`);
  console.log(`    monotone ${report.temperature.monotone}`);
  console.log(`  isotonic (${report.isotonic.steps} steps)`);
  console.log(`    ECE before ${report.eceBefore.toFixed(4)} -> after ${report.isotonic.eceAfter.toFixed(4)}`);
  console.log(`    monotone ${report.isotonic.monotone}`);
}
