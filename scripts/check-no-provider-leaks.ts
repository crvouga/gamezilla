/**
 * Ensures provider names (clerk, infisical) appear only in allowlisted adapter
 * paths, and legacy auth/secret backend terms appear nowhere.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

const LEGACY_TERMS = [
  /\bvault\b/i,
  /\bbetter[- ]?auth\b/i,
  /\bopenbao\b/i,
  /\bdev-idp\b/i,
];

const CLERK_TERM = /\bclerk\b/i;
const INFISICAL_TERM = /\binfisical\b/i;

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  'coverage',
  '.expo',
  '.wrangler',
  '.qa-dist-prodcheck',
  'playwright-report',
  'test-results',
  'ios',
  'android',
  '.cursor',
]);

const SKIP_FILES = new Set(['bun.lock', 'package-lock.json', 'pnpm-lock.yaml']);

function isClerkAllowlisted(relativePath: string): boolean {
  if (relativePath.startsWith('pkgs/auth-clerk/')) return true;
  if (relativePath.startsWith('libs/integration-test/')) return true;
  if (relativePath.startsWith('libs/infra/src/cli/secrets/')) return true;
  if (
    relativePath.startsWith('apps/client/src/providers/app-auth-provider.tsx')
  )
    return true;
  if (relativePath.startsWith('apps/api/src/api.ts')) return true;
  if (/^libs\/auth\/src\/server\/.*\.test\.ts$/.test(relativePath)) return true;
  if (relativePath === 'scripts/check-no-provider-leaks.ts') return true;
  if (relativePath.endsWith('package.json')) return true;
  if (relativePath === 'tsconfig.json') return true;
  return false;
}

function isInfisicalAllowlisted(relativePath: string): boolean {
  // Secrets provider package (neutral facade + private adapter) and CI action.
  if (relativePath.startsWith('pkgs/secret-provider/')) return true;
  if (relativePath.startsWith('.github/actions/secrets-auth/')) return true;
  // CLI-native config kept in sync by the adapter for local CLI use.
  if (relativePath === '.infisical.json') return true;
  // This enforcement script names the forbidden terms.
  if (relativePath === 'scripts/check-no-provider-leaks.ts') return true;
  if (relativePath === 'knip.jsonc') return true;
  if (relativePath.endsWith('package.json')) return true;
  if (relativePath === 'tsconfig.json') return true;
  return false;
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const rel = relative(REPO_ROOT, full);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (SKIP_FILES.has(name)) continue;
    if (!/\.(ts|tsx|js|jsx|json|yml|yaml|md|cjs|mjs)$/.test(name)) continue;
    out.push(rel);
  }
}

function collectFiles(): string[] {
  const out: string[] = [];
  walk(REPO_ROOT, out);
  return out;
}

const files = collectFiles();
const violations: string[] = [];

for (const file of files) {
  const content = readFileSync(join(REPO_ROOT, file), 'utf8');
  const legacy = LEGACY_TERMS.filter((p) => p.test(content));
  if (legacy.length > 0) {
    violations.push(`${file}: legacy term (${legacy.map(String).join(', ')})`);
  }
  if (CLERK_TERM.test(content) && !isClerkAllowlisted(file)) {
    violations.push(`${file}: provider leak (${String(CLERK_TERM)})`);
  }
  if (INFISICAL_TERM.test(content) && !isInfisicalAllowlisted(file)) {
    violations.push(`${file}: provider leak (${String(INFISICAL_TERM)})`);
  }
}

if (violations.length > 0) {
  console.error('Provider leak check failed:\n');
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log('Provider leak check passed.');
