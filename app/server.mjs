// Local server for the Latent app.
//
// Serves the phone-shell UI and a small JSON API over the SQLite ledger written
// by the ingest layer. Binds to loopback only, requires a per-run token on every
// /api call, and rejects cross-origin and cross-site requests.

import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { migrate } from './db.mjs';
import * as L from './ledger.mjs';
import { previewLedger } from './preview-data.mjs';
import { generateChangeset } from './reconcile.mjs';
import { demoStream } from './stream-handler.mjs';
import { comparePlans } from './horizon.mjs';
import { horizonDemo } from './fixtures/horizon-scenario.mjs';
import { loadCalendars } from './calendar.mjs';
import { growSchema, listGrow, saveGrow, growObservations, suggestGrow } from './grow.mjs';
import { actionSchema, connectorStatus, prepareBundle, getBundle, approveBundle, executeBundle } from './actions.mjs';
import { describeRole, chat } from './decide/provider.mjs';
import { runDecision, runDecide } from './decide/run.mjs';
import { createTools, PROTOCOLS } from './mcp-tools.mjs';

// Local configuration is ignored by git. Loading it never invokes a model.
const envFile = process.env.LATENT_ENV_FILE || fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

/**
 * Preview mode serves a synthetic ledger instead of the real one, so the
 * interface can be built and reviewed without a Bee account. It is the only way
 * the synthetic rows can reach the client, every response carries
 * `preview: true`, and every write is refused — the real database is opened
 * read-only in this mode and is never written to.
 */
const PREVIEW = process.env.PREVIEW === '1';
const FIXTURE = process.env.LATENT_FIXTURE === '1';

/** Preview mode never takes a write. */
function refuseWrite() {
  fail('Preview mode reads a synthetic ledger. It never writes, so nothing was changed.', 409);
}

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.LATENT_DATA_DIR || path.join(root, 'data');
const dbPath = process.env.LATENT_DB || path.join(dataDir, 'latent.sqlite');
const dbDir = path.dirname(dbPath);
mkdirSync(dbDir, { recursive: true, mode: 0o700 });
// Preview mode opens the real ledger read-only and never migrates it, so a
// preview session cannot alter the real database even by accident.
const dbPresent = existsSync(dbPath);
const db = new DatabaseSync(dbPath, { readOnly: PREVIEW && dbPresent });
if (!PREVIEW || !dbPresent) {
  db.exec('PRAGMA journal_mode=WAL');
  migrate(db);
  chmodSync(dbPath, 0o600);
  growSchema(db);
  actionSchema(db);
}

const token = randomBytes(32).toString('hex');
const port = Number(process.env.PORT || 4317);
const origin = `http://127.0.0.1:${port}`;
// Loopback by default. LATENT_BIND=0.0.0.0 plus LATENT_HOSTS=100.x.y.z lets a
// phone on a private network (for example Tailscale) open the app. Opt-in only.
const bindAddress = process.env.LATENT_BIND || '127.0.0.1';
const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, ...String(process.env.LATENT_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean).map((h) => (h.includes(':') ? h : `${h}:${port}`))]);

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; " +
  "connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

function send(res, status, value, type = 'application/json') {
  res.writeHead(status, {
    'Content-Type': `${type}; charset=utf-8`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': CSP,
  });
  res.end(type === 'application/json' ? JSON.stringify(value) : value);
}

