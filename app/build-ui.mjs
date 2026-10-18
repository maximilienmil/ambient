// Bundles the React Twin into public/twin.js. There is no dev server and no CDN:
// the page runs under `script-src 'self'`, so the bundle has to be a local file.
//
//   node build-ui.mjs        # once
//   node build-ui.mjs --watch

import { context } from 'esbuild';

const options = {
  entryPoints: ['ui/twin.jsx'],
  bundle: true,
  // The page loads this with a plain deferred <script>, not a module, so the
  // bundle has to be an IIFE. An ESM bundle would throw "Unexpected token
  // 'export'" and the Twin would never mount.
  format: 'iife',
  target: ['safari15', 'chrome100'],
  jsx: 'automatic',
  minify: true,
  sourcemap: false,
  outfile: 'public/twin.js',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
};

const watch = process.argv.includes('--watch');

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('watching ui/ for changes');
} else {
  const { build } = await import('esbuild');
  await build(options);
}
