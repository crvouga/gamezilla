// @io-wall-ok — tools composition root
/**
 * Ensures Better Auth SDK and `@pkgs/auth-better-auth` stay behind the auth
 * adapter boundary.
 *
 * `better-auth` / `@better-auth/*` imports: only in pkgs/auth-better-auth.
 * `@pkgs/auth-better-auth` imports: only in the adapter itself and app
 * composition roots.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');

const BETTER_AUTH_SDK_ALLOW_PREFIXES = ['pkgs/auth-better-auth/'];

const AUTH_BETTER_AUTH_PKG_ALLOW_PREFIXES = ['pkgs/auth-better-auth/'];

const AUTH_BETTER_AUTH_PKG_ALLOW_FILES = new Set([
  'apps/client/src/providers/app-auth-provider.tsx',
  // Sim DI seam: types `authClientStorage` for injected AuthClientStorage.
  'apps/client/src/providers/client-system-resources.ts',
  'apps/api/src/api.ts',
  'apps/api/src/app/request-db-middleware.ts',
  'apps/api/src/app/create-app.ts',
  'apps/api/src/auth/better-auth-routes.ts',
  'apps/api/src/config/better-auth-boot.ts',
  'libs/db/src/server/run-postgres-migrations.ts',
  'apps/api/src/db/migrate.ts',
  'apps/api/src/request-scope.ts',
  'apps/api/scripts/wipe-dev-db.ts',
  'tools/scripts/run-postgres-migrations-secrets.ts',
]);

const BETTER_AUTH_SDK_IMPORT_RE =
  /from\s+['"]better-auth(?:\/[^'"]*)?['"]|from\s+['"]@better-auth\/[^'"]+['"]|require\(\s*['"]better-auth|require\(\s*['"]@better-auth\/|import\(\s*['"]better-auth|import\(\s*['"]@better-auth\//;

const AUTH_BETTER_AUTH_PKG_IMPORT_RE =
  /from\s+['"]@pkgs\/auth-better-auth(?:\/[^'"]*)?['"]|require\(\s*['"]@pkgs\/auth-better-auth|import\(\s*['"]@pkgs\/auth-better-auth/;

const CLERK_IMPORT_RE =
  /from\s+['"]@clerk\/[^'"]+['"]|require\(\s*['"]@clerk\/|import\(\s*['"]@clerk\/|from\s+['"]@pkgs\/auth-clerk/;

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

function isBetterAuthSdkAllowed(rel: string): boolean {
  return startsWithAny(rel, BETTER_AUTH_SDK_ALLOW_PREFIXES);
}

function isAuthBetterAuthPkgAllowed(rel: string): boolean {
  if (startsWithAny(rel, AUTH_BETTER_AUTH_PKG_ALLOW_PREFIXES)) return true;
  return AUTH_BETTER_AUTH_PKG_ALLOW_FILES.has(rel);
}

const files: string[] = [];
for (const root of ['apps', 'libs', 'pkgs', 'tools']) {
  const abs = join(REPO_ROOT, root);
  try {
    if (!statSync(abs).isDirectory()) continue;
  } catch {
    continue;
  }
  walk(abs, files);
}

const betterAuthSdkOffenders: string[] = [];
const authBetterAuthPkgOffenders: string[] = [];
const clerkOffenders: string[] = [];

for (const file of files) {
  const rel = relative(REPO_ROOT, file);
  const text = readFileSync(file, 'utf8');
  if (!isBetterAuthSdkAllowed(rel) && BETTER_AUTH_SDK_IMPORT_RE.test(text)) {
    betterAuthSdkOffenders.push(rel);
  }
  if (
    !isAuthBetterAuthPkgAllowed(rel) &&
    AUTH_BETTER_AUTH_PKG_IMPORT_RE.test(text)
  ) {
    authBetterAuthPkgOffenders.push(rel);
  }
  if (CLERK_IMPORT_RE.test(text)) {
    clerkOffenders.push(rel);
  }
}

if (
  betterAuthSdkOffenders.length > 0 ||
  authBetterAuthPkgOffenders.length > 0 ||
  clerkOffenders.length > 0
) {
  console.error('Provider leak check failed:\n');
  if (clerkOffenders.length > 0) {
    console.error(
      'Clerk must be fully purged — remove @clerk/* / @pkgs/auth-clerk:\n' +
        clerkOffenders.map((f) => `  - ${f}`).join('\n')
    );
  }
  if (betterAuthSdkOffenders.length > 0) {
    if (clerkOffenders.length > 0) console.error('');
    console.error(
      'better-auth / @better-auth/* imports must stay in pkgs/auth-better-auth:\n' +
        betterAuthSdkOffenders.map((f) => `  - ${f}`).join('\n')
    );
  }
  if (authBetterAuthPkgOffenders.length > 0) {
    if (clerkOffenders.length > 0 || betterAuthSdkOffenders.length > 0) {
      console.error('');
    }
    console.error(
      '@pkgs/auth-better-auth imports must stay in the adapter or allowlisted composition roots:\n' +
        authBetterAuthPkgOffenders.map((f) => `  - ${f}`).join('\n')
    );
  }
  process.exit(1);
}

console.log('Provider leak check passed.');
