#!/usr/bin/env bun
// @io-wall-ok — CI entry: reads the environment's secrets, records one workflow result.
/**
 * Record one Release, Health or Verify Nightly run on `main` as a sample of
 * `ci.workflow.result` in every environment's metrics backend, so a red run
 * raises the Grafana alert "An important CI workflow is failing on main"
 * (`libs/observability-server-ts/src/ci-workflow-alerts.ts`) and a green one
 * clears it. Called by `libs/tools-harness-ts/scripts/ci-workflow-alert.ts`.
 *
 *   bun run apps/product-ts/scripts/ci-workflow-result.ts \
 *     --workflow release|health|verify-nightly --passed true|false --envs '["dev","prd"]'
 *
 * Exits 1 when any environment could not record, after trying every one.
 */

import {
  ciWorkflowResultRequest,
  isCiWorkflow,
} from '@libs/observability-server-ts/ci-workflow-results';
import { exportSecretsMapLive } from '@libs/secrets-server-ts/secrets-io';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { createDeadlineFetch } from '@pkgs/http-client-shared-ts/deadline-fetch';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { sendMetrics } from './health-check-results';

function option(argv: readonly string[], name: string): string {
  const at = argv.indexOf(`--${name}`);
  const value = at === -1 ? undefined : argv[at + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`ci-workflow-result: --${name} is required`);
  }
  return value;
}

export function parseEnvs(text: string): readonly string[] {
  const value: unknown = JSON.parse(text);
  if (
    !Array.isArray(value) ||
    !value.every((env): env is string => typeof env === 'string')
  ) {
    throw new Error(
      `ci-workflow-result: --envs must be a JSON list, got ${text}`
    );
  }
  return value;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const workflow = option(argv, 'workflow');
  if (!isCiWorkflow(workflow)) {
    console.error(`ci-workflow-result: unknown workflow ${workflow}`);
    process.exit(2);
  }
  const passed = option(argv, 'passed') === 'true';
  const fetch = createDeadlineFetch({
    fetch: createGlobalHttpClient().fetch,
    timers: wallTimers,
    timeoutMs: 15_000,
  });
  let status = 0;
  for (const environment of parseEnvs(option(argv, 'envs'))) {
    const outcome = await sendMetrics({
      body: JSON.stringify(
        ciWorkflowResultRequest({
          workflow,
          passed,
          environment,
          atMs: wallClock.now(),
          version: process.env['GITHUB_SHA']?.trim() || 'local',
        })
      ),
      secrets: await exportSecretsMapLive(environment),
      fetch,
    });
    if (outcome.recorded) {
      console.log(
        `ci-workflow-result: ${workflow} ${passed ? 'passed' : 'failed'} recorded in ${environment}`
      );
    } else {
      console.error(
        `ci-workflow-result: ${workflow} not recorded in ${environment}: ${outcome.reason}`
      );
      status = 1;
    }
  }
  process.exit(status);
}
