#!/usr/bin/env bun
// @io-wall-ok — operational CLI entry, after a reviewed main-branch apply.
import { join } from 'node:path';
import {
  AlertDeliveryCheck,
  type AlertDeliveryConfiguration,
} from '@libs/infra-server-ts/alert-delivery-check';
import { record } from '@libs/infra-server-ts/alert-delivery-evidence';
import { tofuLayout } from '@libs/infra-server-ts/tofu-layout';
import { alertingDeploymentEnvironment } from '@libs/infra-shared-ts/alerting-deployment';
import { outputArgs } from '@libs/infra-shared-ts/tofu-command';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { spawnTool } from './tofu-process';

function required(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing ${name} for alert delivery verification`);
  return value;
}

function stateOutputs(source: string): Record<string, unknown> {
  try {
    return record(JSON.parse(source));
  } catch {
    throw new Error('OpenTofu returned invalid output JSON');
  }
}

async function main(): Promise<void> {
  if (
    process.env['GITHUB_ACTIONS'] !== 'true' ||
    process.env['GITHUB_REF'] !== 'refs/heads/main'
  )
    throw new Error(
      'Live alert delivery checks run only in the main-branch Release workflow'
    );
  const { paths } = tofuLayout(join(import.meta.dirname, '..'));
  const { env, missing } = alertingDeploymentEnvironment(process.env, paths);
  if (missing.length > 0)
    throw new Error(`Missing alerting credentials: ${missing.join(', ')}`);
  const shown = spawnTool(
    'tofu',
    outputArgs(paths, { stack: 'bootstrap', env: null }),
    { env, capture: true }
  );
  if (shown.status !== 0)
    throw new Error(
      'Could not read alert delivery configuration from encrypted state'
    );
  const output = record(stateOutputs(shown.stdout)['alert_delivery_check']);
  const config = record(output['value']);
  for (const key of [
    'stackUrl',
    'apiUrl',
    'token',
    'webhookUrl',
    'hookId',
    'integrationId',
    'routeId',
    'responderId',
    'responderUsername',
  ]) {
    if (typeof config[key] !== 'string' || config[key].length === 0)
      throw new Error(`Alerting apply did not provide ${key}`);
  }
  const check = new AlertDeliveryCheck(
    {
      ...config,
      githubToken: required('GITHUB_ADMIN_TOKEN'),
    } as AlertDeliveryConfiguration,
    createGlobalHttpClient(),
    wallClock,
    wallTimers
  );
  const evidence = await check.run({
    repository: required('GITHUB_REPOSITORY'),
    repositoryId: required('GITHUB_REPOSITORY_ID'),
    runId: required('GITHUB_RUN_ID'),
    runAttempt: required('GITHUB_RUN_ATTEMPT'),
    sha: required('GITHUB_SHA'),
  });
  console.log(
    JSON.stringify({
      ...evidence,
      observed: [
        'project webhook',
        'IRM incident',
        'mobile notification attempt',
        'incident resolved',
      ],
      handsetReceipt: 'not observable by this check',
    })
  );
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : 'Alert delivery verification failed'
  );
  process.exitCode = 1;
}
