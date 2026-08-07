#!/usr/bin/env bun
/**
 * Fail if retired sync-engine terminology remains in the monorepo.
 * Hard cutover: no aliases, no dual wire fields, no dead names.
 */
import { join } from 'node:path';
import { Glob } from 'bun';

const root = join(import.meta.dirname, '../..');

const SCAN_GLOBS = [
  'pkgs/sync-engine/**/*.{ts,tsx,md}',
  'apps/client/src/sync/**/*.{ts,tsx}',
  'apps/api/src/sync/**/*.{ts,tsx}',
  'libs/**/shared/mutations/**/*.{ts,tsx}',
  'libs/db/src/shared/sync-topics.ts',
  'AGENTS.md',
  'tools/scripts/check-no-domain-hard-delete.ts',
] as const;

type Rule = {
  readonly name: string;
  readonly re: RegExp;
  readonly allow?: (rel: string, line: string) => boolean;
};

const RULES: readonly Rule[] = [
  {
    name: 'reapply / re-apply (sync merge step)',
    re: /\bre-?appl(?:y|ies|ied|ying)\b/i,
  },
  {
    name: '_topic_applied',
    re: /_topic_applied/,
    allow: (rel) => rel.endsWith('local-schema.ts'),
  },
  {
    name: '_sync_topic_checkpoint',
    re: /_sync_topic_checkpoint/,
    allow: (rel) => rel.endsWith('framework-server-ddl.ts'),
  },
  {
    name: 'topicCheckpoints',
    re: /topicCheckpoints/,
  },
  {
    name: 'NudgePayload',
    re: /NudgePayload/,
  },
  {
    name: 'attach-nudges / attachNudges',
    re: /attach-nudges|attachNudges/,
  },
  {
    name: 'mutation def writes: (use declaredWrites)',
    re: /^\s*writes:\s*\[/,
  },
  {
    name: 'mutation.writes reader',
    re: /mutation\.writes\b|\.writes\b(?=\s*[;,)\]])/,
    allow: (_rel, line) => {
      // Ordinary English / unrelated property access outside mutation defs.
      if (/declaredWrites/.test(line)) return true;
      if (/read.*writes|write.?client|table.?writes/i.test(line)) return true;
      return false;
    },
  },
];

const FORMERLY_NUDGE_RE = /formerly ['"]nudge['"]/;

const violations: string[] = [];
let formerlyNudgeHits = 0;

for (const pattern of SCAN_GLOBS) {
  const files = new Glob(pattern).scan({ cwd: root, absolute: true });
  for await (const file of files) {
    if (file.includes('/dist/') || file.includes('node_modules/')) continue;
    const text = await Bun.file(file).text();
    const rel = file.slice(root.length + 1);
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!;
      if (FORMERLY_NUDGE_RE.test(line)) {
        formerlyNudgeHits += 1;
      }
      for (const rule of RULES) {
        if (!rule.re.test(line)) continue;
        if (rule.allow?.(rel, line)) continue;
        violations.push(`${rel}:${i + 1}: [${rule.name}] ${line.trim()}`);
      }
    }
  }
}

if (formerlyNudgeHits !== 1) {
  violations.push(
    `expected exactly 1 glossary "formerly 'nudge'" line, found ${formerlyNudgeHits}`
  );
}

if (violations.length > 0) {
  console.error('ci:sync-engine-terminology FAILED:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log('ci:sync-engine-terminology OK');
