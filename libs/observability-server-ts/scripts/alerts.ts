#!/usr/bin/env bun
// @io-wall-ok — CLI: `bun alerts`, reads Health's open alerts through gh.
/**
 * The open alerts as work items, from the newest Health run on `main` that
 * left them (`src/open-alerts.ts`). Needs only an authenticated `gh`: no
 * secret store.
 *
 *   bun alerts                 every open work item and failing check job
 *   bun alerts --env prd       one environment's
 *   bun alerts --json          the same, as JSON
 */

import { spawnSync } from 'node:child_process';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import {
  findOpenAlerts,
  forEnvironment,
  openAlertsJson,
  renderOpenAlerts,
} from '../src/open-alerts';

function gh(args: readonly string[]): string {
  const run = spawnSync('gh', [...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1_048_576,
  });
  if (run.error !== undefined) throw run.error;
  if (run.status !== 0)
    throw new Error(
      `gh ${args.slice(0, 3).join(' ')} failed: ${run.stderr.trim()}`
    );
  return run.stdout;
}

function flag(argv: readonly string[], name: string): string | undefined {
  const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline !== undefined) return inline.slice(name.length + 3);
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? undefined : argv[at + 1];
}

const argv = process.argv.slice(2);
const found = findOpenAlerts(gh, wallClock.now());
if ('error' in found) {
  process.stderr.write(`alerts: ${found.error}\n`);
  process.exit(1);
}
const alerts = forEnvironment(found, flag(argv, 'env'));
process.stdout.write(
  argv.includes('--json') ? openAlertsJson(alerts) : renderOpenAlerts(alerts)
);
