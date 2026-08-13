// @io-wall-ok — tools composition root
#!/usr/bin/env bun
/**
 * Fail if fanout `rows` payloads are built from mutation args instead of
 * the framework post-replay SELECT helper (`selectFanoutRows`).
 */
import { join } from 'node:path';
import { Glob } from 'bun';

const root = join(import.meta.dirname, '../..');

const SCAN_GLOBS = [
  'pkgs/sync-engine/src/server/**/*.{ts,tsx}',
  'pkgs/sync-engine/src/sim/server-handlers.ts',
] as const;

/** Allowed call sites that may construct the rows map for notifyChannels. */
const ALLOWED_SELECT = 'selectFanoutRows';

const violations: string[] = [];

for (const pattern of SCAN_GLOBS) {
  const files = new Glob(pattern).scan({ cwd: root, absolute: true });
  for await (const file of files) {
    if (file.includes('.test.')) continue;
    if (file.endsWith('select-fanout-rows.ts')) continue;
    // notifyChannels only forwards an already-built rows map.
    if (file.endsWith('notify-channels.ts')) continue;
    const text = await Bun.file(file).text();
    const rel = file.slice(root.length + 1);

    // Flag notifyChannels calls that pass `rows:` without selectFanoutRows in file.
    if (!/notifyChannels\s*\(/.test(text)) continue;
    if (!/\brows\s*:/.test(text)) continue;
    if (!text.includes(ALLOWED_SELECT)) {
      violations.push(
        `${rel}: notifyChannels rows payload without ${ALLOWED_SELECT}`
      );
    }

    // Flag assigning rows from args / mutation.args.
    if (
      /rows\s*:\s*.*\.args\b/.test(text) ||
      /rows\s*=\s*.*\.args\b/.test(text)
    ) {
      violations.push(`${rel}: rows appear derived from mutation args`);
    }
  }
}

if (violations.length > 0) {
  console.error('ci:fanout-rows-from-reads FAILED:');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log('ci:fanout-rows-from-reads OK');
