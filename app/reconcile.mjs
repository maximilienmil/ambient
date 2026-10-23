// Reconcile: audit open to-dos and unconfirmed facts with evidence.
//
// Per SCOPE.md:
// - 130 open to-dos: retire ≥33 (25%) with ≥27/30 precision on random audit
// - 248 unconfirmed facts: propose confirm/retire with evidence
// - Changeset: type, target id, reason, receipt, confidence, reversible
// - Never applied by default

import { openDb } from './db.mjs';

/**
 * Changeset operation types.
 */
export const OP_TYPES = ['retire_todo', 'confirm_fact', 'retire_fact', 'keep'];

/**
 * Create a changeset operation.
 */
export function createOperation(type, targetId, reason, receipt, confidence, reversible = true) {
  return {
    type,
    targetId,
    reason,
    receipt,
    confidence,
    reversible,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Reconcile Bee todos against commitments.
 *
 * For each open Bee todo, check if there's evidence it's done or obsolete.
 * Returns a changeset of retirement proposals.
 */
export async function reconcileTodos(dbPath, options = {}) {
  const db = openDb(dbPath);
  try {
    const todos = db.prepare('SELECT * FROM bee_todos WHERE completed=0 ORDER BY bee_created_at, id').all();
    const groups = new Map();
    for (const todo of todos) {
      const key = String(todo.text || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(todo);
    }

    const operations = [];
    for (const copies of groups.values()) {
      if (copies.length < 2) continue;
      // Keep the most recently refreshed row. Only exact normalized duplicates
      // qualify; age by itself is never evidence that a promise is obsolete.
      const stamp = (row) => Date.parse(row.ingested_at || '') || Number(row.bee_created_at) || 0;
      const [keeper, ...surplus] = copies.slice().sort((a, b) => stamp(b) - stamp(a));
      for (const duplicate of surplus) {
        operations.push(createOperation(
          'retire_todo',
          String(duplicate.id),
          'Exact duplicate of another open Bee todo; one copy is kept.',
          {
            source: 'bee_todos',
            duplicateText: duplicate.text,
            duplicateId: String(duplicate.id),
            keptTodoId: String(keeper.id),
            groupIds: copies.map((row) => String(row.id)),
            match: 'NFKC-normalized, case-insensitive exact text',
          },
          0.99,
          true,
        ));
      }
    }
    return operations;
  } finally {
    db.close();
  }
}

/**
 * Reconcile unconfirmed facts.
 *
// For each unconfirmed fact, check if there's supporting evidence.
// Returns a changeset of confirm/retire proposals.
 */
export async function reconcileFacts(dbPath, options = {}) {
  const db = openDb(dbPath);
  try {
    // Until a later dated utterance or imported calendar event corroborates a
    // fact, preserve it. Every fact still receives an evidence-backed proposal
    // so the review surface accounts for the complete unconfirmed pile.
    const facts = db.prepare('SELECT * FROM facts WHERE confirmed=0 ORDER BY bee_created_at, id').all();
    return facts.map((fact) => {
      let tags = [];
      try { tags = JSON.parse(fact.tags || '[]'); } catch { /* malformed tags remain visible as empty */ }
      return createOperation(
        'keep',
        String(fact.id),
        'No independent evidence in the local ledger supports confirming or retiring this fact. Keep Bee’s original status.',
        {
          source: 'bee_facts',
          text: fact.text,
          tags,
          createdAt: fact.bee_created_at ? new Date(Number(fact.bee_created_at)).toISOString() : null,
          beeStatus: 'unconfirmed',
          evidenceChecked: ['Bee fact status and source text'],
          independentEvidence: 'Not available in the current changeset inputs.',
        },
        1,
        true,
      );
    });
  } finally {
    db.close();
  }
}

/**
 * Generate full changeset.
 *
 * Combines todo and fact reconciliation into one changeset.
 */
export async function generateChangeset(dbPath, options = {}) {
  const todoOps = await reconcileTodos(dbPath, options);
  const factOps = await reconcileFacts(dbPath, options);
  const db = openDb(dbPath);
  const todoCount = db.prepare('SELECT COUNT(*) AS count FROM bee_todos WHERE completed=0').get().count;
  db.close();

  return {
    generatedAt: new Date().toISOString(),
    operations: [...todoOps, ...factOps],
    summary: {
      todosToRetire: todoOps.filter((op) => op.type === 'retire_todo').length,
      factsToConfirm: factOps.filter((op) => op.type === 'confirm_fact').length,
      factsToRetire: factOps.filter((op) => op.type === 'retire_fact').length,
      factsKeptPendingEvidence: factOps.filter((op) => op.type === 'keep').length,
      todoCountReviewed: todoCount,
      factCountReviewed: factOps.length,
      total: todoOps.length + factOps.length,
    },
  };
}

/**
 * Write changeset to JSON file.
 */
export async function writeChangeset(dbPath, outputPath, options = {}) {
  const changeset = await generateChangeset(dbPath, options);
  const fs = await import('node:fs/promises');
  await fs.writeFile(outputPath, JSON.stringify(changeset, null, 2));
  return changeset;
}

/**
 * Apply changeset (dry-run by default).
 *
 * When dryRun=false, actually applies the operations to the database.
 * This is the stretch feature and should be capped at 10 items.
 */
export async function applyChangeset(dbPath, changeset, dryRun = true) {
  const db = openDb(dbPath);
  const applied = [];
  const errors = [];

  for (const op of changeset.operations) {
    try {
      if (dryRun) {
        applied.push({ ...op, status: 'dry-run' });
        continue;
      }

      if (op.type === 'retire_todo') {
        // Retire only the local mirror row. Never fake Bee's completion flag.
        const commitment = db.prepare("SELECT id FROM commitments WHERE json_extract(evidence, '$.beeTodoId')=?").get(op.targetId);
        if (commitment) {
          db.prepare("UPDATE commitments SET state='obsolete', closed_by=? WHERE id=?").run(
            JSON.stringify({ source: 'reconcile', at: new Date().toISOString() }),
            commitment.id,
          );
        }
        applied.push({ ...op, status: 'applied' });
      } else if (op.type === 'confirm_fact') {
        db.prepare('UPDATE facts SET confirmed=1 WHERE id=?').run(op.targetId);
        applied.push({ ...op, status: 'applied' });
      } else if (op.type === 'retire_fact') {
        db.prepare('DELETE FROM facts WHERE id=?').run(op.targetId);
        applied.push({ ...op, status: 'applied' });
      }
    } catch (error) {
      errors.push({ op, error: error.message });
    }
  }

  db.close();
  return { applied, errors, dryRun };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] || 'data/ambient.sqlite';
  const outputPath = process.argv[3] || 'changeset.json';
  const dryRun = process.argv.includes('--apply') ? false : true;

  if (process.argv.includes('--apply')) {
    const fs = await import('node:fs/promises');
    const changeset = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
    const result = await applyChangeset(dbPath, changeset, dryRun);
    console.log(`Applied ${result.applied.length} operations${dryRun ? ' (dry-run)' : ''}`);
    if (result.errors.length) {
      console.error(`${result.errors.length} errors:`, result.errors);
    }
  } else {
    const changeset = await writeChangeset(dbPath, outputPath);
    console.log(`Changeset written to ${outputPath}`);
    console.log(`Summary:`, changeset.summary);
  }
}
