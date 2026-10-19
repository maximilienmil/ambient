#!/usr/bin/env node
// Latent MCP server.
//
// One tool layer over the same SQLite ledger the app reads, so an agent and the
// screen can never disagree about how many rows are open. Transport is the MCP
// stdio convention: newline-delimited JSON-RPC on stdin/stdout. Nothing is
// written to stdout except protocol messages; diagnostics go to stderr.
//
// Run:  node mcp-server.mjs
// Env:  LATENT_DB   path to the ledger (default app/data/latent.sqlite)

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { openDb } from './db.mjs';
import * as L from './ledger.mjs';
import { generateChangeset } from './reconcile.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.LATENT_DB || path.join(root, 'data', 'latent.sqlite');
const PROTOCOL = '2024-11-05';

if (!existsSync(dbPath)) {
  process.stderr.write(`latent: no ledger at ${dbPath}. Run "npm run ingest" first.\n`);
  process.exit(1);
}
const db = openDb(dbPath);

const money = (value) => (Number.isFinite(value) ? Math.round(value * 1000) / 10 : null);

function openRows() {
  return L.listItems(db).filter((item) => item.state === 'live' || item.state === 'blocked');
}

function summary() {
  const ledger = L.buildLedger(db);
  const open = openRows();
  const oldest = open.slice().sort((a, b) => b.age - a.age)[0] || null;
  const span = db
    .prepare('SELECT COUNT(*) AS n, MIN(start_time) AS first, MAX(start_time) AS last FROM conversations')
    .get();
  const days = span?.first && span?.last ? Math.round((span.last - span.first) / 86_400_000) : 0;
  const base = ledger.today?.baseRate || null;
  const todoCounts = db.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) AS done FROM bee_todos').get();
  return {
    owner: ledger.owner,
    conversations: span?.n ?? 0,
    daysOfRecord: days,
    todos: {
      total: todoCounts.total,
      done: todoCounts.done || 0,
      open: todoCounts.total - (todoCounts.done || 0),
    },
    duplicateRows: ledger.today?.duplicateRows ?? 0,
    duplicateGroups: (ledger.today?.duplicates || []).length,
    baseRate: base ? money(base.rate) : null,
    oldestOpenDays: oldest ? oldest.age : null,
    lastReadAt: ledger.sync?.at || ledger.lastRun || null,
  };
}

const TOOLS = [
  {
    name: 'latent_reconcile',
    description:
      'Read a reversible changeset proposal for exact duplicate Bee todos and unconfirmed facts. It never applies changes; unsupported facts are held with their source receipt.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'latent_slip_risk',
    description:
      'List older open commitments as a review queue. No completion model or calibrated slip probability is available, so this returns reasons and no risk percentages.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', minimum: 1, maximum: 20, default: 5 } },
      additionalProperties: false,
    },
  },
  {
    name: 'latent_record',
    description:
      'Read the audit of the Bee record: how many conversations, how many days, how many open todos, how many duplicate rows, and the measured completion rate.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'latent_open_items',
    description:
      'List open commitments, most urgent first. A due date comes before an undated row; ties break on age. Returns the reason for each position.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'latent_duplicates',
    description:
      'List groups of rows that say the same thing, so they can be merged. Bee writes a todo again whenever a conversation mentions it.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'latent_should_act',
    description:
      'Choose the one row to act on now, with the reason and the suggested action. This is the agent entry point: it explains itself instead of returning a bare score.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'latent_merge',
    description:
      'Merge duplicate rows. Pass ids for one group, or all=true for every group. The copy carrying a due date is kept. Writes a receipt per group.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 20 },
        all: { type: 'boolean', default: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'latent_close',
    description:
      'Close one open todo and write a receipt. This changes the ledger the app is showing, so the open count drops immediately.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', minLength: 1 } },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

function rank(items) {
  return items.slice().sort((a, b) => {
    const due = (a.dueAt ? 0 : 1) - (b.dueAt ? 0 : 1);
    if (due !== 0) return due;
    return b.age - a.age;
  });
}

