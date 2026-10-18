// Build the evidence block the decision models are allowed to see.
//
// The block is deliberately narrow: the exact quote, who said it, who it was
// addressed to, the deadline wording, the stakes, and whether an external
// signal already shows it done. It carries no other app state.
//
// External signals (calendar, sent mail) come from an injectable provider with
// the shape:
//   { name: string, check(row) -> Promise<{ done: boolean|null, source: string }> }
// When no provider is configured, `resolveSignals` returns null and the block
// says `signals: 'not checked'`. It never implies a check happened.
//
// Per-row facts (stakes, reversible, internal) live inside the row's `evidence`
// JSON. No column is added to the `commitments` table for them.
//
// The core `buildEvidence` is a pure, deterministic function of its inputs:
// same row + same resolved signals => same object, with a stable key order.

export const NOT_CHECKED = 'not checked';

const EXPLICIT_DATE = /\b(\d{4}-\d{2}-\d{2})\b/;
const RELATIVE_WORDING =
  /\b(?:today|tonight|tomorrow|this (?:morning|afternoon|evening|night|week|weekend|month)|next (?:week|weekend|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|by (?:the )?(?:end of (?:the )?(?:day|week|month)|tonight|tomorrow)|asap|eod)\b/i;

function asObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
}

/**
 * Deadline wording for the quote. `dueAt` is taken from the stored column when
 * present, otherwise from an explicit ISO date the speaker actually wrote. A
 * relative phrase is recorded as wording only; it is never converted to a date.
 */
export function deadlineWording(quote = '', dueAt = null) {
  const text = typeof quote === 'string' ? quote : '';
  const explicit = text.match(EXPLICIT_DATE);
  const relative = text.match(RELATIVE_WORDING);
  const stored = typeof dueAt === 'string' && dueAt ? dueAt : null;
  const date = stored || (explicit ? explicit[1] : null);
  return {
    dueAt: date,
    explicitWording: explicit ? explicit[0] : null,
    relativeWording: relative ? relative[0] : null,
    relative: Boolean(relative) && !explicit && !stored,
  };
}

/**
 * Resolve an injectable signal provider for one row.
 * @returns {Promise<{checked: true, done: boolean|null, source: string}|null>}
 */
export async function resolveSignals(signals, row) {
  if (!signals || typeof signals.check !== 'function') return null;
  const result = await signals.check(row);
  if (!result || typeof result !== 'object') return null;
  return {
    checked: true,
    // `done: null` means the provider looked and could not tell. That is not
    // the same as "not done", so it is reported as an explicit null.
    done: result.done === true ? true : result.done === false ? false : null,
    source: typeof result.source === 'string' ? result.source : (signals.name || 'external'),
  };
}

/**
 * Build the serialisable evidence block.
 *
 * @param {object} row  a commitment row, or `{...}` with the same field names
 * @param {object} [options]
 * @param {object|null} [options.extraction]  validated extraction fields, if any
 * @param {object|null} [options.signals]     result of `resolveSignals`, or null
 * @param {object|null} [options.injection]   `{ rejected, rule, reason }`, if any
 */
export function buildEvidence(row = {}, { extraction = null, signals = null, injection = null } = {}) {
  const facts = asObject(row.evidence);
  const quote = typeof row.quote === 'string' ? row.quote : '';
  const dueAt = row.due_at ?? row.dueAt ?? null;
  const block = {
    untrusted: true,
    origin: facts.origin === 'bee_todo' ? 'bee_todo' : 'conversation',
    quote,
    speaker: typeof facts.speaker === 'string' ? facts.speaker : null,
    addressee: extraction?.addressee ?? row.counterparty ?? null,
    deadline: deadlineWording(quote, dueAt),
    stakes: extraction?.stakes ?? (typeof facts.stakes === 'string' ? facts.stakes : null),
    // 'not checked' until a real provider says otherwise.
    signals: signals ?? NOT_CHECKED,
    // Whether acting externally could be undone. Only `true` permits 'execute'
    // in the policy; unknown stays null, which downgrades to 'draft'.
    reversible: facts.reversible === true ? true : facts.reversible === false ? false : null,
    internal: facts.internal === true ? true : facts.internal === false ? false : null,
  };
  if (injection) {
    block.injection = {
      rejected: Boolean(injection.rejected),
      rule: injection.rule ?? null,
      reason: injection.reason ?? null,
    };
  }
  return block;
}
