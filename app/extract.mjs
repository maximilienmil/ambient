// Rule-based commitment extraction, run only over the wearer's own utterances.
//
// This is the deterministic baseline that seeds the ledger. It is intentionally
// narrow and labelled as a rule, not a model: the Jev and d1 decision scores are
// produced later and stored in `jev_scores` / `d1_scores`. Nothing here claims a
// calibrated probability, so `p` stays NULL until a model writes it.

import { createHash } from 'node:crypto';

const PROMISE = /^(?:i(?:'ll|’ll| will| am going to|'m going to| need to| have to| must| promise to| plan to| intend to))\b/i;
const SHARED = /^(?:we(?:'ll|’ll| will| should| need to| have to| could| can)|let(?:'s|’s)|should we|shall we)\b/i;
const INTEREST = /^(?:i(?:'d|’d) (?:like|love) to|i would (?:like|love) to|i want to|i should)\b/i;

// Utterances that must never become a candidate, even if they start with a
// promise pattern. Kept deliberately conservative.
const RETRACTION = /\b(?:never mind|forget (?:it|that|that one)|cancel(?:led|ing)?|no longer|scratch that|changed my mind|disregard)\b/i;
const NEGATION = /\b(?:won't|will not|don't|do not|can't|cannot|shouldn't|not going to|never)\b/i;
const HYPOTHETICAL = /\b(?:if |maybe|might|perhaps|probably|i wish|i would have|just (?:joking|kidding|said|reading)|hypothetically|quote|quoting|said that|told me to)\b/i;
const REPORTED = /^(?:he|she|they|someone|.*\bsaid\b|\btold me\b)/i;
const INJECTION = /\b(?:ignore (?:previous|all|the) (?:instructions|prompts)|system prompt|you are now|disregard (?:all|previous))\b/i;

// A quoted string (straight or curly) usually means the utterance is reporting
// someone else's words rather than making its own promise.
const QUOTED = /[“”"]/;

const MAX_UTTERANCE = 600;
const MAX_QUOTE = 300;

const stripLead = (text) =>
  text
    .replace(
      /^(?:i(?:'ll|’ll| will| am going to|'m going to| need to| have to| must| promise to| plan to| intend to)|we(?:'ll|’ll| will| should| need to| have to| could| can)|let(?:'s|’s)|i(?:'d|’d) (?:like|love) to|i would (?:like|love) to|i want to|i should)\s+/i,
      '',
    )
    .replace(/[.!?,;:]+$/g, '')
    .trim();

/** Only accept a due date the speaker wrote explicitly. Never infer "tonight". */
export function explicitDueDate(text) {
  const match = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (!match) return null;
  const value = match[1];
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

/** Best-effort named counterparty. Returns null rather than guessing. */
export function findCounterparty(text) {
  const named = text.match(
    /\b(?:to|with|for|email|call|message|text|ask|tell|send|share|forward)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
  );
  if (named) {
    const candidate = named[1].trim();
    if (!/^(?:I|We|You|They|He|She|It|The|And|But|Today|Tomorrow|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

function classify(text) {
  if (PROMISE.test(text)) {
    return { tier: 'draft', rule: 'first-person-promise' };
  }
  if (SHARED.test(text)) {
    return { tier: 'ask', rule: 'shared-intent' };
  }
  if (INTEREST.test(text)) {
    return { tier: 'remember', rule: 'stated-interest' };
  }
  return null;
}

export function shouldReject(text) {
  if (!text || text.length > MAX_UTTERANCE) return 'too-long-or-empty';
  if (INJECTION.test(text)) return 'injection-like';
  if (QUOTED.test(text)) return 'quoted-speech';
  if (RETRACTION.test(text)) return 'retraction';
  if (HYPOTHETICAL.test(text)) return 'hypothetical';
  if (REPORTED.test(text)) return 'reported-speech';
  if (NEGATION.test(text)) return 'negated';
  if (text.trim().endsWith('?')) return 'question';
  return null;
}

/**
 * Extract candidate commitments from the wearer's retained utterances.
 * Returns one row per candidate with the exact quote and its character span
 * inside the utterance text, so a receipt can point at the precise words.
 */
export function extractCommitments(kept, owner) {
  const candidates = [];
  const rejected = [];
  for (const utterance of kept) {
    const text = utterance.text.trim();
    const classification = classify(text);
    const reason = shouldReject(text);
    if (!classification || reason) {
      rejected.push({ utteranceId: utterance.id, reason: reason || 'no-commitment-pattern' });
      continue;
    }
    const quote = text.slice(0, MAX_QUOTE);
    const spanStart = text.indexOf(quote);
    const spanEnd = spanStart + quote.length;
    const cleaned = stripLead(quote);
    if (!cleaned || cleaned.length < 3) {
      rejected.push({ utteranceId: utterance.id, reason: 'empty-after-normalization' });
      continue;
    }
    candidates.push({
      origin: 'bee_conversation',
      originId: `utterance:${utterance.id}`,
      text: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
      quote,
      owner,
      counterparty: findCounterparty(quote),
      spanStart,
      spanEnd,
      spokenAt: utterance.spokenAt,
      dueAt: explicitDueDate(quote),
      tier: classification.tier,
      evidence: {
        utteranceId: utterance.id,
        speaker: utterance.speaker,
        spokenAt: utterance.spokenAt,
        rule: classification.rule,
        provisional: true,
        note: 'Provisional tier from the offline rule extractor; not a model score.',
      },
    });
  }
  return { candidates, rejected };
}

/** Stable id so re-ingesting the same utterance never creates a second row. */
export function commitmentId(sourceConversationId, origin, originId, quote) {
  return createHash('sha256')
    .update([sourceConversationId ?? '', origin, originId, quote].join('\u0000'))
    .digest('hex')
    .slice(0, 32);
}
