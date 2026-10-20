import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { openDb, saveCommitment } from '../db.mjs';
import { horizonDemo } from '../fixtures/horizon-scenario.mjs';

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

  async function boot(fixture = false) {
    proc = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, PORT: String(port), LATENT_DATA_DIR: dir, LATENT_DB: path.join(dir, 'latent.sqlite'), PREVIEW: '0', LATENT_FIXTURE: fixture ? '1' : '0' },
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
    assert.equal((await request('/horizon/demo')).status, 404, 'synthetic data cannot reach a real session');
    const { input } = horizonDemo();
    const comparison = await request('/horizon/compare', 'POST', {
      goalId: 'launch', variants: [{ id: 'a', input }, { id: 'b', input }],
    });
    assert.equal(comparison.status, 200);
    assert.equal((await comparison.json()).variants[0].goal.scheduledBeforeDeadlineMinutes, 360);
    assert.equal((await request('/horizon/compare', 'POST', {})).status, 400);
    assert.equal((await request('/horizon/compare', 'POST', { goalId: 'launch', variants: [null, null] })).status, 400);
    const workspace = await (await request('/workspace')).json();
    assert.equal(workspace.synthetic, false);
    assert.equal(workspace.models.d1.state, 'idle');
    const goal = await (await request('/grow', 'POST', { kind:'goal',title:'Ship Friday',minutes:360,due_at:'2026-10-23T17:00:00-04:00' })).json();
    assert.equal(goal.version, 1);
    assert.equal((await (await request('/workspace')).json()).grow[0].title,'Ship Friday');
    const bundle = await (await request('/actions', 'POST', {executor:'sandbox',goal:'Ship Friday',message:{to:'test@example.com',subject:'Demo timing',body:'Could we move this to Monday?'},blocks:[{start:'2026-10-22T13:00:00Z',end:'2026-10-22T16:00:00Z'}]})).json();
    assert.equal((await request(`/actions/${bundle.id}/execute`, 'POST', {})).status,409);
    assert.equal((await request(`/actions/${bundle.id}/approve`, 'POST', {hash:bundle.hash})).status,200);
    const executed=await (await request(`/actions/${bundle.id}/execute`, 'POST', {})).json();
    assert.equal(executed.state,'complete');
    assert.equal(executed.results.find(r=>r.step==='message').receipt.sent,false);
    assert.equal((await (await request('/actions')).json()).length,1);

    // the app shell loads from the same origin only, and it is the four-screen app
    const shell = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(shell.status, 200);
    const html = await shell.text();
    assert.match(html, /data-view="horizon"/);
    assert.match(html, /data-view="grow"/);
    assert.match(html, /data-view="reconcile"/);
    assert.match(html, /workspace\.js/);
    assert.match(html, /href="\/workspace\.css"/);

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
    assert.equal(ledger.receipts.length, 2);

    // an approval of an ask authorises drafting only
    let result = await (await request('/commitments/seed-b/approve', 'POST')).json();
    assert.equal(result.item.decision, 'draft');
    assert.equal(result.item.state, 'live');
    assert.equal(result.ledger.receipts.length, 3);

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
    assert.equal((await (await request('/workspace')).json()).grow[0].title,'Ship Friday');
    assert.equal((await (await request(`/actions/${bundle.id}`)).json()).state,'complete');

    await stop();
    await boot(true);
    token = (await (await fetch(`http://127.0.0.1:${port}/api/session`)).json()).token;
    const demo = await (await request('/horizon/demo')).json();
    assert.equal(demo.synthetic, true);
    assert.equal(demo.preview, true);
    assert.equal(demo.comparison.variants.find((variant) => variant.id === 'keep').goal.shortfallMinutes, 180);
    assert.equal(demo.models.jev, 'not_run');
  } finally {
    if (proc && !proc.killed) await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
