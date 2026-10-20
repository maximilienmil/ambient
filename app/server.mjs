// Local server for the Latent app.
//
// Serves the phone-shell UI and a small JSON API over the SQLite ledger written
// by the ingest layer. Binds to loopback only, requires a per-run token on every
// /api call, and rejects cross-origin and cross-site requests.

import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { readFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
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
import { describeRole } from './decide/provider.mjs';

// Local configuration is ignored by git. Loading it never invokes a model.
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
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

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
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
  ['/', ['workspace.html', 'text/html']],
  ['/index.html', ['workspace.html', 'text/html']],
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
  ['/fonts/fonetika-400.woff2', ['fonts/fonetika-400.woff2', 'font/woff2']],
  ['/fonts/fonetika-500.woff2', ['fonts/fonetika-500.woff2', 'font/woff2']],
  ['/fonts/fonetika-600.woff2', ['fonts/fonetika-600.woff2', 'font/woff2']],
  ['/fonts/fonetika-700.woff2', ['fonts/fonetika-700.woff2', 'font/woff2']],
  ['/fonts/fonetika-800.woff2', ['fonts/fonetika-800.woff2', 'font/woff2']],
  ['/fonts/fonetika-mono-400.woff2', ['fonts/fonetika-mono-400.woff2', 'font/woff2']],
  ['/fonts/fonetika-mono-500.woff2', ['fonts/fonetika-mono-500.woff2', 'font/woff2']],
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
  if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) {
    fail('Invalid host.', 403);
  }
  if (req.headers.origin && ![origin, `http://localhost:${port}`].includes(req.headers.origin)) {
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

const server = http.createServer(async (req, res) => {
  try {
    checkRequest(req);
    const url = new URL(req.url, origin);
    const route = url.pathname;
    const method = req.method;

    if (method === 'GET' && route === '/api/session') {
      return send(res, 200, { token, extractor: 'offline-rules-v1', preview: PREVIEW });
    }
    if (route.startsWith('/api/') && req.headers['x-latent-token'] !== token) {
      fail('Session expired. Reload this page.', 403);
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
      return send(res, 200, FIXTURE ? { ...changeset, preview: true } : changeset);
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

server.listen(port, '127.0.0.1', () => {
  console.log(`Latent is running at ${origin}`);
  console.log(`Ledger: ${dbPath}${FIXTURE || dbPath.includes('fixture') ? ' (fixture mode)' : ''}`);
});
process.on('SIGINT', () => server.close(() => {
  db.close();
  process.exit(0);
}));
