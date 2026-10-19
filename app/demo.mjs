#!/usr/bin/env node
// Demo mode: run with fixture data instead of real Bee data.
//
// Usage: npm run demo
//
// Sets LATENT_DATA_DIR to point to fixture database and starts the server.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const fixtureDb = path.join(root, 'data', 'latent-fixture.sqlite');

// Check if fixture database exists
const fs = await import('node:fs/promises');
try {
  await fs.access(fixtureDb);
} catch {
  console.error('Fixture database not found. Run: npm run fixtures');
  process.exit(1);
}

// Set environment variable and start server
const env = { ...process.env, LATENT_DATA_DIR: path.join(root, 'data') };
const args = ['server.mjs'];

// Use the fixture database by modifying the db path in server
const child = spawn('node', args, {
  cwd: root,
  env: { ...env, LATENT_DB: fixtureDb },
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
