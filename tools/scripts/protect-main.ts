#!/usr/bin/env bun
// @io-wall-ok — admin CLI entry (gh + GitHub REST)
/**
 * Apply the `main` protection this repo's workflow assumes: `main` only moves
 * through a merged pull request that passed `check:full`.
 *
 * Needs GitHub Pro/Team (or a public repo) — without one the REST API answers
 * 403 `Upgrade to GitHub Pro or make this repository public`, and no script can
 * get around that. Idempotent; re-run it whenever the policy changes.
 *
 *   bun run protect:main
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';

const log = createLogger({ name: 'protect:main', now: wallClock.now });

/** The single PR check (`.github/workflows/pr.yml`, job name). */
const REQUIRED_CHECK = 'check:full';

/** Require a PR, require `check:full` on the latest `main`, and take the direct
 *  push / force-push / delete escape hatches away from everyone — admins too. */
const PROTECTION = {
  required_status_checks: { strict: true, contexts: [REQUIRED_CHECK] },
  enforce_admins: true,
  required_pull_request_reviews: {
    dismiss_stale_reviews: false,
    require_code_owner_reviews: false,
    required_approving_review_count: 0,
  },
  restrictions: null,
  allow_force_pushes: false,
  allow_deletions: false,
} as const;

function gh(args: readonly string[]): {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
} {
  const result = Bun.spawnSync(['gh', ...args], { stderr: 'pipe' });
  return {
    status: result.exitCode ?? 1,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

function resolveRepo(): string {
  const result = gh([
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '--jq',
    '.nameWithOwner',
  ]);
  if (result.status !== 0 || result.stdout === '') {
    throw new Error(
      `could not resolve the repository (is \`gh\` authenticated?): ${result.stderr}`
    );
  }
  return result.stdout;
}

function main(): void {
  const repo = resolveRepo();
  const dir = mkdtempSync(join(tmpdir(), 'gamezilla-protect-main-'));
  const payloadPath = join(dir, 'protection.json');
  writeFileSync(payloadPath, JSON.stringify(PROTECTION));

  const result = gh([
    'api',
    '--method',
    'PUT',
    `repos/${repo}/branches/main/protection`,
    '--input',
    payloadPath,
  ]);

  if (result.status !== 0) {
    const forbidden = /Upgrade to GitHub Pro or make this repository public/u;
    if (forbidden.test(result.stderr)) {
      log.error(
        `main protection needs GitHub Pro/Team (or a public repo): ${repo} is private on a plan without protected branches. Upgrade, then re-run \`bun run protect:main\`.`
      );
    } else {
      log.error(`failed to protect main: ${result.stderr}`);
    }
    process.exit(1);
  }

  log.info(
    `${repo}: main now requires a pull request with a green \`${REQUIRED_CHECK}\` (strict), and rejects direct pushes, force-pushes and deletions — admins included.`
  );
}

try {
  main();
} catch (error: unknown) {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
