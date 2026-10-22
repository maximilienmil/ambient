// Publish only the scripted synthetic story, never a local ledger or credentials.
import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = new URL('./public/', import.meta.url);
const out = new URL('../dist/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of ['v5.css', 'grain.js', 'icon-192.png', 'apple-touch-icon.png']) {
  await cp(new URL(file, source), new URL(file, out));
}
// Only fonts referenced by the shipped stylesheet are copied.
let css = await readFile(new URL('v5.css', out), 'utf8');
for (const match of css.matchAll(/url\(['"]?(?:\/)?(fonts\/[^)'"\s]+)['"]?\)/g)) {
  await mkdir(new URL('fonts/', out), { recursive: true });
  await cp(new URL(match[1], source), new URL(match[1], out));
}
css = css.replaceAll('url(/fonts/', 'url(fonts/').replace('url(assets/bee-macro.jpg)', 'linear-gradient(#fbe27c,#d3c6fa)');
await writeFile(new URL('v5.css', out), css);
for (const license of ['OFL-geist.txt', 'OFL-instrument-serif.txt']) await cp(new URL('fonts/' + license, source), new URL('fonts/' + license, out));
let html = await readFile(new URL('v5.html', source), 'utf8');
html = html.replace(/(href|src)="\//g, '$1="./').replace('<link rel="manifest" href="./manifest.webmanifest">', '');
await writeFile(new URL('index.html', out), html);
let js = await readFile(new URL('v5.js', source), 'utf8');
const start = js.indexOf('async function boot() {');
const end = js.indexOf('\nasync function loadLedger()', start);
if (start < 0 || end < 0) throw new Error('Demo boot anchors changed');
js = js.slice(0, start) + `async function boot() {
  D.ready = true; D.synthetic = true; S.mode = 'demo'; render();
}
` + js.slice(end);
const apiStart = js.indexOf('async function api(path, body) {');
const apiEnd = js.indexOf('\nasync function boot()', apiStart);
js = js.slice(0, apiStart) + `async function api() { throw new Error('This public demo uses synthetic data. Run the local app to connect your own accounts.'); }\n` + js.slice(apiEnd);
js = js.replace('function settings() {', `function settings() {
  return '<div class="scrim" data-close><div class="rc" role="dialog" aria-label="About this demo"><button class="x" data-close aria-label="Close">×</button><h2>Try Ambient</h2><p>This interactive story uses synthetic conversations and simulated actions. It does not access Bee, send email or change a calendar.</p><p>For the working local app and connector setup, see <a href="https://github.com/maximilienmil/ambient" target="_blank" rel="noopener">the repository</a>.</p></div></div>';
`);
js = js.replaceAll('Demo story · synthetic', 'Demo: simulated actions').replaceAll('Sent to Jordan', 'Simulated send to Jordan').replaceAll('Send and hold time', 'Simulate send and holds');
await writeFile(new URL('v5.js', out), js);
await writeFile(new URL('.nojekyll', out), '');
console.log('Synthetic demo built at ' + fileURLToPath(out));
