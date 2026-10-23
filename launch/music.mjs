// Synthesizes a 120 BPM original track (no samples, no licensing) shaped to the film's timeline.
// node launch/music.mjs  -> launch/out/ambient-track.wav
import fs from 'node:fs';
const dir = new URL('./out/', import.meta.url).pathname;
const { starts, total } = JSON.parse(fs.readFileSync(dir + 'timeline.json'));
const SR = 44100, N = Math.ceil((total + 1.5) * SR), L = new Float32Array(N), R = new Float32Array(N);
const BEAT = 0.5;
// section energy: 0 pad only, 1 + soft kick, 2 + hats/bass, 3 full + arp
const E = [0, 1, 3, 0.5, 3, 3, 2, 1, 0];
const energyAt = (t) => { let i = 0; while (i + 1 < starts.length && t >= starts[i + 1]) i++; return E[i]; };
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const roots = [45, 41, 36, 43];
const add = (i, v, p = 0) => { if (i >= 0 && i < N) { L[i] += v * (1 - p); R[i] += v * (1 + p); } };
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
// pad
for (let i = 0; i < N; i++) {
  const t = i / SR, c = chords[Math.floor(t / 4) % 4], x = (t % 4) / 4;
  const env = Math.min(1, x * 6) * Math.min(1, (1 - x) * 6 + .4), lfo = .8 + .2 * Math.sin(t * .7);
  let s = 0; for (const m of c) { const f = hz(m); s += Math.sin(2 * Math.PI * f * t) + .5 * Math.sin(2 * Math.PI * f * 2.003 * t) + .25 * Math.sin(2 * Math.PI * f * 3.01 * t); }
  const e = energyAt(t), g = (e === 0.5 ? 1.15 : .8) * (t > total - 4 ? Math.max(0, (total - t) / 4 + .0) : 1);
  add(i, s * .028 * env * lfo * g);
}
const hit = (t0, len, fn, p = 0) => { const i0 = Math.floor(t0 * SR); for (let k = 0; k < len * SR; k++) add(i0 + k, fn(k / SR), p); };
let step = 0;
for (let t = 0; t < total + .5; t += BEAT / 2, step++) {
  const e = energyAt(t), beat = step % 2 === 0, bar = Math.floor(step / 8), chord = bar % 4 >= 0 ? Math.floor(t / 4) % 4 : 0;
  const fade = t > total - 3 ? Math.max(0, (total - t) / 3) : 1;
  if (beat && step % 4 === 0 && e >= 1 && (e !== 0.5)) hit(t, .3, (x) => Math.sin(2 * Math.PI * (48 + 90 * Math.exp(-x * 28)) * x) * Math.exp(-x * 9) * (.55 * fade));
  if (e >= 2 && step % 2 === 1) hit(t, .05, (x) => rnd() * Math.exp(-x * 90) * .16 * fade, .3);
  if (e >= 2 && step % 8 === 4) hit(t, .16, (x) => (rnd() * .5 + Math.sin(2 * Math.PI * 190 * x) * .5) * Math.exp(-x * 24) * .22 * fade);
  if (e >= 2 && step % 2 === 1) hit(t, .24, (x) => Math.sin(2 * Math.PI * hz(roots[chord]) * x) * Math.exp(-x * 7) * .2 * fade);
  if (e >= 3 && step % 1 === 0) { const c = chords[chord], m = c[(step * 3 + (step >> 2)) % 3] + 12 + (step % 7 === 0 ? 12 : 0); hit(t, .3, (x) => (Math.sin(2 * Math.PI * hz(m) * x) + .3 * Math.sin(2 * Math.PI * hz(m) * 2 * x)) * Math.exp(-x * 11) * .075 * fade, ((step % 4) - 1.5) * .25); }
}
// riser into each hard cut: a short noise sweep one beat before sections 2, 4 (the hive), 5
for (const si of [2, 4, 5]) { const t0 = starts[si] - 1.5; hit(t0, 1.5, (x) => rnd() * (x / 1.5) ** 2 * .12, 0); }
// soft hit on the final card
hit(starts[starts.length - 1] + .3, 1.6, (x) => (Math.sin(2 * Math.PI * 110 * x) + Math.sin(2 * Math.PI * 165 * x)) * Math.exp(-x * 2.6) * .25);
// simple stereo-ish echo, then write 16-bit
const D = Math.floor(.375 * SR); for (let i = D; i < N; i++) { L[i] += R[i - D] * .22; R[i] += L[i - D] * .22; }
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const buf = Buffer.alloc(44 + N * 4); buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
const k = .89 / peak; for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(L[i] * k * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * k * 32767), 46 + i * 4); }
fs.writeFileSync(dir + 'ambient-track.wav', buf); console.log('track', total + 1.5, 's');
