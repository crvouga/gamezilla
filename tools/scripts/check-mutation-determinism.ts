#!/usr/bin/env bun
import { join } from 'node:path';
/**
 * Ban non-deterministic APIs inside mutation `run` bodies and mutation modules.
 * IDs must come via args; time via env.now(); no network.
 */
import { Glob } from 'bun';

const root = join(import.meta.dirname, '../..');
const banned = [
  { re: /\bDate\.now\b/, label: 'Date.now' },
  { re: /\bperformance\.now\b/, label: 'performance.now' },
  { re: /\bnew\s+Date\s*\(\s*\)/, label: 'new Date()' },
  { re: /\bMath\.random\b/, label: 'Math.random' },
  { re: /(?:^|[^.\w])fetch\s*\(/, label: 'fetch(' },
  { re: /\bisoNow\s*\(/, label: 'isoNow(' },
  { re: /crypto\.randomUUID\b/, label: 'crypto.randomUUID' },
  { re: /crypto\.getRandomValues\b/, label: 'crypto.getRandomValues' },
  { re: /(?:^|[^\w.])setTimeout\s*\(/, label: 'setTimeout(' },
  { re: /(?:^|[^\w.])setInterval\s*\(/, label: 'setInterval(' },
  { re: /\.localeCompare\s*\(/, label: 'localeCompare(' },
  { re: /\bIntl\./, label: 'Intl.' },
] as const;

const files = new Glob('{libs,pkgs}/**/mutations/**/*.{ts,tsx}').scan({
  cwd: root,
  absolute: true,
});

const violations: string[] = [];

for await (const file of files) {
  if (file.includes('.test.') || file.includes('/test/')) continue;
  const text = await Bun.file(file).text();
  for (const ban of banned) {
    if (ban.re.test(text)) {
      violations.push(`${file.slice(root.length + 1)}: ${ban.label}`);
    }
  }
}

if (violations.length > 0) {
  console.error('check:mutation-determinism FAILED:');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log('check:mutation-determinism OK');
