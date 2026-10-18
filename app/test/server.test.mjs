import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { openDb, saveCommitment } from '../db.mjs';

const port = 15371;

function seed(dir, rows) {
  const db = openDb(path.join(dir, 'latent.sqlite'));
  for (const row of rows) saveCommitment(db, row);
  db.close();
}

function commitment(id, overrides = {}) {
  const quote = overrides.quote || 'I will send the deck.';
  return {
    id,
    text: overrides.text || 'Send the deck',
    quote,
    owner: 'Maximilian Milovidov',
    counterparty: overrides.counterparty ?? null,
    sourceConversationId: overrides.sourceConversationId ?? null,
    spanStart: 0,
    spanEnd: quote.length,
    createdAt: overrides.createdAt || '2026-10-01T12:00:00.000Z',
    dueAt: overrides.dueAt ?? null,
    state: 'live',
    tier: overrides.tier ?? 'draft',
    evidence: overrides.evidence || { rule: 'first-person-promise' },
  };
}

test('ledger API: security, projections, actions, plans, persistence', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'latent-ledger-'));
  seed(dir, [commitment('seed-a'), commitment('seed-b', { tier: 'ask', text: 'Make dinner plans', quote: 'We should get dinner.' })]);
  let proc;

  async function boot() {
    proc = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, PORT: String(port), LATENT_DATA_DIR: dir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server boot timed out')), 5_000);
      proc.stdout.once('data', () => {
        clearTimeout(timer);
        resolve();
      });
      proc.once('error', reject);
    });
  }
  async function stop() {
    const ended = once(proc, 'exit');
    proc.kill('SIGINT');
    await ended;
  }

  try {
    await boot();
    let token = (await (await fetch(`http://127.0.0.1:${port}/api/session`)).json()).token;
    const request = (route, method = 'GET', body, headers = {}) =>
      fetch(`http://127.0.0.1:${port}/api${route}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Latent-Token': token, ...headers },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

    // security
    assert.equal((await request('/plans', 'POST', { consent: true }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await request('/ledger', 'GET', null, { 'X-Latent-Token': 'wrong' })).status, 403);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/ledger`)).status, 403);
    assert.equal((await request('/nope')).status, 404);

    // the app shell loads from the same origin only, and it is the four-screen app
    const shell = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(shell.status, 200);
    const html = await shell.text();
    assert.match(html, /id="twin-screen"/);
    assert.match(html, /id="commitment-list"/);
    assert.match(html, /id="plan-form"/);
    assert.match(html, /id="receipt-list"/);
    assert.match(html, /href="\/tokens\.css"/);

    // projection
    let ledger = await (await request('/ledger')).json();
    assert.equal(ledger.items.length, 2);
    assert.equal(ledger.stats.open, 2);
    assert.equal(ledger.stats.drafts, 1);
    assert.equal(ledger.privacy.utterancesDroppedOther, 0);
    const ask = ledger.items.find((item) => item.id === 'seed-b');
    assert.equal(ask.decision, 'ask');
    assert.equal(ask.person, null);
    assert.equal(ask.scored, false, 'no model score is invented');
    assert.equal(ask.confidence, null);
    assert.equal(ledger.receipts.length, 0);

    // an approval of an ask authorises drafting only
    let result = await (await request('/commitments/seed-b/approve', 'POST')).json();
    assert.equal(result.item.decision, 'draft');
    assert.equal(result.item.state, 'live');
    assert.equal(result.ledger.receipts.length, 1);

    // dismiss, then clear retired rows
    result = await (await request('/commitments/seed-a/dismiss', 'POST')).json();
    assert.equal(result.item.state, 'obsolete');
    assert.equal((await request('/commitments/seed-a/dismiss', 'POST')).status, 409);
    assert.equal((await request('/commitments/missing/dismiss', 'POST')).status, 404);
    result = await (await request('/commitments/retire-obsolete', 'POST')).json();
    assert.equal(result.removed, 1);
    assert.equal((await request('/commitments/retire-obsolete', 'POST')).status, 409);

    // plan policy
    assert.equal((await request('/plans', 'POST', { commitmentId: 'seed-b', date: '2099-10-22', participants: ['You', 'Sam'], consent: false })).status, 400);
    assert.equal((await request('/plans', 'POST', { commitmentId: 'seed-b', date: '2099-10-22', participants: ['You', 'You'], consent: true })).status, 400);
    assert.equal((await request('/plans', 'POST', { commitmentId: 'seed-b', date: '2001-01-01', participants: ['You', 'Sam'], consent: true })).status, 400);
    result = await (await request('/plans', 'POST', { commitmentId: 'seed-b', date: '2099-10-22', participants: ['You', 'Sam'], consent: true })).json();
    const plan = result.plan;
    assert.equal(plan.state, 'proposed');
    assert.deepEqual(plan.awaiting, ['You', 'Sam']);
    assert.equal((await request(`/plans/${plan.id}.ics`)).status, 404, 'no export before dispatch');
    assert.equal((await request(`/plans/${plan.id}/approve`, 'POST', { actor: 'Nobody' })).status, 400);
    assert.equal((await request(`/plans/${plan.id}/execute`, 'POST')).status, 409, 'one approval is not enough');
    assert.equal((await (await request(`/plans/${plan.id}/approve`, 'POST', { actor: 'You' })).json()).plan.state, 'proposed');
    result = await (await request(`/plans/${plan.id}/approve`, 'POST', { actor: 'Sam' })).json();
    assert.equal(result.plan.state, 'approved');
    result = await (await request(`/plans/${plan.id}/execute`, 'POST')).json();
    assert.equal(result.plan.state, 'executed');
    const ics = await request(`/plans/${plan.id}.ics`);
    assert.equal(ics.status, 200);
    assert.match(await ics.text(), /BEGIN:VCALENDAR/);
    result = await (await request(`/plans/${plan.id}/cancel`, 'POST')).json();
    assert.equal(result.plan.state, 'cancelled');
    assert.equal((await request(`/plans/${plan.id}.ics`)).status, 404, 'cancel revokes the export');
    const badJson = await fetch(`http://127.0.0.1:${port}/api/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Latent-Token': token },
      body: '{oops',
    });
    assert.equal(badJson.status, 400);

    ledger = await (await request('/ledger')).json();
    const receiptsBeforeRestart = ledger.receipts.length;
    assert.ok(receiptsBeforeRestart >= 6);

    await stop();
    await boot();
    token = (await (await fetch(`http://127.0.0.1:${port}/api/session`)).json()).token;
    ledger = await (await request('/ledger')).json();
    assert.equal(ledger.items.length, 2);
    assert.equal(ledger.items.find((item) => item.id === 'seed-a').state, 'forgotten');
    assert.equal(ledger.plans[0].state, 'cancelled');
    assert.equal(ledger.receipts.length, receiptsBeforeRestart);
  } finally {
    if (proc && !proc.killed) await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