// Every file the app ships, with its content type. Nothing is served from
// outside this map, so a path in a request can never reach the filesystem.
const STATIC = new Map([
  ['/assets/horizon-atmosphere.svg', ['assets/horizon-atmosphere.svg', 'image/svg+xml']],
  ['/assets/horizon-grain.svg', ['assets/horizon-grain.svg', 'image/svg+xml']],
  ['/icons/house.svg', ['icons/house.svg', 'image/svg+xml']],
  ['/icons/brain.svg', ['icons/brain.svg', 'image/svg+xml']],
  ['/icons/check-square.svg', ['icons/check-square.svg', 'image/svg+xml']],
  ['/icons/sparkle.svg', ['icons/sparkle.svg', 'image/svg+xml']],
  ['/icons/arrow-right.svg', ['icons/arrow-right.svg', 'image/svg+xml']],
  ['/workspace.js', ['workspace.js', 'text/javascript']],
  ['/workspace.css', ['workspace.css', 'text/css']],
  ['/', ['v5.html', 'text/html']],
  ['/index.html', ['v5.html', 'text/html']],
  ['/v5.css', ['v5.css', 'text/css']],
  ['/v5.js', ['v5.js', 'text/javascript']],
  ['/workspace', ['workspace.html', 'text/html']],
  ['/legacy', ['index.html', 'text/html']],
  ['/tokens.css', ['tokens.css', 'text/css']],
  ['/style.css', ['style.css', 'text/css']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/twin.js', ['twin.js', 'text/javascript']],
  ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json']],
  ['/sw.js', ['sw.js', 'text/javascript']],
  ['/icon-192.png', ['icon-192.png', 'image/png']],
  ['/icon-512.png', ['icon-512.png', 'image/png']],
  ['/apple-touch-icon.png', ['apple-touch-icon.png', 'image/png']],
  ['/fonts/geist-latin-400-normal.woff2', ['fonts/geist-latin-400-normal.woff2', 'font/woff2']],
  ['/fonts/geist-latin-500-normal.woff2', ['fonts/geist-latin-500-normal.woff2', 'font/woff2']],
  ['/fonts/geist-latin-600-normal.woff2', ['fonts/geist-latin-600-normal.woff2', 'font/woff2']],
  ['/fonts/geist-latin-700-normal.woff2', ['fonts/geist-latin-700-normal.woff2', 'font/woff2']],
  ['/fonts/instrument-serif-latin-400-normal.woff2', ['fonts/instrument-serif-latin-400-normal.woff2', 'font/woff2']],
  ['/fonts/instrument-serif-latin-400-italic.woff2', ['fonts/instrument-serif-latin-400-italic.woff2', 'font/woff2']],
]);

function sendFile(res, name, type) {
  const file = path.join(root, 'public', name);
  if (!existsSync(file)) return send(res, 404, { error: 'Not found.' });
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': name === 'sw.js' ? 'no-store' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': CSP,
    'Service-Worker-Allowed': '/',
  });
  res.end(readFileSync(file));
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 150_000) fail('Request too large.', 413);
  }
  try {
    return JSON.parse(data || '{}');
  } catch {
    fail('Invalid JSON.');
  }
}

function checkRequest(req) {
  if (!allowedHosts.has(req.headers.host)) {
    fail('Invalid host.', 403);
  }
  if (req.headers.origin && ![...allowedHosts].map((h) => `http://${h}`).includes(req.headers.origin)) {
    fail('Cross-origin request blocked.', 403);
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') fail('Cross-site request blocked.', 403);
}

// One Bee ingest at a time. The ingest is the only thing that touches the
// network; the API never calls Bee directly.
let syncing = null;

function runIngest() {
  if (syncing) return syncing;
  syncing = new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['ingest.mjs'], {
      cwd: root,
      env: { ...process.env, LATENT_DB: dbPath },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
    });
    child.stderr.on('data', (chunk) => {
      err += chunk;
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ ok: true, log: out.trim().split('\n') });
      else reject(Object.assign(new Error(err.trim() || 'Bee sync failed.'), { status: 502 }));
    });
  }).finally(() => {
    syncing = null;
  });
  return syncing;
}


