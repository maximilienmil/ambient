#!/usr/bin/env node
// Latent ingest layer.
//
// Reads live data from the wearer's own Bee account through the Bee CLI
// (https://docs.bee.computer/docs/cli) and stores it locally in SQLite.
//
//   npm run ingest                      incremental: pulls what changed since the last run
//   npm run ingest -- --full            backfill: walks conversations/todos/facts from the top
//   npm run ingest -- --conversations 5 cap the backfill at 5 conversations
//
// Incrementality uses `bee changed --cursor <cursor>` and stores `meta.next_cursor`
// (https://docs.bee.computer/docs/agentic-sync). The cursor is persisted only
// after every fetched entity has been written, so a crash re-reads the same batch.
//
// Redaction: only the wearer's own utterances are stored, verbatim. Everyone
// else is dropped before storage and reported as a count. See redact.mjs.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as bee from './bee.mjs';
import { ownerLabelSet, redactConversation } from './redact.mjs';
import { commitmentId, extractCommitments, explicitDueDate } from './extract.mjs';
import {
  counts as dbCounts,
  getState,
  logEvent,
  openDb,
  reconcileTodoState,
  removeStaleConversationCommitments,
  saveCommitment,
  setState,
  upsertBeeTodo,
  upsertConversation,
  upsertFact,
  upsertUtterances,
} from './db.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

export function parseArgs(argv) {
  const options = {
    full: false,
    quiet: false,
    strict: process.env.LATENT_STRICT_REDACTION === '1',
    // The account holds more than a year of conversations. The old default of
    // 25 made "a year of data" false and left the record with one month.
    conversations: 2000,
    maxTodos: 500,
    maxFacts: 500,
    db: process.env.LATENT_DB || path.join(root, 'data', 'latent.sqlite'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--full') options.full = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--conversations') options.conversations = Number(argv[++i]);
    else if (arg === '--max-todos') options.maxTodos = Number(argv[++i]);
    else if (arg === '--max-facts') options.maxFacts = Number(argv[++i]);
    else if (arg === '--db') options.db = argv[++i];
    else if (arg === '--help' || arg === '-h') options.help = true;
  }
  return options;
}

const HELP = `Latent · bee ingest

  node ingest.mjs [options]

  --full                backfill from the top instead of using the changed cursor
  --conversations N     max conversations to backfill (default 25)
  --max-todos N         max Bee todos to pull in a backfill (default 500)
  --max-facts N         max Bee facts to pull in a backfill (default 500)
  --strict              fail closed: drop any utterance whose speaker is not the wearer by name
  --db PATH             SQLite file (default app/data/latent.sqlite)
  --quiet               only print the final summary line

Redaction: only the wearer's utterances are stored. A conversation whose single
speaker label does not match the wearer's name is still attributed to the wearer
by default (assumed-single-speaker, recorded on every row). Pass --strict to
refuse that assumption and store no speech from such conversations.
`;

/**
 * Run one ingest pass.
 * `adapter` defaults to the real Bee CLI; tests inject a stub.
 */
