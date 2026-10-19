// Generate synthetic fixture data for demo mode.
//
// Creates fake conversations, utterances, and commitments so anyone can run
// the app without a Bee account connected.

import { openDb } from '../db.mjs';
import { commitmentId } from '../extract.mjs';

const OWNER = 'Demo User';
const NOW = new Date('2026-10-18T00:00:00Z').getTime();

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysAgo) {
  const date = new Date(NOW - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

/**
 * Generate synthetic conversation.
 */
function generateConversation(id, daysAgo) {
  return {
    id: String(id),
    start_time: NOW - daysAgo * 24 * 60 * 60 * 1000,
    end_time: NOW - daysAgo * 24 * 60 * 60 * 1000 + 3600000,
    device_type: 'ios',
    state: 'COMPLETED',
    short_summary: 'Demo conversation',
    created_at: NOW - daysAgo * 24 * 60 * 60 * 1000,
    updated_at: NOW - daysAgo * 24 * 60 * 60 * 1000,
  };
}

/**
 * Generate synthetic utterance.
 */
function generateUtterance(id, conversationId, text, daysAgo) {
  return {
    id: String(id),
    conversation_id: String(conversationId),
    speaker: OWNER,
    spoken_at: NOW - daysAgo * 24 * 60 * 60 * 1000,
    start: 0,
    end: 1,
    text,
    ingested_at: new Date().toISOString(),
  };
}

/**
 * Generate synthetic commitment.
 */
function generateCommitment(id, conversationId, text, daysAgo, dueDaysLater = 7) {
  const quote = text;
  const spanStart = 0;
  const spanEnd = quote.length;

  return {
    id: commitmentId(String(conversationId), 'fixture', `utterance:${id}`, quote),
    text: text.charAt(0).toUpperCase() + text.slice(1),
    quote,
    owner: OWNER,
    counterparty: null,
    source_conversation_id: String(conversationId),
    span_start: spanStart,
    span_end: spanEnd,
    created_at: randomDate(daysAgo),
    due_at: randomDate(daysAgo - dueDaysLater),
    state: 'live',
    tier: null,
    p: null,
    jev_scores: '{}',
    d1_scores: '{}',
    evidence: JSON.stringify({
      origin: 'fixture',
      utteranceId: String(id),
      speaker: OWNER,
      rule: 'demo-fixture',
    }),
    closed_by: null,
  };
}

/**
 * Generate all fixture data.
 */
export function generateFixtures(dbPath) {
  const db = openDb(dbPath);

  // Generate 20 conversations with commitments
  for (let i = 1; i <= 20; i++) {
    const daysAgo = randomInt(1, 90);
    const convId = 10000 + i;

    // Insert conversation
    const conv = generateConversation(convId, daysAgo);
    db.prepare(
      `INSERT INTO conversations (id, start_time, end_time, device_type, state, short_summary,
        utterances_total, utterances_kept, utterances_dropped_other, utterances_dropped_empty,
        wearer_label, redaction, dropped_by_speaker, bee_updated_at, ingested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      conv.id,
      conv.start_time,
      conv.end_time,
      conv.device_type,
      conv.state,
      conv.short_summary,
      1, // utterances_total
      1, // utterances_kept
      0, // utterances_dropped_other
      0, // utterances_dropped_empty
      OWNER,
      'fixture',
      '{}',
      conv.updated_at,
      new Date().toISOString(),
    );

    // Generate 1-3 utterances per conversation
    const utteranceCount = randomInt(1, 3);
    for (let j = 1; j <= utteranceCount; j++) {
      const uttId = convId * 100 + j;
      const texts = [
        "I'll send the deck by Friday.",
        'We should review the proposal.',
        "I'd like to schedule a meeting.",
        'I need to follow up on the contract.',
        "I'll finish the report tomorrow.",
      ];
      const text = texts[randomInt(0, texts.length - 1)];

      // Insert utterance
      const utt = generateUtterance(uttId, convId, text, daysAgo);
      db.prepare(
        'INSERT INTO utterances (id, conversation_id, speaker, spoken_at, start, end, text, ingested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(utt.id, utt.conversation_id, utt.speaker, utt.spoken_at, utt.start, utt.end, utt.text, utt.ingested_at);

      // 50% chance of generating a commitment from this utterance
      if (Math.random() > 0.5) {
        const commit = generateCommitment(uttId, convId, text, daysAgo, randomInt(3, 14));
        db.prepare(
          `INSERT INTO commitments (id, text, quote, owner, counterparty, source_conversation_id,
            span_start, span_end, created_at, due_at, state, tier, p, jev_scores, d1_scores, evidence, closed_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          commit.id,
          commit.text,
          commit.quote,
          commit.owner,
          commit.counterparty,
          commit.source_conversation_id,
          commit.span_start,
          commit.span_end,
          commit.created_at,
          commit.due_at,
          commit.state,
          commit.tier,
          commit.p,
          commit.jev_scores,
          commit.d1_scores,
          commit.evidence,
          commit.closed_by,
        );
      }
    }
  }

  // Generate some Bee todos
  for (let i = 1; i <= 10; i++) {
    const todoId = 20000 + i;
    const todoText = `Demo todo item ${i}`;
    db.prepare(
      `INSERT INTO bee_todos (id, text, alarm_at, completed, bee_created_at, corrections, ingested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      String(todoId),
      todoText,
      NOW + randomInt(1, 7) * 24 * 60 * 60 * 1000,
      0,
      NOW - randomInt(1, 30) * 24 * 60 * 60 * 1000,
      '[]',
      new Date().toISOString(),
    );

    // Create commitment from todo
    const commitId = commitmentId(null, 'bee_todo', `todo:${todoId}`, todoText);
    db.prepare(
      `INSERT INTO commitments (id, text, quote, owner, counterparty, source_conversation_id,
        span_start, span_end, created_at, due_at, state, tier, p, jev_scores, d1_scores, evidence, closed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      commitId,
      todoText,
      todoText,
      OWNER,
      null,
      null,
      0,
      todoText.length,
      new Date().toISOString(),
      new Date(NOW + randomInt(1, 7) * 24 * 60 * 60 * 1000).toISOString(),
      'live',
      null,
      null,
      '{}',
      '{}',
      JSON.stringify({ origin: 'bee_todo', beeTodoId: String(todoId), completed: false }),
      null,
    );
  }

  // Generate some facts
  for (let i = 1; i <= 5; i++) {
    const factId = 30000 + i;
    db.prepare(
      `INSERT INTO facts (id, text, tags, confirmed, bee_created_at, ingested_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      String(factId),
      `Demo fact ${i}`,
      JSON.stringify(['demo']),
      1,
      NOW - randomInt(1, 30) * 24 * 60 * 60 * 1000,
      new Date().toISOString(),
    );
  }

  db.close();
  console.log('Fixture data generated successfully');
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] || 'data/latent.sqlite';
  generateFixtures(dbPath);
}
