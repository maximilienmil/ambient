// Assembles the final film: node launch/assemble.mjs  (needs ffmpeg and the rendered parts in launch/out)
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const dir = path.dirname(new URL(import.meta.url).pathname), out = `${dir}/out`, FF = process.env.FFMPEG || 'ffmpeg';
const marks = { models: 14.47, act: 16.27 };
const X = 0.5; // transition length: one beat at 120 bpm
// [file, in, out, transition into the NEXT part]
const parts = [
  ['ambient-hook.mp4', 0, 9, 'fade'],
  ['ambient-turn.mp4', 0, 5, 'fade'],
  ['seg/desktop.mp4', 0, marks.act, 'circleopen'],
  ['ambient-hive.mp4', 0, 6.5, 'wipeleft'],
  ['seg/desktop.mp4', marks.act, 26.37, 'slideleft'],
  ['seg/phoneclip.mp4', 0, 17.1, 'slideup'],
  ['seg/real.mp4', 0, 14.1, 'fade'],
  ['ambient-term.mp4', 0, 10.6, 'fade'],
  ['ambient-close.mp4', 0, 6.5, null],
];
const inputs = parts.flatMap(([f, a, b]) => ['-ss', String(a), '-t', String(+(b - a).toFixed(3)), '-i', `${out}/${f}`]);
let g = parts.map((_, i) => `[${i}:v]fps=30,scale=1920:1080,format=yuv420p,setsar=1,setpts=PTS-STARTPTS[v${i}]`).join(';');
let acc = 'v0', t = parts[0][2] - parts[0][1]; const starts = [0];
for (let i = 1; i < parts.length; i++) {
  const off = +(t - X).toFixed(3); starts.push(off);
  g += `;[${acc}][v${i}]xfade=transition=${parts[i - 1][3]}:duration=${X}:offset=${off}[x${i}]`; acc = `x${i}`;
  t = off + (parts[i][2] - parts[i][1]);
}
const total = +t.toFixed(2);
fs.writeFileSync(`${out}/timeline.json`, JSON.stringify({ starts, total, parts: parts.map((p) => p[0]) }));
const r = spawnSync(FF, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', g, '-map', `[${acc}]`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', `${out}/ambient-launch-silent.mp4`], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
console.log('total', total, 'starts', starts.join(','));
