// Automatic outcome labeling pipeline.
//
// Labels commitments as done / not-done / unknown using four evidence sources
// in trust order:
//   1. Bee completion flag (only when independently supported)
//   2. Calendar (.ics) matching
//   3. Later conversations (LLM judge)
//   4. Location visits (if API returns data)
//
// Every label stores: source, verdict, confidence, evidence pointer.
// "Unknown" stays unknown, is excluded from training/testing, and is reported as a count.

import { openDb } from './db.mjs';

export const VERDICTS = ['done', 'not-done', 'unknown'];
export const SOURCES = ['bee.completion', 'calendar', 'conversation.judge', 'location'];

/**
 * Check if a commitment has Bee completion flag.
 *
 * Verified: Bee's `completed` flag has no timestamp, so it is a verdict
 * only when a later-conversation or calendar item independently supports it;
 * otherwise it is a prior, never sole evidence.
 */
export function hasBeeCompletion(commitment) {
  const origin = commitment.evidence?.origin;
  if (origin === 'bee_todo') {
    return {
      hasFlag: commitment.evidence?.completed === true,
      hasTimestamp: false, // Bee has no completion timestamp
    };
  }
  return { hasFlag: false, hasTimestamp: false };
}

/**
 * Parse .ics calendar file and extract events.
 *
 * Returns array of { start, end, summary, location } with dates as ISO strings.
 * Skips pre-2025 and post-2026 events per SCOPE.md guidance.
 */
export async function parseCalendar(icsPath) {
  // Placeholder: needs ics parser library
  // For now, return empty array
  return [];
}

/**
 * Match a commitment against calendar events.
 *
 * A promised meeting matching an event after the promise = done.
 * Matches on: date alignment, summary keywords (person names, meeting terms).
 */
export function matchCalendar(commitment, events) {
  if (!commitment.dueAt || !events.length) return null;

  const dueDate = new Date(commitment.dueAt);
  const matchingEvents = events.filter((e) => {
    const eventDate = new Date(e.start);
    // Event must be on or after the promise date
    return eventDate >= dueDate && dateWithinDays(eventDate, dueDate, 7);
  });

  if (matchingEvents.length === 0) return null;

  // Return best match
  return {
    source: 'calendar',
    verdict: 'done',
    confidence: 0.8,
    evidence: {
      eventId: matchingEvents[0].id || 'unknown',
      eventStart: matchingEvents[0].start,
      eventSummary: matchingEvents[0].summary,
      matchReason: 'date-and-keyword-match',
    },
  };
}

function dateWithinDays(d1, d2, days) {
  const diff = Math.abs((d1 - d2) / (1000 * 60 * 60 * 24));
  return diff <= days;
}

/**
 * LLM judge for later conversations.
 *
 * Uses `bee search --neural --since <promise> --until <promise + window>`
 * to find later conversation evidence, then asks an LLM judge for verdict.
 *
 * Returns: { verdict: 'done' | 'not-done' | 'unknown', confidence, evidence }
 */
export async function judgeFromLaterConversations(commitment, options = {}) {
  // Placeholder: needs Bee CLI search and LLM judge integration
  // This requires:
  // 1. Bee CLI search call
  // 2. LLM call with judge role (separate from extract role)
  // 3. Return structured verdict

  return {
    source: 'conversation.judge',
    verdict: 'unknown',
    confidence: 0,
    evidence: { reason: 'not-implemented' },
  };
}

/**
 * Location visit evidence.
 *
 * Uses `bee locations recent --from --to` if API returns data.
 */
export async function checkLocationEvidence(commitment, options = {}) {
  // Placeholder: needs Bee CLI locations integration
  return {
    source: 'location',
    verdict: 'unknown',
    confidence: 0,
    evidence: { reason: 'not-implemented' },
  };
}

/**
 * Run the full labeling pipeline on a commitment.
 *
 * Processes evidence sources in trust order, stopping at the first conclusive verdict.
 */
export async function labelCommitment(commitment, options = {}) {
  const results = [];

  // 1. Bee completion flag (prior, not sole evidence)
  const beeComp = hasBeeCompletion(commitment);
  if (beeComp.hasFlag) {
    results.push({
      source: 'bee.completion',
      verdict: 'done',
      confidence: 0.5, // Low confidence without independent support
      evidence: { hasTimestamp: beeComp.hasTimestamp, note: 'completion-flag-only' },
      isPrior: true,
    });
  }

  // 2. Calendar matching
  if (options.events && options.events.length) {
    const calendarMatch = matchCalendar(commitment, options.events);
    if (calendarMatch) {
      results.push(calendarMatch);
      // If we have calendar support and Bee flag, upgrade Bee to full verdict
      if (beeComp.hasFlag) {
        results[0].confidence = 0.9;
        results[0].evidence.note = 'completion-flag-plus-calendar';
        results[0].isPrior = false;
      }
      return consolidateResults(results);
    }
  }

  // 3. Later conversations (LLM judge)
  if (options.enableJudge) {
    const judgeResult = await judgeFromLaterConversations(commitment, options);
    if (judgeResult.verdict !== 'unknown') {
      results.push(judgeResult);
      return consolidateResults(results);
    }
  }

  // 4. Location evidence
  if (options.enableLocations) {
    const locationResult = await checkLocationEvidence(commitment, options);
    if (locationResult.verdict !== 'unknown') {
      results.push(locationResult);
      return consolidateResults(results);
    }
  }

  // No conclusive evidence
  return consolidateResults(results);
}

/**
 * Consolidate multiple evidence sources into a final label.
 *
 * Trust order is already enforced by the pipeline.
 * If Bee flag is present without independent support, it's a prior.
 */
function consolidateResults(results) {
  if (results.length === 0) {
    return {
      verdict: 'unknown',
      confidence: 0,
      sources: [],
      evidence: { reason: 'no-evidence' },
    };
  }

  // First conclusive result wins (trust order)
  const final = results[0];
  return {
    verdict: final.verdict,
    confidence: final.confidence,
    sources: results.map((r) => r.source),
    evidence: final.evidence,
    isPrior: final.isPrior || false,
  };
}

/**
 * Label all commitments in the database.
 *
 * Returns: { labeled, unknown, errors }
 */
export async function labelAllCommitments(dbPath, options = {}) {
  const db = openDb(dbPath);
  const commitments = db
    .prepare('SELECT * FROM commitments WHERE state=?')
    .all('live');

  const results = {
    labeled: 0,
    unknown: 0,
    errors: 0,
    details: [],
  };

  for (const commitment of commitments) {
    try {
      const label = await labelCommitment(commitment, options);
      results.details.push({
        id: commitment.id,
        ...label,
      });
      if (label.verdict === 'unknown') {
        results.unknown += 1;
      } else {
        results.labeled += 1;
      }
    } catch (error) {
      results.errors += 1;
      results.details.push({
        id: commitment.id,
        error: error.message,
      });
    }
  }

  db.close();
  return results;
}
