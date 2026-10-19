import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDeadlinePhrase,
  classifySpecificity,
  resolveDeadline,
  extractAndResolveDeadline,
} from '../deadline-resolver.mjs';

test('extracts deadline phrases from text', () => {
  assert.equal(extractDeadlinePhrase("I'll send it by Friday."), 'by Friday');
  assert.equal(extractDeadlinePhrase('Ship it by 2026-11-02.'), 'by 2026-11-02');
  assert.equal(extractDeadlinePhrase('I will do it by tomorrow.'), 'by tomorrow');
  assert.equal(extractDeadlinePhrase('No deadline here.'), null);
});

test('classifies deadline specificity', () => {
  assert.equal(classifySpecificity('by 2026-11-02'), 'absolute');
  assert.equal(classifySpecificity('by Friday'), 'weekday');
  assert.equal(classifySpecificity('by tomorrow'), 'relative');
  assert.equal(classifySpecificity(null), 'none');
});

test('resolves absolute deadlines', () => {
  const timestamp = new Date('2026-10-15T12:00:00Z').getTime();
  const result = resolveDeadline(timestamp, 'by 2026-11-02');
  assert.equal(result, '2026-11-02');
});

test('resolves weekday deadlines', () => {
  // Wednesday Oct 15, 2026
  const wednesday = new Date('2026-10-15T12:00:00Z').getTime();
  const result = resolveDeadline(wednesday, 'by Friday');
  assert.equal(result, '2026-10-16'); // Friday Oct 16
});

test('resolves relative deadlines', () => {
  const timestamp = new Date('2026-10-15T12:00:00Z').getTime();
  assert.equal(resolveDeadline(timestamp, 'by tomorrow'), '2026-10-16');
  assert.equal(resolveDeadline(timestamp, 'by today'), '2026-10-15');
});

test('resolves "next week" correctly', () => {
  const timestamp = new Date('2026-10-15T12:00:00Z').getTime(); // Wednesday
  const result = resolveDeadline(timestamp, 'by next week');
  // End of next week (Sunday)
  assert.equal(result, '2026-10-25');
});

test('extracts and resolves in one call', () => {
  const timestamp = new Date('2026-10-15T12:00:00Z').getTime();
  const result = extractAndResolveDeadline("I'll send it by Friday.", timestamp);
  assert.equal(result.phrase, 'by Friday');
  assert.equal(result.specificity, 'weekday');
  assert.equal(result.resolvedDate, '2026-10-16');
});
