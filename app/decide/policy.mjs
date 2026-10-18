// The policy: a pure function from two distributions plus the evidence to a
// tier, a calibrated confidence and a reason. No network, no clock, no I/O.
//
// Documented constants and rules:
//
//   AGREEMENT_THRESHOLD = 0.6
//     Both models must agree on the top option AND each must put at least this
//     much probability on it before the policy acts. Below it, the tier is
//     'ask'. This is a product threshold, not a fitted value; there are not yet
//     enough hand labels to fit one honestly (see calibrate.mjs).
//
//   'execute' requires evidence.reversible === true OR evidence.internal === true.
//     Anything external, or a row whose evidence does not say, becomes 'draft'.
//     Unknown means not reversible.
//
//   Disagreement on the top option => 'ask'.
//
//   p is the mean of the two models' probability for the chosen tier, clamped to
//     [0, 1]. When an agreed 'execute' is downgraded to 'draft', p is the mean
//     probability for 'execute' instead: it is the confidence that an action is
//     warranted, while the tier records the safe action actually taken. The one
//     exception is a security refusal, which is a deterministic rule and
//     reports p = 1.

import { OPTIONS } from './schema.mjs';

export const AGREEMENT_THRESHOLD = 0.6;

export const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** Highest-probability option for one distribution. */
export function topOf(distribution) {
  let best = OPTIONS[0];
  for (const option of OPTIONS) if (distribution[option] > distribution[best]) best = option;
  return { option: best, p: distribution[best] };
}

/** Mean probability the two models assign to `option`, clamped to [0, 1]. */
export function confidenceFor(jev, d1, option) {
  return clamp01((jev[option] + d1[option]) / 2);
}

/** An action can be executed only when the evidence says it is safe to. */
export function isReversibleOrInternal(evidence = {}) {
  return evidence.reversible === true || evidence.internal === true;
}

/**
 * Apply the policy.
 *
 * @param {object} input
 * @param {object} input.jev  validated 5-way distribution
 * @param {object} input.d1   validated 5-way distribution
 * @param {object} [input.evidence]  the evidence block
 * @param {number} [input.threshold]
 * @returns {{tier: string, p: number, reason: string}}
 */
export function decide({ jev, d1, evidence = {}, threshold = AGREEMENT_THRESHOLD } = {}) {
  // Security refusal first. If the extraction layer rejected the span, no model
  // output can move this row into 'draft' or 'execute'. No model probability
  // exists for a refusal, so `p` is null unless real distributions were given.
  if (evidence.injection?.rejected) {
    return {
      tier: 'ignore',
      p: jev && d1 ? confidenceFor(jev, d1, 'ignore') : null,
      reason:
        `Refused: transcript contained instruction-like content (${evidence.injection.rule || 'injection'}); ` +
        'treated as data, not acted on. Deterministic rule, not a model probability.',
    };
  }

  if (!jev || !d1) {
    throw new TypeError('decide() requires both distributions; pass null only for a security refusal.');
  }

  const j = topOf(jev);
  const d = topOf(d1);

  if (j.option !== d.option) {
    return {
      tier: 'ask',
      p: confidenceFor(jev, d1, 'ask'),
      reason: `Models disagree (${j.option} vs ${d.option}); asking instead of acting.`,
    };
  }

  const candidate = j.option;
  if (j.p < threshold || d.p < threshold) {
    return {
      tier: 'ask',
      p: confidenceFor(jev, d1, 'ask'),
      reason: `Confidence below the ${threshold} threshold (jev ${j.p.toFixed(3)}, d1 ${d.p.toFixed(3)}); asking.`,
    };
  }

  if (candidate === 'execute' && !isReversibleOrInternal(evidence)) {
    return {
      tier: 'draft',
      p: confidenceFor(jev, d1, 'execute'),
      reason:
        'Both models agreed on execute, but the evidence does not say the action is reversible or internal; ' +
        'drafting instead of executing.',
    };
  }

  return {
    tier: candidate,
    p: confidenceFor(jev, d1, candidate),
    reason: `Both models agree on ${candidate} at or above the ${threshold} threshold.`,
  };
}