function whyOf(item) {
  if (item.dueAt) {
    const due = new Date(item.dueAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    if (day < today) return `It was due ${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`;
    if (day.getTime() === today.getTime()) return 'It is due today.';
    return `It is due ${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`;
  }
  if (item.age >= 21) return `It has been open for ${item.age} days.`;
  return 'It is the oldest open row without a due date.';
}

const HANDLERS = {
  async latent_reconcile() {
    return generateChangeset(dbPath);
  },

  latent_slip_risk(args = {}) {
    const limit = Math.min(20, Math.max(1, Number(args.limit) || 5));
    return {
      available: false,
      reason: 'No independently labeled outcomes are available to estimate slip risk.',
      rankedForReview: rank(openRows()).slice(0, limit).map((item) => ({
        id: item.id,
        title: item.title,
        daysOpen: item.age,
        dueAt: item.dueAt || null,
        why: whyOf(item),
      })),
      probability: null,
    };
  },

  latent_record() {
    return summary();
  },

  latent_open_items(args = {}) {
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 10));
    return rank(openRows()).slice(0, limit).map((item) => ({
      id: item.id,
      title: item.title,
      daysOpen: item.age,
      dueAt: item.dueAt || null,
      state: item.state,
      why: whyOf(item),
    }));
  },

  latent_duplicates() {
    const today = L.buildLedger(db).today || {};
    return {
      groups: today.duplicates || [],
      surplusRows: today.duplicateRows || 0,
    };
  },

  latent_should_act() {
    const open = rank(openRows());
    if (!open.length) {
      return { item: null, why: 'Nothing is open. Every row has been closed or retired.' };
    }
    const item = open[0];
    return {
      item: { id: item.id, title: item.title, daysOpen: item.age, dueAt: item.dueAt || null },
      why: whyOf(item),
      suggestion: item.dueAt
        ? 'It is overdue. Decide whether to do it now, reschedule it, or retire it.'
        : 'It is the oldest open row. Decide whether to do it, or retire it.',
      alternatives: open.slice(1, 4).map((row) => ({ id: row.id, title: row.title, daysOpen: row.age })),
    };
  },

  latent_merge(args = {}) {
    if (args.all) {
      const result = L.mergeAllDuplicates(db, { actor: 'agent' });
      return { ...result, ...summary() };
    }
    const ids = Array.isArray(args.ids) ? args.ids.map(String) : [];
    if (ids.length < 2) {
      const error = new Error('Pass at least two ids, or all=true.');
      error.code = -32602;
      throw error;
    }
    const result = L.mergeCommitments(db, ids, { actor: 'agent' });
    return { groups: 1, ...result, ...summary() };
  },

  latent_close(args = {}) {
    const id = String(args.id || '');
    if (!id) {
      const error = new Error('id is required.');
      error.code = -32602;
      throw error;
    }
    const result = L.approveCommitment(db, id, { actor: 'agent' });
    return {
      item: { id: result.item?.id, title: result.item?.title, state: result.item?.state },
      receipt: { title: result.receipt?.title, detail: result.receipt?.detail, at: result.receipt?.at },
      ...summary(),
    };
  },
};

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(request) {
  const { id, method, params } = request;

  if (method === 'initialize') {
    return send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: 'latent', version: '0.1.0' },
      },
    });
  }
  if (method === 'notifications/initialized' || method === 'initialized') {
    return; // notification: no response
  }
  if (method === 'ping') {
    return send({ jsonrpc: '2.0', id, result: {} });
  }
  if (method === 'tools/list') {
    return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  }
  if (method === 'tools/call') {
    const name = params?.name;
    const handler = HANDLERS[name];
    if (!handler) {
      return send({ jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${name}` } });
    }
    try {
      const data = await handler(params?.arguments || {});
      return send({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] },
      });
    } catch (error) {
      return send({
        jsonrpc: '2.0',
        id,
        error: { code: error.code || -32603, message: error.message || 'Tool failed.' },
      });
    }
  }
  return send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } });
}

let buffer = '';
const inFlight = new Set();
let inputEnded = false;
function finishIfIdle() {
  if (inputEnded && inFlight.size === 0) db.close();
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let index = buffer.indexOf('\n');
  while (index !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) {
      try {
        const task = handle(JSON.parse(line)).catch(() => {});
        inFlight.add(task);
        task.finally(() => {
          inFlight.delete(task);
          finishIfIdle();
        });
      } catch (error) {
        send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      }
    }
    index = buffer.indexOf('\n');
  }
});
process.stdin.on('end', () => {
  inputEnded = true;
  finishIfIdle();
});

process.stderr.write(`latent mcp ready: ${dbPath}\n`);
