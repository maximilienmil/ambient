// Dependency-free validators for the two shapes the decision layer exchanges:
// the extraction JSON and a 5-way probability distribution.
//
// Everything validates and rejects. A rejection is a `SchemaError` whose
// `.errors` array names the offending field, so a caller can report exactly
// what was wrong instead of inventing a substitute value.

/**
 * The declared option set, everywhere, exactly. Order is fixed so a table or a
 * stored distribution has one canonical key order.
 */
export const OPTIONS = ['ignore', 'remember', 'ask', 'draft', 'execute'];

/** Closed set for the `stakes` fact. `null` means the extractor did not say. */
export const STAKES = ['low', 'medium', 'high'];

/** Distributions must sum to 1 within this tolerance. */
export const SUM_TOLERANCE = 1e-6;

/** Extraction field limits. Anything longer is treated as a malformed blob. */
const LIMITS = { text: 1000, quote: 600, notes: 1000, name: 200 };

export class SchemaError extends Error {
  constructor(kind, errors) {
    const first = errors[0] ? ` (${errors[0].field}: ${errors[0].message})` : '';
    super(`${kind} failed validation${first}`);
    this.name = 'SchemaError';
    this.code = 'schema_violation';
    this.kind = kind;
    this.errors = errors;
  }
}

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Validate a 5-way distribution. Returns structured errors; never throws.
 * Errors: `{ field, message }`.
 */
export function distributionErrors(value, field = 'distribution') {
  const errors = [];
  if (!isPlainObject(value)) {
    return [{ field, message: 'must be an object keyed by the five options' }];
  }
  for (const key of Object.keys(value)) {
    if (!OPTIONS.includes(key)) errors.push({ field: `${field}.${key}`, message: 'unknown option' });
  }
  for (const option of OPTIONS) {
    const p = value[option];
    if (!(option in value)) {
      errors.push({ field: `${field}.${option}`, message: 'missing option' });
      continue;
    }
    if (typeof p !== 'number' || !Number.isFinite(p)) {
      errors.push({ field: `${field}.${option}`, message: 'must be a finite number' });
      continue;
    }
    if (p < 0) errors.push({ field: `${field}.${option}`, message: 'must not be negative' });
    if (p > 1 + SUM_TOLERANCE) errors.push({ field: `${field}.${option}`, message: 'must not exceed 1' });
  }
  if (errors.length === 0) {
    const sum = OPTIONS.reduce((total, option) => total + value[option], 0);
    if (Math.abs(sum - 1) > SUM_TOLERANCE) {
      errors.push({ field, message: `must sum to 1 (got ${sum})` });
    }
  }
  return errors;
}

/** Validate and normalise (so the returned object sums to exactly 1). */
export function validateDistribution(value, { field = 'distribution' } = {}) {
  const errors = distributionErrors(value, field);
  if (errors.length) throw new SchemaError('distribution', errors);
  const sum = OPTIONS.reduce((total, option) => total + value[option], 0);
  const normalised = {};
  for (const option of OPTIONS) normalised[option] = value[option] / sum;
  return normalised;
}

function fieldErrors(value, field, { required = false, nullable = false, max = null } = {}) {
  const errors = [];
  if (value === undefined || value === null) {
    if (required) errors.push({ field, message: 'is required' });
    else if (!nullable) errors.push({ field, message: 'must be a string or null' });
    return errors;
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: 'must be a string' });
    return errors;
  }
  if (!value.trim()) errors.push({ field, message: 'must not be empty' });
  if (max !== null && value.length > max) errors.push({ field, message: `must be at most ${max} characters` });
  return errors;
}

const EXTRACTION_FIELDS = ['isCommitment', 'text', 'quote', 'counterparty', 'addressee', 'dueAt', 'stakes', 'notes'];

/**
 * Validate the extraction JSON:
 *   { isCommitment, text, quote, counterparty, addressee, dueAt, stakes, notes }
 * Unknown fields are rejected: the prompt declares this exact shape, and an
 * unexpected field is a sign the model tried to redefine it.
 */
export function extractionErrors(value, field = 'extraction') {
  const errors = [];
  if (!isPlainObject(value)) {
    return [{ field, message: 'must be an object' }];
  }
  for (const key of Object.keys(value)) {
    if (!EXTRACTION_FIELDS.includes(key)) errors.push({ field: `${field}.${key}`, message: 'unknown field' });
  }
  if (typeof value.isCommitment !== 'boolean') {
    errors.push({ field: `${field}.isCommitment`, message: 'must be a boolean' });
  }
  const committed = value.isCommitment === true;
  errors.push(...fieldErrors(value.text, `${field}.text`, { required: committed, nullable: !committed, max: LIMITS.text }));
  errors.push(...fieldErrors(value.quote, `${field}.quote`, { required: committed, nullable: !committed, max: LIMITS.quote }));
  errors.push(...fieldErrors(value.counterparty, `${field}.counterparty`, { nullable: true, max: LIMITS.name }));
  errors.push(...fieldErrors(value.addressee, `${field}.addressee`, { nullable: true, max: LIMITS.name }));
  errors.push(...fieldErrors(value.notes, `${field}.notes`, { required: true, max: LIMITS.notes }));
  if (value.dueAt !== null && value.dueAt !== undefined) {
    if (typeof value.dueAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.dueAt)) {
      errors.push({ field: `${field}.dueAt`, message: 'must be null or YYYY-MM-DD' });
    }
  }
  if (value.stakes !== null && value.stakes !== undefined) {
    if (typeof value.stakes !== 'string' || !STAKES.includes(value.stakes)) {
      errors.push({ field: `${field}.stakes`, message: `must be null or one of ${STAKES.join(', ')}` });
    }
  }
  return errors;
}

/** Validate and normalise the extraction shape (missing optionals become null). */
export function validateExtraction(value, { field = 'extraction' } = {}) {
  const errors = extractionErrors(value, field);
  if (errors.length) throw new SchemaError('extraction', errors);
  return {
    isCommitment: value.isCommitment,
    text: value.text ?? null,
    quote: value.quote ?? null,
    counterparty: value.counterparty ?? null,
    addressee: value.addressee ?? null,
    dueAt: value.dueAt ?? null,
    stakes: value.stakes ?? null,
    notes: value.notes,
  };
}
