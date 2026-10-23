// iPhone 16 Pro pass (402x874 @2x): Horizon, the promise, the fork, the tab bar, Compass, Reconcile.
import { recorder } from './recorder.mjs';
const base = process.argv[2] || 'http://127.0.0.1:4320';
const out = process.argv[3] || new URL('./out/seg/phone.mp4', import.meta.url).pathname;
const r = await recorder({ url: `${base}/?mode=demo`, out, viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, init: () => localStorage.setItem('ambient-mode', 'demo') });
await r.hold(.8);
await r.scrollTo('[data-replay]', { dur: 1, offset: 300 }); await r.hold(1);
await r.click('[data-replay]'); await r.hold(4.2);
await r.scrollTo('button[data-path="A"]', { dur: 1, offset: 330 }); await r.hold(1);
for (const p of ['B', 'C', 'A']) { await r.click(`button[data-path="${p}"]`); await r.hold(1); }
await r.click('.tb[data-tab="compass"]'); await r.scrollTop(.1); await r.hold(1.6);
await r.scrollTo('.hive, [class*=hive], svg polygon', { dur: 1.1, offset: 200 }).catch(() => {}); await r.hold(1.3);
await r.click('.tb[data-tab="rec"]'); await r.scrollTop(.1); await r.hold(1.4);
await r.scrollTo('[data-merge]', { dur: 1, offset: 380 }); await r.hold(.6); await r.click('[data-merge="0"]'); await r.hold(1.2);
await r.click('.tb[data-tab="horizon"]'); await r.scrollTop(.1); await r.hold(1);
await r.done();