// Model keys live in the git-ignored root .env, next to the rest of the local
// configuration. The key itself is never sent back to the browser.
const ROLE_PREFIX = { jev: 'JEV', d1: 'D1' };
function writeEnv(updates) {
  const lines = existsSync(envFile) ? readFileSync(envFile, 'utf8').split('\n') : [];
  for (const [key, value] of Object.entries(updates)) {
    const at = lines.findIndex((line) => line.startsWith(`${key}=`));
    const entry = `${key}=${value}`;
    if (at >= 0) lines[at] = entry; else lines.push(entry);
    process.env[key] = value;
  }
  writeFileSync(envFile, lines.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 });
}
function modelsStatus() {
  const out = {};
  for (const role of ['jev', 'd1']) {
    const d = describeRole(role);
    out[role] = { configured: d.configured, baseUrl: d.baseUrl, model: d.model, hasKey: !d.missing.includes(`${ROLE_PREFIX[role]}_API_KEY`), missing: d.missing };
  }
  return out;
}
// MCP over Streamable HTTP (spec 2025-11-25): POST /mcp with JSON-RPC, JSON responses,
// no server-initiated stream. Loopback callers need nothing; any other caller must send
// Authorization: Bearer $LATENT_MCP_TOKEN, and without that variable remote MCP is off.
const mcp = createTools({ db, dbPath, dataDir });
const mcpSessions = new Set();
async function serveMcp(req, res) {
  const head = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  const remote = !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const want = process.env.LATENT_MCP_TOKEN;
  if (remote && (!want || req.headers.authorization !== `Bearer ${want}`)) {
    res.writeHead(401, { ...head, 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' });
    return res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } }));
  }
  if (req.method === 'GET') { res.writeHead(405, { ...head, Allow: 'POST, DELETE' }); return res.end(); }
  if (req.method === 'DELETE') { mcpSessions.delete(req.headers['mcp-session-id']); res.writeHead(204, head); return res.end(); }
  if (req.method !== 'POST') { res.writeHead(405, { ...head, Allow: 'POST, DELETE' }); return res.end(); }
  const version = req.headers['mcp-protocol-version'];
  if (version && !PROTOCOLS.includes(version)) { res.writeHead(400, { ...head, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message: `Unsupported MCP-Protocol-Version ${version}` } })); }
  const body = await readBody(req);
  const batch = Array.isArray(body) ? body : [body];
  const out = [];
  let session = null;
  for (const message of batch) {
    const reply = await mcp.handle(message);
    if (message?.method === 'initialize' && reply?.result) { session = randomBytes(16).toString('hex'); mcpSessions.add(session); }
    if (reply) out.push(reply);
  }
  if (!out.length) { res.writeHead(202, head); return res.end(); }
  res.writeHead(200, { ...head, 'Content-Type': 'application/json', ...(session ? { 'Mcp-Session-Id': session } : {}) });
  res.end(JSON.stringify(Array.isArray(body) ? out : out[0]));
}

