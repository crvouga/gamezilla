/**
 * Guards that interface / client / wire never import the SQL adapter.
 * `testing/` may re-export the sim world (which boots impl-sql privately).
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../..');
const FORBIDDEN = [
  /from ['"]\.\.\/impl-sql/,
  /from ['"]@pkgs\/matchmaking\/impl-sql/,
  /@electric-sql\/pglite/,
  /createPgliteSqlClient/,
  /@pkgs\/sql-client/,
  /impl-in-memory/,
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...walk(path));
    } else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) {
      out.push(path);
    }
  }
  return out;
}

describe('import hygiene', () => {
  for (const folder of ['interface', 'client', 'wire']) {
    test(`${folder} does not import SQL / PGlite / in-memory`, () => {
      const files = walk(join(ROOT, folder));
      const offenders: string[] = [];
      for (const file of files) {
        const text = readFileSync(file, 'utf8');
        for (const re of FORBIDDEN) {
          if (re.test(text)) {
            offenders.push(`${file} matches ${String(re)}`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});
