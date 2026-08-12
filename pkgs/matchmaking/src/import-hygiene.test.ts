/**
 * Guards that interface / testing / in-memory sources never import the
 * SQL adapter or Postgres clients.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir);
const FORBIDDEN = [
  /from ['"]\.\.\/impl-sql/,
  /from ['"]@pkgs\/matchmaking\/impl-sql/,
  /@electric-sql\/pglite/,
  /createPgliteSqlClient/,
  /@pkgs\/sql-client/,
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
  for (const folder of [
    'interface',
    'impl-in-memory',
    'testing',
    'client',
    'wire',
  ]) {
    test(`${folder} does not import SQL / PGlite`, () => {
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
