#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Residual sync-engine terminology gate (MD / line-regex / glossary).
 * Identifier bans live in Biome plugin `no-sync-engine-terminology.grit`.
 */
import { join } from 'node:path';
import { Glob } from 'bun';

const root = join(import.meta.dirname, '../..');

const SCAN_GLOBS = [
  'pkgs/sync-engine/**/*.{ts,tsx,md}',
  'libs/notifications/src/**/*.{ts,tsx}',
  'pkgs/pubsub/README.md',
  'apps/client/src/sync/**/*.{ts,tsx}',
  'apps/server/src/sync/**/*.{ts,tsx}',
  'libs/**/use-cases/**/shared/**/*.{ts,tsx}',
  'libs/runtime/src/public/sync-topics.ts',
  'libs/runtime/src/root/app-topic-map.ts',
  'AGENTS.md',
  'tools/scripts/check-no-domain-hard-delete.ts',
] as const;

type Rule = {
  readonly name: string;
  readonly re: RegExp;
  readonly allow?: (rel: string, line: string) => boolean;
};

const isTerminologyScript = (rel: string) =>
  rel.endsWith('check-sync-engine-terminology.ts');

const RULES: readonly Rule[] = [
  {
    name: 'reapply / re-apply (sync merge step)',
    re: /\bre-?appl(?:y|ies|ied|ying)\b/i,
  },
  {
    name: 'retired invalidates field',
    re: /\binvalidates\s*:/,
    allow: (rel) => isTerminologyScript(rel),
  },
  {
    name: 'retired authoring hydrates field',
    re: /\bhydrates\s*:/,
    allow: (rel) =>
      isTerminologyScript(rel) ||
      rel.endsWith('queries/core/types.ts') ||
      rel.endsWith('CONTRACTS.md'),
  },
  {
    name: 'retired query channels field',
    re: /^\s*channels:\s*/,
    allow: (rel) => isTerminologyScript(rel),
  },
  {
    name: 'protocol v1 module',
    re: /protocol\/v1/,
    allow: (rel) => isTerminologyScript(rel),
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