function factReviewSchema() {
  db.exec('CREATE TABLE IF NOT EXISTS fact_reviews (fact_id TEXT PRIMARY KEY, verdict TEXT NOT NULL, at TEXT NOT NULL)');
}
if (!PREVIEW || !dbPresent) factReviewSchema();
function textFor(id) {
  for (const sql of ['SELECT text FROM facts WHERE id=?', 'SELECT text FROM commitments WHERE id=?', 'SELECT text FROM bee_todos WHERE id=?']) {
    try { const row = db.prepare(sql).get(id); if (row?.text) return row.text; } catch {}
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    checkRequest(req);
    const url = new URL(req.url, origin);
    const route = url.pathname;
    const method = req.method;
    if (route === '/mcp') return await serveMcp(req, res);

    if (method === 'GET' && route === '/api/session') {
      return send(res, 200, { token, extractor: 'offline-rules-v1', preview: PREVIEW });
    }
    if (route.startsWith('/api/') && req.headers['x-latent-token'] !== token) {
      fail('Session expired. Reload this page.', 403);
    }

    if (method === 'GET' && route === '/api/models') return send(res, 200, modelsStatus());
    if (method === 'POST' && route === '/api/models') {
      if (PREVIEW) refuseWrite();
      const body = await readBody(req);
      const prefix = ROLE_PREFIX[body.role];
      if (!prefix) fail('Choose jev or d1.');
      const baseUrl = String(body.baseUrl || '').trim();
      const model = String(body.model || '').trim();
      const apiKey = String(body.apiKey || '').trim();
      if (!/^https?:\/\/[^\s]+$/.test(baseUrl)) fail('Base URL must start with http:// or https://.');
      if (!model || /\s/.test(model) || model.length > 200) fail('Name the model without spaces.');
      if (/[\s"'`]/.test(apiKey)) fail('The API key cannot contain spaces or quotes.');
      const updates = { [`${prefix}_BASE_URL`]: baseUrl, [`${prefix}_MODEL`]: model };
      if (apiKey) updates[`${prefix}_API_KEY`] = apiKey;
      writeEnv(updates);
      return send(res, 200, modelsStatus());
    }
    if (method === 'POST' && route === '/api/models/test') {
      const { role } = await readBody(req);
      if (!ROLE_PREFIX[role]) fail('Choose jev or d1.');
      try {
        const r = await chat({ role, messages: [{ role: 'user', content: 'Reply with the single word OK.' }], timeoutMs: 20000 });
        return send(res, 200, { ok: true, latencyMs: r.latencyMs ?? null, reply: String(r.content || '').slice(0, 60) });
      } catch (error) {
        return send(res, 200, { ok: false, message: error.message });
      }
    }
    if (method === 'POST' && route === '/api/decide/item') {
      const { id } = await readBody(req);
      const row = db.prepare('SELECT id, text, quote, owner, counterparty, source_conversation_id, span_start, span_end, created_at, due_at, state, tier, p, jev_scores, d1_scores, evidence FROM commitments WHERE id=?').get(String(id || ''));
      if (!row) fail('That commitment no longer exists.', 404);
      const status = modelsStatus();
      if (!status.jev.configured || !status.d1.configured) return send(res, 200, { configured: false, models: status });
      try {
        const r = await runDecision({ row });
        return send(res, 200, { configured: true, tier: r.tier, p: r.p, reason: r.reason, jev: r.jev, d1: r.d1, latencyMs: r.latencyMs, cost: r.cost, scored: r.scored !== false });
      } catch (error) {
        return send(res, 200, { configured: true, error: error.message });
      }
    }
    if (method === 'POST' && route === '/api/decide/run') {
      if (PREVIEW) refuseWrite();
      const { limit } = await readBody(req);
      const result = await runDecide({ limit: Math.min(50, Math.max(1, Number(limit) || 10)), quiet: true, labels: path.join(root, 'labels.json') }, { db });
      return send(res, 200, { ok: result.ok, decided: result.decided, reason: result.reason || null, missingByRole: result.missingByRole, ledger: L.buildLedger(db) });
    }
    const factMatch = route.match(/^\/api\/facts\/([^/]+)$/);
    if (factMatch && method === 'POST') {
      if (PREVIEW) refuseWrite();
      const { verdict } = await readBody(req);
      if (!['confirmed', 'not_true', 'undo'].includes(verdict)) fail('Choose confirmed or not true.');
      const id = decodeURIComponent(factMatch[1]);
      if (verdict === 'undo') db.prepare('DELETE FROM fact_reviews WHERE fact_id=?').run(id);
      else {
        db.prepare('INSERT OR REPLACE INTO fact_reviews VALUES (?,?,?)').run(id, verdict, new Date().toISOString());
        L.insertReceipt(db, { kind: 'remember', decision: 'remember', title: verdict === 'confirmed' ? 'Confirmed a Bee fact' : 'Marked a Bee fact not true', detail: `${textFor(id) || id}. Recorded in Latent only; Bee was not changed.` });
      }
      return send(res, 200, { ok: true });
    }
    if (method === 'GET' && route === '/api/workspace') {
      const calendar = FIXTURE || PREVIEW ? { events: horizonDemo().input.events, files: 0, synthetic: true } : await loadCalendars(path.join(dataDir, 'calendars'));
      return send(res, 200, { synthetic: FIXTURE || PREVIEW, grow: PREVIEW ? [] : listGrow(db), suggestions: PREVIEW ? [] : suggestGrow(db), observations: PREVIEW ? { daily: [] } : growObservations(db), calendar, connectors: connectorStatus(), models: { d1: { ...describeRole('d1'), state: 'idle', connectivity: 'not_tested' }, jev: { ...describeRole('jev'), state: 'not_run' } } });
    }
    if (method === 'POST' && route === '/api/grow') {
      if (PREVIEW) refuseWrite();
      return send(res, 200, saveGrow(db, await readBody(req)));
    }
    if (method === 'POST' && route === '/api/actions') {
      if (PREVIEW) refuseWrite();
      const payload = await readBody(req);
      if (FIXTURE && payload.executor === 'google' && !connectorStatus().configured) fail('Connect the dedicated demo account before choosing Google.', 409);
      return send(res, 200, prepareBundle(db, payload));
    }
    if (method === 'GET' && route === '/api/actions') {
      return send(res, 200, PREVIEW ? [] : db.prepare('SELECT id FROM action_bundles ORDER BY created_at DESC LIMIT 20').all().map(row => getBundle(db,row.id)));
    }
    const actionMatch = route.match(/^\/api\/actions\/([a-zA-Z0-9-]+)(?:\/(approve|execute))?$/);
    if (actionMatch) {
      if (method === 'GET' && !actionMatch[2]) return send(res, 200, getBundle(db, actionMatch[1]));
      if (method === 'POST') {
        if (PREVIEW) refuseWrite();
        if (actionMatch[2] === 'approve') return send(res, 200, approveBundle(db, actionMatch[1], (await readBody(req)).hash));
        if (actionMatch[2] === 'execute') return send(res, 200, await executeBundle(db, actionMatch[1]));
      }
    }

    // Every source of the ledger goes through one function, so a preview build
    // can never serve the real rows and a real build can never serve synthetic
    // ones. The flag travels with the payload and the client reads it.
    if (method === 'GET' && route === '/api/ledger') {
      const ledger = PREVIEW ? previewLedger() : L.buildLedger(db);
      return send(res, 200, FIXTURE && !PREVIEW ? { ...ledger, preview: true, fixtureMode: true } : ledger);
    }
    if (method === 'GET' && route === '/api/evaluation') {
      const file = path.join(root, 'evaluation-results.json');
      return send(res, 200, existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { status: 'not_run' });
    }
    if (method === 'GET' && route === '/api/horizon/demo') {
      if (!FIXTURE && !PREVIEW) fail('The synthetic scenario is available in demo mode only.', 404);
      return send(res, 200, horizonDemo());
    }
    if (method === 'POST' && route === '/api/horizon/compare') {
      // Calculation only: no source records, approvals, or calendar events change.
      return send(res, 200, comparePlans(await readBody(req)));
    }
    if (method === 'GET' && route === '/api/reconcile') {
      if (PREVIEW) return send(res, 200, { preview: true, summary: { todosToRetire: 0, factsKeptPendingEvidence: 0 }, operations: [] });
      const changeset = await generateChangeset(dbPath);
      changeset.operations = changeset.operations.map((op) => ({ ...op, text: textFor(op.targetId) }));
      const reviews = Object.fromEntries(db.prepare('SELECT fact_id, verdict FROM fact_reviews').all().map((r) => [r.fact_id, r.verdict]));
      return send(res, 200, FIXTURE ? { ...changeset, reviews, preview: true } : { ...changeset, reviews });
    }
    if (method === 'POST' && route === '/api/stream-demo') {
      if (!FIXTURE || PREVIEW) refuseWrite();
      const result = await demoStream({ dbPath });
      return send(res, 200, { ...result, ledger: { ...L.buildLedger(db), preview: true, fixtureMode: true } });
    }

    if (method === 'POST' && route === '/api/sync') {
      if (PREVIEW) refuseWrite();
      const result = await runIngest();
      return send(res, 200, { ...result, ledger: L.buildLedger(db) });
    }

    const cm = route.match(/^\/api\/commitments\/([^/]+)\/(approve|dismiss|edit)$/);
    if (cm && method === 'POST') {
      if (PREVIEW) refuseWrite();
      const result =
        cm[2] === 'approve'
          ? L.approveCommitment(db, cm[1])
          : cm[2] === 'dismiss'
            ? L.dismissCommitment(db, cm[1])
            : L.editCommitment(db, cm[1], await readBody(req));
      return send(res, 200, { ...result, ledger: L.buildLedger(db) });
    }
    if (method === 'POST' && route === '/api/commitments/retire-obsolete') {
      if (PREVIEW) refuseWrite();
      return send(res, 200, { ...L.retireObsolete(db), ledger: L.buildLedger(db) });
    }
    if (method === 'POST' && route === '/api/merge') {
      if (PREVIEW) refuseWrite();
      const body = await readBody(req);
      return send(res, 200, { ...L.mergeCommitments(db, body.ids), ledger: L.buildLedger(db) });
    }
    if (method === 'POST' && route === '/api/merge-all') {
      if (PREVIEW) refuseWrite();
      return send(res, 200, { ...L.mergeAllDuplicates(db), ledger: L.buildLedger(db) });
    }
    if (method === 'POST' && route === '/api/commitments/restore') {
      if (PREVIEW) refuseWrite();
      const body = await readBody(req);
      return send(res, 200, { ...L.restoreCommitments(db, body.entries), ledger: L.buildLedger(db) });
    }

    if (method === 'POST' && route === '/api/plans') {
      if (PREVIEW) refuseWrite();
      const body = await readBody(req);
      return send(res, 200, { ...L.createPlan(db, body), ledger: L.buildLedger(db) });
    }
    const planIcs = route.match(/^\/api\/plans\/([^/]+)\.ics$/);
    if (planIcs && method === 'GET') {
      if (PREVIEW) refuseWrite();
      const file = L.planIcs(db, planIcs[1]);
      res.writeHead(200, {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      return res.end(file.content);
    }
    const planAction = route.match(/^\/api\/plans\/([^/]+)\/(approve|execute|cancel)$/);
    if (planAction && method === 'POST') {
      if (PREVIEW) refuseWrite();
      const body = ['approve'].includes(planAction[2]) ? await readBody(req) : {};
      const result =
        planAction[2] === 'approve'
          ? L.approvePlan(db, planAction[1], body.actor)
          : planAction[2] === 'execute'
            ? L.executePlan(db, planAction[1])
            : L.cancelPlan(db, planAction[1]);
      return send(res, 200, { ...result, ledger: L.buildLedger(db) });
    }

    if (method === 'GET' && STATIC.has(route)) {
      const [name, type] = STATIC.get(route);
      return sendFile(res, name, type);
    }

    send(res, 404, { error: 'Not found.' });
  } catch (error) {
    send(res, error.status || 500, {
      error: error.status
        ? error.message
        : 'An unexpected local error occurred. Your saved data was not replaced.',
    });
  }
});

server.listen(port, bindAddress, () => {
  console.log(`Ambient is running at ${origin}`);
  console.log(`Ledger: ${dbPath}${FIXTURE || dbPath.includes('fixture') ? ' (fixture mode)' : ''}`);
});
process.on('SIGINT', () => server.close(() => {
  db.close();
  process.exit(0);
}));
