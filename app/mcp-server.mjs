#!/usr/bin/env node
// Ambient MCP server over stdio: newline-delimited JSON-RPC on stdin/stdout.
// The same tools are served over Streamable HTTP at /mcp by server.mjs.
//
// Run:  node mcp-server.mjs
// Env:  LATENT_DB   path to the ledger (default app/data/latent.sqlite)

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { openDb } from './db.mjs';
import { createTools } from './mcp-tools.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.LATENT_DB || path.join(root, 'data', 'latent.sqlite');
if (!existsSync(dbPath)) {
  process.stderr.write(`ambient: no ledger at ${dbPath}. Run "npm run ingest" first.\n`);
  process.exit(1);
}
const db = openDb(dbPath);
const { handle } = createTools({ db, dbPath });

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
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
        const task = handle(JSON.parse(line)).then((m) => { if (m) send(m); }).catch(() => {});
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

process.stderr.write(`ambient mcp ready: ${dbPath}\n`);
