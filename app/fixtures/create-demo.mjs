// Rebuild only the named synthetic demo database before every demo run.
// The user's real ambient.sqlite is never touched by this helper.
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFixtures } from './generate.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data = path.join(root, 'data');
const db = path.join(data, 'ambient-reconcile-demo.sqlite');
await mkdir(data, { recursive: true, mode: 0o700 });
try {
  await access(db);
  console.log('Using the existing synthetic demo ledger.');
} catch {
  generateFixtures(db);
}
