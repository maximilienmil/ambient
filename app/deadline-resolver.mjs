// Deadline phrase resolver for predictor features.
//
// Normalizes "by Friday"-style phrases against the conversation timestamp.
// Specificity class = none / relative / absolute / weekday.
//
// Per SCOPE.md Q4b: extraction records the phrase; a unit-tested resolver
// normalizes it against the conversation timestamp.

/**
 * Extract deadline phrase from commitment text.
 *
 * Returns the raw phrase as it appears in the text.
 */
export function extractDeadlinePhrase(text) {
  // Match common deadline patterns
  const patterns = [
    /\bby\s+(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\bby\s+\d{4}-\d{2}-\d{2}\b/,
    /\bby\s+(?:tomorrow|today|tonight|this week|next week)\b/i,
    /\bby\s+(?:the\s+)?(?:morning|afternoon|evening)\b/i,
    /\bwill\s+(?:do\s+)?(?:it|that)\s+(?:by\s+)?(?:tomorrow|today|tonight)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return null;
}

/**
 * Classify deadline specificity.
 *
 * Returns: 'none' | 'relative' | 'absolute' | 'weekday'
 */
export function classifySpecificity(phrase) {
  if (!phrase) return 'none';

  if (/\d{4}-\d{2}-\d{2}/.test(phrase)) return 'absolute';
  if (/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(phrase)) return 'weekday';
  if (/\b(?:tomorrow|today|tonight|this week|next week)\b/i.test(phrase)) return 'relative';

  return 'none';
}

/**
 * Resolve a relative deadline phrase to an absolute date.
 *
 * conversationTimestamp: epoch ms from the utterance
 * phrase: e.g., "by Friday", "by tomorrow"
 *
 * Returns ISO date string or null if unresolvable.
 */
export function resolveDeadline(conversationTimestamp, phrase) {
  if (!phrase) return null;

  const specificity = classifySpecificity(phrase);
  if (specificity === 'absolute') {
    // Extract the date from phrase like "by 2026-11-02"
    const match = phrase.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  if (!conversationTimestamp) return null;

  if (specificity === 'weekday') {
    // Match day of week
    const dayMatch = phrase.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (dayMatch) {
      const targetDay = dayMatch[1].toLowerCase();
      const date = new Date(conversationTimestamp);
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = date.getDay();
      const targetIndex = dayNames.indexOf(targetDay);

      // If "next Monday", add 7 days
      const daysToAdd = phrase.toLowerCase().includes('next') ? 7 : 0;
      const diff = (targetIndex - currentDay + 7) % 7 + daysToAdd;

      date.setDate(date.getDate() + diff);
      return date.toISOString().slice(0, 10);
    }
  }

  if (specificity === 'relative') {
    const date = new Date(conversationTimestamp);
    const lower = phrase.toLowerCase();

    if (lower.includes('tomorrow')) {
      date.setDate(date.getDate() + 1);
      return date.toISOString().slice(0, 10);
    }
    if (lower.includes('today')) {
      return date.toISOString().slice(0, 10);
    }
    if (lower.includes('this week')) {
      // End of current week (Sunday)
      const daysUntilSunday = 7 - date.getDay();
      date.setDate(date.getDate() + daysUntilSunday);
      return date.toISOString().slice(0, 10);
    }
    if (lower.includes('next week')) {
      // End of next week (Sunday)
      const daysUntilSunday = 7 - date.getDay();
      date.setDate(date.getDate() + daysUntilSunday + 7);
      return date.toISOString().slice(0, 10);
    }
  }

  return null;
}

/**
 * Extract and resolve deadline in one call.
 *
 * Returns: { phrase, specificity, resolvedDate }
 */
export function extractAndResolveDeadline(text, conversationTimestamp) {
  const phrase = extractDeadlinePhrase(text);
  const specificity = classifySpecificity(phrase);
  const resolvedDate = resolveDeadline(conversationTimestamp, phrase);

  return { phrase, specificity, resolvedDate };
}
