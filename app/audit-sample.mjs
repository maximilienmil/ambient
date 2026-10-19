// Generate audit sample for owner's one-time check.
//
// Exports 40 random auto-labeled items for the owner to verify.
// Used to establish labeling accuracy before training the predictor.

import { openDb } from './db.mjs';
import { labelCommitment } from './label.mjs';
import crypto from 'node:crypto';

/**
 * Generate random audit sample.
 *
 * Returns 40 random commitments with their auto-labels.
 */
export async function generateAuditSample(dbPath, options = {}) {
  const db = openDb(dbPath);
  const count = options.count || 40;

  // Get all live commitments
  const commitments = db
    .prepare('SELECT * FROM commitments WHERE state=?')
    .all('live');

  // Shuffle and pick count items
  const shuffled = shuffleArray([...commitments]);
  const sample = shuffled.slice(0, count);

  const audit = [];
  for (const commitment of sample) {
    const label = await labelCommitment(commitment, options);
    audit.push({
      id: commitment.id,
      text: commitment.text,
      quote: commitment.quote,
      dueAt: commitment.dueAt,
      createdAt: commitment.created_at,
      evidence: commitment.evidence,
      autoLabel: label,
      // Owner will fill these in
      ownerVerdict: null,
      ownerNotes: null,
    });
  }

  db.close();
  return audit;
}

/**
 * Write audit sample to JSON file.
 */
export async function writeAuditSample(dbPath, outputPath, options = {}) {
  const audit = await generateAuditSample(dbPath, options);
  const fs = await import('node:fs/promises');
  await fs.writeFile(outputPath, JSON.stringify(audit, null, 2));
  return audit;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(crypto.randomInt(0, i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] || 'data/latent.sqlite';
  const outputPath = process.argv[3] || 'audit-sample.json';
  writeAuditSample(dbPath, outputPath)
    .then((audit) => {
      console.log(`Audit sample written to ${outputPath}`);
      console.log(`Sample size: ${audit.length} items`);
    })
    .catch((error) => {
      console.error('Failed to generate audit sample:', error);
      process.exit(1);
    });
}
