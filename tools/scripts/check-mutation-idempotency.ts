#!/usr/bin/env bun
/**
 * Flag bare INSERT INTO (no ON CONFLICT) and relative UPDATE assignments
 * inside mutation modules — rebase must not double-apply.
 */
import { Glob } from 'bun';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../..');
const files = new Glob('{libs,pkgs}/**/mutations/**/*.{ts,tsx}').scan({
  cwd: root,
  absolute: true,
});

const violations: string[] = [];
const relativeUpdate = /\bSET\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\1\s*[\+\-]/i;

for await (const file of files) {
  if (file.includes('.test.') || file.includes('/test/')) continue;
  if (file.includes('create-mutation-client')) continue;
  if (file.includes('replay-mutation')) continue;
  if (file.includes('process-upload')) continue;
  if (file.includes('process-mutations')) continue;
  const text = await Bun.file(file).text();
  const rel = file.slice(root.length + 1);

  if (relativeUpdate.test(text)) {
    violations.push(`${rel}: relative UPDATE (col = col ± n)`);
  }

  const insertRe = /INSERT\s+INTO\s+[a-zA-Z_][\s\S]{0,400}?(?=;|`)/gi;
  let m: RegExpExecArray | null;
  while ((m = insertRe.exec(text)) !== null) {
    const chunk = m[0];
    if (!/ON\s+CONFLICT/i.test(chunk)) {
      const line = text.slice(0, m.index).split('\n').length;
      violations.push(`${rel}:${line}: bare INSERT without ON CONFLICT`);
    }
  }
}

if (violations.length > 0) {
  console.error('check:mutation-idempotency FAILED:');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log('check:mutation-idempotency OK');
