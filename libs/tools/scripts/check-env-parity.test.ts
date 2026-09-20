import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * A gate leaf must reach the same verdict on every machine.
 *
 * `bun check` is only worth running if a green run means the PR check is green
 * too. Both times that broke here, the cause was the same shape: a check read
 * `CI` and did something different. `@libs/billing#billing:check` skipped off
 * CI and hard-failed on it, so a laptop reported green over a check it never
 * ran; the property harness explored 40 cases in CI and 10 locally off one
 * seed, so CI searched 30 cases nobody had run.
 *
 * So `scripts/check-*.ts` may not read `CI` / `GITHUB_ACTIONS` at all. Adapting
 * *how* a run reports (log grouping, annotations) is legitimate but has to be
 * named here, with the reason it cannot change the verdict.
 */
const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const TIERS = ['apps', 'libs', 'pkgs'] as const;
const CI_ENV_READ = /process\.env\[['"](?:CI|GITHUB_ACTIONS)['"]\]/;

/** Files that read a CI variable for something that cannot change a verdict. */
const REPORTING_ONLY: Readonly<Record<string, string>> = {
  'apps/client/scripts/check-production-compression.ts':
    'emits a ::warning:: annotation; the script exits 0 on every path',
};

function scriptsDirs(tier: string): string[] {
  const tierDir = join(REPO_ROOT, tier);
  const out: string[] = [];
  for (const pkg of readdirSync(tierDir)) {
    const dir = join(tierDir, pkg, 'scripts');
    try {
      if (statSync(dir).isDirectory()) out.push(dir);
    } catch {
      // package has no scripts/
    }
  }
  return out;
}

function checkScripts(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name.startsWith('check-') && entry.name.endsWith('.ts')) {
        if (entry.name.endsWith('.test.ts')) continue;
        out.push(full);
      }
    }
  };
  for (const tier of TIERS) {
    for (const dir of scriptsDirs(tier)) walk(dir);
  }
  return out.sort();
}

describe('gate leaves reach the same verdict on every machine', () => {
  test('no `scripts/check-*.ts` branches on CI / GITHUB_ACTIONS', () => {
    const offenders = checkScripts()
      .map((path) => relative(REPO_ROOT, path))
      .filter((path) => !Object.hasOwn(REPORTING_ONLY, path))
      .filter((path) =>
        CI_ENV_READ.test(readFileSync(join(REPO_ROOT, path), 'utf8'))
      );
    expect(offenders).toEqual([]);
  });

  test('the scan actually reaches the check scripts', () => {
    // A rule that silently matches nothing is not a rule.
    expect(checkScripts().length).toBeGreaterThan(3);
  });

  test('every reporting-only exemption still exists and still reads CI', () => {
    for (const [path, reason] of Object.entries(REPORTING_ONLY)) {
      const source = readFileSync(join(REPO_ROOT, path), 'utf8');
      expect(CI_ENV_READ.test(source), `${path} no longer reads CI`).toBe(true);
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});
