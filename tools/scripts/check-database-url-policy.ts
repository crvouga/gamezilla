#!/usr/bin/env bun
/**
 * Fail-fast guardrail: every DATABASE_URL entrypoint must call the Tiger
 * database policy helpers so non-deploy contexts never reach production Postgres.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');

type EntrypointRule = {
  readonly file: string;
  readonly mustInclude: readonly string[];
};

const ENTRYPOINTS: readonly EntrypointRule[] = [
  {
    file: 'apps/api/scripts/setup-dev-vars.ts',
    mustInclude: ['assertDevSecretsEnv', 'assertNonProdDatabaseUrlForTooling'],
  },
  {
    file: 'apps/api/src/db/migrate.ts',
    mustInclude: ['assertDevSecretsEnv', 'assertNonProdDatabaseUrlForTooling'],
  },
  {
    file: 'apps/api/scripts/wipe-dev-db.ts',
    mustInclude: [
      'assertDevSecretsEnv',
      'ALLOW_PRODUCTION_DATABASE_URL',
      'assertWipeDatabasePolicy',
      'fetchSecretFrom',
    ],
  },
  {
    file: 'apps/api/src/app/request-db-middleware.ts',
    mustInclude: ['assertDatabaseUrlAllowedForSecretsEnv'],
  },
  {
    file: 'libs/stripe/src/script-runtime.ts',
    mustInclude: [
      'assertDevSecretsEnv',
      'assertDatabaseUrlAllowedForSecretsEnvForTooling',
    ],
  },
  {
    file: 'libs/chess/src/server/seed-chess-puzzle/chess-puzzle-seeder.ts',
    mustInclude: ['assertDatabaseUrlAllowedForSecretsEnvForTooling'],
  },
  {
    file: 'libs/integration-test/src/preview-stack-env.ts',
    mustInclude: ['assertDevSecretsEnv', 'LOCAL_POSTGRES_DATABASE_URL'],
  },
];

const violations: string[] = [];

for (const rule of ENTRYPOINTS) {
  const abs = join(REPO_ROOT, rule.file);
  try {
    if (!statSync(abs).isFile()) {
      violations.push(`${rule.file}: file missing`);
      continue;
    }
  } catch {
    violations.push(`${rule.file}: file missing`);
    continue;
  }
  const content = readFileSync(abs, 'utf8');
  for (const needle of rule.mustInclude) {
    if (!content.includes(needle)) {
      violations.push(`${rule.file}: missing required reference \`${needle}\``);
    }
  }
}

if (violations.length === 0) {
  console.log(
    'check:database-url-policy OK — DATABASE_URL entrypoints wire Tiger policy guards.'
  );
  process.exit(0);
}

console.error('check:database-url-policy FAILED:');
for (const v of violations) {
  console.error(`  - ${v}`);
}
process.exit(1);