export async function runIngest(options, adapter = bee) {
  const startedAt = new Date().toISOString();
  const ownsDb = !options.dbHandle;
  const db = options.dbHandle || openDb(options.db);
  const log = [];
  const emit = (line) => {
    log.push(line);
    if (!options.quiet) console.log(line);
  };

  try {
    const profile = await adapter.getProfile();
    const owner = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || 'You';
    const ownerLabels = ownerLabelSet(profile);

    emit(`Latent ingest · ${startedAt}`);
    emit(`Signed in as ${owner} (${profile.timezone}).`);
    emit(`SQLite: ${options.db}`);

    const cursor = getState(db, 'bee.changed.cursor');
    const backfill = options.full || !cursor;
    const mode = backfill ? 'backfill' : 'incremental';
    emit(`Mode: ${mode}${cursor ? ` from cursor ${cursor}` : ''}.`);

    // ---- discover what to read -------------------------------------------------
    let conversationIds = [];
    let todoIds = [];
    let factIds = [];
    let nextCursor = cursor;

    if (backfill) {
      const list = await adapter.listConversations({ max: options.conversations, limit: 100 });
      conversationIds = list.map((c) => String(c.id));
      emit(`Bee conversations available: ${list.length} (cap ${options.conversations}).`);
    } else {
      const changed = await adapter.getChanged(cursor);
      nextCursor = changed.nextCursor || cursor;
      conversationIds = changed.changed.conversations;
      todoIds = changed.changed.todos;
      factIds = changed.changed.facts;
      if (changed.resetCursor) emit('Bee rejected the stored cursor as too old; the window was reset.');
      emit(
        `Changed since ${new Date(changed.since || Date.now()).toISOString()}: ` +
          `${conversationIds.length} conversations, ${todoIds.length} todos, ${factIds.length} facts.`,
      );
    }

    // ---- conversations ---------------------------------------------------------
    let conversationFetched = 0;
    let utterancesKept = 0;
    let utterancesDropped = 0;
    let droppedEmpty = 0;
    let commitmentsNew = 0;
    let commitmentsSeen = 0;
    let rejected = 0;
    let removedStale = 0;
    let assumedSingleSpeaker = 0;
    const unresolved = [];

    for (const id of conversationIds) {
      let payload;
      try {
        payload = await adapter.getConversation(id);
      } catch (error) {
        emit(`  ! conversation ${id}: ${error.message}`);
        continue;
      }
      const { conversation } = payload;
      const redaction = redactConversation(conversation, ownerLabels, {
        allowSingleSpeaker: !options.strict,
      });
      upsertConversation(db, conversation, redaction);
      upsertUtterances(db, conversation.id, redaction.kept);

      const { candidates, rejected: rejectedRows } = extractCommitments(redaction.kept, owner);
      rejected += rejectedRows.length;
      let createdHere = 0;
      const keepIds = [];
      for (const candidate of candidates) {
        const id_ = commitmentId(String(conversation.id), candidate.origin, candidate.originId, candidate.quote);
        keepIds.push(id_);
        const result = saveCommitment(db, {
          id: id_,
          text: candidate.text,
          quote: candidate.quote,
          owner,
          counterparty: candidate.counterparty,
          sourceConversationId: String(conversation.id),
          spanStart: candidate.spanStart,
          spanEnd: candidate.spanEnd,
          createdAt: candidate.spokenAt ? new Date(candidate.spokenAt).toISOString() : startedAt,
          dueAt: candidate.dueAt,
          state: 'live',
          tier: candidate.tier,
          evidence: {
            ...candidate.evidence,
            conversationId: String(conversation.id),
            redaction: redaction.resolution,
            wearerLabel: redaction.wearerLabel,
            droppedBystanderUtterances: redaction.dropped.otherSpeaker,
          },
        });
        if (result.created) createdHere += 1;
      }
      // If redaction tightened (for example with --strict), rows this pass no
      // longer produces are removed rather than left behind with stale evidence.
      removedStale += removeStaleConversationCommitments(db, conversation.id, keepIds);
      commitmentsNew += createdHere;
      commitmentsSeen += candidates.length;
      conversationFetched += 1;
      utterancesKept += redaction.kept.length;
      utterancesDropped += redaction.dropped.otherSpeaker;
      droppedEmpty += redaction.dropped.empty;

      if (redaction.resolution === 'assumed-single-speaker') {
        assumedSingleSpeaker += 1;
      } else if (redaction.resolution !== 'profile-name-match') {
        unresolved.push({
          id: String(conversation.id),
          resolution: redaction.resolution,
          wearerLabel: redaction.wearerLabel,
        });
      }
      emit(
        `  conversation ${conversation.id}: ${redaction.dropped.total} utterances, ` +
          `${redaction.kept.length} kept, ${redaction.dropped.otherSpeaker} dropped ` +
          `(${redaction.resolution}) · +${createdHere} commitments`,
      );
    }

    // ---- Bee todos (owner-authored action items) -------------------------------
    let todosFetched = 0;
    let todosNew = 0;
    let todoIdsToRead = todoIds;

    if (backfill) {
      const list = await adapter.listTodos({ max: options.maxTodos, limit: 50 });
      todoIdsToRead = list.map((t) => String(t.id));
      for (const todo of list) await storeTodo(todo);
    } else {
      for (const id of todoIds) {
        try {
          await storeTodo(await adapter.getTodo(id));
        } catch (error) {
          emit(`  ! todo ${id}: ${error.message}`);
        }
      }
    }

    async function storeTodo(todo) {
      if (!todo || todo.id === undefined || todo.id === null) return;
      upsertBeeTodo(db, todo);
      todosFetched += 1;
      const id_ = commitmentId(null, 'bee_todo', `todo:${todo.id}`, String(todo.text ?? ''));
      const created = saveCommitment(db, {
        id: id_,
        text: String(todo.text ?? '').trim() || '(untitled Bee todo)',
        quote: String(todo.text ?? ''),
        owner,
        counterparty: null,
        sourceConversationId: null,
        spanStart: 0,
        spanEnd: String(todo.text ?? '').length,
        createdAt: todo.created_at ? new Date(todo.created_at).toISOString() : startedAt,
        dueAt: todo.alarm_at ? new Date(todo.alarm_at).toISOString() : explicitDueDate(String(todo.text ?? '')),
        state: 'live',
        tier: null,
        evidence: {
          origin: 'bee_todo',
          beeTodoId: String(todo.id),
          completed: Boolean(todo.completed),
          note: 'Imported from Bee todos; tier and scores are assigned by the decision layer.',
        },
      });
      if (created.created) todosNew += 1;
      reconcileTodoState(db, id_, Boolean(todo.completed), todo.created_at);
    }

    // ---- Bee facts (the owner's memory, used to ground the Twin) ---------------
    let factsFetched = 0;
    if (backfill) {
      const list = await adapter.listFacts({ max: options.maxFacts, limit: 50 });
      for (const fact of list) {
        upsertFact(db, fact);
        factsFetched += 1;
      }
    } else {
      for (const id of factIds) {
        try {
          const fact = await adapter.getFact(id);
          if (fact) {
            upsertFact(db, fact);
            factsFetched += 1;
          }
        } catch (error) {
          emit(`  ! fact ${id}: ${error.message}`);
        }
      }
    }

    // ---- persist progress ------------------------------------------------------
    // A backfill has no cursor yet. The documented bootstrap is one `bee changed`
    // call without a cursor, which returns the current position to resume from
    // (https://docs.bee.computer/docs/agentic-sync).
    if (backfill) {
      try {
        const seed = await adapter.getChanged(null);
        if (seed?.nextCursor) nextCursor = seed.nextCursor;
      } catch (error) {
        emit(`  ! could not read a starting cursor: ${error.message}`);
      }
    }
    if (nextCursor) setState(db, 'bee.changed.cursor', nextCursor);
    setState(db, 'bee.last_run', startedAt);
    setState(db, 'bee.owner', owner);
    setState(db, 'bee.timezone', profile.timezone);

    const totals = dbCounts(db);
    const summary = {
      at: startedAt,
      mode,
      conversationsFetched: conversationFetched,
      utterancesKept,
      utterancesDroppedOtherSpeaker: utterancesDropped,
      utterancesDroppedEmpty: droppedEmpty,
      commitmentsFromConversations: commitmentsSeen,
      commitmentsNew,
      commitmentsRejected: rejected,
      commitmentsRemovedStale: removedStale,
      beeTodosFetched: todosFetched,
      beeTodosNew: todosNew,
      factsFetched,
      assumedSingleSpeaker,
      unresolvedWearer: unresolved.length,
      totals,
    };

    logEvent(db, 'ingest', `${mode}: ${conversationFetched} conversations, ${todosFetched} todos, ${factsFetched} facts`, {
      mode,
      utterancesKept,
      utterancesDroppedOtherSpeaker: utterancesDropped,
      assumedSingleSpeaker,
    });

    emit('');
    emit(`Fetched: ${conversationFetched} conversations, ${todosFetched} Bee todos, ${factsFetched} Bee facts.`);
    emit(
      `Stored: ${commitmentsNew} new commitments (${commitmentsSeen} candidates from conversations, ${todosNew} from todos).`,
    );
    if (removedStale) emit(`Removed: ${removedStale} conversation commitments no longer produced by this redaction.`);
    emit(`Dropped: ${utterancesDropped} bystander utterances, ${droppedEmpty} empty. Bystander text was never stored.`);
    if (assumedSingleSpeaker) {
      emit(
        `Assumed wearer in ${assumedSingleSpeaker} single-speaker conversation(s) ` +
          '(no name match; recorded as assumed-single-speaker). Use --strict to refuse this.',
      );
    }
    if (unresolved.length) {
      emit(`${unresolved.length} conversation(s) had no attributable wearer; no speech was stored from them.`);
    }
    emit(
      `Totals now: ${totals.commitments} commitments (${totals.live} live) · ` +
        `${totals.conversations} conversations · ${totals.facts} facts · ${totals.beeTodos} Bee todos.`,
    );
    if (nextCursor) emit(`Cursor saved: ${nextCursor}`);

    return { ok: true, summary, log };
  } finally {
    if (ownsDb) db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    process.exit(0);
  }
  runIngest(options)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`\nIngest failed: ${error.message}`);
      if (error.detail) console.error(error.detail.split('\n').slice(0, 4).join('\n'));
      if (error.code === 'bee_missing' || error.code === 'bee_unauthenticated') {
        console.error('Bee CLI must be installed and signed in: npm i -g @beeai/cli && bee login');
      }
      process.exit(1);
    });
}
