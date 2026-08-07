/**
 * Ensures Clerk SDK and `@pkgs/auth-clerk` stay behind the auth adapter boundary.
 *
 * `@clerk/*` imports: only in pkgs/auth-clerk and libs/integration-test.
 * `@pkgs/auth-clerk` imports: only in the adapter itself and app composition roots.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');

const CLERK_SDK_ALLOW_PREFIXES = ['pkgs/auth-clerk/', 'libs/integration-test/'];

const AUTH_CLERK_PKG_ALLOW_PREFIXES = ['pkgs/auth-clerk/'];

const AUTH_CLERK_PKG_ALLOW_FILES = new Set([
  'apps/client/src/providers/app-auth-provider.tsx',
  'apps/api/src/api.ts',
]);

const CLERK_SDK_IMPORT_RE =
  /from\s+['"]@clerk\/[^'"]+['"]|require\(\s*['"]@clerk\/|import\(\s*['"]@clerk\//;

const AUTH_CLERK_PKG_IMPORT_RE =
  /from\s+['"]@pkgs\/auth-clerk(?:\/[^'"]*)?['"]|require\(\s*['"]@pkgs\/auth-clerk|import\(\s*['"]@pkgs\/auth-clerk/;

const SKIP_DIR = new Set([
  'node_modules',
  'dist',
  '.git',
  '.turbo',
  'coverage',
  '.expo',
  '.wrangler',
  'ios',
  'android',
]);

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue;
    out.push(join(dir, entry.name));
  }
}

function startsWithAny(rel: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => rel.startsWith(prefix));
}

function isClerkSdkAllowed(rel: string): boolean {
  return startsWithAny(rel, CLERK_SDK_ALLOW_PREFIXES);
}

function isAuthClerkPkgAllowed(rel: string): boolean {
  if (startsWithAny(rel, AUTH_CLERK_PKG_ALLOW_PREFIXES)) return true;
  return AUTH_CLERK_PKG_ALLOW_FILES.has(rel);
}

const files: string[] = [];
for (const root of ['apps', 'libs', 'pkgs']) {
  const abs = join(REPO_ROOT, root);
  try {
    if (!statSync(abs).isDirectory()) continue;
  } catch {
    continue;
  }
  walk(abs, files);
}

const clerkSdkOffenders: string[] = [];
const authClerkPkgOffenders: string[] = [];

for (const file of files) {
  const rel = relative(REPO_ROOT, file);
  const text = readFileSync(file, 'utf8');
  if (!isClerkSdkAllowed(rel) && CLERK_SDK_IMPORT_RE.test(text)) {
    clerkSdkOffenders.push(rel);
  }
  if (!isAuthClerkPkgAllowed(rel) && AUTH_CLERK_PKG_IMPORT_RE.test(text)) {
    authClerkPkgOffenders.push(rel);
  }
}

if (clerkSdkOffenders.length > 0 || authClerkPkgOffenders.length > 0) {
  console.error('Provider leak check failed:\n');
  if (clerkSdkOffenders.length > 0) {
    console.error(
      '@clerk/* imports must stay in pkgs/auth-clerk or libs/integration-test:\n' +
        clerkSdkOffenders.map((f) => `  - ${f}`).join('\n')
    );
  }
  if (authClerkPkgOffenders.length > 0) {
    if (clerkSdkOffenders.length > 0) console.error('');
    console.error(
      '@pkgs/auth-clerk imports must stay in the adapter or app composition roots:\n' +
        authClerkPkgOffenders.map((f) => `  - ${f}`).join('\n')
    );
  }
  process.exit(1);
}

console.log('Provider leak check passed.');
