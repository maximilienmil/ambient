// Time-split for predictor evaluation.
//
// Splits commitments by time: older months for training, newer for testing.
// Calculates baseline Brier score (overall completion rate predicted for every item).
//
// Per SCOPE.md: train on older months, test on newer. Never mix.

import { openDb } from './db.mjs';

/**
 * Split commitments by creation time without treating an open row as a failed
 * outcome. Only explicit, independently stored outcome labels are eligible.
 *
 * splitPoint: ISO date string or month index (e.g., 2026-03 for March 2026)
 *
 * Returns: { train, test, splitPoint }
 */
export function timeSplitCommitments(dbPath, splitPoint) {
  const db = openDb(dbPath);

  const all = db.prepare('SELECT * FROM commitments').all();

  const train = [];
  const test = [];

  for (const row of all) {
    const createdAt = new Date(row.created_at);
    const month = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;

    if (month < splitPoint) {
      train.push(row);
    } else {
      test.push(row);
    }
  }

  db.close();
  return { train, test, splitPoint };
}

/**
 * Calculate baseline Brier score.
 *
 * Baseline = overall completion rate predicted for every item.
 * Brier score = mean squared error between predicted probability and actual outcome.
 *
 * Actual outcome: 1 for done, 0 for not-done, excluded for unknown.
 */
function explicitOutcome(commitment) {
  const evidence = typeof commitment.evidence === 'string'
    ? (() => { try { return JSON.parse(commitment.evidence); } catch { return {}; } })()
    : commitment.evidence || {};
  const value = commitment.outcomeLabel ?? evidence.outcomeLabel ?? evidence.outcome;
  if (value === 'done' || value === 1) return 1;
  if (value === 'not-done' || value === 0) return 0;
  return null;
}

export function calculateBaselineBrier(commitments, baselineRate = null) {
  const labeled = commitments.map((commitment) => ({ commitment, outcome: explicitOutcome(commitment) }))
    .filter((row) => row.outcome !== null);
  if (labeled.length === 0) return { brier: null, baselineRate, count: 0, unknownCount: commitments.length };

  const doneCount = labeled.filter((row) => row.outcome === 1).length;
  const rate = baselineRate ?? doneCount / labeled.length;
  let sumSquaredError = 0;
  for (const { outcome } of labeled) {
    sumSquaredError += (outcome - rate) ** 2;
  }
  return {
    brier: sumSquaredError / labeled.length,
    baselineRate: rate,
    count: labeled.length,
    doneCount,
    unknownCount: commitments.length - labeled.length,
  };
}

/**
 * Run time-split evaluation.
 *
 * Returns: { train, test, trainBaseline, testBaseline }
 */
export function evaluateTimeSplit(dbPath, splitPoint) {
  const { train, test, splitPoint: actualSplit } = timeSplitCommitments(dbPath, splitPoint);

  const trainBaseline = calculateBaselineBrier(train);
  // The test baseline uses only the older training period's completion rate.
  const testLabels = calculateBaselineBrier(test);
  const testBaseline = trainBaseline.baselineRate === null
    ? { ...testLabels, brier: null, baselineRate: null }
    : calculateBaselineBrier(test, trainBaseline.baselineRate);
  const status = trainBaseline.count === 0 || testBaseline.count < 40 ? 'cannot_evaluate' : 'baseline_available';
  const reason = trainBaseline.count === 0
    ? 'No explicit, independently supported training labels.'
    : testBaseline.count < 40
      ? 'Fewer than 40 explicit, independently supported test labels.'
      : null;

  return {
    splitPoint: actualSplit,
    train: {
      count: train.length,
      baseline: trainBaseline,
    },
    test: {
      count: test.length,
      baseline: testBaseline,
    },
    status,
    reason,
  };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] || 'data/latent.sqlite';
  const splitPoint = process.argv[3] || '2026-03'; // Default: March 2026

  const result = evaluateTimeSplit(dbPath, splitPoint);

  console.log('Time-split baseline evaluation');
  console.log(`Split point: ${result.splitPoint}`);
  console.log('');
  console.log('Training set:');
  console.log(`  Rows: ${result.train.count}; explicit labels: ${result.train.baseline.count}; unknown: ${result.train.baseline.unknownCount}`);
  console.log(`  Baseline completion rate: ${result.train.baseline.baselineRate === null ? 'N/A' : `${(result.train.baseline.baselineRate * 100).toFixed(1)}%`}`);
  console.log(`  Baseline Brier score: ${result.train.baseline.brier === null ? 'N/A' : result.train.baseline.brier.toFixed(4)}`);
  console.log('');
  console.log('Test set:');
  console.log(`  Rows: ${result.test.count}; explicit labels: ${result.test.baseline.count}; unknown: ${result.test.baseline.unknownCount}`);
  console.log(`  Baseline completion rate: ${result.train.baseline.baselineRate === null ? 'N/A' : `${(result.train.baseline.baselineRate * 100).toFixed(1)}%`}`);
  console.log(`  Baseline Brier score: ${result.test.baseline.brier === null ? 'N/A' : result.test.baseline.brier.toFixed(4)}`);
  console.log('');
  console.log('Interpretation:');
  console.log('  - Baseline Brier is the score to beat with the predictor');
  console.log('  - Predictor passes only if Brier < baseline AND AUC ≥ 0.6');
  console.log('  - At least 40 labeled test items required');
  console.log(`  Result: ${result.status}${result.reason ? ` — ${result.reason}` : ''}`);
}
