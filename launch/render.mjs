// Renders a film frame by frame: node launch/render.mjs <film> [fps]
// Needs Playwright and ffmpeg (FFMPEG or ffmpeg on PATH; CHROME_PATH optional).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const name = process.argv[2], fps = +(process.argv[3] || 30);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`file://${dir}/films/${name}.html`);
const { w, h, dur } = await page.evaluate(() => ({ w: document.body.offsetWidth, h: document.body.offsetHeight, dur: DUR }));
await page.setViewportSize({ width: w, height: h });
await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]));
const out = path.join(dir, 'out', `ambient-${name}.mp4`);
const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const frames = Math.round(dur * fps);
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => seek(t), i / fps);
  ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 94 }));
  if (i % fps === 0) process.stdout.write(`\r${name} ${Math.round(i / fps)}s / ${dur}s`);
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await browser.close();
console.log(`\n${out}`);
