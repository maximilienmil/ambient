// Desktop demo pass: the hive's night, a captured promise, the fork, the models, the hive acting.
import { recorder } from './recorder.mjs';
const base = process.argv[2] || 'http://127.0.0.1:4320';
const out = process.argv[3] || new URL('./out/seg/desktop.mp4', import.meta.url).pathname;
const r = await recorder({ url: `${base}/?mode=demo`, out, init: () => localStorage.setItem('ambient-mode', 'demo') });
// The hive's night
r.state.cam = { x: 760, y: 260, s: 1.9 };
r.cam({ x: 820, y: 300, s: 1.45 }, 2.2); await r.point('.ring', 1.6); await r.hold(1.8);
await r.point('[data-filter="done"]', .5); await r.hold(.5); await r.click('[data-filter="done"]'); await r.hold(.5);
r.wide(.9); await r.hold(.5);
// The promise
await r.point('[data-replay]', .7); await r.frame('[data-replay]', { fill: .22, dur: .8, max: 2 }); await r.hold(.8);
await r.click('[data-replay]'); r.hideCursor(.5); await r.hold(.25);
await r.frame('.blk.live', { fill: 1, max: 2.3, dur: .8 }); await r.hold(2.6);
await r.frame('.blk.y.pop', { fill: .95, max: 1.9, dur: .9 }); await r.hold(1.5);
// one continuous move from the promise down to the fork: scroll while easing the zoom, never back out
r.cam({ x: 700, y: 520, s: 1.3 }, 1.1); await r.scrollTo('button[data-path="A"]', { dur: 1.1, offset: 470 }); await r.hold(1.2);
await r.frame('button[data-path="A"]', { fill: .5, max: 1.7, dur: .8, dy: -60 });
for (const p of ['B', 'C', 'A']) { await r.point(`button[data-path="${p}"]`, .45, .25); await r.hold(.5); await r.click(`button[data-path="${p}"]`); await r.hold(1.1); }
r.mark('models');
// Two models weigh in
await r.frame('.models', { fill: .35, max: 2.6, dur: .9 }); await r.point('.models', .8, .9, .5); await r.hold(1.8);
// The hive does the rest
r.mark('act'); r.wide(.7); await r.point('[data-sheet]', .7); await r.hold(.7); await r.click('[data-sheet]'); await r.hold(.3);
await r.scrollTo('[data-go]', { dur: .8, offset: 760 }); await r.frame('.sheet', { fill: .9, max: 1.8, dur: .8 }); await r.hold(1.6);
await r.point('[data-go]', .5); await r.hold(.5); await r.click('[data-go]'); r.hideCursor(.6); await r.hold(.2);
await r.frame('.run', { fill: .9, max: 2.2, dur: .7 }); await r.hold(4.4);
r.wide(1); await r.hold(1.2);
await r.done();
