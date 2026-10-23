// Bee CLI adapter for Ambient's ingest layer.
//
// Documentation used (read before writing these calls):
//   - https://docs.bee.computer/docs/cli            (command reference: me, conversations list/get,
//                                                    facts list/get, todos list/get, changed)
//   - https://docs.bee.computer/docs/agentic-sync   (incremental loop: `bee changed --cursor <cursor>`,
//                                                    JSON exposes meta.next_cursor)
//   - https://docs.bee.computer/docs/api            (the CLI is the supported client for the same /v1/* data)
//   - https://github.com/bee-computer/bee-cli       (CLI source, confirms list/get are the only conversation reads
//                                                    at 0.6.0; `conversations transcript` and `todos suggestions`
//                                                    are documented but absent from this build)
//
// Exact JSON field names below were not guessed: they were captured from an
// authenticated `@beeai/cli 0.6.0` run on this machine (see app/README.md
// "Bee API calls"). The shapes recorded then are:
//
//   bee me --json                  -> { id, first_name, last_name, timezone }
//   bee conversations list --json  -> { conversations: [ { id, start_time, end_time, device_type,
//                                       summary, short_summary, state, created_at, updated_at,
//                                       utterances_count, primary_location } ],
//                                       next_cursor, timezone }
//   bee conversations get <id>     -> { conversation: { ...the list fields...,
//                                       transcriptions: [ { id, realtime, utterances: [ { id, realtime,
//                                       start, end, spoken_at, text, speaker, created_at } ] } ],
//                                       suggested_links, primary_location }, timezone }
//   bee facts list --json          -> { facts: [ { id, text, tags, created_at, confirmed } ],
//                                       next_cursor, timezone }
//   bee facts get <id> --json      -> { id, text, tags, created_at, confirmed, timezone }
//   bee todos list --json          -> { todos: [ { id, text, alarm_at, completed, created_at,
//                                       corrections } ], next_cursor, timezone }
//   bee todos get <id> --json      -> { id, text, alarm_at, completed, created_at, corrections, timezone }
//   bee changed --json             -> { meta: { next_cursor, since, until, updated, timezone },
//                                       facts: [], todos: [], dailies: [], conversations: [], journals: [] }
//
// Timestamps arrive as epoch milliseconds unless noted. `alarm_at` is documented
// as epoch ms on output even though it is ISO 8601 on input
// (https://docs.bee.computer/docs/api).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export class BeeError extends Error {
  constructor(message, { code = 'bee_error', detail = '' } = {}) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

let binary = process.env.BEE_BIN || 'bee';

/** Point the adapter at another binary (used by tests). */
export function setBeeBinary(path) {
  binary = path;
}

