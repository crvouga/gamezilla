// @io-wall-ok — tools composition root
/**
 * Ban SQL-engine wall clock / RNG defaults and DML.
 *
 * App-supplied now/createId must own timestamps and ids — no DEFAULT now(),
 * gen_random_uuid(), randomblob, strftime('now'), datetime('now'), or bare
 * SQL now()/gen_random_uuid(). Test / extension stubs opt in with `@io-wall-ok`.
 *
 * Only scans .sql files and known SQL-emitting TS modules (avoids JS `now()`).
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import {
  fileAllowsWallConstruction,
  fileHasIoWallOkPragma,
} from './io-scan-pragma';
import { collectSqlWallScanFiles, REPO_ROOT } from './io-scan-roots';

type Ban = {
  readonly kind: string;
  readonly re: RegExp;
};

const BANS: readonly Ban[] = [
  {
    kind: 'DEFAULT now()',
    re: /DEFAULT\s+now\s*\(\s*\)/i,
  },
  {
    kind: 'DEFAULT gen_random_uuid()',
    re: /DEFAULT\s+gen_random_uuid\s*\(\s*\)/i,
  },
  {
    kind: 'randomblob(',
    re: /\brandomblob\s*\(/i,
  },
  {
    kind: "strftime('now')",
    re: /strftime\s*\([^)]*['"]now['"]/i,
  },
  {
    kind: "datetime('now')",
    re: /datetime\s*\(\s*['"]now['"]\s*\)/i,
  },
  {
    kind: 'COALESCE(..., now())',
    re: /COALESCE\s*\([^;]*?(?<![.\w])now\s*\(\s*\)/i,
  },
  {
    kind: 'sql now()',
    re: /(?<![.\w])now\s*\(\s*\)/i,
  },
  {
    kind: 'gen_random_uuid()',
    re: /(?<!DEFAULT\s)(?<![.\w])gen_random_uuid\s*\(\s*\)/i,
  },
];

type Offense = {
  readonly path: string;
  readonly line: number;
  readonly kind: string;
};

function offenseKey(o: Offense): string {
  return `${o.path}:${String(o.line)}:${o.kind}`;
}

/** Paths that emit or embed SQL (not general TS with injected `now` callbacks). */
function isSqlishPath(rel: string): boolean {
  if (rel.endsWith('.sql')) return true;
  const base = rel.split('/').pop() ?? '';
  if (
    base === 'emit.ts' ||
    base === 'framework-server-ddl.ts' ||
    base === 'migrate-sql.ts' ||
    base === 'open-sim-sqlite.ts' ||
    base === 'impl-postgres.ts' ||
    base === 'impl-postgres-tx.ts'
  ) {
    return true;
  }
  // Tests that assert SQL text may still embed wall defaults — scan them too.
  if (base.endsWith('.test.ts') || base.endsWith('.test.tsx')) {
    return /migrate|emit|ddl|sql-map|schema|open-sim/.test(rel);
  }
  return false;
}

function stripLineComment(line: string, isSql: boolean): string {
  const trimmed = line.trim();
  if (isSql) {
    if (trimmed.startsWith('--')) return '';
  } else {
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*')
    ) {
      return '';
    }
  }
  const idx = line.indexOf(isSql ? '--' : '//');
  if (idx >= 0) return line.slice(0, idx);
  return line;
}

function scanFile(abs: string): Offense[] {
  const rel = relative(REPO_ROOT, abs);
  if (!isSqlishPath(rel)) return [];
  const isSql = rel.endsWith('.sql');
  const text = readFileSync(abs, 'utf8');
  const isTest = /\.test\.[tj]sx?$/.test(rel) || /\.spec\.[tj]sx?$/.test(rel);
  if (
    fileAllowsWallConstruction(rel, text) ||
    (isTest && fileHasIoWallOkPragma(text))
  ) {
    return [];
  }
  const lines = text.split('\n');
  const out: Offense[] = [];
  for (let i = 0; i < lines.length; i++) {
    const code = stripLineComment(lines[i] ?? '', isSql);
    if (code.length === 0) continue;
    for (const ban of BANS) {
      if (!ban.re.test(code)) continue;
      // DEFAULT now() already reported — skip duplicate sql now() on same line.
      if (ban.kind === 'sql now()' && /DEFAULT\s+now\s*\(\s*\)/i.test(code)) {
        continue;
      }
      if (
        ban.kind === 'gen_random_uuid()' &&
        /DEFAULT\s+gen_random_uuid\s*\(\s*\)/i.test(code)
      ) {
        continue;
      }
      out.push({ path: rel, line: i + 1, kind: ban.kind });
    }
  }
  return out;
}

const files = await collectSqlWallScanFiles();
const offenses: Offense[] = [];
for (const f of files) {
  offenses.push(...scanFile(f));
}

if (offenses.length > 0) {
  console.error(
    'SQL wall-I/O check failed — inject now/createId; do not use engine now()/uuid defaults.\n' +
      'Extension stubs may mark with `// @io-wall-ok`:\n'
  );
  for (const o of offenses.slice(0, 200)) {
    console.error(`  - ${offenseKey(o)}`);
  }
  if (offenses.length > 200) {
    console.error(`  … and ${String(offenses.length - 200)} more`);
  }
  process.exit(1);
}

console.log(`SQL wall-I/O check passed (${String(files.length)} files).`);
