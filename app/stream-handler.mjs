// Live moment: read Bee's documented JSON event payload, keep only a speaker
// that can be matched to the account owner, and recover missed events after a
// disconnect with the ordinary incremental ingest.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, saveCommitment } from './db.mjs';
import { extractCommitments, commitmentId } from './extract.mjs';
import { ownerLabelSet } from './redact.mjs';
import * as bee from './bee.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

function unwrapEvent(event) {
  // Bee's --json payload is the event itself, with no type key. The envelope
  // form is accepted only for older local fixtures.
  if (event?.type === 'new-utterance') return event.data?.utterance ? { utterance: event.data.utterance, conversation_id: event.data.utterance.conversation_id } : null;
  if (event?.utterance && typeof event.utterance === 'object') return event;
  return null;
}

function timestampOf(value) {
  if (Number.isFinite(value)) return new Date(value).toISOString();
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

/** Process one raw Bee JSON event. Unknown diarization labels fail closed. */
export async function processStreamEvent(event, db, options = {}) {
  const payload = unwrapEvent(event);
  const utterance = payload?.utterance;
  if (!utterance || typeof utterance.text !== 'string' || !utterance.text.trim()) return { accepted: 0, rejected: 'not-an-utterance' };

  const profile = options.profile || await bee.getProfile();
  const ownerLabels = ownerLabelSet(profile, options.ownerLabels || []);
  const speaker = String(utterance.speaker || '').trim().toLowerCase();
  if (!speaker || !ownerLabels.has(speaker)) {
    return { accepted: 0, rejected: speaker ? 'speaker-not-identified-as-owner' : 'speaker-missing' };
  }

  const conversationId = payload.conversation_id ?? payload.conversation_uuid ?? utterance.conversation_id;
  if (conversationId === undefined || conversationId === null) return { accepted: 0, rejected: 'conversation-id-missing' };
  const spokenAt = timestampOf(utterance.spoken_at ?? utterance.timestamp);
  const utteranceId = utterance.id ?? createHash('sha256')
    .update(`${conversationId}\u0000${speaker}\u0000${spokenAt}\u0000${utterance.text}`)
    .digest('hex').slice(0, 24);
  const owner = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || 'You';
  const { candidates } = extractCommitments([{
    id: String(utteranceId),
    conversation_id: String(conversationId),
    speaker: utterance.speaker,
    spokenAt: Date.parse(spokenAt),
    text: utterance.text,
  }], owner);

  const saved = [];
  for (const candidate of candidates) {
    const id = commitmentId(String(conversationId), candidate.origin, candidate.originId, candidate.quote);
    const result = saveCommitment(db, {
      id,
      text: candidate.text,
      quote: candidate.quote,
      owner,
      counterparty: candidate.counterparty,
      sourceConversationId: String(conversationId),
      spanStart: candidate.spanStart,
      spanEnd: candidate.spanEnd,
      createdAt: spokenAt,
      dueAt: candidate.dueAt,
      state: 'live',
      tier: candidate.tier,
      p: null,
      jevScores: {},
      d1Scores: {},
      evidence: {
        ...candidate.evidence,
        source: 'stream',
        streamTimestamp: new Date().toISOString(),
        tierStatus: 'provisional-rule-score',
      },
    });
    saved.push({ id, text: candidate.text, tier: candidate.tier, created: result.created });
  }
  return { accepted: saved.length, commitments: saved };
}

async function runIncrementalCatchup(dbPath) {
  const { runIngest, parseArgs } = await import('./ingest.mjs');
  const options = parseArgs(['--quiet', '--db', dbPath]);
  return runIngest(options);
}

/** Reconnect until aborted; do a cursor-based catch-up before every reconnect. */
export async function consumeStream(options = {}) {
  const dbPath = options.dbPath || path.join(root, 'data', 'latent.sqlite');
  const beeBin = options.beeBin || process.env.BEE_BIN || 'bee';
  const profile = options.profile || await bee.getProfile();
  const controller = options.controller || new AbortController();
  const db = openDb(dbPath);
  let attempt = 0;

  try {
    while (!controller.signal.aborted) {
      attempt += 1;
      const child = (options.spawnImpl || spawn)(beeBin, ['stream', '--json', '--types', 'new-utterance'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let buffer = '';
      let pending = Promise.resolve();
      const consumeLine = (line) => {
        if (!line.trim()) return;
        pending = pending.then(async () => {
          try {
            const result = await processStreamEvent(JSON.parse(line), db, { profile });
            if (result.accepted) console.log(`Latent · new promise · ${result.commitments[0].tier}`);
          } catch (error) {
            console.error(`Latent · stream event skipped · ${error.message}`);
          }
        });
      };
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) consumeLine(line);
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => process.stderr.write(chunk));
      const aborted = () => child.kill('SIGTERM');
      controller.signal.addEventListener('abort', aborted, { once: true });
      const [code] = await once(child, 'close').catch(() => [1]);
      controller.signal.removeEventListener('abort', aborted);
      if (buffer.trim()) consumeLine(buffer);
      await pending;
      if (controller.signal.aborted) break;
      console.error(`Latent · Bee stream disconnected (${code ?? 'signal'}); catching up.`);
      try {
        await (options.catchup || runIncrementalCatchup)(dbPath);
      } catch (error) {
        console.error(`Latent · catch-up failed · ${error.message}`);
      }
      const delay = Math.min(5000, 250 * (2 ** Math.min(attempt - 1, 4)));
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, delay);
        controller.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
  } finally {
    db.close();
  }
}

/** Fixture path uses the exact event processor but never reads Bee or user data. */
export async function demoStream(options = {}) {
  const fixturePath = options.fixturePath || path.join(root, 'fixtures', 'stream-events.json');
  const dbPath = options.dbPath || path.join(root, 'data', 'latent-fixture.sqlite');
  const profile = options.profile || { firstName: 'Demo', lastName: 'User', timezone: 'UTC' };
  const { readFile } = await import('node:fs/promises');
  const events = JSON.parse(await readFile(fixturePath, 'utf8'));
  const db = openDb(dbPath);
  try {
    const results = [];
    for (const event of events) results.push(await processStreamEvent(event, db, { profile }));
    return { processed: events.length, accepted: results.reduce((sum, result) => sum + result.accepted, 0), results };
  } finally {
    db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2] || 'stream';
  const dbPath = process.argv[3] || (mode === 'demo' ? path.join(root, 'data', 'latent-fixture.sqlite') : undefined);
  if (mode === 'demo') {
    demoStream({ dbPath }).then((result) => console.log(`Processed ${result.processed} events; ${result.accepted} promise(s) extracted.`));
  } else {
    const controller = new AbortController();
    process.once('SIGINT', () => controller.abort());
    process.once('SIGTERM', () => controller.abort());
    consumeStream({ dbPath, controller }).catch((error) => {
      console.error(`Latent stream failed: ${error.message}`);
      process.exitCode = 1;
    });
  }
}
