// Bystander redaction.
//
// Ambient only stores the wearer's own utterances. Every other speaker in a Bee
// transcript is dropped before anything touches SQLite. The only counts that
// survive for dropped speech are integers, never text.
//
// Speaker semantics come from the Bee CLI reference and Skill:
//   - https://docs.bee.computer/docs/cli#bee-conversations-get  ("verbatim, with speaker and timestamps")
//   - https://docs.bee.computer/docs/agentic-now                 (unresolved diarization prints as "Unknown")
//   - https://github.com/bee-computer/bee-skill                  ("Utterances ... are verbatim and authoritative")
//
// A hex-encoded space separates the two modes of the resolver below so the log
// can say which one was used and a reviewer can audit every assumption.

const ALIASES = new Set([
  'you',
  'me',
  'myself',
  'owner',
  'wearer',
  'user',
  'self',
  'the wearer',
]);

export function normalizeLabel(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ');
}

/** Candidate speaker labels that mean "the wearer", from the Bee profile and env. */
export function ownerLabelSet(profile, extra = []) {
  const labels = new Set();
  const add = (value) => {
    const normalized = normalizeLabel(value);
    if (normalized) labels.add(normalized);
  };
  add(profile?.firstName);
  add(profile?.lastName);
  add([profile?.firstName, profile?.lastName].filter(Boolean).join(' '));
  for (const alias of ALIASES) add(alias);
  for (const value of String(process.env.AMBIENT_OWNER_LABELS || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)) {
    add(value);
  }
  for (const value of extra) add(value);
  return labels;
}

/** Flatten `conversation.transcriptions[].utterances[]` into one ordered list. */
export function utterancesOf(conversation) {
  const transcriptions = Array.isArray(conversation?.transcriptions) ? conversation.transcriptions : [];
  const rows = [];
  for (const transcription of transcriptions) {
    const utterances = Array.isArray(transcription?.utterances) ? transcription.utterances : [];
    for (const utterance of utterances) {
      rows.push({
        id: utterance?.id ?? null,
        realtime: Boolean(utterance?.realtime),
        start: Number.isFinite(utterance?.start) ? utterance.start : null,
        end: Number.isFinite(utterance?.end) ? utterance.end : null,
        spokenAt: Number.isFinite(utterance?.spoken_at) ? utterance.spoken_at : null,
        text: typeof utterance?.text === 'string' ? utterance.text : '',
        speaker: typeof utterance?.speaker === 'string' ? utterance.speaker : '',
      });
    }
  }
  rows.sort((a, b) => (a.spokenAt ?? 0) - (b.spokenAt ?? 0));
  return rows;
}

/**
 * Decide which speaker label is the wearer.
 *
 * Precedence:
 *   1. exactly one label matches the owner's name/aliases  -> profile-name-match
 *   2. more than one match                                  -> ambiguous (keep nothing)
 *   3. exactly one distinct speaker in the whole recording  -> assumed-single-speaker
 *      (only when `allowSingleSpeaker` is on; otherwise unresolved)
 *   4. otherwise                                            -> unresolved (keep nothing)
 *
 * Rule 3 is an explicit assumption, recorded on every row it touches: a
 * one-voice recording captured by the wearer's own device is treated as the
 * wearer talking. It is disabled by `--strict` so the ingest can fail closed.
 */
export function resolveWearer(utterances, ownerLabels, { allowSingleSpeaker = true } = {}) {
  const distinct = [...new Set(utterances.map((u) => normalizeLabel(u.speaker)))];
  const matched = distinct.filter((label) => ownerLabels.has(label));
  if (matched.length === 1) {
    return { label: matched[0], how: 'profile-name-match' };
  }
  if (matched.length > 1) {
    return { label: null, how: 'ambiguous-name-match' };
  }
  if (allowSingleSpeaker && distinct.length === 1) {
    return { label: distinct[0], how: 'assumed-single-speaker' };
  }
  return { label: null, how: 'unresolved' };
}

/**
 * Split a conversation into the wearer's utterances (kept) and everyone else's
 * (dropped as integer counts only).
 */
export function redactConversation(conversation, ownerLabels, options = {}) {
  const utterances = utterancesOf(conversation);
  const { label: wearer, how } = resolveWearer(utterances, ownerLabels, options);

  const kept = [];
  let droppedOtherSpeaker = 0;
  let droppedEmpty = 0;
  const droppedBySpeaker = new Map();

  for (const utterance of utterances) {
    const text = utterance.text.trim();
    if (!text) {
      droppedEmpty += 1;
      continue;
    }
    if (wearer === null || normalizeLabel(utterance.speaker) !== wearer) {
      droppedOtherSpeaker += 1;
      const key = normalizeLabel(utterance.speaker) || '(unlabeled)';
      droppedBySpeaker.set(key, (droppedBySpeaker.get(key) || 0) + 1);
      continue;
    }
    kept.push({
      id: utterance.id,
      speaker: utterance.speaker,
      spokenAt: utterance.spokenAt,
      start: utterance.start,
      end: utterance.end,
      text,
    });
  }

  return {
    wearerLabel: wearer,
    resolution: how,
    kept,
    dropped: {
      total: utterances.length,
      kept: kept.length,
      otherSpeaker: droppedOtherSpeaker,
      empty: droppedEmpty,
      // Speaker labels are kept as counts only. Text is never retained here.
      bySpeaker: Object.fromEntries([...droppedBySpeaker.entries()].sort()),
    },
    timezone: conversation?.timezone ?? null,
  };
}
