// Films the live app deterministically: Playwright's clock steps time one frame
// at a time while a virtual camera (zoom/pan on <body>), a cursor and the main
// scroll are tweened. Each frame is piped to ffmpeg.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export async function recorder({ url, out, viewport = { width: 1920, height: 1080 }, fps = 30, init, deviceScaleFactor = 1, isMobile = false, redact = false, overlay = '' }) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, isMobile, hasTouch: isMobile });
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init);
  await page.clock.install({ time: new Date('2026-10-26T08:30:00-04:00') });
  await page.goto(url);
  await page.clock.runFor(3000);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(({ W, H, redact, overlay }) => {
    const css = document.createElement('style');
    css.textContent = `body{transform-origin:0 0}
#rc-cur{position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))}
#rc-ring{position:fixed;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:3px solid rgba(91,63,196,.85);z-index:2147483646;pointer-events:none;opacity:0}
.rc-blur :is(p,li,small,label,.f,.quote,.t,.sub) , .rc-blur [class*="item"] :is(b,span,div):not(:has(*)){filter:blur(7px)}`;
    document.head.append(css);
    document.body.insertAdjacentHTML('beforeend', `<svg id="rc-cur" viewBox="0 0 24 24"><path d="M4 2l15 9.5-6.6 1.3 3.9 7.4-2.8 1.5-3.9-7.5L4 19z" fill="#17160a" stroke="#fffdf8" stroke-width="1.6" stroke-linejoin="round"/></svg><div id="rc-ring"></div>`);
    window.__rc = { W, H, redact };
    if (overlay) document.documentElement.insertAdjacentHTML('beforeend', overlay);
  }, { W: viewport.width, H: viewport.height, redact, overlay });

  const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const state = { cam: { x: viewport.width / 2, y: viewport.height / 2, s: 1 }, cur: { x: viewport.width * .7, y: viewport.height * .8, o: 0 }, scroll: 0, ring: 0, drift: 0, f: 0 };
  const tweens = [];
  let frame = 0;
  const tween = (obj, to, dur, f = ease) => { const from = {}; for (const k in to) from[k] = obj[k]; tweens.push({ obj, from, to, a: frame, n: Math.max(1, Math.round(dur * fps)), f }); };
  const apply = () => page.evaluate((st) => {
    const { W, H } = window.__rc, s = st.cam.s, hw = W / 2 / s, hh = H / 2 / s;
    const x = Math.min(W - hw, Math.max(hw, st.cam.x + st.drift * Math.sin(st.f / 70) * 6)), y = Math.min(H - hh, Math.max(hh, st.cam.y + st.drift * Math.cos(st.f / 90) * 4));
    document.body.style.transform = `translate(${W / 2 - x * s}px,${H / 2 - y * s}px) scale(${s})`;
    if (window.__rc.redact) {
      const keep = '.hero,.nav,.brand,.mdl,.sync,.tabbar,svg,.stat b,[class*=lbl]';
      const ok = /^(sync from bee|merge into one|keep both|confirm|not true|done|undo|receipt|show \d+ more|add .{0,24}|review .{0,40}|jev|liquid d1|week|month|year|settings|demo|your bee|\d[\d.]*\s?\w{0,3})$/i;
      document.querySelectorAll('input,textarea').forEach((e) => { e.style.filter = 'blur(7px)'; });
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) {
        const t = n.nodeValue.trim(); if (t.length < 8 || !/[a-z]{3}/i.test(t)) continue;
        const el = n.parentElement; if (!el || el.closest(keep) || ok.test(t)) continue;
        el.style.filter = 'blur(7px)'; el.style.webkitUserSelect = 'none';
      }
    }
    const m = document.querySelector('.main'); if (m && st.scrollSet) m.scrollTop = st.scroll;
    const c = document.getElementById('rc-cur'); c.style.transform = `translate(${st.cur.x}px,${st.cur.y}px)`; c.style.opacity = st.cur.o;
    const r = document.getElementById('rc-ring'); r.style.left = st.cur.x + 'px'; r.style.top = st.cur.y + 'px'; r.style.opacity = st.ring; r.style.transform = `scale(${.4 + (1 - st.ring) * .9})`;
  }, state);
  const step = async () => {
    for (const t of tweens) { const p = Math.min(1, (frame - t.a) / t.n); for (const k in t.to) t.obj[k] = t.from[k] + (t.to[k] - t.from[k]) * t.f(Math.max(0, p)); }
    for (let i = tweens.length - 1; i >= 0; i--) if (frame - tweens[i].a >= tweens[i].n) tweens.splice(i, 1);
    state.f = frame; state.drift = Math.min(1, Math.max(0, state.cam.s - 1) * 4);
    await apply();
    ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 93, animations: 'disabled' }));
    await page.clock.runFor(1000 / fps);
    frame++;
  };
  // Viewport rect of an element as if the camera were at rest.
  const rect = (sel) => page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null || e.getClientRects().length); if (!el) throw new Error('missing ' + sel);
    const b = document.body.style.transform; document.body.style.transform = ''; const r = el.getBoundingClientRect(); document.body.style.transform = b;
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  }, sel);
  const marks = {};
  const api = {
    page, state, fps, marks, mark: (n) => { marks[n] = +(frame / fps).toFixed(2); },
    hold: async (sec) => { const n = Math.round(sec * fps); for (let i = 0; i < n; i++) await step(); },
    cam: (to, dur = 1) => tween(state.cam, to, dur),
    /** Frame an element: zoom so it fills `fill` of the viewport height or width. */
    frame: async (sel, { fill = .8, dur = 1, max = 2.2, dx = 0, dy = 0 } = {}) => { const r = await rect(sel); const s = Math.min(max, fill * Math.min(viewport.width / r.w, viewport.height / r.h)); tween(state.cam, { x: r.cx + dx, y: r.cy + dy, s }, dur); },
    wide: (dur = 1) => tween(state.cam, { x: viewport.width / 2, y: viewport.height / 2, s: 1 }, dur),
    scrollTo: async (sel, { dur = 1, offset = 120 } = {}) => { const top = await page.evaluate(({ sel, offset }) => { const m = document.querySelector('.main'), el = document.querySelector(sel); return Math.max(0, Math.min(m.scrollHeight - m.clientHeight, m.scrollTop + el.getBoundingClientRect().top - offset)); }, { sel, offset }); state.scroll = await page.evaluate(() => document.querySelector('.main').scrollTop); state.scrollSet = true; tween(state, { scroll: top }, dur); },
    scrollTop: (dur = 1) => { state.scrollSet = true; tween(state, { scroll: 0 }, dur); },
    point: async (sel, dur = .7, ox = .5, oy = .5) => { const r = await rect(sel); tween(state.cur, { x: r.x + r.w * ox, y: r.y + r.h * oy, o: 1 }, dur); },
    hideCursor: (dur = .3) => tween(state.cur, { o: 0 }, dur, (x) => x),
    click: async (sel) => { state.ring = 1; tween(state, { ring: 0 }, .45, (x) => x); await page.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length); el.click(); }, sel); },
    eval: (fn, arg) => page.evaluate(fn, arg),
    done: async () => { console.log('MARKS ' + JSON.stringify(marks)); ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await browser.close(); return out; },
  };
  return api;
}
