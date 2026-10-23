// Synthesizes an original 120 BPM track (no samples, no licensing) shaped to the film's timeline.
// node launch/music.mjs  -> launch/out/ambient-track.wav
import fs from 'node:fs';
const dir = new URL('./out/', import.meta.url).pathname;
const { starts, total } = JSON.parse(fs.readFileSync(dir + 'timeline.json'));
const SR = 44100, N = Math.ceil((total + 1.5) * SR), L = new Float32Array(N), R = new Float32Array(N);
const BEAT = 0.5, STEP = BEAT / 4; // sixteenths
// section energy: 0 pad, 1 + pulse/pluck, 2 + drums/bass, 3 full, 0.5 breakdown
const E = [1, 1, 3, 0.5, 3, 3, 2, 1, 0];
const energyAt = (t) => { let i = 0; while (i + 1 < starts.length && t >= starts[i + 1]) i++; return E[i]; };
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const chords = [[60, 64, 67, 71], [64, 67, 71, 74], [65, 69, 72, 76], [67, 71, 74, 78]]; // Cmaj7 Em7 Fmaj7 G(lydian)
const roots = [36, 40, 41, 43];
const add = (i, v, p = 0) => { if (i >= 0 && i < N) { L[i] += v * (1 - p); R[i] += v * (1 + p); } };
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const tail = (t) => (t > total - 3.5 ? Math.max(0, (total - t) / 3.5) : 1);
// sidechain: ducks the pad on every kick (quarter notes) when drums are in
const duck = (t) => { const x = (t % BEAT) / BEAT; return 0.35 + 0.65 * Math.min(1, x * 3.2); };
for (let i = 0; i < N; i++) {
  const t = i / SR, c = chords[Math.floor(t / 2) % 4], x = (t % 2) / 2, e = energyAt(t);
  const env = Math.min(1, x * 8) * Math.min(1, (1 - x) * 8 + .5);
  let s = 0; for (const m of c) { const f = hz(m + 12); s += Math.sin(2 * Math.PI * f * t) * .6 + Math.sin(2 * Math.PI * f * 1.004 * t) * .4 + .15 * Math.sin(2 * Math.PI * f * 2 * t); }
  add(i, s * .03 * env * (e >= 2 ? duck(t) : 1) * (e === 0.5 ? 1.4 : 1) * tail(t), Math.sin(t * .3) * .2);
}
const hit = (t0, len, fn, p = 0) => { const i0 = Math.floor(t0 * SR); for (let k = 0; k < len * SR; k++) add(i0 + k, fn(k / SR), p); };
let n = 0;
for (let t = 0; t < total + .5; t += STEP, n++) {
  const e = energyAt(t), idx = Math.floor(t / 2) % 4, chord = chords[idx], q = n % 4, bar16 = n % 16, g = tail(t);
  if (e >= 2 && q === 0) hit(t, .3, (x) => Math.sin(2 * Math.PI * (44 + 70 * Math.exp(-x * 26)) * x) * Math.exp(-x * 9) * .32 * g);
    if (e >= 3 && q === 2) hit(t, .04, (x) => rnd() * Math.exp(-x * 110) * .05 * g, .35); // open-ish hat on the offbeat
    if (e >= 2 && bar16 === 0) hit(t, .9, (x) => Math.sin(2 * Math.PI * hz(roots[idx]) * x) * Math.exp(-x * 2.2) * .22 * g); // sub bass
  const arp = [0, 2, 1, 3, 2, 1, 3, 2, 0, 3, 1, 2, 3, 1, 2, 0][bar16];
  if (e >= 3 && (bar16 === 0 || bar16 === 10)) {
    const m = chord[arp] + 12 + (bar16 === 14 ? 12 : 0);
    hit(t, .9, (x) => (Math.sin(2 * Math.PI * hz(m) * x) + .45 * Math.sin(2 * Math.PI * hz(m) * 2.76 * x) * Math.exp(-x * 30) + .2 * Math.sin(2 * Math.PI * hz(m) * 4 * x)) * Math.exp(-x * 3.5) * .05 * g, ((q - 1.5) / 6));
  }
}
// risers into each hard cut: the circle-open, the hive, the slide to the phone
for (const si of [2, 4, 5]) { const t0 = starts[si] - 1.5; hit(t0, 1.5, (x) => rnd() * (x / 1.5) ** 2.4 * .1 + Math.sin(2 * Math.PI * (300 + 900 * (x / 1.5) ** 2) * x) * (x / 1.5) * .02); }
// bell on the final card
hit(starts[starts.length - 1] + .25, 2.4, (x) => (Math.sin(2 * Math.PI * hz(84) * x) + .5 * Math.sin(2 * Math.PI * hz(84) * 2.76 * x) + Math.sin(2 * Math.PI * hz(72) * x) * .7) * Math.exp(-x * 2) * .12);
const D = Math.floor(.375 * SR); for (let i = D; i < N; i++) { L[i] += R[i - D] * .2; R[i] += L[i - D] * .2; }
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const buf = Buffer.alloc(44 + N * 4); buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
const k = .85 / peak; for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(L[i] * k * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * k * 32767), 46 + i * 4); }
fs.writeFileSync(dir + 'ambient-track.wav', buf); console.log('track', +(total + 1.5).toFixed(1), 's');
