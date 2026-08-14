#!/usr/bin/env bun
// @io-wall-ok — tools composition root

import { join } from 'node:path';
import { Glob } from 'bun';

const root = join(import.meta.dirname, '../..');
const patterns = [
  'validatedWrite',
  'defineRule',
  'runRules',
  'RulesReject',
  "from '@pkgs/rules",
  'processUploadWithRules',
  'applyBatch',
  'APP_TABLE_POLICIES',
  'denyTablePolicy',
  'createTablePolicyRegistry',
  'APP_RULES',
  'beforeBatch',
  'BeforeBatch',
  'strip-server-owned-profile',
  'PUT /profile/username',
] as const;

const files = new Glob('{apps,libs,pkgs}/**/*.{ts,tsx,js,cjs,mjs,json}').scan({
  cwd: root,
  absolute: true,
});
const violations: string[] = [];

for await (const file of files) {
  if (
    file.includes('/pkgs/sync-engine/src/mutations/') ||
    file.includes('/dist/') ||
    file.includes('/build/')
  )
    continue;
  const text = await Bun.file(file).text();
  for (const pattern of patterns) {
    if (text.includes(pattern)) {
      violations.push(`${file.slice(root.length + 1)}: ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  console.error('check:no-legacy-writes FAILED:');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log('check:no-legacy-writes OK');
