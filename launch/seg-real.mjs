// The real account, redacted: every line of personal text is blurred in the page itself before it is captured.
import { recorder } from './recorder.mjs';
const base = process.argv[2] || 'http://127.0.0.1:4320';
const out = process.argv[3] || new URL('./out/seg/real.mp4', import.meta.url).pathname;
const label = `<div style="position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483647;padding:9px 18px;border-radius:99px;background:rgba(255,253,248,.92);color:#17160a;box-shadow:0 0 0 1px rgba(23,22,10,.12),0 8px 24px -8px rgba(0,0,0,.25);font:600 17px Geist,sans-serif;display:flex;gap:10px;align-items:center"><span style="width:10px;height:10px;border-radius:50%;background:#1f7a4c"></span>Real Bee account · personal text blurred</div>`;
const r = await recorder({ url: `${base}/?mode=live`, out, redact: true, overlay: label, init: () => localStorage.setItem('ambient-mode', 'live') });
r.state.cam = { x: 700, y: 250, s: 1.7 };
r.cam({ x: 780, y: 300, s: 1.5 }, 2); await r.point('.ring', 1.4); await r.hold(2.2);
r.wide(.8); await r.hold(.4);
await r.scrollTo('button[data-lpath="A"]', { dur: .9, offset: 400 }); await r.hold(.9);
for (const p of ['B', 'C', 'A']) { await r.point(`button[data-lpath="${p}"]`, .45, .25); await r.hold(.35); await r.click(`button[data-lpath="${p}"]`); await r.hold(.9); }
await r.scrollTop(.8); await r.hold(.9);
await r.point('.nav[data-tab="rec"]', .6); await r.click('.nav[data-tab="rec"]'); await r.hold(1);
r.cam({ x: 700, y: 300, s: 1.6 }, 1); await r.hold(1.6);
await r.point('[data-lmerge]', .7); await r.hold(.4); await r.click('[data-lmerge]'); await r.hold(.9);
await r.point('.nav[data-tab="compass"]', .6); await r.click('.nav[data-tab="compass"]'); r.wide(.8); await r.hold(2);
await r.done();
