// Builds a single self-contained HTML file that runs the real app against the
// synthetic ledger, with no server and no build step at view time.
//
// It works by inlining four things and stubbing one:
//   tokens.css + the Fonetika files      so the face survives a file:// open
//   style.css                            the whole stylesheet
//   preview-data.mjs                     the same ledger the preview server serves
//   twin.js                              the Twin bundle
// and replacing app.js's api() with a local version. Nothing here invents a
// number: the wireframe shows exactly what PREVIEW=1 shows.
//
// Every splice below throws if its anchor is gone, so a refactor of app.js
// fails loudly here instead of quietly shipping a broken file.

import { readFileSync, writeFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const bytes = (f) => readFileSync(new URL(f, import.meta.url));

/* The fonts are referenced relative to the stylesheet, which stops resolving
   once the stylesheet lives inside a file somewhere else. Embed them instead. */
const tokens = read('./public/tokens.css').replace(
  /url\("fonts\/([^"]+)"\)/g,
  (_, name) => `url("data:font/woff2;base64,${bytes('./public/fonts/' + name).toString('base64')}")`,
);
if (tokens.includes('url("fonts/')) throw new Error('a font did not embed');

/* The synthetic ledger, taken from the module the preview server uses, so the
   wireframe cannot drift from preview mode. */
const previewData = read('./preview-data.mjs').replace(/^export /gm, '');

/* app.js talks to /api. Replace that with the local ledger plus honest refusals
   for the two routes that genuinely need an account or a database. */
const STUB = `async function api(route, { method = 'GET', body } = {}) {
  const path = route.replace(/^\\/+/, '');
  if (path === 'session') return { token: 'standalone-wireframe' };
  if (path === 'ledger') return structuredClone(window.__wireframeLedger());
  if (path === 'sync') {
    throw new Error('This standalone wireframe has no Bee account. Run the local app to read yours.');
  }
  throw new Error('That needs the running app. The standalone wireframe only reads the synthetic ledger.');
}

`;

let ui = read('./public/app.js');
const first = ui.indexOf('async function api(');
const last = ui.indexOf('async function act(');
if (first < 0 || last < 0) throw new Error('app.js no longer has the api()/act() shape this builder splices');
ui = ui.slice(0, first) + STUB + ui.slice(last);

const bootFetch = "const session = await (await fetch('/api/session')).json();";
if (!ui.includes(bootFetch)) throw new Error('boot() no longer fetches /api/session the way this builder expects');
ui = ui.replace(bootFetch, "const session = { token: 'standalone-wireframe' };");

const styleTag = '<link rel="stylesheet" href="/style.css" />';
const tokenTag = '<link rel="stylesheet" href="/tokens.css" />';
const twinTag = '<script src="/twin.js" defer></script>';
const appTag = '<script src="/app.js" defer></script>';

let html = read('./public/index.html');
for (const anchor of [styleTag, tokenTag, twinTag, appTag]) {
  if (!html.includes(anchor)) throw new Error(`index.html no longer contains: ${anchor}`);
}

/* Every insertion below uses a function replacer: a replacement string would
   treat `$$`, `$&` and `$'` in the inlined source as escapes, which silently
   rewrote app.js's `const $$ = ...` into a duplicate `const $ = ...`. */
html = html
  .replace(tokenTag, () => `<style>\n${tokens}\n</style>`)
  .replace(styleTag, () => `<style>\n${read('./public/style.css')}\n</style>`)
  /* These four point at files that will not sit beside the wireframe. */
  .replace(/[ \t]*<link rel="manifest"[^>]*>\n/, '')
  .replace(/[ \t]*<link rel="icon"[^>]*>\n/, '')
  .replace(/[ \t]*<link rel="apple-touch-icon"[^>]*>\n/, '')
  .replace(twinTag, '')
  .replace(appTag, '')
  .replace('Local workspace</span>', 'Standalone wireframe · synthetic ledger · resets on reload</span>');

for (const leftover of ['/tokens.css', '/style.css', '/app.js', '/twin.js', '/fonts/']) {
  if (html.includes(`"${leftover}`)) throw new Error(`the wireframe still points at ${leftover}`);
}

/* twin.js fetches /api by itself, and its source is minified, so patch fetch for
   the two read routes it needs rather than trying to anchor into the bundle. */
const shim = `(() => {
  const real = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const path = url.replace(/^[a-z]+:\\/\\/[^/]*/i, '').replace(/^\\/+/, '');
    if (!path.startsWith('api/')) return real(input, init);
    const respond = (payload, status = 200) => Promise.resolve(new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }));
    if (path === 'api/session') return respond({ token: 'standalone-wireframe', preview: true });
    if (path === 'api/ledger') return respond(structuredClone(window.__wireframeLedger()));
    return respond({ error: 'This standalone wireframe only reads the synthetic ledger.' }, 503);
  };
})();`;

html = html.replace(
  '</body>',
  () => `<script>\n${shim}\n</script>
    <script>\n${read('./public/twin.js')}\n</script>
    <script>\n${previewData}\nwindow.__wireframeLedger = previewLedger;\n${ui}\n</script>
  </body>`,
);

const out = new URL('../docs/archive/Latent - Wireframe.html', import.meta.url);
writeFileSync(out, html);
console.log(`Wrote ${out.pathname} (${Math.round(html.length / 1024)}kb, self-contained)`);
