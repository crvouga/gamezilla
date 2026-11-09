#!/usr/bin/env bun
// @io-wall-ok — read all PR checks from GitHub; the policy itself is pure.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { monotonicClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { awaitRequiredPrChecks } from './pr-check-readiness';
import { readPrCheckSnapshot } from './pr-check-source';
import {
  type RequiredPrCheck,
  unavailableScannerWarnings,
} from './required-pr-checks';

async function main(): Promise<void> {
  const repository = process.env['GITHUB_REPOSITORY'];
  const head = process.env['PR_HEAD'];
  const merge = process.env['GITHUB_SHA'];
  if (!repository || !head || !merge)
    throw new Error(
      'Mandatory PR checks require GITHUB_REPOSITORY, PR_HEAD and GITHUB_SHA'
    );
  const directory = join(
    import.meta.dirname,
    '../../infra-shared-ts/tofu/modules/repository/required-checks'
  );
  const required = readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .map(
      (file) =>
        JSON.parse(
          readFileSync(join(directory, file), 'utf8')
        ) as RequiredPrCheck
    );
  const shas = [...new Set([head, merge])];
  const checks = await awaitRequiredPrChecks({
    required,
    read: () => readPrCheckSnapshot(repository, shas),
    emptyShardPlan: process.env['SHARD_RESULT'] === 'skipped',
    clock: monotonicClock,
    timers: wallTimers,
    // Bounded external-producer coordination within the existing job deadline.
    // Every concurrent PR polls through one token's hourly API budget, so the
    // wait is long and the polling sparse.
    timeoutMs: 900_000,
    intervalMs: 30_000,
  });
  for (const warning of unavailableScannerWarnings(required, checks))
    console.log(`::warning::${warning}`);
  console.log(
    `Every discovered PR check passed and is mandatory (${checks.length} check results)`
  );
}

if (import.meta.main) await main();