/** Run one Bee CLI command and return raw stdout. */
export async function beeRaw(args, { timeout = 30000 } = {}) {
  try {
    const { stdout } = await exec(binary, args, { timeout, maxBuffer: 32 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    const stderr = String(error.stderr || '').trim();
    if (/ENOENT|not found/i.test(String(error.message))) {
      throw new BeeError(
        'The Bee CLI is not installed or not on PATH. Install it with `npm install -g @beeai/cli`, then run `bee login`.',
        { code: 'bee_missing', detail: stderr },
      );
    }
    if (/Not logged in|login/i.test(stderr)) {
      throw new BeeError('Not signed in to Bee. Run `bee login` in your terminal, then retry.', {
        code: 'bee_unauthenticated',
        detail: stderr,
      });
    }
    throw new BeeError(`Bee command failed: bee ${args.join(' ')}`, {
      code: 'bee_command_failed',
      detail: stderr || String(error.message),
    });
  }
}

/** Run one Bee CLI command with `--json` and parse the result. */
export async function beeJson(args, options) {
  const raw = await beeRaw([...args, '--json'], options);
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new BeeError(`Bee returned output that is not JSON for: bee ${args.join(' ')}`, {
      code: 'bee_bad_json',
    });
  }
}

/** `bee me` — the authenticated owner profile. https://docs.bee.computer/docs/cli#bee-me */
export async function getProfile() {
  const profile = await beeJson(['me']);
  if (!profile || typeof profile !== 'object') {
    throw new BeeError('Bee did not return a profile. Run `bee login` and retry.', { code: 'bee_no_profile' });
  }
  return {
    id: profile.id ?? null,
    firstName: typeof profile.first_name === 'string' ? profile.first_name : '',
    lastName: typeof profile.last_name === 'string' ? profile.last_name : '',
    timezone: typeof profile.timezone === 'string' ? profile.timezone : 'UTC',
  };
}

/** `bee changed [--cursor]` — incremental changefeed. https://docs.bee.computer/docs/agentic-sync */
export async function getChanged(cursor, { limit, timeout } = {}) {
  const args = ['changed'];
  if (cursor) args.push('--cursor', cursor);
  try {
    const data = await beeJson(args, { timeout });
    const meta = data?.meta && typeof data.meta === 'object' ? data.meta : {};
    return {
      nextCursor: typeof meta.next_cursor === 'string' ? meta.next_cursor : null,
      since: Number.isFinite(meta.since) ? meta.since : null,
      until: Number.isFinite(meta.until) ? meta.until : null,
      changed: {
        conversations: idsOf(data?.conversations),
        todos: idsOf(data?.todos),
        facts: idsOf(data?.facts),
      },
      raw: data,
    };
  } catch (error) {
    // A cursor older than the server's retention window is rejected. The
    // documented recovery is to restart the window without a cursor.
    if (error instanceof BeeError && /cursor_too_old/i.test(error.detail)) {
      const data = await beeJson(['changed'], { timeout });
      const meta = data?.meta && typeof data.meta === 'object' ? data.meta : {};
      return {
        nextCursor: typeof meta.next_cursor === 'string' ? meta.next_cursor : null,
        since: Number.isFinite(meta.since) ? meta.since : null,
        until: Number.isFinite(meta.until) ? meta.until : null,
        changed: {
          conversations: idsOf(data?.conversations),
          todos: idsOf(data?.todos),
          facts: idsOf(data?.facts),
        },
        raw: data,
        resetCursor: true,
      };
    }
    throw error;
  }
}

/** Pull ids out of a changed-entity array whose element shape the docs do not pin down. */
function idsOf(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (item === null || item === undefined) return null;
      if (typeof item === 'number' || typeof item === 'string') return String(item);
      if (typeof item === 'object') {
        const candidate = item.id ?? item.conversation_id ?? item.conversationId ?? item.todo_id ?? item.fact_id;
        return candidate === undefined || candidate === null ? null : String(candidate);
      }
      return null;
    })
    .filter((id) => id !== null && /^-?\d+$/.test(id));
}

/** Page through a list command using the documented `next_cursor` field. */
async function pageAll(command, { max = 100, limit = 50, timeout } = {}) {
  const items = [];
  let cursor = null;
  let pages = 0;
  do {
    const args = [...command, '--limit', String(limit)];
    if (cursor) args.push('--cursor', cursor);
    const data = await beeJson(args, { timeout });
    const list = arrayField(data, command[0]);
    items.push(...list);
    cursor = typeof data?.next_cursor === 'string' ? data.next_cursor : null;
    pages += 1;
    if (pages > 200) break;
  } while (cursor && items.length < max);
  return items.slice(0, max);
}

/**
 * The list commands wrap their rows in a named key (`conversations`, `facts`,
 * `todos`) per the CLI reference. Fall back to any array field so a minor
 * server rename degrades to "empty" instead of throwing.
 */
function arrayField(data, name) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data[name])) return data[name];
  for (const value of Object.values(data)) if (Array.isArray(value)) return value;
  return [];
}

/** `bee conversations list` — summaries only. https://docs.bee.computer/docs/cli#bee-conversations-list */
export async function listConversations(options) {
  return pageAll(['conversations', 'list'], options);
}

/** `bee conversations get <id>` — full transcript with utterances. */
export async function getConversation(id, { timeout } = {}) {
  const data = await beeJson(['conversations', 'get', String(id)], { timeout });
  const conversation = data?.conversation ?? data;
  if (!conversation || typeof conversation !== 'object') {
    throw new BeeError(`Bee returned no conversation for id ${id}.`, { code: 'bee_no_conversation' });
  }
  return { conversation, timezone: data?.timezone ?? null };
}

/** `bee todos list`. https://docs.bee.computer/docs/cli#bee-todos-list */
export async function listTodos(options) {
  return pageAll(['todos', 'list'], options);
}

/** `bee facts list`. https://docs.bee.computer/docs/cli#bee-facts-list */
export async function listFacts(options, { unconfirmed = false } = {}) {
  const args = ['facts', 'list'];
  if (unconfirmed) args.push('--unconfirmed');
  return pageAll(args, options);
}

/** `bee todos get <id>` (flat object). */
export async function getTodo(id, { timeout } = {}) {
  return beeJson(['todos', 'get', String(id)], { timeout });
}

/** `bee facts get <id>` (flat object). */
export async function getFact(id, { timeout } = {}) {
  return beeJson(['facts', 'get', String(id)], { timeout });
}
