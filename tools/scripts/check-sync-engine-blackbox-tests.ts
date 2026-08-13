// @io-wall-ok — tools composition root
#!/usr/bin/env bun
/**
 * Enforce black-box sync-engine tests:
 * - all `*.test.ts` live under `pkgs/sync-engine/src/tests/`
 * - scenario tests do not assert framework tables or import private modules
 * - scenario authoring uses the five-concept sim API (no old DSL / pump helpers)
 * - demoted surface banned; bare faults: RELIABLE_FAULTS banned
 */
import { basename, join } from 'node:path';
import { Glob } from 'bun';

const root = join(import.meta.dirname, '../..');
const pkg = 'pkgs/sync-engine';
const testsRoot = `${pkg}/src/tests`;

const violations: string[] = [];

const FORBIDDEN_TABLE_RE =
  /\b(sync_engine_push_applied|sync_engine_mutations_applied|sync_engine_mutations|sync_engine_scope_meta|sync_engine_write_rejections|sqlite_master)\b/;

const PRIVATE_RELATIVE_IMPORT_RE =
  /from\s+['"](?:\.\.\/)+(?:client|server|mutations|queries|shared)\//;

const PRIVATE_PACKAGE_IMPORT_RE = /from\s+['"]@pkgs\/sync-engine\/src\//;

const ALLOWED_PACKAGE_IMPORT_RE =
  /from\s+['"]@pkgs\/sync-engine\/(client|server|shared|test)['"]/;

const GET_SYNC_ENGINE_ALLOW = new Set([
  'account-switch-pool-isolation.test.ts',
]);
const POST_MUTATIONS_ALLOW = new Set([
  'duplicate-mutation-id-different-args-first-wins.test.ts',
]);

function prevNonEmpty(lines: string[], idx: number): string {
  for (let j = idx - 1; j >= 0; j -= 1) {
    const t = lines[j]!.trim();
    if (t.length > 0) return t;
  }
  return '';
}

/** True when a seed for-of loop body opens a world (not runSeed fuzz). */
function seedLoopOpensWorld(lines: string[], start: number): boolean {
  let seenOpen = false;
  let seenRunSeed = false;
  for (let k = start; k < Math.min(start + 25, lines.length); k += 1) {
    const t = lines[k]!;
    if (k > start && /^\s*test\s*[\.(]/.test(t)) break;
    if (/openSimWorld\s*\(/.test(t)) seenOpen = true;
    if (/runSeed\s*\(/.test(t)) seenRunSeed = true;
  }
  return seenOpen && !seenRunSeed;
}

/** Bare `faults: RELIABLE_FAULTS` (not a spread / custom object). */
function isBareReliableFaults(line: string): boolean {
  return /^\s*faults:\s*RELIABLE_FAULTS\s*,?\s*$/.test(line);
}

for await (const file of new Glob(`${pkg}/src/**/*.test.ts`).scan({
  cwd: root,
  absolute: false,
})) {
  if (!file.startsWith(`${testsRoot}/`)) {
    violations.push(`${file}: test must live under ${testsRoot}/`);
  }
}

for await (const file of new Glob(`${testsRoot}/scenarios/**/*.test.ts`).scan({
  cwd: root,
  absolute: false,
})) {
  const base = basename(file);
  const text = await Bun.file(join(root, file)).text();
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const n = i + 1;
    if (FORBIDDEN_TABLE_RE.test(line)) {
      violations.push(
        `${file}:${n}: scenario must not reference framework tables`
      );
    }
    if (PRIVATE_RELATIVE_IMPORT_RE.test(line)) {
      violations.push(
        `${file}:${n}: scenario must not import sync-engine internals`
      );
    }
    if (PRIVATE_PACKAGE_IMPORT_RE.test(line)) {
      violations.push(
        `${file}:${n}: scenario must not deep-import @pkgs/sync-engine/src`
      );
    }
    if (
      line.includes('@pkgs/sync-engine/') &&
      line.includes('from') &&
      !ALLOWED_PACKAGE_IMPORT_RE.test(line) &&
      !line.includes('@pkgs/sync-engine/src/')
    ) {
      const m = line.match(/from\s+['"](@pkgs\/sync-engine\/[^'"]+)['"]/);
      if (m !== null && !ALLOWED_PACKAGE_IMPORT_RE.test(line)) {
        violations.push(
          `${file}:${n}: scenario may only import @pkgs/sync-engine/{client,server,shared,test}`
        );
      }
    }
    if (/\.engine\./.test(line)) {
      violations.push(
        `${file}:${n}: scenario must not use .engine. (use flattened client API)`
      );
    }
    if (/\.lifecycle\./.test(line)) {
      violations.push(
        `${file}:${n}: scenario must not use .lifecycle. (use online/foreground)`
      );
    }
    if (/function\s+pump\b/.test(line)) {
      violations.push(`${file}:${n}: use world.until instead of local pump()`);
    }
    if (/function\s+waitForStatus\b/.test(line)) {
      violations.push(
        `${file}:${n}: use client.outcome + world.until instead of waitForStatus`
      );
    }
    if (/function\s+waitForTopics\b/.test(line)) {
      violations.push(
        `${file}:${n}: use world.until(() => topics…) instead of waitForTopics`
      );
    }
    if (/mutation-status/.test(line) && /from\s+['"]/.test(line)) {
      violations.push(
        `${file}:${n}: use client.outcome / rejections instead of mutation-status`
      );
    }
    if (/await\s+world\.dispose\s*\(/.test(line)) {
      violations.push(
        `${file}:${n}: use await using world = … instead of manual dispose`
      );
    }
    if (
      /for\s*\(\s*const\s+seed\s+of\b/.test(line) &&
      seedLoopOpensWorld(lines, i)
    ) {
      violations.push(
        `${file}:${n}: use test.each for seed sweeps that openSimWorld`
      );
    }
    if (
      /\.nudge\s*\(/.test(line) &&
      !prevNonEmpty(lines, i).startsWith('// nudge:')
    ) {
      violations.push(
        `${file}:${n}: client.nudge() requires a preceding // nudge: comment`
      );
    }
    if (/\bworld\.scheduler\b/.test(line)) {
      violations.push(
        `${file}:${n}: use world.isSchedulerQuiescent() — world.scheduler is internal`
      );
    }
    if (/\bworld\.rng\b/.test(line)) {
      violations.push(`${file}:${n}: world.rng is internal (lab/fuzz only)`);
    }
    if (/\bworld\.network\b/.test(line)) {
      violations.push(
        `${file}:${n}: use world.net() — world.network is internal`
      );
    }
    if (/\brunUntilIdle\s*\(/.test(line)) {
      violations.push(
        `${file}:${n}: runUntilIdle is internal — use until / assertConverged`
      );
    }
    if (isBareReliableFaults(line)) {
      violations.push(
        `${file}:${n}: omit faults: RELIABLE_FAULTS (default); spread for custom faults`
      );
    }
    if (/\.getSyncEngine\s*\(/.test(line) && !GET_SYNC_ENGINE_ALLOW.has(base)) {
      violations.push(
        `${file}:${n}: getSyncEngine is allowlisted for pool isolation only`
      );
    }
    if (/\.postMutations\s*\(/.test(line) && !POST_MUTATIONS_ALLOW.has(base)) {
      violations.push(
        `${file}:${n}: postMutations is allowlisted for wire-idempotency only`
      );
    }
  }
}

if (violations.length > 0) {
  console.error('ci:sync-engine-blackbox-tests FAILED:');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log('ci:sync-engine-blackbox-tests OK');
