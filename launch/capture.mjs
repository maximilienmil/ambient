// Captures real Ambient screens (demo story only, never the real ledger) for the
// README, Devpost and the launch films. Usage: node launch/capture.mjs [baseURL]
import { chromium } from 'playwright';
import path from 'node:path';
const base = process.argv[2] || 'http://127.0.0.1:4320';
const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'shots');
const devices = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  phone: { viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
for (const [name, opts] of Object.entries(devices)) {
  const ctx = await browser.newContext({ ...opts, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const shot = async (id, full = false) => { await page.waitForTimeout(1600); await page.screenshot({ path: `${out}/${name}-${id}.png`, fullPage: full }); };
  const click = async (sel) => { await page.locator(sel).locator("visible=true").first().click({ force: true }); };
  await page.addInitScript(() => localStorage.setItem('ambient-mode', 'demo'));
  await page.goto(`${base}/?mode=demo`); await page.waitForTimeout(2500);
  await shot('horizon'); await shot('horizon-full', true);
  await click('[data-replay]'); await page.waitForTimeout(1200); await shot('listening');
  await page.waitForTimeout(4500);
  await shot('heard'); await shot('heard-full', true);
  const fork = page.locator("button[data-path=A]").first();
  for (const p of ['A', 'B', 'C']) { await click(`button[data-path="${p}"]`); await fork.evaluate((e) => e.scrollIntoView({ block: "center" })); await shot(`fork-${p}`); }
  await click(`button[data-path="A"]`); await click('[data-sheet]'); await page.locator('[data-go]').scrollIntoViewIfNeeded(); await shot('sheet');
  await click('[data-go]'); await page.waitForTimeout(1200); await shot('running');
  await page.waitForTimeout(4200); await page.evaluate(() => scrollTo(0, 0)); await shot('sent'); await shot('sent-full', true);
  for (const t of ['compass', 'rec']) { await click(`[data-tab="${t}"]`); await page.evaluate(() => scrollTo(0, 0)); await shot(t); await shot(`${t}-full`, true); }
  await ctx.close();
}
await browser.close();
