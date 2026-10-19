// Time-split for predictor evaluation.
//
// Splits commitments by time: older months for training, newer for testing.
// Calculates baseline Brier score (overall completion rate predicted for every item).
//
// Per SCOPE.md: train on older months, test on newer. Never mix.

import { openDb } from './db.mjs';

/**
 * Split commitments by time.
 *
 * splitPoint: ISO date string or month index (e.g., 2026-03 for March 2026)
 *
 * Returns: { train, test, splitPoint }
 */
export function timeSplitCommitments(dbPath, splitPoint) {
  const db = openDb(dbPath);

  const all = db
    .prepare('SELECT * FROM commitments WHERE state IN (?, ?)')
    .all('live', 'done');

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
export function calculateBaselineBrier(commitments) {
  if (commitments.length === 0) return { brier: null, baselineRate: null, count: 0 };

  // Calculate overall completion rate from training data
  const doneCount = commitments.filter((c) => c.state === 'done').length;
  const baselineRate = doneCount / commitments.length;

  // Calculate Brier score on test data
  let sumSquaredError = 0;
  let count = 0;

  for (const c of commitments) {
    if (c.state === 'done') {
      sumSquaredError += Math.pow(1 - baselineRate, 2);
      count += 1;
    } else if (c.state === 'live') {
      // Assume live = not done for baseline calculation
      sumSquaredError += Math.pow(0 - baselineRate, 2);
      count += 1;
    }
    // Unknown excluded
  }

  const brier = count > 0 ? sumSquaredError / count : null;

  return {
    brier,
    baselineRate,
    count,
    doneCount,
    liveCount: commitments.filter((c) => c.state === 'live').length,
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
  const testBaseline = calculateBaselineBrier(test);

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
  console.log(`  Count: ${result.train.count}`);
  console.log(`  Baseline completion rate: ${(result.train.baseline?.baselineRate * 100).toFixed(1)}%`);
  console.log(`  Baseline Brier score: ${result.train.baseline?.brier?.toFixed(4) || 'N/A'}`);
  console.log('');
  console.log('Test set:');
  console.log(`  Count: ${result.test.count}`);
  console.log(`  Baseline completion rate: ${(result.test.baseline?.baselineRate * 100).toFixed(1)}%`);
  console.log(`  Baseline Brier score: ${result.test.baseline?.brier?.toFixed(4) || 'N/A'}`);
  console.log('');
  console.log('Interpretation:');
  console.log('  - Baseline Brier is the score to beat with the predictor');
  console.log('  - Predictor passes only if Brier < baseline AND AUC ≥ 0.6');
  console.log('  - At least 40 labeled test items required');
}
